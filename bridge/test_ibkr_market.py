import unittest
from types import SimpleNamespace as NS
from unittest.mock import AsyncMock, Mock, patch
from ib_async import Option
from ibkr_market_worker import chain, nonnegative, search

class IbkrMarketTests(unittest.IsolatedAsyncioTestCase):
    def reader(self):
        async def qualify(*contracts):
            for i,c in enumerate(contracts): c.conId=i+1
            return list(contracts)
        def ticker(c,*args):
            return NS(marketPrice=lambda:100,bid=float('nan'),ask=-1,last=float('nan'),
                      modelGreeks=None,bidGreeks=None,askGreeks=None,marketDataType=4,time=None)
        ib=NS(reqMarketDataType=Mock(),qualifyContractsAsync=AsyncMock(side_effect=qualify),
          reqSecDefOptParamsAsync=AsyncMock(return_value=[NS(exchange='SMART',tradingClass='AAPL',multiplier='100',expirations={'20991218'},strikes=list(range(80,121)))]),
          reqMktData=Mock(side_effect=ticker),cancelMktData=Mock())
        async def details(query):
            return [NS(contract=Option(query.symbol,query.lastTradeDateOrContractMonth,strike,right,query.exchange,
                multiplier=query.multiplier,currency='USD',tradingClass=query.tradingClass,conId=i+1))
                for i,(right,strike) in enumerate((r,s) for r in ('C','P') for s in range(80,121))]
        ib.reqContractDetailsAsync=AsyncMock(side_effect=details)
        return NS(ensure_connected=AsyncMock(),ib=ib)

    async def test_expiry_specific_strikes_replace_dense_global_union(self):
        r=self.reader()
        r.ib.reqSecDefOptParamsAsync.return_value[0].strikes=[99+i/100 for i in range(201)]
        with patch('ibkr_market_worker.asyncio.sleep',new=AsyncMock()):
            data=await chain(r,{'symbol':'AAPL','center':100,'count':'10'})
        self.assertEqual(data['availableStrikes'],list(range(80,121)))
        self.assertEqual(len(data['options']),20)
        self.assertEqual(len({o['strike'] for o in data['options']}),10)
        self.assertTrue(all(o['strike']==int(o['strike']) for o in data['options']))
        query=r.ib.reqContractDetailsAsync.call_args.args[0]
        self.assertEqual(query.lastTradeDateOrContractMonth,'20991218')
        self.assertEqual(query.tradingClass,'AAPL')

    async def test_empty_expiry_does_not_fabricate_global_contracts(self):
        r=self.reader();r.ib.reqContractDetailsAsync.side_effect=None
        r.ib.reqContractDetailsAsync.return_value=[]
        with patch('ibkr_market_worker.asyncio.sleep',new=AsyncMock()):
            with self.assertRaisesRegex(ValueError,'没有可用合约'):
                await chain(r,{'symbol':'AAPL'})
        self.assertEqual(r.ib.qualifyContractsAsync.call_count,1)

    async def test_bounded_contracts_missing_quotes_and_cleanup(self):
        r=self.reader()
        with patch('ibkr_market_worker.asyncio.sleep',new=AsyncMock()):
            data=await chain(r,{'symbol':'AAPL','otm':5})
        self.assertEqual(len(data['options']),20)
        self.assertTrue(data['partial'])
        self.assertTrue(all(o['bid'] is None and o['last'] is None and o['delta'] is None for o in data['options']))
        self.assertEqual(r.ib.cancelMktData.call_count,41)
        self.assertEqual(r.ib.reqMarketDataType.call_args_list[0].args,(3,))
        self.assertTrue(all(c.args==(4,) for c in r.ib.reqMarketDataType.call_args_list[1:]))
        self.assertEqual([o['strike'] for o in data['options'] if o['right']=='P'],
                         [o['strike'] for o in data['options'] if o['right']=='C'])

    async def test_paired_chain_and_unconfirmed_type(self):
        r=self.reader()
        with patch('ibkr_market_worker.asyncio.sleep',new=AsyncMock()):
            data=await chain(r,{'symbol':'AAPL','mode':'chain','center':110})
        calls=[o['strike'] for o in data['options'] if o['right']=='C']
        puts=[o['strike'] for o in data['options'] if o['right']=='P']
        self.assertEqual(calls,puts)
        self.assertEqual(len(calls),10)
        self.assertTrue(all(o['marketDataType'] is None for o in data['options']))
        self.assertEqual(r.ib.cancelMktData.call_count,41)

    async def test_display_counts_and_full_chain_batches(self):
        for count, expected in [('10', 10), ('20', 20), ('all', 41)]:
            with self.subTest(count=count):
                r=self.reader()
                with patch('ibkr_market_worker.asyncio.sleep',new=AsyncMock()):
                    data=await chain(r,{'symbol':'AAPL','count':count,'center':110})
                calls=[o['strike'] for o in data['options'] if o['right']=='C']
                puts=[o['strike'] for o in data['options'] if o['right']=='P']
                self.assertEqual(len(calls),expected)
                self.assertEqual(calls,puts)
                self.assertTrue(all(len(c.args)<=40 for c in r.ib.qualifyContractsAsync.call_args_list))
                self.assertEqual(r.ib.cancelMktData.call_count,1+expected*4)
                if count=='all':
                    self.assertEqual(calls,list(range(80,121)))
                else:
                    self.assertIn(110,calls)

    async def test_actual_delayed_callback_preserved(self):
        r=self.reader()
        ticks=[]
        make=r.ib.reqMktData.side_effect
        def subscribe(*args):
            t=make(*args);ticks.append(t);return t
        r.ib.reqMktData.side_effect=subscribe
        async def update(_):
            for t in ticks:
                t.bid,t.ask,t.marketDataType=1.0,1.2,3
        with patch('ibkr_market_worker.asyncio.sleep',side_effect=update):
            data=await chain(r,{'symbol':'AAPL','mode':'chain'})
        self.assertFalse(data['partial'])
        self.assertTrue(all(o['marketDataType']==3 and o['mid']==1.1 for o in data['options']))
        r.ib.reqMarketDataType.assert_called_once_with(3)

    async def test_spx_index_and_separate_series(self):
        r=self.reader()
        r.ib.reqSecDefOptParamsAsync.return_value=[NS(exchange='SMART',tradingClass=c,multiplier='100',expirations={e},strikes=list(range(80,121))) for c,e in [('SPX','20991217'),('SPXW','20991218')]]
        with patch('ibkr_market_worker.asyncio.sleep',new=AsyncMock()):
            data=await chain(r,{'symbol':'^GSPC','mode':'chain'})
        self.assertEqual(r.ib.qualifyContractsAsync.call_args_list[0].args[0].secType,'IND')
        self.assertEqual(r.ib.reqSecDefOptParamsAsync.call_args.args[2],'IND')
        self.assertEqual(data['tradingClass'],'SPXW')
        self.assertEqual(data['expiry'],'20991218')
        self.assertTrue(all(c.tradingClass=='SPXW' for c in r.ib.qualifyContractsAsync.call_args.args))
        with patch('ibkr_market_worker.asyncio.sleep',new=AsyncMock()):
            data=await chain(r,{'symbol':'SPX','mode':'chain','tradingClass':'SPX'})
        self.assertEqual(data['expiry'],'20991217')

    async def test_search_keeps_contract_identity_and_timeout(self):
        r=self.reader()
        def row(sec,exchange,currency,cid):
            return NS(contract=NS(conId=cid,symbol='SPX',description='Example',secType=sec,primaryExchange=exchange,exchange='',currency=currency),derivativeSecTypes=['OPT'])
        r.ib.reqMatchingSymbolsAsync=AsyncMock(return_value=[row('STK','LSE','GBP',2),row('IND','CBOE','USD',1)])
        data=await search(r,{'query':'SPXW'})
        r.ib.reqMatchingSymbolsAsync.assert_awaited_once_with('SPX')
        self.assertEqual([v['conId'] for v in data],[1,2])
        self.assertTrue(data[0]['supported'])
        self.assertFalse(data[1]['supported'])
        r.ib.reqMatchingSymbolsAsync.return_value=None
        with patch('ibkr_market_worker.asyncio.sleep',new=AsyncMock()):
            with self.assertRaisesRegex(TimeoutError,'搜索超时'):
                await search(r,{'query':'SPX'})

    async def test_none_option_contracts_are_skipped(self):
        r=self.reader()
        qualify=r.ib.qualifyContractsAsync.side_effect
        async def partial(*contracts):
            result=await qualify(*contracts)
            return result if len(contracts)==1 else [None]+result[1:]
        r.ib.qualifyContractsAsync.side_effect=partial
        with patch('ibkr_market_worker.asyncio.sleep',new=AsyncMock()):
            data=await chain(r,{'symbol':'AAPL'})
        self.assertEqual(len(data['options']),19)
        self.assertTrue(data['partial'])
        self.assertTrue(all(c.args[0] is not None for c in r.ib.reqMktData.call_args_list))

    async def test_all_invalid_options_give_clear_error(self):
        r=self.reader()
        qualify=r.ib.qualifyContractsAsync.side_effect
        async def invalid(*contracts):
            return await qualify(*contracts) if len(contracts)==1 else [None]*len(contracts)
        r.ib.qualifyContractsAsync.side_effect=invalid
        with patch('ibkr_market_worker.asyncio.sleep',new=AsyncMock()):
            with self.assertRaisesRegex(ValueError,'没有可用合约'):
                await chain(r,{'symbol':'AAPL'})
        self.assertEqual(r.ib.reqMktData.call_count,1)

    async def test_invalid_underlying_stops_before_chain_request(self):
        r=self.reader();r.ib.qualifyContractsAsync.side_effect=None
        r.ib.qualifyContractsAsync.return_value=[None]
        with self.assertRaisesRegex(ValueError,'无法识别'):
            await chain(r,{'symbol':'BAD'})
        r.ib.reqSecDefOptParamsAsync.assert_not_called()

    async def test_bad_expiry_never_subscribes(self):
        r=self.reader()
        with self.assertRaisesRegex(ValueError,'到期日'):
            await chain(r,{'symbol':'AAPL','expiry':'20990101'})
        r.ib.reqMktData.assert_not_called()

    async def test_unknown_stock_price_is_not_invented(self):
        r=self.reader()
        r.ib.reqMktData.side_effect=lambda *a:NS(marketPrice=lambda:float('nan'))
        r.ib.reqHistoricalDataAsync=AsyncMock(return_value=[])
        with patch('ibkr_market_worker.asyncio.sleep',new=AsyncMock()):
            with self.assertRaisesRegex(ValueError,'参考价'):
                await chain(r,{'symbol':'AAPL'})
        r.ib.cancelMktData.assert_called_once()

    def test_unset_quotes_vs_real_zero(self):
        self.assertIsNone(nonnegative(-1))
        self.assertIsNone(nonnegative(float('nan')))
        self.assertEqual(nonnegative(0),0)
