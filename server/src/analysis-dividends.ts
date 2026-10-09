import {quotes} from './providers/yahoo.js';
export type DividendEstimate={value:number;source:string;method:string;asOf:string;url?:string};
// Dated issuer evidence, not a default for missing dividends. Revalidate after 90 days.
export function issuerDividendPolicy(symbol:string,currency:string,now=Date.now()):DividendEstimate|null{
 const asOf='2026-08-05',age=now-Date.parse(asOf+'T00:00:00Z');
 if(symbol.toUpperCase()!=='CLS'||currency!=='USD'||age<0||age>90*86400000)return null;
 return {value:0,source:'Celestica',method:'issuer-no-dividend-policy',asOf,url:'https://celestica.gcs-web.com/node/17651/html'};
}
export async function readDividendEstimate(symbol:string,currency:string):Promise<DividendEstimate|null>{
 const policy=issuerDividendPolicy(symbol,currency);if(policy)return policy;
 if(currency!=='USD')return null;
 const mapped=symbol.toUpperCase().replaceAll(' ', '-').replaceAll('.', '-');
 const row=(await quotes([mapped])).find(q=>q.symbol===mapped&&q.currency===currency);
 const y=row?.dividendYield,time=row?.time;
 if(typeof y!=='number'||!Number.isFinite(y)||y<0||y>1||!time||Date.now()-time*1000>7*86400000||time*1000>Date.now()+300000)return null;
 return {value:Math.log1p(y),source:'Yahoo Finance',method:'trailing-dividend-yield-proxy',asOf:new Date(time*1000).toISOString()};
}
