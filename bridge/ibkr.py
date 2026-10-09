"""Read-only IB Gateway bridge. JSON lines over private child-process pipes.
No HTTP listener or order placement methods; execution history is read-only.
"""
import asyncio
import json
import logging
import math
import sys
from datetime import datetime, timezone, date
from ib_async import IB, StartupFetch, Stock, Index, ExecutionFilter

logging.basicConfig(stream=sys.stderr, level=logging.CRITICAL)

def stamp():
    return datetime.now(timezone.utc).isoformat()

def number(value):
    try:
        n = float(value)
        return n if math.isfinite(n) and abs(n) < 1e100 else None
    except (ValueError, TypeError):
        return None

def position_row(p, item=None):
    c = p.contract
    multiplier = number(c.multiplier)
    # IB avgCost includes the derivative contract multiplier. Keep raw and
    # normalized costs separate; never guess an unknown derivative multiplier.
    divisor = multiplier if c.secType in ('OPT', 'FOP', 'FUT') else 1
    cost = number(p.avgCost)
    return {
        'conId': c.conId, 'symbol': c.symbol, 'localSymbol': c.localSymbol,
        'secType': c.secType, 'currency': c.currency, 'expiry': c.lastTradeDateOrContractMonth,
        'strike': number(c.strike), 'right': c.right, 'multiplier': multiplier,
        'quantity': number(p.position), 'avgCost': cost,
        'unitCost': cost / divisor if cost is not None and divisor else None,
        'marketPrice': number(item.marketPrice) if item else None,
        'marketValue': number(item.marketValue) if item else None,
        'unrealizedPnl': number(item.unrealizedPNL) if item else None,
        'realizedPnl': number(item.realizedPNL) if item else None,
    }


def execution_row(fill, report=None):
    c, e = fill.contract, fill.execution
    at = e.time if e.time.tzinfo else e.time.replace(tzinfo=timezone.utc)
    return {'execId': e.execId, 'account': e.acctNumber, 'at': at.astimezone(timezone.utc).isoformat(),
        'conId': c.conId, 'symbol': c.symbol, 'localSymbol': c.localSymbol, 'assetType': c.secType,
        'currency': c.currency, 'side': e.side, 'quantity': number(e.shares), 'price': number(e.price),
        'expiry': c.lastTradeDateOrContractMonth, 'right': c.right, 'strike': number(c.strike),
        'multiplier': number(c.multiplier) if c.secType in ('OPT','FOP','FUT') else 1,
        **(report or {'commission': None, 'reportCurrency': None, 'realizedPnl': None})}

