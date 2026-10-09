import {expect,it} from 'vitest';
import {basicTriggerpoints,type Evidence} from './triggerpoints-basic.js';
import {summarizeResearch} from './analysis-research.js';
const now=Date.parse('2026-10-07T12:00:00Z');
const raw={operatingMargin:.1,revenueGrowth:.05,cfoAssets:.075,debtCoverage:1.25,earningsYield:.04,trend:3};
function evidence(values:Record<string,number|null>=raw):Record<string,Evidence>{return Object.fromEntries(Object.keys(values).map(k=>[k,{source:'Yahoo Finance',asOf:k==='trend'?'2026-10-06':'2026-08-31',priceAsOf:'2026-10-06'}]));}
const score=(values:Record<string,number|null>=raw,sources=evidence(values))=>basicTriggerpoints(values,sources,'Technology','Software',now);
it('produces a real reproducible total from six known inputs',()=>{
 const s=score();expect(s.coverage).toBe(100);expect(s.earned).toBeCloseTo(57.5);expect(s.score).toBe(58);expect(s.provisional).toBe(false);
 [10,7.5,10,7.5,7.5,15].forEach((v,i)=>expect(s.metrics[i].points).toBeCloseTo(v,10));
});
it('caps high values and treats negative earnings and cash flow as valid low scores',()=>{
 const s=score({...raw,operatingMargin:-.1,cfoAssets:-1,earningsYield:-.2,revenueGrowth:4});
 expect(s.coverage).toBe(100);expect(s.metrics.find(m=>m.key==='cfoAssets')).toMatchObject({points:0,status:'ready'});
 expect(s.metrics.find(m=>m.key==='revenueGrowth')?.points).toBe(15);expect(s.score).not.toBeNull();
});
it('provisional total uses only valid weights and exposes missing-data bounds',()=>{
 const s=score({...raw,earningsYield:null});expect(s.coverage).toBe(85);expect(s.score).toBe(59);expect(s.provisional).toBe(true);expect(s.bounds).toEqual({low:50,high:65});
 expect(s.metrics.find(m=>m.key==='earningsYield')?.points).toBeNull();
});
it('requires every core metric even when coverage exceeds 80%',()=>{
 const s=score({...raw,debtCoverage:null});expect(s.coverage).toBe(85);expect(s.score).toBeNull();expect(s.missingCore).toEqual(['debtCoverage']);
});
it('rejects low coverage, NaN, impossible trend counts and negative liquidity ratios',()=>{
 expect(score({...raw,earningsYield:null,trend:null}).score).toBeNull();
 expect(score({...raw,cfoAssets:NaN}).score).toBeNull();
 expect(score({...raw,trend:4}).metrics.at(-1)?.status).toBe('invalid');
 expect(score({...raw,debtCoverage:-1}).score).toBeNull();
});
it('excludes stale, unknown and future dates, including valuation prices',()=>{
 for(const date of ['2024-01-01','2026-12-01',null]){const e=evidence();e.cfoAssets.asOf=date;expect(score(raw,e).score).toBeNull();}
 const e=evidence();e.earningsYield.priceAsOf='2026-09-01';expect(score(raw,e).coverage).toBe(85);
 e.cfoAssets={source:'SEC EDGAR',asOf:'2025-09-30'};expect(score(raw,e).missingCore).toEqual([]);
 e.cfoAssets.asOf='2025-01-01';expect(score(raw,e).missingCore).toContain('cfoAssets');
});
it('bank template avoids corporate cashflow and current-ratio rules',()=>{
 const r={...raw,returnOnEquity:.15,revenueGrowth:.15,earningsYield:.1};
 const s=basicTriggerpoints(r,evidence(r),'Financial Services','Banks - Diversified',now);
 expect(s.profile).toBe('bank');expect(s.score).toBe(100);expect(s.metrics.map(m=>m.key)).toEqual(['returnOnEquity','revenueGrowth','earningsYield','trend']);
 const incomplete=basicTriggerpoints({...r,returnOnEquity:null},evidence(r),'Financial Services','Banks',now);expect(incomplete.score).toBeNull();
});
it('unknown industries and specialized non-bank financials never receive a generic total',()=>{
 for(const [sector,industry] of [['',''],['Financial Services','Insurance'],['Real Estate','REIT']])expect(basicTriggerpoints(raw,evidence(),sector,industry,now).score).toBeNull();
});
it('uses the provider P/E ratio across listing currencies and audits price dates',()=>{
 const r=summarizeResearch({price:{currency:'CAD',regularMarketPrice:10,regularMarketTime:Date.parse('2026-10-06')/1000},financialData:{financialCurrency:'USD'},summaryDetail:{trailingPE:20},defaultKeyStatistics:{mostRecentQuarter:Date.parse('2026-08-31')/1000}},[],'stock',now);
 expect(r.raw.earningsYield).toBe(.05);expect(r.metricSources.earningsYield.priceAsOf).toBe('2026-10-06T00:00:00.000Z');
});
