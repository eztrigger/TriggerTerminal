import {afterEach,beforeEach,expect,it,vi} from 'vitest';
vi.mock('./ibkr-quotes.js',()=>({quoteIbkr:vi.fn()}));
vi.mock('./market-source.js',()=>({marketSource:{active:'yahoo'}}));
vi.mock('./providers/yahoo.js',()=>({quoteFromChart:vi.fn(),options:vi.fn()}));
import {parseTdFundNav} from './providers/td-funds.js';
import {fillMissingFundPrices,fillMissingHoldingPrices,quoteHoldings} from './holdings-quotes.js';
import {quoteIbkr} from './ibkr-quotes.js';
import {marketSource} from './market-source.js';
import {quoteFromChart} from './providers/yahoo.js';
const html='<meta name="fundCode" content="TDB2915"/><div class="singleCurrency"><span>USD</span></div><span class="mb-fund-nav-date">Oct 6, 2026</span><span class="mb-fund-nav-price">$10.00</span><span>Yield 3.72%</span>';
const fund={symbol:'TDB2915',assetType:'FUND',currency:'USD',multiplier:null,marketPrice:null,expiry:'',right:'',strike:null};
beforeEach(()=>{vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-07T12:00:00Z'));marketSource.active='yahoo';});
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();vi.clearAllMocks();});
it('reads the dated unit NAV, never the yield, and validates series/currency/staleness',()=>{
 expect(parseTdFundNav(html,'TDB2915','USD')).toMatchObject({price:10,fetchedAt:'2026-10-06T00:00:00.000Z',bid:null,ask:null});
 for(const bad of [html.replace('TDB2915','TDB2916'),html.replace('USD','CAD'),html.replace('$10.00','N/A'),html.replace('Oct 6','Sep 1'),html.replace('Oct 6','Nov 1')])expect(()=>parseTdFundNav(bad,'TDB2915','USD')).toThrow();
 expect(()=>parseTdFundNav(html,'TDB2915','CAD')).toThrow();
});
it('fills missing NAV and multiplier using TD for either market source, without requiring IBKR',async()=>{
 const fetch=vi.fn().mockResolvedValue({ok:true,text:async()=>html});vi.stubGlobal('fetch',fetch);
 for(const source of ['yahoo','api'] as const){
  marketSource.active=source;
  const [value]=await fillMissingFundPrices([fund]);
  expect(value).toMatchObject({marketPrice:10,multiplier:1,quoteBasis:'TD Asset Management NAV',quoteAt:'2026-10-06T00:00:00.000Z'});
 }
 expect(fetch).toHaveBeenCalledTimes(1);expect(quoteIbkr).not.toHaveBeenCalled();
});
it('preserves user-entered NAV and refuses unsupported funds instead of using cost',async()=>{
 expect(await fillMissingFundPrices([{...fund,marketPrice:9.98,avgCost:8}])).toMatchObject([{marketPrice:9.98,multiplier:1,avgCost:8}]);
 await expect(fillMissingFundPrices([{...fund,symbol:'UNKNOWN',avgCost:10}])).rejects.toThrow('UNKNOWN');
});
it('keeps mixed batch ordering and isolates TD currency failures from other quotes',async()=>{
 vi.mocked(quoteFromChart).mockResolvedValue({price:123,currency:'USD',time:1791288000} as any);
 const results=await quoteHoldings([{...fund,currency:'CAD'},{...fund,assetType:'STK',symbol:'TEST'}]);
 expect(results[0].error).toContain('币种');expect(results[1].price).toBe(123);
});

it('automatically fills stock prices through Yahoo fallback and refuses currency mismatch',async()=>{
 marketSource.active='api';vi.mocked(quoteIbkr).mockRejectedValue(new Error('offline'));
 vi.mocked(quoteFromChart).mockResolvedValue({price:125,currency:'USD',time:1791288000} as any);
 const leg={...fund,assetType:'STK',symbol:'AUTO',multiplier:1,avgCost:80};
 expect(await fillMissingHoldingPrices([leg])).toMatchObject([{marketPrice:125,avgCost:80,quoteBasis:'Yahoo Finance'}]);
 vi.mocked(quoteFromChart).mockResolvedValue({price:125,currency:'CAD',time:1791288000} as any);
 await expect(fillMissingHoldingPrices([{...leg,symbol:'BAD_CURRENCY'}])).rejects.toThrow();
 expect(leg.marketPrice).toBeNull();
});
it('automatically fills fund NAV and default multiplier without any manual mark',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,text:async()=>html}));
 expect(await fillMissingHoldingPrices([fund])).toMatchObject([{marketPrice:10,multiplier:1,quoteBasis:'TD Asset Management NAV'}]);
 await expect(fillMissingHoldingPrices([{...fund,symbol:'UNSUPPORTED'}])).rejects.toThrow('UNSUPPORTED');
});
