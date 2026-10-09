"""Read-only CSP research snapshots, isolated from the existing option-chain UI."""
import asyncio
import json
import sys
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from ib_async import IB, Stock, Index, Option
from ibkr import number, stamp

def positive(value):
    n = number(value)
    return n if n is not None and n >= 0 else None

def nearby_strikes(strikes, spot):
    values = sorted({s for s in strikes if s > 0})
    return [s for s in values if s < spot][-10:] + [s for s in values if s > spot][:10]

def contract_label(contract):
    return f'{contract.symbol} {contract.lastTradeDateOrContractMonth} {contract.right} {contract.strike:g}'

def clear_prices(ticker):
    ticker.bid = ticker.ask = ticker.bidSize = float('nan')
    ticker.time = None
    ticker.marketDataType = 0

async def frozen_fallback(ib, ticks, wait=asyncio.sleep):
    missing = [(i, c, t) for i, (c, t) in enumerate(ticks)
               if positive(t.bid) is None or positive(t.ask) is None]
    for i, c, t in missing:
        data_type = 2 if t.marketDataType in (1, 2) else 4
        ib.cancelMktData(c)
        ib.reqMarketDataType(data_type)
        replacement = ib.reqMktData(c, '100,101', False, False)
        clear_prices(replacement)
        ticks[i] = (c, replacement)
    if missing:
        await wait(6)

async def nearby_valid_contracts(strikes, spot, make_contract, qualify):
    selected = []
    values = sorted({s for s in strikes if s > 0})
    for candidates in ([s for s in values if s < spot][::-1], [s for s in values if s > spot]):
        side = []
        candidates = candidates[:40]
        while candidates and len(side) < 10:
            batch, candidates = candidates[:10-len(side)], candidates[10-len(side):]
            groups = await asyncio.gather(*(qualify(make_contract(s)) for s in batch))
            side.extend(c for group in groups for c in group if c and c.conId and c.multiplier == '100' and c.right == 'P')
        selected.extend(side[:10])
    return selected

def completed_bars(bars, now=None):
    now = now or datetime.now(ZoneInfo('America/New_York'))
    cutoff = now.date() if (now.hour, now.minute) >= (16, 15) else now.date() - timedelta(days=1)
    result = []
    for b in bars:
        day = b.date.date() if isinstance(b.date, datetime) else b.date
        if day > cutoff:
            continue
        vals = [number(v) for v in (b.open, b.high, b.low, b.close, b.volume)]
        if any(v is None for v in vals):
            continue
        result.append(dict(zip(('open', 'high', 'low', 'close', 'volume'), vals), date=day.isoformat()))
    return result

