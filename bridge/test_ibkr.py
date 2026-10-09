import asyncio
import unittest
from types import SimpleNamespace as NS
from unittest.mock import AsyncMock
from ibkr import Reader, number, position_row

class SerializationTests(unittest.TestCase):
    def test_unset_is_not_zero(self):
        for value in (None, '', 'NaN', float('inf'), 1.7976931348623157e308):
            self.assertIsNone(number(value))
        self.assertEqual(number('0'), 0)
        self.assertEqual(number('-52.5'), -52.5)

    def test_option_cost_and_signed_values(self):
        c=NS(conId=1,symbol='TEST',localSymbol='TEST C100',secType='OPT',currency='USD',lastTradeDateOrContractMonth='20261218',strike=100,right='C',multiplier='100')
        p=NS(contract=c,avgCost=250,position=-2)
        row=position_row(p,NS(marketPrice=3,marketValue=-600,unrealizedPNL=-100,realizedPNL=float('nan')))
        self.assertEqual(row['unitCost'], 2.5)
        self.assertEqual(row['avgCost'], 250)
        self.assertEqual(row['marketValue'], -600)
        self.assertIsNone(row['realizedPnl'])
        c.multiplier=''
        self.assertIsNone(position_row(p)['unitCost'])
        self.assertIsNone(position_row(p)['marketPrice'])
        c.secType='STK'
        self.assertEqual(position_row(p)['unitCost'], 250)

class SnapshotTests(unittest.IsolatedAsyncioTestCase):
    async def test_scope_currency_and_completion(self):
        r=Reader();r.connection=(4001,71)
        c=NS(conId=1,symbol='TEST',localSymbol='TEST',secType='STK',currency='USD',lastTradeDateOrContractMonth='',strike=0,right='',multiplier='')
        fake=NS(isConnected=lambda:True,managedAccounts=lambda:['U1','U2'],
            reqAccountUpdatesAsync=AsyncMock(), accountSummaryAsync=AsyncMock(return_value=[]), reqPositionsAsync=AsyncMock(return_value=[NS(account='U2',contract=c,position=1,avgCost=4)]),
            accountValues=lambda a:[NS(tag='Currency',value='BASE',currency='BASE',modelCode=''),NS(tag='NetLiquidation',value='100',currency='USD',modelCode='')],
            portfolio=lambda a:[],client=NS(reqAccountUpdates=lambda *args:None))
        r.ib=fake
        x=await r.snapshot({'account':'U1'})
        self.assertEqual(x['positions'],[])
        self.assertTrue(x['positionsComplete'])
        self.assertEqual(x['baseCurrency'],'USD')
        y=await r.snapshot({'account':'U2'})
        self.assertEqual(len(y['positions']),1)
        with self.assertRaises(ValueError):await r.snapshot({'account':'UNKNOWN'})
        r.upstream_ok=False
        with self.assertRaises(ConnectionError):await r.snapshot({'account':'U1'})

