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
