import {describe,it,expect,vi,beforeEach} from 'vitest';
vi.mock('./market-source.js',()=>({marketSource:{active:'yahoo'}}));
vi.mock('./providers/yahoo.js',()=>({quoteFromChart:vi.fn(),options:vi.fn()}));
import * as yahoo from './providers/yahoo.js';
import {quoteYahooHolding,yahooSymbol} from './holdings-quotes.js';
import {applyHoldingQuote,holdingContract} from '../../web/lib/use-holdings-market';
import {contractsSchema} from './watchlist-stream.js';
const leg={symbol:'AAPL',assetType:'OPT',currency:'USD',expiry:'20261218',right:'P',strike:100,multiplier:100,quantity:-2,avgCost:2,marketPrice:1};
describe('holding market identity and valuation',()=>{
 it('distinguishes strikes, markets and contract ids, excluding quantity and notes',()=>{
  expect(holdingContract(leg).key).not.toBe(holdingContract({...leg,strike:105}).key);
  expect(holdingContract(leg).key).not.toBe(holdingContract({...leg,currency:'CAD'}).key);
  expect(holdingContract(leg).key).toBe(holdingContract({...leg,quantity:4,notes:'test'}).key);
  expect(contractsSchema.safeParse([holdingContract(leg)]).success).toBe(true);
  expect(contractsSchema.safeParse(Array(61).fill(holdingContract(leg))).success).toBe(false);
 });
 it('revalues short positions without changing their notes or cost',()=>{
  const q={symbol:'key',price:.5,bid:.4,ask:.6,volume:null,changePercent:null,marketDataType:1,receivedAt:'2026-09-29T14:00:00Z',basis:'mid'};
  expect(applyHoldingQuote({...leg,notes:'plan'},q)).toMatchObject({marketValue:-100,unrealizedPnl:300,avgCost:2,notes:'plan'});
  expect(applyHoldingQuote(leg,{...q,price:null})).toEqual(leg);
 });
 it('maps Canadian equities and rejects unknown markets instead of guessing USD',()=>{
  expect(yahooSymbol({...leg,assetType:'STK',symbol:'RY',currency:'CAD'})).toBe('RY.TO');
  expect(()=>yahooSymbol({...leg,assetType:'FUND'})).toThrow();
  expect(()=>yahooSymbol({...leg,assetType:'STK',currency:'EUR'})).toThrow();
 });
 it('uses exact option expiry/right/strike, never the underlying price',async()=>{
  vi.mocked(yahoo.options).mockResolvedValue({selectedDate:1797552000,puts:[{strike:100,bid:1,ask:2,lastPrice:9,nonStandard:false}],calls:[{strike:100,lastPrice:88}]});
  expect(await quoteYahooHolding(leg)).toMatchObject({price:1.5,bid:1,ask:2,marketDataType:3});
  await expect(quoteYahooHolding({...leg,strike:101})).rejects.toThrow('匹配');
  await expect(quoteYahooHolding({...leg,multiplier:10})).rejects.toThrow('标准');
 });
});
