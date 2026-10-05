import {quoteIbkr} from './ibkr-quotes.js';
import {marketSource} from './market-source.js';
import * as yahoo from './providers/yahoo.js';

type Leg={symbol:string;assetType:string;currency:string;expiry:string;right:string;strike:number|null;multiplier:number|null;primaryExchange?:string;conId?:number};
export function yahooSymbol(leg:Leg) {
 if(!['STK','ETF'].includes(leg.assetType))throw new Error('Yahoo 暂不支持此资产自动报价');
 const symbol=leg.symbol.trim().toUpperCase();
 if(leg.currency==='CAD') {
  if(leg.primaryExchange&&!['TSE','TSX','TORONTO'].includes(leg.primaryExchange))throw new Error('请确认此资产的 Yahoo 市场代码');
  return symbol.endsWith('.TO')?symbol:symbol.replaceAll(' ', '-')+'.TO';
 }
 if(leg.currency!=='USD')throw new Error('请确认此资产的 Yahoo 市场代码');
 return symbol.replaceAll(' ', '-').replaceAll('.', '-');
}
const cache=new Map<string,{until:number;promise:Promise<any>}>();
function cached(key:string,read:()=>Promise<any>) {
 const old=cache.get(key);if(old&&old.until>Date.now())return old.promise;
 for(const [k,v] of cache)if(v.until<Date.now())cache.delete(k);
 const promise=read();cache.set(key,{until:Date.now()+30000,promise});return promise;
}
export async function quoteYahooHolding(leg:Leg) {
 let price:number|null,bid:number|null=null,ask:number|null=null,time:number|null=null;
 if(leg.assetType==='OPT') {
  if(leg.currency!=='USD'||leg.multiplier!==100||!/^\d{8}$/.test(leg.expiry)||!['C','P'].includes(leg.right))throw new Error('Yahoo 仅支持标准美股期权；此合约需人工确认');
  const date=Date.parse(leg.expiry.slice(0,4)+'-'+leg.expiry.slice(4,6)+'-'+leg.expiry.slice(6,8)+'T00:00:00Z')/1000;
  const chain=await cached('option:'+leg.symbol+':'+date,()=>yahoo.options(leg.symbol,date));
  if(chain.selectedDate!==date)throw new Error('Yahoo 未返回指定到期日');
  const row=(leg.right==='C'?chain.calls:chain.puts).find((v:any)=>v.strike===leg.strike&&!v.nonStandard);
  if(!row)throw new Error('Yahoo 未找到匹配期权合约');
  bid=row.bid;ask=row.ask;time=row.lastTradeDate??null;
  price=bid!==null&&ask!==null&&bid>=0&&ask>0&&ask>=bid?(bid+ask)/2:row.lastPrice;
 } else {
  const symbol=yahooSymbol(leg);
  const row=await cached('stock:'+symbol,()=>yahoo.quoteFromChart(symbol));
  if(row.currency!==leg.currency)throw new Error('Yahoo 返回币种与资产不符，未更新');
  price=row.price;time=row.time;
 }
 if(price===null||!Number.isFinite(price)||price<0)throw new Error('Yahoo 暂无可用报价');
 return {conId:leg.conId,price,bid,ask,basis:'Yahoo Finance',marketDataType:3,fetchedAt:time&&Number.isFinite(time)?new Date(time*1000).toISOString():new Date().toISOString()};
}
export async function quoteHoldings(legs:Leg[]):Promise<any[]> {
 if(marketSource.active!=='yahoo')return await quoteIbkr(legs) as any[];
 return Promise.all(legs.map(async leg=>{try{return await quoteYahooHolding(leg);}catch(e){return {error:(e as Error).message};}}));
}