class HistoryTests(unittest.IsolatedAsyncioTestCase):
    async def test_resolution_and_sorted_unique_timestamps(self):
        from datetime import datetime, timezone
        r = Reader()
        r.ensure_connected = AsyncMock()
        c = NS(conId=123, currency='USD')
        def bar(hour, close):
            return NS(date=datetime(2026,9,22,hour,0,tzinfo=timezone.utc),
                      open=1,high=3,low=1,close=close,volume=10)
        from unittest.mock import Mock
        r.ib = NS(reqMarketDataType=Mock(), RaiseRequestErrors=False,
                  qualifyContractsAsync=AsyncMock(return_value=[c]),
                  reqHistoricalDataAsync=AsyncMock(return_value=[bar(15,2),bar(14,2),bar(15,3)]))
        result = await r.history({'symbol':'AAPL','range':'1D'})
        self.assertEqual(len(result['candles']),2)
        self.assertLess(result['candles'][0]['time'],result['candles'][1]['time'])
        self.assertEqual(result['candles'][-1]['close'],3)
        self.assertEqual(result['source'],'IBKR Gateway')
        r.ib.reqMarketDataType.assert_called_once_with(3)
        args=r.ib.reqHistoricalDataAsync.call_args.kwargs
        self.assertEqual(args['barSizeSetting'],'5 mins')
        self.assertEqual(args['durationStr'],'1 D')
        self.assertTrue(args['useRTH'])
        self.assertFalse(r.ib.RaiseRequestErrors)

    async def test_empty_history_is_error(self):
        from unittest.mock import Mock
        r=Reader();r.ensure_connected=AsyncMock()
        r.ib=NS(reqMarketDataType=Mock(),RaiseRequestErrors=False,
                qualifyContractsAsync=AsyncMock(return_value=[NS(conId=1,currency='USD')]),
                reqHistoricalDataAsync=AsyncMock(return_value=[]))
        with self.assertRaisesRegex(ValueError,'未返回历史'):
            await r.history({'symbol':'AAPL','range':'6M'})
        self.assertFalse(r.ib.RaiseRequestErrors)

    async def test_invalid_range_does_not_connect(self):
        r=Reader();r.ensure_connected=AsyncMock()
        with self.assertRaises(ValueError):
            await r.history({'symbol':'AAPL','range':'invalid'})
        r.ensure_connected.assert_not_awaited()

class ExecutionTests(unittest.IsolatedAsyncioTestCase):
    async def test_raw_unset_preserved_and_execution_scope(self):
        from datetime import datetime, timezone
        from ib_async import CommissionReport
        from ibkr import execution_row
        r=Reader()
        r.ib.wrapper.commissionReport(CommissionReport(execId='opening',commission=1,currency='USD',realizedPNL=1.7976931348623157e308))
        self.assertIsNone(r.reports['opening']['realizedPnl'])
        r.ib.wrapper.commissionReport(CommissionReport(execId='closing',commission=.1,currency='USD',realizedPNL=-50))
        self.assertEqual(r.reports['closing']['realizedPnl'],-50)
        c=NS(conId=12,symbol='CLS',localSymbol='CLS P380',secType='OPT',currency='USD',lastTradeDateOrContractMonth='20261009',right='P',strike=380,multiplier='100')
        e=NS(execId='closing',acctNumber='U1',time=datetime(2026,10,8,16,tzinfo=timezone.utc),side='BOT',shares=1,price=26)
        f=NS(contract=c,execution=e)
        r.ib=NS(reqExecutionsAsync=AsyncMock(return_value=[f]),fills=lambda:[])
        rows=await r.executions('U1')
        self.assertEqual(rows[0]['realizedPnl'],-50)
        self.assertEqual(rows[0]['commission'],.1)
        self.assertEqual(rows[0]['quantity'],1)
        self.assertIsNone(execution_row(f)['realizedPnl'])
        self.assertEqual(await r.executions('U2'),[])

if __name__=='__main__':unittest.main()

class ConnectionCompatibilityTests(unittest.IsolatedAsyncioTestCase):
    async def test_gateway_and_tws_ports_remain_read_only(self):
        from unittest.mock import Mock
        for port in (4001, 4002, 7496, 7497):
            r = Reader()
            r.ib = NS(isConnected=lambda: False, disconnect=Mock(), connectAsync=AsyncMock())
            await r.ensure_connected({'port': port, 'clientId': 801})
            args = r.ib.connectAsync.call_args
            self.assertEqual(args.args, ('127.0.0.1', port))
            self.assertTrue(args.kwargs['readonly'])
            self.assertEqual(args.kwargs['clientId'], 801)

    async def test_invalid_connection_is_rejected(self):
        r = Reader()
        for port in (0, 65536, '7496'):
            with self.assertRaises(ValueError):
                await r.ensure_connected({'port': port, 'clientId': 801})
