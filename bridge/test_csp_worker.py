import unittest

from csp_worker import nearby_strikes, nearby_valid_contracts, contract_label, frozen_fallback
from types import SimpleNamespace
from unittest.mock import Mock, AsyncMock
from ib_async import Option


class CspSamplingTests(unittest.TestCase):
    def test_ten_on_each_side(self):
        selected = nearby_strikes(range(1, 101), 50)
        self.assertEqual(selected, list(range(40, 50)) + list(range(51, 61)))

    def test_between_strikes(self):
        selected = nearby_strikes(range(1, 101), 50.5)
        self.assertEqual(selected, list(range(41, 61)))

    def test_sparse_and_duplicate_strikes(self):
        self.assertEqual(nearby_strikes([0, -1, 10, 10, 20, 40], 25), [10, 20, 40])

    def test_contract_error_context(self):
        self.assertEqual(contract_label(Option('TSLA', '20261016', 350, 'P', 'SMART')),
                         'TSLA 20261016 P 350')


class CspValidationTests(unittest.IsolatedAsyncioTestCase):
    async def test_frozen_fallback_only_retries_missing_quotes(self):
        for initial, expected in [(1, 2), (3, 4), (0, 4)]:
            ib = Mock()
            replacement = SimpleNamespace(bid=99, ask=100, bidSize=1, time='old', marketDataType=1)
            ib.reqMktData.return_value = replacement
            ticks = [('missing', SimpleNamespace(bid=-1, ask=-1, marketDataType=initial)),
                     ('complete', SimpleNamespace(bid=1, ask=2, marketDataType=1))]
            wait = AsyncMock()
            await frozen_fallback(ib, ticks, wait)
            ib.cancelMktData.assert_called_once_with('missing')
            ib.reqMarketDataType.assert_called_once_with(expected)
            self.assertIsNone(replacement.time)
            self.assertEqual(replacement.marketDataType, 0)
            wait.assert_awaited_once_with(6)

    async def test_refills_invalid_combinations_without_full_chain(self):
        checked = []
        def make(strike):
            return Option('TSLA', '20261023', strike, 'P', 'SMART', multiplier='100')
        async def qualify(contract):
            checked.append(contract.strike)
            if contract.strike % 5:
                return [None]
            contract.conId = int(contract.strike)
            return [contract]
        result = await nearby_valid_contracts([s * 2.5 for s in range(1, 400)], 357.5, make, qualify)
        self.assertEqual(len(result), 20)
        self.assertEqual(sum(c.strike < 357.5 for c in result), 10)
        self.assertLessEqual(len(checked), 80)
        self.assertEqual(len(checked), len(set(checked)))

    async def test_all_invalid_is_bounded(self):
        checked = []
        async def qualify(strike):
            checked.append(strike)
            return []
        self.assertEqual(await nearby_valid_contracts(range(1, 1000), 500, lambda s: s, qualify), [])
        self.assertEqual(len(checked), 80)


if __name__ == '__main__':
    unittest.main()
