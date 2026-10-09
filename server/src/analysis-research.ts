import {Router} from 'express';
import {z} from 'zod';
import * as yahoo from './providers/yahoo.js';
import {basicTriggerpoints,type Evidence} from './triggerpoints-basic.js';
import {companyFacts} from './providers/secedgar.js';
import {readIbkrResearchHistory} from './ibkr.js';
import {quoteIbkr} from './ibkr-quotes.js';
import {secResearch} from './analysis-sec.js';
import {analysisMarket,analysisLegSchema} from './analysis-market.js';
import {cacheGet,cacheSet} from './cache.js';
const n=(x:any):number|null=>{const value=x?.raw??x;return typeof value==='number'&&Number.isFinite(value)?value:null;};
const ratio=(a:number|null,b:number|null)=>a!==null&&b!==null&&b>0?a/b:null;
const millis=(x:any)=>{const v=n(x);return v===null?null:v*1000;};
export function summarizeResearch(r:any,candles:yahoo.Candle[],kind:'stock'|'fund',now=Date.now()){
 const f=r.financialData??{},d=r.defaultKeyStatistics??{},summary=r.summaryDetail??{};
 const income=(r.incomeStatementHistory?.incomeStatementHistory??[]).filter((x:any)=>millis(x.endDate)!==null).sort((a:any,b:any)=>n(b.endDate)!-n(a.endDate)!);
 const cash=(r.cashflowStatementHistory?.cashflowStatements??[]).filter((x:any)=>millis(x.endDate)!==null).sort((a:any,b:any)=>n(b.endDate)!-n(a.endDate)!);
 const annualFresh=(x:any)=>!!x&&now>=millis(x.endDate)!&&now-millis(x.endDate)!<450*86400000;
 const sameFinancialCurrency=typeof f.financialCurrency==='string'&&f.financialCurrency===r.price?.currency;
 const raw:Record<string,number|null>={
  returnOnEquity:n(f.returnOnEquity),roic:null,operatingMargin:n(f.operatingMargins),cfoAssets:null,accruals:null,earningsStability:null,
  revenueCagr:income.length>=4&&annualFresh(income[0])&&n(income[0].totalRevenue)!>0&&n(income[3].totalRevenue)!>0?Math.pow(n(income[0].totalRevenue)!/n(income[3].totalRevenue)!,1/3)-1:null,
  perShareProfitGrowth:null,revenueGrowth:n(f.revenueGrowth),marginChange:null,growthContinuity:null,
  earningsYield:sameFinancialCurrency?ratio(n(d.trailingEps),n(r.price?.regularMarketPrice)):null,fcfYield:sameFinancialCurrency?ratio(n(f.freeCashflow),n(r.price?.marketCap)):null,cfoEv:sameFinancialCurrency?ratio(n(f.operatingCashflow),n(d.enterpriseValue)):null,historicalValue:null,
  netDebtEbitda:n(f.totalDebt)!==null&&n(f.totalCash)!==null?ratio(n(f.totalDebt)!-n(f.totalCash)!,n(f.ebitda)):null,
  interestCoverage:null,debtCoverage:n(f.currentRatio),cashflowHealth:null,dilution:null,momentum:null,trend:null,liquidity:null,payoutCoverage:null,allocation:null,disclosure:null
 };
 const quarter=millis(d.mostRecentQuarter);const fresh=quarter!==null&&now>=quarter&&now-quarter<180*86400000;
 const pe=n(summary.trailingPE)??n(d.trailingPE);
 if(pe!==null&&pe!==0)raw.earningsYield=1/pe;
 const prices=[...new Map(candles.filter(c=>Number.isFinite(c.close)&&c.close>0&&c.time*1000<=now).map(c=>[c.time,c])).values()].sort((a,b)=>a.time-b.time);
 if(prices.length>=220&&now-(prices.at(-1)?.time??0)*1000<7*86400000){
  const avg=(xs:yahoo.Candle[])=>xs.reduce((a,b)=>a+b.close,0)/xs.length;
  const ma200=avg(prices.slice(-200)),ma50=avg(prices.slice(-50)),prior200=avg(prices.slice(-220,-20));
  const count=Number(prices.at(-1)!.close>ma200)+Number(ma50>ma200)+Number(ma200>prior200);
  raw.trend=count;
 }
 const sector=String(r.assetProfile?.sector??''),industry=String(r.assetProfile?.industry??'');
 const asOf=quarter!==null?new Date(quarter).toISOString():null;
 const metricSources:Record<string,Evidence>=Object.fromEntries(Object.entries(raw).filter(([,v])=>v!==null).map(([k])=>[k,{source:'Yahoo Finance',asOf:k==='trend'?new Date((prices.at(-1)?.time??0)*1000).toISOString():asOf,
  url:'https://finance.yahoo.com/',inputs:{field:({returnOnEquity:'financialData.returnOnEquity',operatingMargin:'financialData.operatingMargins',revenueGrowth:'financialData.revenueGrowth',debtCoverage:'financialData.currentRatio'} as Record<string,string>)[k]??k,value:raw[k]},...(k==='earningsYield'?{priceAsOf:millis(r.price?.regularMarketTime)!==null?new Date(millis(r.price.regularMarketTime)!).toISOString():null,inputs:{trailingPE:pe,eps:n(d.trailingEps),price:n(r.price?.regularMarketPrice),financialCurrency:f.financialCurrency??null,quoteCurrency:r.price?.currency??null}}:{}),
  ...(k==='trend'?{inputs:{last:prices.at(-1)?.close,ma50:prices.slice(-50).reduce((n,c)=>n+c.close,0)/50,ma200:prices.slice(-200).reduce((n,c)=>n+c.close,0)/200,priorMa200:prices.slice(-220,-20).reduce((n,c)=>n+c.close,0)/200}}:{})}]));
 const scoring=basicTriggerpoints(raw,metricSources,sector,industry,now);
 const applicable=scoring.profile!=='unsupported';
 const risk=n(r.fundPerformance?.overallRisk),rating=n(r.fundPerformance?.overallMorningstarRating);
 return {kind,source:'Yahoo Finance',sector,industry,currency:r.price?.currency??null,price:n(r.price?.regularMarketPrice),
  asOf:quarter!==null?new Date(quarter).toISOString():null,reportFresh:fresh,raw,scoring,applicable,metricSources,
  fundRating:rating!==null&&Number.isInteger(rating)&&rating>=1&&rating<=5?rating:null,
  fundRisk:risk!==null&&Number.isInteger(risk)&&risk>=1&&risk<=5?risk:null,
  fundRatingPeriod:r.fundPerformance?.asOfDate??null,
  summary:r.assetProfile?.longBusinessSummary??null};
}
export const analysisResearchRouter=Router();
async function researchHistory(symbol:string,mapped:string|null,currency?:string){
 if(currency==='USD')try{
  const r=await readIbkrResearchHistory(symbol) as {candles:yahoo.Candle[];currency:string};
  if(r.currency==='USD'&&r.candles?.length)return {candles:r.candles,source:'IBKR'};
 }catch{}
 if(!mapped)throw new Error('unsupported-research-market');
 return {candles:await yahoo.history(mapped,'2y','1d'),source:'Yahoo Finance'};
}
analysisResearchRouter.get('/research/:symbol',async(req,res)=>{
 const p=z.object({symbol:z.string().regex(/^\^?[A-Za-z0-9.-]{1,30}$/),kind:z.enum(['stock','fund']).default('stock'),currency:z.string().regex(/^[A-Z]{3}$/).optional()}).safeParse({symbol:req.params.symbol,kind:req.query.kind,currency:req.query.currency});
 if(!p.success){res.status(400).json({error:'Invalid research instrument'});return;}
 const {symbol,kind,currency}=p.data,key='analysis-research:basic-v1:'+kind+':'+symbol+':'+(currency??'');
 const cached=cacheGet<any>(key);if(cached){res.json(cached);return;}
 // Currency is required for safe exchange mapping; never treat a CAD listing as its US namesake.
 const mapped=currency==='CAD'?(symbol.endsWith('.TO')?symbol:symbol+'.TO'):currency==='USD'?symbol.replaceAll('.', '-'):null;
 const results=await Promise.allSettled([
  mapped?yahoo.researchSummary(mapped):Promise.reject(new Error('unsupported-research-market')),
  kind==='stock'?researchHistory(symbol,mapped,currency):Promise.resolve({candles:[],source:null}),
  kind==='stock'&&(currency==='USD'||currency==='CAD'&&['TD','BB'].includes(symbol.toUpperCase()))?companyFacts(symbol.toUpperCase()):Promise.resolve(null),
  currency?quoteIbkr([{symbol,assetType:kind==='fund'?'ETF':'STK',currency}]):Promise.resolve([])
 ]);
 let r=results[0].status==='fulfilled'?results[0].value:{};
 const candles=results[1].status==='fulfilled'?results[1].value.candles:[];
 const historySource=results[1].status==='fulfilled'?results[1].value.source:null;
 const broker=results[3].status==='fulfilled'?(results[3].value as any[])?.[0]:null;
 const errors=results.flatMap((x,i)=>x.status==='rejected'?[['yahoo-research-unavailable','history-unavailable','sec-unavailable','ibkr-quote-unavailable'][i]]:[]);
 const currencyMismatch=currency&&r.price?.currency&&r.price.currency!==currency;
 if(currencyMismatch){r={};errors.push('Research currency differs from position currency');}
 if(symbol.toUpperCase()==='TD'&&!r.assetProfile?.sector)r={...r,assetProfile:{...r.assetProfile,sector:'Financial Services',industry:'Banks'}};
 const result=summarizeResearch(r,currencyMismatch?[]:candles,kind);
 const metricSources:Record<string,Evidence>={...result.metricSources};
 if(metricSources.trend)metricSources.trend={...metricSources.trend,source:historySource??'Yahoo Finance'};
 for(const m of Object.values(metricSources))if(m.source==='Yahoo Finance'&&mapped)m.url='https://finance.yahoo.com/quote/'+encodeURIComponent(mapped)+'/financials/';
 const sec=results[2].status==='fulfilled'&&results[2].value?secResearch(results[2].value):null;
 if(sec){Object.assign(result.raw,sec.raw);Object.assign(metricSources,sec.provenance);}
 result.scoring=basicTriggerpoints(result.raw,metricSources,result.sector,result.industry);
 result.applicable=result.scoring.profile!=='unsupported';
 const sources=[...(historySource==='IBKR'||broker?.price!==null&&broker?.price!==undefined?['IBKR']:[]),...(results[0].status==='fulfilled'&&!currencyMismatch?['Yahoo Finance']:[]),...(Object.keys(sec?.raw??{}).length?['SEC EDGAR']:[])];
 const missing=kind==='stock'?result.scoring.metrics.filter(m=>m.status!=='ready').map(m=>m.key):[...(result.fundRating===null?['fundRating']:[]),...(result.fundRisk===null?['fundRisk']:[])];
 const response={...result,marketQuote:broker?.currency===currency&&typeof broker?.price==='number'?{price:broker.price,source:'IBKR',marketDataType:broker.marketDataType,fetchedAt:broker.fetchedAt}:null,historySource,source:sources.join(' + ')||null,secAsOf:sec?.asOf??null,metricSources,missing,fetchedAt:new Date().toISOString(),errors};
 cacheSet(key,response,errors.length?60000:3600000);res.json(response);
});
analysisResearchRouter.post('/market',async(req,res)=>{
 const p=z.object({legs:z.array(analysisLegSchema).min(1).max(20)}).safeParse(req.body);
 if(!p.success){res.status(400).json({error:'Invalid analysis contracts (maximum 20)'});return;}
 if(new Set(p.data.legs.map(l=>l.symbol+'|'+l.currency)).size!==1){res.status(400).json({error:'Mixed analysis underlyings'});return;}
 try{res.json(await analysisMarket(p.data.legs));}catch{res.status(503).json({error:'Analysis market data unavailable'});}
});
