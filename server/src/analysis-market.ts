import {z} from 'zod';
import {readDividendEstimate,type DividendEstimate} from './analysis-dividends.js';
import {quoteIbkr} from './ibkr-quotes.js';
import {yahooOptionChain} from './yahoo-options.js';
import {expiryYears} from './analysis-engine.js';
import {readTreasuryRate} from './analysis-rates.js';
export const analysisLegSchema=z.object({conId:z.number().int().positive().optional(),symbol:z.string().regex(/^[A-Za-z0-9. -]{1,24}$/),assetType:z.enum(['OPT','STK','ETF']),currency:z.string().regex(/^[A-Z]{3}$/),expiry:z.string(),right:z.string(),strike:z.number().nullable(),multiplier:z.number().positive().nullable()}).superRefine((l,ctx)=>{
 if(l.assetType==='OPT'&&(!/^\d{8}$/.test(l.expiry)||!['C','P'].includes(l.right)||!(l.strike!>0)))ctx.addIssue({code:'custom',message:'Invalid option contract'});
});
type Leg=z.infer<typeof analysisLegSchema>;
const validIv=(n:unknown):number|null=>typeof n==='number'&&Number.isFinite(n)&&n>0&&n<=5?n:null;
const nonnegative=(n:unknown):number|null=>typeof n==='number'&&Number.isFinite(n)&&n>=0?n:null;
const validBook=(bid:number|null,ask:number|null)=>bid!==null&&ask!==null&&ask>0&&ask>=bid;
const positive=(n:unknown):number|null=>typeof n==='number'&&Number.isFinite(n)&&n>0?n:null;
export function matchingQuote(l:Leg,q:any){
 if(!q||String(q.symbol??'').toUpperCase().replace(/[ .-]/g,'')!==l.symbol.toUpperCase().replace(/[ .-]/g,'')||q.currency!==l.currency||(l.conId&&q.conId!==l.conId))return false;
 if(l.assetType==='OPT'&&(q.expiry!==l.expiry||q.right!==l.right||q.strike!==l.strike||q.multiplier!==l.multiplier))return false;
 return true;
}
export function dividendProxy(pv:unknown,spot:unknown,t:number|null){
 return typeof pv==='number'&&Number.isFinite(pv)&&pv>=0&&typeof spot==='number'&&spot>pv&&t!==null&&t>0?-Math.log1p(-pv/spot)/t:null;
}
export async function analysisMarket(legs:Leg[]){
 const warnings:string[]=[];
 // Each expiration needs its own term rate and dividend horizon.
 const terms=new Map<string,Awaited<ReturnType<typeof readTreasuryRate>>>();
 const rateJob=Promise.all([...new Map(legs.filter(o=>o.assetType==='OPT').map(o=>[o.currency+'|'+o.expiry,o])).values()].map(async row=>{
  const key=row.currency+'|'+row.expiry;
  const years=expiryYears(row.expiry);
  try{terms.set(key,years?await readTreasuryRate(years,row.currency):null);}catch{terms.set(key,null);warnings.push('rate-unavailable');}
 }));
 let broker:any[]=[];
 try{broker=await quoteIbkr(legs) as any[];}catch{warnings.push('ibkr-unavailable');}
 const options=legs.map((l,i)=>{
  const q=matchingQuote(l,broker[i])?broker[i]:null;
  return {...l,identityMismatch:!!broker[i]?.conId&&!matchingQuote(l,broker[i]),iv:validIv(q?.iv),underlyingPrice:positive(q?.underlyingPrice),pvDividend:q?.pvDividend??null,
   bid:nonnegative(q?.bid),ask:nonnegative(q?.ask),bookSource:q?'IBKR':null,bookAt:q?.receivedAt??q?.fetchedAt??null,bookMarketDataType:q?.marketDataType??null,
   volume:nonnegative(q?.volume),openInterest:nonnegative(q?.openInterest),volumeSource:nonnegative(q?.volume)!==null?'IBKR':null,openInterestSource:nonnegative(q?.openInterest)!==null?'IBKR':null,
   price:q?.price??null,priceSource:q?.price!==null&&q?.price!==undefined?'IBKR':null,source:q?'IBKR':null,marketDataType:q?.marketDataType??null,receivedAt:q?.receivedAt??null,fetchedAt:q?.fetchedAt??null};
 });
 // Only standard USD equity options have a safe symbol-based fallback. Keep broker fields independently.
 const fallback=new Map<string,Promise<Awaited<ReturnType<typeof yahooOptionChain>>|null>>();
 await Promise.all(options.map(async row=>{
  if(row.identityMismatch||row.assetType!=='OPT'||(row.iv!==null&&row.price!==null&&row.underlyingPrice!==null&&validBook(row.bid,row.ask)&&row.volume!==null&&row.openInterest!==null)||row.currency!=='USD'||row.multiplier!==100)return;
  const key=row.symbol+'|'+row.expiry;
  if(!fallback.has(key))fallback.set(key,yahooOptionChain({symbol:row.symbol.replaceAll(' ', '-').replaceAll('.', '-'),expiry:row.expiry,count:'all'}).catch(()=>{warnings.push('yahoo-options-unavailable');return null;}));
  const chain=await fallback.get(key);if(!chain)return;
  const match=chain.options.find(o=>o.strike===row.strike&&o.right===row.right);
  if(row.iv===null&&match&&validIv(match.iv)!==null){row.iv=match.iv;row.source='Yahoo Finance';row.marketDataType=null;row.receivedAt=null;row.fetchedAt=chain.fetchedAt??null;}
  if(row.price===null&&match&&match.bid!==null&&match.ask!==null&&match.bid>=0&&match.ask>0&&match.ask>=match.bid){
   row.price=(match.bid+match.ask)/2;row.priceSource='Yahoo Finance';
  }
  if(match){
   if(!validBook(row.bid,row.ask)&&validBook(nonnegative(match.bid),nonnegative(match.ask))){row.bid=match.bid;row.ask=match.ask;row.bookSource='Yahoo Finance';row.bookAt=chain.fetchedAt??null;row.bookMarketDataType=null;}
   if(row.volume===null&&nonnegative(match.volume)!==null){row.volume=match.volume;row.volumeSource='Yahoo Finance';}
   if(row.openInterest===null&&nonnegative(match.openInterest)!==null){row.openInterest=match.openInterest;row.openInterestSource='Yahoo Finance';}
  }
  if(row.underlyingPrice===null)row.underlyingPrice=positive(chain.spot);
 }));
 await rateJob;
 const dividends=new Map<string,Promise<DividendEstimate|null>>();
 const enriched=await Promise.all(options.map(async row=>{
  const q=dividendProxy(row.pvDividend,row.underlyingPrice,expiryYears(row.expiry));
  let dividend:DividendEstimate|null=q===null?null:{value:q,source:'IBKR',method:'pv-dividend-proxy',asOf:row.fetchedAt??new Date().toISOString()};
  if(q===null&&row.assetType==='OPT'&&!row.identityMismatch&&row.multiplier===100){
   const key=row.symbol+'|'+row.currency;
   if(!dividends.has(key))dividends.set(key,readDividendEstimate(row.symbol,row.currency).catch(()=>null));
   dividend=await dividends.get(key)!;
  }
  return {...row,rate:terms.get(row.currency+'|'+row.expiry)??null,dividendYield:dividend?.value??null,dividend};
 }));
 const first=options.find(l=>l.assetType==='OPT'),t=first?expiryYears(first.expiry):null;
 const rate=first?terms.get(first.currency+'|'+first.expiry)??null:null;
 const spotRow=options.find(o=>o.underlyingPrice!==null);
 const dividendRow=enriched.find(o=>o.expiry===first?.expiry&&o.dividend!==null);
 if(options.some(o=>o.identityMismatch))warnings.push('identity-mismatch');
 if(options.some(o=>o.price===null))warnings.push('price-missing');
 if(options.some(o=>o.assetType==='OPT'&&o.iv===null))warnings.push('iv-missing');
 if(!rate)warnings.push('rate-missing');
 if(!dividendRow)warnings.push('dividend-missing');
 return {source:[...new Set(options.map(o=>o.source).filter(Boolean))].join(' + ')||null,spot:spotRow?.underlyingPrice??null,options:enriched,rate,
  dividend:dividendRow?{...dividendRow.dividend,expiry:first?.expiry}:null,
  warnings:[...new Set(warnings)],fetchedAt:new Date().toISOString()};
}
