"""Read-only streaming watchlist. IB Gateway socket callbacks -> JSON lines."""
import asyncio
import json
import sys
from ib_async import Stock, Index, Contract, Option
from ibkr_market_worker import QuoteReader, clear_quote, nonnegative
from ibkr import number, stamp


def emit(value):
    print(json.dumps(value, allow_nan=False), flush=True)


def quote_row(symbol, t, holding=False):
    last, bid, ask, close = (nonnegative(v) for v in (t.last, t.bid, t.ask, t.close))
    price = last if last is not None else (bid + ask) / 2 if bid is not None and ask is not None and ask >= bid else close
    basis='最近成交' if last is not None else '买卖中间价' if bid is not None and ask is not None and ask >= bid else '收盘价'
    if holding:
        mid=(bid+ask)/2 if bid is not None and ask is not None and ask >= bid else None
        price=mid if mid is not None else last
        basis='买卖中间价' if mid is not None else '最近成交'
    return dict(symbol=symbol, price=price, bid=bid, ask=ask, volume=nonnegative(t.volume),
                changePercent=(price-close)/close*100 if price is not None and close and close > 0 else None,
                marketDataType=t.marketDataType or None, receivedAt=stamp(),
                basis=basis)


async def main():
    reader=QuoteReader()
    ib=reader.ib
    desired=set()
    ticks={}
    failed=set()
    config={}
    contracts={}
    requests=asyncio.Queue()
    def changed(changed_ticks):
        rows=[quote_row(s,t,s in contracts) for s,t in ticks.items() if t in changed_ticks]
        if rows: emit(dict(type='quotes',quotes=rows))
    ib.pendingTickersEvent += changed
    def error(req_id,code,message,*args):
        if code in (1100,1300): emit(dict(type='status',connected=False,message='IBKR 上游连接中断，正在重连'))
        elif req_id >= 0 and code not in (2104,2106,2158):
            symbol=next((s for s,t in ticks.items() if getattr(ib.wrapper,'reqId2Ticker',{}).get(req_id) is t),None)
            emit(dict(type='quoteError',symbol=symbol,message=f'IBKR {code}: {message}'))
    ib.errorEvent += error
    async def read():
        while True:
            line=await asyncio.to_thread(sys.stdin.readline)
            if not line: await requests.put(None);return
            await requests.put(json.loads(line))
    task=asyncio.create_task(read())
    async def subscribe(symbol):
        try:
            aliases={'^GSPC':'SPX','SPXW':'SPX','^NDX':'NDX','^VIX':'VIX','^RUT':'RUT'}
            name=aliases.get(symbol,symbol)
            exchange={'SPX':'CBOE','NDX':'NASDAQ','VIX':'CBOE','RUT':'RUSSELL'}.get(name)
            currency='CAD' if name.endswith('.TO') else 'USD'
            contract=Index(name,exchange,'USD') if exchange else Stock(name[:-3] if currency=='CAD' else name.replace('.',' '),'SMART',currency,primaryExchange='TSE' if currency=='CAD' else '')
            leg=contracts.get(symbol)
            if leg:
                kind=leg['assetType']
                if kind not in ('STK','ETF','OPT','FUND','FUT','FOP','CASH'):
                    raise ValueError('此资产不支持 IBKR 推送')
                if leg.get('conId'):
                    contract=Contract(conId=leg['conId'],exchange=leg.get('exchange') or ('FUNDSERV' if kind=='FUND' else 'SMART'))
                elif kind in ('STK','ETF'):
                    contract=Stock(leg['symbol'].replace('.',' '),leg.get('exchange') or 'SMART',leg['currency'],primaryExchange=leg.get('primaryExchange') or '')
                elif kind=='OPT':
                    contract=Option(leg['symbol'],leg['expiry'],leg['strike'],leg['right'],'SMART',currency=leg['currency'],multiplier=str(leg.get('multiplier') or ''))
                elif kind=='FUND':
                    contract=Contract(secType='FUND',symbol=leg['symbol'],exchange=leg.get('exchange') or 'FUNDSERV',currency=leg['currency'])
                else:
                    raise ValueError('此资产需要明确的 IBKR 合约编号')
            found=await asyncio.wait_for(ib.qualifyContractsAsync(contract),8)
            if not found or found[0] is None: raise ValueError('IBKR 无法识别此代码')
            existing=next((t for t in ticks.values() if t.contract.conId==found[0].conId),None)
            if existing is not None:
                ticks[symbol]=existing
                emit(dict(type='quotes',quotes=[quote_row(symbol,existing,symbol in contracts)]))
                return
            ib.reqMarketDataType(3)
            tick=ib.reqMktData(found[0],'',False,False)
            clear_quote(tick);ticks[symbol]=tick
        except Exception as e:
            failed.add(symbol);emit(dict(type='quoteError',symbol=symbol,message=str(e) or '合约识别超时'))
    try:
        while True:
            try:
                req=await asyncio.wait_for(requests.get(),3)
                if req is None:break
                contracts={c['key']:c for c in req.get('contracts',[])}
                desired=set(req.get('symbols',[]))|set(contracts)
                config=req
                failed.clear()
            except asyncio.TimeoutError: pass
            if not desired:
                for t in ticks.values():ib.cancelMktData(t.contract)
                ticks.clear();continue
            try:
                previous=reader.connection
                was_connected=ib.isConnected()
                await reader.ensure_connected(config)
                if not was_connected or previous!=reader.connection:
                    ticks.clear();failed.clear()
                    emit(dict(type='reset'))
                for s in list(ticks):
                    if s not in desired:
                        removed=ticks.pop(s)
                        if not any(t is removed for t in ticks.values()):ib.cancelMktData(removed.contract)
                for s in desired-set(ticks)-failed:
                    await subscribe(s)
                emit(dict(type='status',connected=True,message='IBKR 行情推送已连接'))
            except Exception as e:
                emit(dict(type='status',connected=False,message=str(e) or 'Gateway 连接失败'))
    finally:
        task.cancel();ib.disconnect()

if __name__=='__main__':asyncio.run(main())