class Reader:
    def __init__(self):
        self.ib = IB()
        self.reports = {}
        self.report_ready = asyncio.Event()
        original_report = self.ib.wrapper.commissionReport
        def capture_report(report):
            # ib_async replaces IB's unset realizedPNL with zero. Preserve raw
            # availability before that normalization; missing is never profit=0.
            self.reports[report.execId] = {'commission': number(report.commission),
                'reportCurrency': report.currency or None, 'realizedPnl': number(report.realizedPNL)}
            self.report_ready.set()
            original_report(report)
        self.ib.wrapper.commissionReport = capture_report
        self.connection = None
        self.selected = None
        self.account_updated = {}
        self.position_updated = {}
        self.upstream_ok = True
        self.ib.accountValueEvent += lambda v: self.account_updated.update({v.account: stamp()})
        self.ib.updatePortfolioEvent += lambda p: self.position_updated.update({p.account: stamp()})
        self.ib.errorEvent += self.on_error

    def on_error(self, req_id, code, message, *args):
        if code in (1100, 1300):
            self.upstream_ok = False
        elif code in (1101, 1102):
            # Force a fresh subscription and account reconciliation next request.
            self.connection = None

    async def ensure_connected(self, req):
        port = req.get('port', 4001)
        client = req.get('clientId', 71)
        if not isinstance(port, int) or not 1 <= port <= 65535 or not isinstance(client, int) or not 1 <= client <= 999999:
            raise ValueError('无效端口或 Client ID')
        if self.connection != (port, client) or not self.ib.isConnected():
            self.ib.disconnect()
            self.selected = None
            self.account_updated.clear()
            self.position_updated.clear()
            await self.ib.connectAsync('127.0.0.1', port, clientId=client, readonly=True,
                timeout=5, raiseSyncErrors=True, fetchFields=StartupFetch.POSITIONS)
            self.connection = (port, client)
            self.upstream_ok = True
        if not self.upstream_ok:
            raise ConnectionError('Gateway 与 IB 服务器断开，请检查 Gateway 登录及网络状态')
    async def executions(self, account):
        fills = await asyncio.wait_for(self.ib.reqExecutionsAsync(ExecutionFilter(acctCode=account)), 5)
        # Include cached fills so reports delivered after a previous snapshot are
        # persisted at the next sync, even across the request's date boundary.
        fills = {f.execution.execId: f for f in [*self.ib.fills(), *fills]
                 if f.execution.acctNumber == account}
        deadline = asyncio.get_running_loop().time() + 1
        while any(key not in self.reports for key in fills):
            remaining = deadline - asyncio.get_running_loop().time()
            if remaining <= 0: break
            self.report_ready.clear()
            try: await asyncio.wait_for(self.report_ready.wait(), remaining)
            except asyncio.TimeoutError: break
        return [execution_row(f, self.reports.get(key)) for key, f in fills.items()
                if f.contract.secType != 'BAG']

    async def snapshot(self, req):
        await self.ensure_connected(req)
        port = req.get('port', 4001)
        accounts = self.ib.managedAccounts()
        if not accounts:
            raise ConnectionError('Gateway 尚未返回可访问账户，请完成登录')
        account = req.get('account') or accounts[0]
        if account not in accounts:
            raise ValueError('所选账户不在 Gateway 授权账户列表中')
        if self.selected != account or req.get('refresh'):
            if self.selected:
                self.ib.client.reqAccountUpdates(False, self.selected)
            await asyncio.wait_for(self.ib.reqAccountUpdatesAsync(account), 10)
            self.selected = account
        # Explicit positionEnd barrier: zero means completed empty snapshot.
        positions = await asyncio.wait_for(self.ib.reqPositionsAsync(), 8)
        values = self.ib.accountValues(account)
        fields = [{'tag': v.tag, 'value': v.value, 'currency': v.currency}
                  for v in values if not v.modelCode]
        if not fields:
            raise ConnectionError('账户资金尚未完成同步，请稍后重试')
        summary = await asyncio.wait_for(self.ib.accountSummaryAsync(account), 8)
        existing = {(f['tag'], f['currency']) for f in fields}
        fields.extend({'tag': v.tag, 'value': v.value, 'currency': v.currency}
                      for v in summary if (v.tag, v.currency) not in existing)
        currency = next((v['value'] for v in fields if v['tag'] == 'Currency' and v['currency'] == 'BASE'), None)
        if not currency or currency == 'BASE':
            currency = next((v['currency'] for v in fields if v['tag'] == 'NetLiquidation' and v['currency'] not in ('', 'BASE')), None)
        marks = {p.contract.conId: p for p in self.ib.portfolio(account)}
        rows = [position_row(p, marks.get(p.contract.conId)) for p in positions if p.account == account and p.position != 0]
        try:
            executions = await self.executions(account)
            executions_complete = True
        except Exception:
            executions = []  # Never erase locally persisted history on failure.
            executions_complete = False
        return {'executionsComplete': executions_complete, 'executions': executions, 'connected': True, 'readOnly': True, 'host': '127.0.0.1', 'port': port,
            'accounts': accounts, 'account': account, 'baseCurrency': currency,
            'syncedAt': stamp(), 'accountUpdatedAt': self.account_updated.get(account),
            'portfolioUpdatedAt': self.position_updated.get(account),
            'positionsComplete': True, 'fields': fields, 'positions': rows}

    async def history(self, req):
        symbol = str(req.get('symbol', '')).strip().upper()
        ranges = {
            '1D': ('1 D', '5 mins'), '5D': ('1 W', '15 mins'),
            '1M': ('1 M', '1 hour'), '6M': ('6 M', '1 day'),
            'YTD': ('1 Y', '1 day'), '1Y': ('1 Y', '1 day'),
            '2Y': ('2 Y', '1 day'), '5Y': ('5 Y', '1 week'), 'MAX': ('20 Y', '1 month'),
        }
        range_key = req.get('range', '6M')
        if range_key not in ranges or not symbol or len(symbol) > 24:
            raise ValueError('无效代码或图表周期')
        await self.ensure_connected(req)
        self.ib.reqMarketDataType(3)
        self.ib.RaiseRequestErrors = True
        # Explicit US stock/ETF routing; never silently reinterpret foreign symbols.
        if symbol in ('SPX', 'SPXW', 'NDX', 'RUT', '^RUT', 'VIX', '^VIX', '^GSPC', '^NDX', '^DJI'):
            symbols = {'SPX': ('SPX','CBOE'), 'SPXW': ('SPX','CBOE'), 'NDX': ('NDX','NASDAQ'), 'RUT': ('RUT','RUSSELL'), '^RUT': ('RUT','RUSSELL'), 'VIX': ('VIX', 'CBOE'), '^VIX': ('VIX', 'CBOE'),
                       '^GSPC': ('SPX', 'CBOE'), '^NDX': ('NDX', 'NASDAQ'), '^DJI': ('INDU', 'NYSE')}
            name, exchange = symbols[symbol]
            contract = Index(name, exchange, 'USD')
        else:
            if any(char not in 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.- ' for char in symbol):
                raise ValueError('IBKR 图表目前支持美股、ETF 和常用美股指数')
            contract = Stock(symbol.replace('.', ' '), 'SMART', 'USD')
        try:
            qualified = await asyncio.wait_for(self.ib.qualifyContractsAsync(contract), 8)
            if len(qualified) != 1 or qualified[0] is None or not getattr(qualified[0], 'conId', 0):
                raise ValueError('IBKR 无法唯一识别该合约，请检查代码')
            duration, interval = ranges[range_key]
            bars = await self.ib.reqHistoricalDataAsync(
                qualified[0], endDateTime='', durationStr=duration,
                barSizeSetting=interval, whatToShow='TRADES', useRTH=True,
                formatDate=2, keepUpToDate=False, timeout=25)
            candles = {}
            for bar in bars:
                dt = bar.date
                if not isinstance(dt, datetime):
                    dt = datetime.combine(dt, datetime.min.time(), tzinfo=timezone.utc)
                elif dt.tzinfo is None:
                    raise ValueError('IBKR 返回了缺少时区的时间')
                if range_key == 'YTD' and dt.year != datetime.now(timezone.utc).year:
                    continue
                values = [number(v) for v in (bar.open, bar.high, bar.low, bar.close)]
                if any(v is None for v in values):
                    continue
                timestamp = int(dt.timestamp())
                candles[timestamp] = dict(time=timestamp, open=values[0], high=values[1],
                    low=values[2], close=values[3], volume=max(0, number(bar.volume) or 0))
            if not candles:
                raise ValueError('IBKR 未返回历史 K 线；请检查合约、历史行情权限或稍后重试')
            return {'candles': [candles[t] for t in sorted(candles)], 'source': 'IBKR Gateway',
                    'interval': interval, 'fetchedAt': stamp(), 'requestedMarketDataType': 'delayed',
                    'note': '已允许延迟行情；历史数据权限由 IBKR 决定，实际更新时间以最新 K 线为准。',
                    'conId': qualified[0].conId, 'currency': qualified[0].currency}
        finally:
            self.ib.RaiseRequestErrors = False

async def main():
    reader = Reader()
    try:
        while True:
            line = await asyncio.to_thread(sys.stdin.readline)
            if not line:
                break
            req = {}
            try:
                req = json.loads(line)
                action = reader.history if req.get('action') == 'history' else reader.snapshot
                result = await asyncio.wait_for(action(req), 40 if req.get('action') == 'history' else 22)
                reply = {'id': req['id'], 'result': result}
            except Exception as e:
                if req.get('action') != 'history':
                    reader.ib.disconnect()
                    reader.connection = None
                message = str(e) or '连接或账户同步超时，请检查 Gateway 的 API 设置和登录状态'
                reply = {'id': req.get('id'), 'error': message}
            print(json.dumps(reply, allow_nan=False), flush=True)
    finally:
        reader.ib.disconnect()

if __name__ == '__main__':
    asyncio.run(main())
