"""Option-chain integration adapted from AllYouNeedIsWheel core/connection.py.
Upstream Apache-2.0; full source/license: ../third_party/AllYouNeedIsWheel.
Changes: bounded asynchronous reads, delayed/frozen prices, no fabricated quotes,
no broker order methods. Runs in a separate process from portfolio/history.
"""
import asyncio
import json
import sys
from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo
from ib_async import Stock, Option, Index, Contract
from ibkr import Reader, number, stamp

def clear_quote(ticker):
    # ib_async reuses Ticker objects across subscriptions; discard the old snapshot.
    for field in ('bid', 'ask', 'last', 'close', 'volume', 'callOpenInterest', 'putOpenInterest'):
        setattr(ticker, field, float('nan'))
    ticker.bidGreeks = ticker.askGreeks = ticker.lastGreeks = ticker.modelGreeks = None
    ticker.time = None
    ticker.marketDataType = 0

def nonnegative(value):
    n = number(value)
    return n if n is not None and n >= 0 else None

class QuoteReader(Reader):
    async def ensure_connected(self, req):
        port, client = req.get('port', 4001), req.get('clientId', 72)
        if not isinstance(port, int) or not 1 <= port <= 65535 or not isinstance(client, int) or not 1 <= client <= 999999:
            raise ValueError('无效端口或 Client ID')
        if self.connection != (port, client) or not self.ib.isConnected():
            self.ib.disconnect()
            # Quotes need the API handshake, not account/position synchronization.
            self.ib.wrapper.clientId = client
            await self.ib.client.connectAsync('127.0.0.1', port, client, timeout=5)
            self.connection = (port, client)
            self.upstream_ok = True
        if not self.upstream_ok:
            raise ConnectionError('Gateway 与 IB 服务器断开，请检查登录及网络状态')

