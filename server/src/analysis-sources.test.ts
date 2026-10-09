import {expect,it,vi,beforeEach} from 'vitest';
import {secResearch} from './analysis-sec.js';
import {treasuryRate,readTreasuryRate} from './analysis-rates.js';
import {analysisMarket,matchingQuote,dividendProxy} from './analysis-market.js';
import {quoteIbkr} from './ibkr-quotes.js';
import {yahooOptionChain} from './yahoo-options.js';
vi.mock('./analysis-dividends.js',()=>({readDividendEstimate:vi.fn().mockResolvedValue(null)}));
vi.mock('./ibkr-quotes.js',()=>({quoteIbkr:vi.fn()}));
vi.mock('./yahoo-options.js',()=>({yahooOptionChain:vi.fn()}));
vi.mock('./analysis-rates.js',async original=>({...await original<object>(),readTreasuryRate:vi.fn()}));
beforeEach(()=>{vi.clearAllMocks();vi.mocked(readTreasuryRate).mockResolvedValue(null);vi.mocked(yahooOptionChain).mockRejectedValue(new Error('Unavailable'));});
const now=Date.parse('2026-10-06T12:00:00Z');
const fact=(val:number,end='2025-12-31',start='2025-01-01',filed='2026-02-15')=>({val,end,start,filed,form:'10-K',accn:'test'});
const tag=(rows:any[],unit='USD')=>({units:{[unit]:rows}});
it('aligns annual periods and ignores quarters and future filings',()=>{
 const data={cik:1,facts:{'us-gaap':{Revenues:tag([fact(100),fact(20,'2025-12-31','2025-10-01'),fact(999,'2025-12-31','2025-01-01','2027-01-01')]),OperatingIncomeLoss:tag([fact(20)])}}};
 expect(secResearch(data,now).raw.operatingMargin).toBe(.2);
 expect(secResearch(data,Date.parse('2028-01-01')).raw).toEqual({});
});
it('accepts Canadian 40-F reports but never mixes monetary units',()=>{
 const f={...fact(100),form:'40-F'};
 const data={cik:1,facts:{'ifrs-full':{Revenue:tag([f],'CAD'),ProfitLossFromOperatingActivities:tag([{...f,val:15}],'CAD')}}};
 expect(secResearch(data,now).raw.operatingMargin).toBe(.15);
 data.facts['ifrs-full'].ProfitLossFromOperatingActivities=tag([{...f,val:15}],'USD');
 expect(secResearch(data,now).raw.operatingMargin).toBeUndefined();
});
it('does not infer missing cash flow or missing years as zero',()=>{
 const data={cik:1,facts:{'us-gaap':{Revenues:tag([fact(100),fact(70,'2023-12-31','2023-01-01'),fact(60,'2022-12-31','2022-01-01'),fact(50,'2021-12-31','2021-01-01')])}}};
 const r=secResearch(data,now);expect(r.raw.revenueCagr).toBeUndefined();expect(r.raw.cashflowHealth).toBeUndefined();
});
const xml=(date:string)=>`<feed><entry><content><m:properties><d:NEW_DATE>${date}</d:NEW_DATE><d:BC_3MONTH>4</d:BC_3MONTH><d:BC_6MONTH>6</d:BC_6MONTH><d:BC_1YEAR m:null="true"/></m:properties></content></entry></feed>`;
it('interpolates a dated Treasury proxy with continuous compounding',()=>{
 const r=treasuryRate(xml('2026-10-05T00:00:00'),.375,now)!;
 expect(r.value).toBeCloseTo(2*Math.log1p(.05/2));expect(r.asOf).toBe('2026-10-05');
 expect(treasuryRate(xml('2026-09-01'),.5,now)).toBeNull();expect(treasuryRate(xml('2026-10-07'),.5,now)).toBeNull();
});
const leg={symbol:'TEST',assetType:'OPT' as const,currency:'USD',expiry:'20261218',right:'P',strike:10,multiplier:100,conId:123};
it('requires exact contract identity and currency, including adjusted multipliers',()=>{
 const q={...leg};expect(matchingQuote(leg,q)).toBe(true);
 for(const patch of [{conId:456},{expiry:'20270115'},{currency:'CAD'},{multiplier:10},{right:'C'}])expect(matchingQuote(leg,{...q,...patch})).toBe(false);
});
it('distinguishes absent dividends from a valid zero dividend estimate',()=>{
 expect(dividendProxy(null,100,.5)).toBeNull();expect(dividendProxy(0,100,.5)).toBeCloseTo(0);
 expect(dividendProxy(1,100,.5)).toBeCloseTo(-Math.log(.99)/.5);expect(dividendProxy(100,100,.5)).toBeNull();
});
it('keeps broker IV even without a bid/ask and reports missing prices',async()=>{
 vi.mocked(quoteIbkr).mockResolvedValue([{...leg,iv:.3,price:null,underlyingPrice:12,pvDividend:0,marketDataType:2}]);
 const r=await analysisMarket([leg]);expect(r.options[0].iv).toBe(.3);expect(r.options[0].source).toBe('IBKR');
 expect(r.warnings).toContain('price-missing');expect(yahooOptionChain).toHaveBeenCalled();
});
it('falls back only to the exact standard contract and labels the provider',async()=>{
 vi.mocked(quoteIbkr).mockRejectedValue(new Error('offline'));
 vi.mocked(yahooOptionChain).mockResolvedValue({spot:12,options:[{strike:11,right:'P',iv:.8},{strike:10,right:'P',iv:.4}],fetchedAt:'2026-10-06'} as any);
 const r=await analysisMarket([leg]);expect(r.options[0].iv).toBe(.4);expect(r.options[0].source).toBe('Yahoo Finance');expect(r.warnings).toContain('ibkr-unavailable');
});
it('never uses standard-chain fallback for adjusted or non-USD options',async()=>{
 vi.mocked(quoteIbkr).mockResolvedValue([]);
 const r=await analysisMarket([{...leg,multiplier:10},{...leg,currency:'CAD'}]);
 expect(r.options.every(x=>x.iv===null)).toBe(true);expect(yahooOptionChain).not.toHaveBeenCalled();
});