async def read(req):
    ib = IB()
    errors = []
    connecting = set()
    validating = set()
    skipped = []
    def on_error(request, code, text, contract=None, *args):
        farm = text.rsplit(':', 1)[-1].strip()
        if code == 2119:
            connecting.add(farm)
        elif code == 2104:
            connecting.discard(farm)
        elif code == 200 and contract and contract_label(contract) in validating:
            skipped.append(contract_label(contract))
        elif code not in (2106, 2158, 2108):
            label = contract_label(contract) if contract else f'request {request}'
            errors.append(f'{label} · {code}: {text}')
    ib.errorEvent += on_error
    try:
        ib.wrapper.clientId = req['clientId']
        await ib.client.connectAsync('127.0.0.1', req['port'], req['clientId'], timeout=6)
        symbol = req['symbol']
        raw = Index(symbol.lstrip('^'), 'CBOE', 'USD') if symbol in ('^VIX', '^VIX3M') else Stock(symbol.replace('.', ' '), 'SMART', 'USD')
        details = await asyncio.wait_for(ib.reqContractDetailsAsync(raw), 12)
        details = [d for d in details if d.contract.currency == 'USD']
        if len(details) != 1:
            raise ValueError('无法唯一识别美国上市标的')
        info, stock = details[0], details[0].contract
        bars = await ib.reqHistoricalDataAsync(stock, endDateTime='', durationStr='3 Y', barSizeSetting='1 day', whatToShow='TRADES', useRTH=True, formatDate=1, timeout=35)
        ib.reqMarketDataType(3)
        underlying = ib.reqMktData(stock, '', False, False)
        await asyncio.sleep(3)
        result = dict(symbol=symbol, name=info.longName, stockType=info.stockType, exchange=stock.primaryExchange or stock.exchange, industry=info.industry,
                      bars=completed_bars(bars), spot=positive(underlying.marketPrice()), spotAt=underlying.time.isoformat() if underlying.time else None,
                      marketDataType=underlying.marketDataType if underlying.time else None, options=[], fetchedAt=stamp(), errors=[],
                      coverage=dict(available=0, requested=0, qualified=0, expiries=[], availableExpiries=0, truncated=False))
        if req.get('mode') != 'options' or stock.secType != 'STK':
            return result
        params = await asyncio.wait_for(ib.reqSecDefOptParamsAsync(stock.symbol, '', 'STK', stock.conId), 15)
        chains = [c for c in params if c.exchange == 'SMART' and c.tradingClass == stock.symbol and c.multiplier == '100']
        if not chains:
            raise ValueError('未找到匹配的标准100股合约系列')
        config = req['params']
        today = datetime.now(ZoneInfo('America/New_York')).date()
        expiries = sorted({e for c in chains for e in c.expirations if config['dteMin'] <= (datetime.strptime(e, '%Y%m%d').date()-today).days <= config['dteMax']})
        result['coverage']['availableExpiries'] = len(expiries)
        result['coverage']['expiries'] = expiries[:config['maxExpiries']]
        result['coverage']['truncated'] = len(expiries) > config['maxExpiries']
        contracts = []
        spot = result['spot'] or (result['bars'][-1]['close'] if result['bars'] else None)
        if not spot:
            raise ValueError('标的参考价缺失')
        semaphore = asyncio.Semaphore(8)
        async def qualify(contract):
            async with semaphore:
                label = contract_label(contract)
                validating.add(label)
                try:
                    matches = await asyncio.wait_for(ib.qualifyContractsAsync(contract), 12)
                    if not matches:
                        skipped.append(label)
                    return matches
                except Exception as error:
                    errors.append(f'{label} · 合约验证失败：{str(error) or "超时"}')
                    return []
                finally:
                    validating.discard(label)
        for expiry in result['coverage']['expiries']:
            chain = next((c for c in chains if expiry in c.expirations), None)
            if not chain:
                continue
            make_contract = lambda strike: Option(stock.symbol, expiry, strike, 'P', 'SMART', multiplier='100', currency='USD', tradingClass=stock.symbol)
            valid = await nearby_valid_contracts(chain.strikes, spot, make_contract, qualify)
            contracts.extend(valid)
            result['coverage']['truncated'] |= len(valid) < len(chain.strikes)
            if len(valid) < 20:
                errors.append(f'{stock.symbol} {expiry} · 邻近合约不足：有效 {len(valid)}/20，已限次补选')
        result['coverage']['skippedInvalid'] = sorted(set(skipped))
        contracts = list({c.conId: c for c in contracts}.values())
        result['coverage']['available'] = len(contracts)
        # Distribute the configured total cap evenly across selected expiries.
        buckets = [[c for c in sorted(contracts, key=lambda c: abs(c.strike-spot)) if c.lastTradeDateOrContractMonth == e] for e in result['coverage']['expiries']]
        selected = []
        while any(buckets) and len(selected) < config['maxContracts']:
            for bucket in buckets:
                if bucket and len(selected) < config['maxContracts']:
                    selected.append(bucket.pop(0))
        result['coverage']['truncated'] |= any(buckets)
        result['coverage']['requested'] = len(selected)
        missing_quotes = []
        for start in range(0, len(selected), 20):
            ticks = []
            try:
                ib.reqMarketDataType(3)
                for c in selected[start:start+20]:
                    t = ib.reqMktData(c, '100,101', False, False)
                    clear_prices(t)
                    ticks.append((c, t))
                await asyncio.sleep(8)
                # Streaming requests remain active while the farm reconnects; no duplicate subscriptions.
                for _ in range(2):
                    if not connecting and all(positive(t.bid) is not None and positive(t.ask) is not None for _, t in ticks):
                        break
                    await asyncio.sleep(5)
                await frozen_fallback(ib, ticks)
                for c, t in ticks:
                    if positive(t.bid) is None or positive(t.ask) is None:
                        missing_quotes.append(contract_label(c))
                    g = t.modelGreeks or t.bidGreeks or t.askGreeks
                    result['options'].append(dict(conId=c.conId, expiry=datetime.strptime(c.lastTradeDateOrContractMonth[:8], '%Y%m%d').date().isoformat(),
                        strike=c.strike, multiplier=number(c.multiplier), right=c.right, tradingClass=c.tradingClass,
                        bid=positive(t.bid), ask=positive(t.ask), bidSize=positive(t.bidSize), volume=positive(t.volume), oi=positive(t.putOpenInterest),
                        iv=positive(g.impliedVol) if g else None, delta=number(g.delta) if g else None, gamma=number(g.gamma) if g else None, vega=number(g.vega) if g else None,
                        underlyingPrice=positive(g.undPrice) if g else None, receivedAt=t.time.isoformat() if t.time else None, marketDataType=t.marketDataType if t.time else None))
            finally:
                for c, _ in ticks:
                    ib.cancelMktData(c)
        result['coverage']['qualified'] = len(result['options'])
        result['coverage']['missingQuotes'] = missing_quotes
        if missing_quotes:
            errors.append(f'{len(missing_quotes)}/{len(selected)} 张合约缺少完整买卖报价（已尝试冻结报价）；具体合约保存在完整快照中')
        result['spotAt'] = underlying.time.isoformat() if underlying.time else None
        result['spot'] = positive(underlying.marketPrice())
        result['fetchedAt'] = stamp()
        return result
    finally:
        if 'result' in locals():
            if connecting:
                errors.append('行情连接未就绪：' + ', '.join(sorted(connecting)))
            result['errors'] = list(dict.fromkeys(errors))[:20]
        ib.disconnect()

async def main():
    try:
        req = json.loads(sys.stdin.readline())
        result = await asyncio.wait_for(read(req), 420)
        print(json.dumps({'result': result}, allow_nan=False), flush=True)
    except Exception as error:
        print(json.dumps({'error': str(error) or 'CSP IBKR读取超时'}), flush=True)

if __name__ == '__main__':
    asyncio.run(main())