async def chain(reader, req):
    symbol = req['symbol']
    aliases = {'^GSPC':'SPX', 'SPXW':'SPX', '^NDX':'NDX', '^VIX':'VIX', '^RUT':'RUT'}
    symbol = aliases.get(symbol, symbol)
    index_exchange = {'SPX':'CBOE','NDX':'NASDAQ','VIX':'CBOE','RUT':'RUSSELL'}.get(symbol)
    otm = float(req.get('otm', 5))
    if not symbol or len(symbol) > 16 or not all(c in 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.-' for c in symbol) or not 0 <= otm <= 50:
        raise ValueError('请输入有效美股代码和 0–50% 的 OTM 距离')
    await reader.ensure_connected(req)
    ib = reader.ib
    ib.reqMarketDataType(3)  # IBKR prefers live when entitled, otherwise delayed.
    stocks = await asyncio.wait_for(ib.qualifyContractsAsync(Index(symbol, index_exchange, 'USD') if index_exchange else Stock(symbol.replace('.', ' '), 'SMART', 'USD')), 6)
    if len(stocks) != 1 or stocks[0] is None or not getattr(stocks[0], 'conId', 0):
        raise ValueError('IBKR 无法识别该股票、ETF 或指数')
    stock = stocks[0]
    params = await asyncio.wait_for(ib.reqSecDefOptParamsAsync(stock.symbol, '', 'IND' if index_exchange else 'STK', stock.conId), 10)
    choices = [c for c in params if c.exchange == 'SMART' and c.multiplier == '100' and (index_exchange or c.tradingClass == stock.symbol)]
    if not choices and index_exchange:
        choices = [c for c in params if c.exchange == index_exchange and c.multiplier == '100']
    if not choices:
        raise ValueError('未找到标准美股期权链；调整合约暂不自动推断')
    classes = sorted(set(c.tradingClass for c in choices))
    requested_class = req.get('tradingClass') or ('SPXW' if symbol == 'SPX' and 'SPXW' in classes else stock.symbol)
    chosen = next((c for c in choices if c.tradingClass == requested_class), None)
    if chosen is None:
        raise ValueError('所选合约系列不属于当前期权链')
    now = datetime.now(ZoneInfo('America/New_York'))
    cutoff = now + timedelta(days=1) if now.hour >= 16 else now
    today = cutoff.strftime('%Y%m%d')
    expiries = sorted(e for e in chosen.expirations if e >= today)
    if not expiries:
        raise ValueError('IBKR 未提供有效到期日')
    expiry = req.get('expiry') or expiries[0]
    if expiry not in expiries:
        raise ValueError('所选到期日不属于当前期权链')
    ticker = ib.reqMktData(stock, '', False, False)
    clear_quote(ticker)
    try:
        for _ in range(20):
            await asyncio.sleep(.15)
            if number(ticker.marketPrice()) and ticker.marketPrice() > 0:
                break
        spot = number(ticker.marketPrice())
        spot_source = 'IBKR 报价（可延迟／冻结）'
    finally:
        ib.cancelMktData(stock)
    if not spot or spot <= 0:
        bars = await ib.reqHistoricalDataAsync(stock, endDateTime='', durationStr='5 D', barSizeSetting='1 day',
                whatToShow='TRADES', useRTH=True, formatDate=2, timeout=7)
        spot = number(bars[-1].close) if bars else None
        spot_source = f'IBKR 日线收盘（{bars[-1].date}）' if bars else ''
    if not spot or spot <= 0:
        raise ValueError('无法获取标的参考价；请检查 IBKR 行情权限')
    contracts = []
    all_strikes = sorted(s for s in chosen.strikes if s > 0)
    center = float(req.get('center') or spot)
    count = str(req.get('count', '10'))
    if count not in ('10', '20', 'all'):
        raise ValueError('显示数量必须为 10、20 或全部')
    paired = all_strikes if count == 'all' else sorted(sorted(all_strikes, key=lambda s: abs(s-center))[:int(count)])
    for right in ('P', 'C'):
        for strike in paired:
            contracts.append(Option(stock.symbol, expiry, strike, right, chosen.exchange,
                multiplier=chosen.multiplier, currency='USD', tradingClass=chosen.tradingClass))
    options = []
    qualified_count = 0
    # Bound subscriptions and qualification requests even for the full chain.
    for start in range(0, len(contracts), 40):
        if start:
            ib.reqMarketDataType(3)
        batch = await chain_batch(ib, contracts[start:start + 40])
        options.extend(batch)
        qualified_count += len(batch)
    if not options:
        raise ValueError('目标行权价附近没有可用合约')
    return dict(tradingClass=chosen.tradingClass, tradingClasses=classes, underlyingSecType='IND' if index_exchange else 'STK', source='IBKR', availableStrikes=all_strikes, symbol=symbol, spot=spot, spotSource=spot_source, expiries=expiries,
                expiry=expiry, otm=otm, options=sorted(options,key=lambda o:(o['right'],o['strike'])),
                fetchedAt=stamp(), partial=qualified_count < len(contracts) or any(o['bid'] is None or o['ask'] is None for o in options))

async def chain_batch(ib, contracts):
    qualified = await asyncio.wait_for(ib.qualifyContractsAsync(*contracts), 10)
    # ib_async preserves request slots and returns None for unqualified contracts.
    qualified = [c for c in qualified if c is not None and getattr(c, 'conId', 0) > 0]
    if not qualified:
        return []
    ticks = []
    try:
        for c in qualified:
            t = ib.reqMktData(c, '', False, False)
            # Ticker defaults to 1 even before any server reply: do not label it live.
            clear_quote(t)
            ticks.append((c, t))
        for _ in range(40):
            await asyncio.sleep(.15)
            if all(nonnegative(t.bid) is not None and nonnegative(t.ask) is not None for _,t in ticks):
                break
        # Outside market hours, request frozen data for contracts with no price.
        missing = [(i,c,t) for i,(c,t) in enumerate(ticks)
                   if all(nonnegative(v) is None for v in (t.bid,t.ask,t.last))]
        if missing:
            for i,c,t in missing:
                ib.reqMarketDataType(2 if t.marketDataType == 1 else 4)
                ib.cancelMktData(c)
                t = ib.reqMktData(c, '', False, False)
                clear_quote(t)
                ticks[i] = (c,t)
            await asyncio.sleep(6)
        options = []
        for c,t in ticks:
            g = t.modelGreeks or t.bidGreeks or t.askGreeks
            bid,ask = nonnegative(t.bid),nonnegative(t.ask)
            mid = (bid+ask)/2 if bid is not None and ask is not None and ask >= bid else None
            options.append(dict(conId=c.conId, symbol=c.symbol, localSymbol=c.localSymbol,
                expiry=c.lastTradeDateOrContractMonth, right=c.right, strike=c.strike,
                multiplier=number(c.multiplier), currency=c.currency,
                bid=bid, ask=ask, mid=mid, last=nonnegative(t.last),
                delta=number(g.delta) if g else None, iv=number(g.impliedVol) if g else None,
                volume=nonnegative(getattr(t, 'volume', None)),
                openInterest=nonnegative(getattr(t, 'callOpenInterest' if c.right == 'C' else 'putOpenInterest', None)),
                marketDataType=t.marketDataType or None, receivedAt=t.time.isoformat() if t.time else None))
        return options
    finally:
        for c,_ in ticks:
            ib.cancelMktData(c)

async def quotes(reader, req):
    unique, indexes, keys = [], [], {}
    for leg in req.get('legs', []):
        key = str(leg['conId']) if leg.get('conId') else json.dumps({k: leg.get(k) for k in
            ('symbol', 'assetType', 'currency', 'expiry', 'strike', 'right', 'multiplier', 'exchange', 'primaryExchange')}, sort_keys=True)
        if key not in keys:
            keys[key] = len(unique)
            unique.append(leg)
        indexes.append(keys[key])
    result = await quotes_unique(reader, {**req, 'legs': unique})
    return [result[i] for i in indexes]

async def quotes_unique(reader, req):
    await reader.ensure_connected(req)
    ib = reader.ib
    legs = req.get('legs', [])
    if not 1 <= len(legs) <= 20:
        raise ValueError('每批最多读取 20 个合约')
    results = [dict(error='合约无法识别或不支持自动报价') for _ in legs]
    ticks = []
    async def qualify(i, leg):
        kind = leg.get('assetType')
        if kind not in ('STK', 'ETF', 'OPT', 'FUND'):
            return
        if leg.get('conId'):
            contract = Contract(conId=leg['conId'], exchange=leg.get('exchange') or ('FUNDSERV' if kind == 'FUND' else 'SMART'))
        elif kind in ('STK', 'ETF'):
            contract = Stock(leg['symbol'].replace('.', ' '), leg.get('exchange') or 'SMART', leg['currency'], primaryExchange=leg.get('primaryExchange') or '')
        elif kind == 'FUND':
            contract = Contract(secType='FUND', symbol=leg['symbol'], exchange=leg.get('exchange') or 'FUNDSERV', currency=leg['currency'])
        else:
            contract = Option(leg['symbol'], leg['expiry'], leg['strike'], leg['right'],
                              'SMART', currency=leg['currency'], multiplier=str(leg.get('multiplier') or ''))
        try:
            found = await asyncio.wait_for(ib.qualifyContractsAsync(contract), 8)
            if len(found) == 1 and found[0] is not None and found[0].conId:
                ib.reqMarketDataType(3)
                tick = ib.reqMktData(found[0], '', False, False)
                clear_quote(tick)
                ticks.append((i, found[0], tick))
        except (ValueError, asyncio.TimeoutError):
            pass
    try:
        await asyncio.gather(*(qualify(i, l) for i, l in enumerate(legs)))
        await asyncio.sleep(5)
        for j, (i, c, t) in enumerate(ticks):
            if all(nonnegative(v) is None for v in (t.bid, t.ask, t.last)):
                ib.cancelMktData(c)
                ib.reqMarketDataType(2 if t.marketDataType == 1 else 4)
                t = ib.reqMktData(c, '', False, False)
                clear_quote(t)
                ticks[j] = (i, c, t)
        await asyncio.sleep(5)
        for i, c, t in ticks:
            bid, ask = nonnegative(t.bid), nonnegative(t.ask)
            mid = (bid + ask) / 2 if bid is not None and ask is not None and ask >= bid else None
            price = mid if mid is not None else nonnegative(t.last)
            if price is not None:
                results[i] = dict(conId=c.conId, price=price, bid=bid, ask=ask, basis='买卖中间价' if mid is not None else '最近成交价',
                                  marketDataType=t.marketDataType or None, fetchedAt=stamp())
            else:
                results[i] = dict(error='IBKR 未返回可用报价')
        return results
    finally:
        for _, c, _ in ticks:
            ib.cancelMktData(c)

async def search(reader, req):
    query = str(req.get('query', '')).strip()
    if not 1 <= len(query) <= 80:
        raise ValueError('请输入 1–80 个字符')
    await reader.ensure_connected(req)
    loop = asyncio.get_running_loop()
    wait = 1.05 - (loop.time() - getattr(reader, 'last_search', -100))
    if wait > 0:
        await asyncio.sleep(wait)
    reader.last_search = loop.time()
    pattern = {'SPXW':'SPX','^GSPC':'SPX','^NDX':'NDX','^VIX':'VIX','^RUT':'RUT'}.get(query.upper(), query)
    if req.get('fund'):
        matches = await reader.ib.reqMatchingSymbolsAsync(pattern)
        funds = [m.contract for m in (matches or []) if m.contract.secType == 'FUND' and m.contract.currency == req.get('currency', 'USD')]
        if funds:
            return [dict(conId=c.conId,symbol=c.symbol,name=c.description or c.symbol,exchange=c.primaryExchange or c.exchange or 'FUNDSERV',currency=c.currency,type='FUND',hasOptions=False,supported=False) for c in funds]
        details = await asyncio.wait_for(reader.ib.reqContractDetailsAsync(Contract(symbol=pattern.upper(), secType='FUND', exchange='FUNDSERV', currency=req.get('currency', 'USD'))), 8)
        return [dict(conId=d.contract.conId,symbol=d.contract.symbol,name=d.longName or d.contract.symbol,
                     exchange=d.contract.exchange or 'FUNDSERV',currency=d.contract.currency,type='FUND',hasOptions=False,supported=False) for d in details]
    rows = await reader.ib.reqMatchingSymbolsAsync(pattern)
    if rows is None:
        raise TimeoutError('IBKR 搜索超时，请检查 Gateway 连接后重试')
    results = []
    us_exchanges = {'NYSE','NASDAQ','ARCA','AMEX','BATS','ISLAND','IEX','EDGEA','EDGX','NYSEARCA','NYSEAMERICAN'}
    for row in rows:
        c = row.contract
        supported = c.currency == 'USD' and ((c.secType == 'STK' and c.primaryExchange in us_exchanges and c.symbol not in {'SPX','NDX','VIX','RUT'}) or (c.secType == 'IND' and c.symbol in {'SPX','NDX','VIX','RUT'}))
        results.append(dict(conId=c.conId, symbol=c.symbol.replace(' ', '.') if c.secType == 'STK' else c.symbol, name=c.description or c.symbol,
            exchange=c.primaryExchange or c.exchange, currency=c.currency, type=c.secType,
            hasOptions='OPT' in row.derivativeSecTypes, supported=supported))
    return sorted(results, key=lambda r:(not r['supported'], r['symbol'].upper()!=pattern.upper(), r['symbol']))

async def main():
    reader=QuoteReader()
    try:
        while True:
            line=await asyncio.to_thread(sys.stdin.readline)
            if not line: break
            req={}
            try:
                req=json.loads(line)
                result=await asyncio.wait_for(quotes(reader,req) if req.get('action') == 'quotes' else search(reader,req) if req.get('action') == 'search' else chain(reader,req),900 if req.get('count') == 'all' else 50)
                reply={'id':req['id'],'result':result}
            except Exception as e:
                reply={'id':req.get('id'),'error':str(e) or 'IBKR 期权读取超时，请检查 Gateway 的服务器连接后重试'}
            print(json.dumps(reply,allow_nan=False),flush=True)
    finally:
        reader.ib.disconnect()
if __name__=='__main__':
    asyncio.run(main())