it('supplements a missing price without replacing broker IV',async()=>{
 vi.mocked(quoteIbkr).mockResolvedValue([{...leg,iv:.3,price:null,underlyingPrice:12,pvDividend:0,marketDataType:2}]);
 vi.mocked(yahooOptionChain).mockResolvedValue({spot:12,options:[{strike:10,right:'P',iv:.4,bid:1,ask:2}]} as any);
 const r=await analysisMarket([leg]);expect(r.options[0].iv).toBe(.3);expect(r.options[0].price).toBe(1.5);expect(r.options[0].priceSource).toBe('Yahoo Finance');
});
it('uses each expiry own dividend horizon and supplements missing underlying prices',async()=>{
 vi.mocked(quoteIbkr).mockResolvedValue([{...leg,iv:.3,price:1,underlyingPrice:null,pvDividend:0,marketDataType:2},{...leg,expiry:'20270115',iv:.3,price:1,underlyingPrice:12,pvDividend:.2,marketDataType:2}]);
 vi.mocked(yahooOptionChain).mockResolvedValue({spot:12,options:[{strike:10,right:'P',iv:.4,bid:1,ask:2}]} as any);
 const r=await analysisMarket([leg,{...leg,expiry:'20270115'}]);
 expect(r.options[0].underlyingPrice).toBe(12);expect(r.options[0].dividendYield).toBe(0);
 expect(r.options[1].dividendYield).toBeGreaterThan(0);expect(r.options[0].iv).toBe(.3);
});
it('keeps two-sided quote provenance coherent while supplementing volume and OI independently',async()=>{
 vi.mocked(quoteIbkr).mockResolvedValue([{...leg,iv:.3,price:1,underlyingPrice:12,pvDividend:0,bid:.9,ask:1.1,volume:0,openInterest:null,marketDataType:3,receivedAt:'2026-10-07T12:00:00Z'}]);
 vi.mocked(yahooOptionChain).mockResolvedValue({spot:12,options:[{strike:10,right:'P',iv:.4,bid:3,ask:4,volume:9,openInterest:42}],fetchedAt:'2026-10-07T12:01:00Z'} as any);
 const row=(await analysisMarket([leg])).options[0];
 expect(row).toMatchObject({bid:.9,ask:1.1,bookSource:'IBKR',volume:0,volumeSource:'IBKR',openInterest:42,openInterestSource:'Yahoo Finance'});
});
it('replaces an invalid quote pair together, never mixing IBKR bid with Yahoo ask',async()=>{
 vi.mocked(quoteIbkr).mockResolvedValue([{...leg,iv:.3,price:1,underlyingPrice:12,pvDividend:0,bid:5,ask:null}]);
 vi.mocked(yahooOptionChain).mockResolvedValue({spot:12,options:[{strike:10,right:'P',bid:1,ask:2,volume:0,openInterest:0}],fetchedAt:'2026-10-07T12:01:00Z'} as any);
 expect((await analysisMarket([leg])).options[0]).toMatchObject({bid:1,ask:2,bookSource:'Yahoo Finance',bookMarketDataType:null,volume:0,openInterest:0});
});

it('loads rates alongside broker quotes and loads independent expiries concurrently',async()=>{
 vi.useFakeTimers();
 try{
  const later=<T>(value:T,ms:number)=>new Promise<T>(resolve=>setTimeout(()=>resolve(value),ms));
  vi.mocked(quoteIbkr).mockImplementation(()=>later([],1000));
  vi.mocked(readTreasuryRate).mockImplementation(()=>later(null,5000));
  vi.mocked(yahooOptionChain).mockImplementation(()=>later({spot:12,options:[{strike:10,right:'P',iv:.4,bid:1,ask:2}]} as any,2000));
  let done=false;const result=analysisMarket([leg,{...leg,expiry:'20270115'}]).then(r=>{done=true;return r;});
  expect(readTreasuryRate).toHaveBeenCalledTimes(2);
  await vi.advanceTimersByTimeAsync(1000);expect(yahooOptionChain).toHaveBeenCalledTimes(2);
  await vi.advanceTimersByTimeAsync(3999);expect(done).toBe(false);
  await vi.advanceTimersByTimeAsync(1);expect(done).toBe(true);
  expect((await result).options.map(o=>o.iv)).toEqual([.4,.4]);
 }finally{vi.useRealTimers();}
});

it('fills missing broker dividends for both contract and strategy probability inputs',async()=>{
 const {readDividendEstimate}=await import('./analysis-dividends.js');
 vi.mocked(readDividendEstimate).mockResolvedValueOnce({value:0,source:'Celestica',method:'issuer-no-dividend-policy',asOf:'2026-08-05'});
 vi.mocked(quoteIbkr).mockResolvedValue([{...leg,iv:.3,price:1,underlyingPrice:12,pvDividend:null,bid:.9,ask:1.1,volume:1,openInterest:1}]);
 const result=await analysisMarket([leg]);
 expect(result.options[0].dividendYield).toBe(0);
 expect(result.dividend).toMatchObject({value:0,source:'Celestica'});
 expect(result.warnings).not.toContain('dividend-missing');
});
