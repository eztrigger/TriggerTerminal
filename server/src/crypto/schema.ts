import {z} from 'zod';
import {Decimal} from 'decimal.js';

export const D=Decimal.clone({precision:60,toExpNeg:-40,toExpPos:40});
export const amount=z.string().regex(/^-?\d{1,24}(\.\d{1,24})?$/).refine(v=>new D(v).isFinite());
const nonnegative=amount.refine(v=>new D(v).gte(0));
const positive=amount.refine(v=>new D(v).gt(0));
export const denomination=z.enum(['USDT','USDC']);
export const accountSchema=z.object({name:z.string().trim().min(1).max(100),venue:z.string().trim().min(1).max(60),cash:z.object({USDT:nonnegative,USDC:nonnegative})});
export const positionSchema=z.object({
 accountId:z.number().int().positive(),symbol:z.string().trim().regex(/^[A-Za-z0-9]{1,24}$/).transform(s=>s.toUpperCase()),
 kind:z.enum(['SPOT','PERPETUAL','FUTURE']),currency:denomination,side:z.enum(['LONG','SHORT']),
 quantity:positive,entryPrice:nonnegative,markPrice:nonnegative.nullable(),margin:nonnegative,
 expiry:z.string().default(''),notes:z.string().max(2000).default(''),
 mode:z.enum(['EXISTING','TRADE']),fee:nonnegative,
}).superRefine((v,c)=>{
 if(v.symbol===v.currency)c.addIssue({code:'custom',message:'Use account cash for the settlement asset'});
 if(v.kind==='SPOT'&&(v.side!=='LONG'||!new D(v.margin).isZero()))c.addIssue({code:'custom',message:'Spot holdings must be long with no margin'});
 if(v.kind!=='SPOT'&&new D(v.entryPrice).lte(0))c.addIssue({code:'custom',message:'Derivatives require a positive entry price'});
 if(v.kind==='FUTURE'&&(!/^\d{4}-\d{2}-\d{2}$/.test(v.expiry)||!Number.isFinite(Date.parse(v.expiry+'T00:00:00Z'))||new Date(v.expiry+'T00:00:00Z').toISOString().slice(0,10)!==v.expiry))c.addIssue({code:'custom',message:'A valid futures expiry is required'});
 if(v.mode==='EXISTING'&&!new D(v.fee).isZero())c.addIssue({code:'custom',message:'Existing positions must use zero fee; use fee records for past charges'});
});
export const commandSchema=z.object({requestId:z.string().uuid(),revision:z.number().int().nonnegative(),at:z.string().datetime(),notes:z.string().max(2000).default('')});
export const closeSchema=commandSchema.extend({quantity:positive,price:nonnegative,fee:nonnegative});
export const flowSchema=commandSchema.extend({currency:denomination,kind:z.enum(['DEPOSIT','WITHDRAWAL','FUNDING','FEE','CASH_CORRECTION','PROFIT_CORRECTION']),amount});
export type Currency=z.infer<typeof denomination>;
export type CryptoAccount={id:number;name:string;venue:string;cash:Record<Currency,string>;revision:number;since:string};
export type CryptoPosition=z.infer<typeof positionSchema> & {id:string;openedAt:string;quoteAt:string|null;priceSource:string};
export type CryptoEvent={id:string;accountId:number;kind:string;at:string;currency:Currency;cashDelta:string;realized:string;notes:string;symbol?:string;quantity?:string;price?:string;fee?:string};
export type CryptoSummary={currency:Currency;cash:string;spotValue:string|null;margin:string;realized:string;unrealized:string|null;totalPnl:string|null;equity:string|null;missing:number};
export type CryptoData={accounts:CryptoAccount[];positions:CryptoPosition[];events:CryptoEvent[];summaries:CryptoSummary[]};
export function valuation(p:CryptoPosition){
 if(p.markPrice===null)return null;
 const quantity=new D(p.quantity),price=new D(p.markPrice);
 return {value:p.kind==='SPOT'?quantity.mul(price).toFixed():p.margin,notional:quantity.mul(price).toFixed(),unrealized:price.minus(p.entryPrice).mul(quantity).mul(p.side==='LONG'?1:-1).toFixed()};
}
export function summarize(accounts:CryptoAccount[],positions:CryptoPosition[],events:CryptoEvent[]):CryptoSummary[]{
 return (['USDT','USDC'] as const).map(currency=>{
  const rows=positions.filter(p=>p.currency===currency),missing=rows.filter(p=>p.markPrice===null).length;
  const cash=accounts.reduce((sum,a)=>sum.plus(a.cash[currency]),new D(0));
  const margin=rows.filter(p=>p.kind!=='SPOT').reduce((sum,p)=>sum.plus(p.margin),new D(0));
  const spot=rows.filter(p=>p.kind==='SPOT').reduce((sum,p)=>sum.plus(valuation(p)?.value??0),new D(0));
  const unrealized=rows.reduce((sum,p)=>sum.plus(valuation(p)?.unrealized??0),new D(0));
  const realized=events.filter(e=>e.currency===currency).reduce((sum,e)=>sum.plus(e.realized),new D(0));
  const derivative=rows.filter(p=>p.kind!=='SPOT').reduce((sum,p)=>sum.plus(valuation(p)?.unrealized??0),new D(0));
  return {currency,cash:cash.toFixed(),spotValue:missing?null:spot.toFixed(),margin:margin.toFixed(),realized:realized.toFixed(),unrealized:missing?null:unrealized.toFixed(),totalPnl:missing?null:realized.plus(unrealized).toFixed(),equity:missing?null:cash.plus(spot).plus(margin).plus(derivative).toFixed(),missing};
 });
}
