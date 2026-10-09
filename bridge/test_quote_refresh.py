import unittest
from ib_async import Ticker
from ibkr_market_worker import clear_quote, nonnegative

class RefreshTest(unittest.TestCase):
    def test_resubscription_discards_previous_snapshot(self):
        ticker = Ticker();ticker.bid=1.0;ticker.ask=2.0;ticker.last=1.5;ticker.marketDataType=1
        clear_quote(ticker)
        self.assertIsNone(nonnegative(ticker.bid))
        self.assertIsNone(nonnegative(ticker.ask))
        self.assertIsNone(nonnegative(ticker.last))
        self.assertEqual(ticker.marketDataType, 0)

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
from ibkr_market_worker import quotes_unique

class ContractRoutingTest(unittest.IsolatedAsyncioTestCase):
    async def test_canadian_and_fund_contracts_use_the_selected_market(self):
        ib = MagicMock()
        ib.qualifyContractsAsync = AsyncMock(return_value=[None])
        reader = SimpleNamespace(ib=ib, ensure_connected=AsyncMock())
        with patch('ibkr_market_worker.asyncio.sleep', new=AsyncMock()):
            await quotes_unique(reader, {'legs':[
                {'assetType':'STK','symbol':'RY','currency':'CAD','primaryExchange':'TSE'},
                {'assetType':'FUND','symbol':'TEST','currency':'USD','conId':123,'exchange':'FUNDSERV'}]})
        contracts=[call.args[0] for call in ib.qualifyContractsAsync.call_args_list]
        self.assertEqual((contracts[0].currency,contracts[0].primaryExchange),('CAD','TSE'))
        self.assertEqual((contracts[1].conId,contracts[1].exchange),(123,'FUNDSERV'))
        ib.reqMktData.assert_not_called()

from watchlist_worker import quote_row
class StreamQuoteTest(unittest.TestCase):
    def test_change_uses_previous_close_and_keeps_missing_values(self):
        ticker=Ticker();ticker.last=110;ticker.close=100;ticker.marketDataType=3
        q=quote_row('TEST',ticker)
        self.assertEqual(q['price'],110)
        self.assertEqual(q['changePercent'],10)
        self.assertEqual(q['marketDataType'],3)
        q=quote_row('TEST',Ticker())
        self.assertIsNone(q['price'])
        self.assertIsNone(q['changePercent'])

class AnalysisGreeksTest(unittest.IsolatedAsyncioTestCase):
    async def test_retains_valid_greeks_when_bid_ask_are_missing(self):
        from ib_async import Option
        c = Option('TEST', '20261218', 100, 'P', 'SMART', currency='USD', multiplier='100', conId=123)
        good = SimpleNamespace(impliedVol=.3, undPrice=101, pvDividend=0, delta=-.4)
        invalid = SimpleNamespace(impliedVol=-1)
        ticker = SimpleNamespace(bid=float('nan'), ask=float('nan'), last=float('nan'),
                                 modelGreeks=invalid, bidGreeks=good, askGreeks=None, lastGreeks=None,
                                 marketDataType=2, time=None)
        ib = MagicMock(); ib.qualifyContractsAsync=AsyncMock(return_value=[c]); ib.reqMktData.return_value=ticker
        reader=SimpleNamespace(ib=ib, ensure_connected=AsyncMock())
        with patch('ibkr_market_worker.asyncio.sleep',new=AsyncMock()), patch('ibkr_market_worker.clear_quote'):
            result=await quotes_unique(reader, {'legs':[{'conId':123,'symbol':'TEST','assetType':'OPT','currency':'USD'}]})
        self.assertIsNone(result[0]['price'])
        self.assertEqual(result[0]['iv'], .3)
        self.assertEqual(result[0]['pvDividend'], 0)
        self.assertEqual(result[0]['conId'], 123)
        self.assertEqual(result[0]['marketDataType'], 2)
        ib.cancelMktData.assert_called_with(c)

class FastQuotesTest(unittest.IsolatedAsyncioTestCase):
    async def test_complete_option_data_returns_without_fixed_sleep(self):
        from ib_async import Option
        c = Option('TEST', '20261218', 100, 'P', 'SMART', currency='USD', multiplier='100', conId=123)
        greek = SimpleNamespace(impliedVol=.3, undPrice=101, pvDividend=0, delta=-.4)
        ticker = SimpleNamespace(bid=1, ask=2, last=1.5, modelGreeks=greek,
            bidGreeks=None, askGreeks=None, lastGreeks=None, marketDataType=3, time=None)
        ib = MagicMock(); ib.qualifyContractsAsync=AsyncMock(return_value=[c]); ib.reqMktData.return_value=ticker
        reader=SimpleNamespace(ib=ib, ensure_connected=AsyncMock())
        with patch('ibkr_market_worker.asyncio.sleep',new=AsyncMock()) as sleep, patch('ibkr_market_worker.clear_quote'):
            result=await quotes_unique(reader, {'legs':[{'conId':123,'symbol':'TEST','assetType':'OPT','currency':'USD'}]})
        sleep.assert_not_called()
        self.assertEqual(result[0]['iv'], .3)
        self.assertEqual(result[0]['price'], 1.5)
        ib.cancelMktData.assert_called_once_with(c)
