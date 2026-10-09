import {blackScholes} from 'black-scholes';
import {legAmounts,type Position,type PositionLeg} from './holdings-view';
export type AnalysisLeg={position:Position;leg:PositionLeg};
export type Scenario={spot:number;date:string;iv:number;rate:number;dividend:number};
export const stockTypes=new Set(['STK','ETF']);
export const analysisLegs=(rows:Position[]):AnalysisLeg[]=>rows.filter(p=>p.active).flatMap(position=>position.legs.filter(l=>l.quantity!==0).map(leg=>({position,leg})));
export const underlyingKey=(l:PositionLeg)=>l.symbol.trim().toUpperCase()+' / '+l.currency;
export function theoretical(l:PositionLeg,s:Scenario):number|null {
 if(!Number.isFinite(s.spot)||s.spot<=0)return null;
 if(stockTypes.has(l.assetType))return s.spot;
 if(l.assetType!=='OPT'||l.strike===null||l.strike<=0||!['C','P'].includes(l.right)||!/^\d{8}$/.test(l.expiry))return null;
 const expiry=Date.parse(l.expiry.slice(0,4)+'-'+l.expiry.slice(4,6)+'-'+l.expiry.slice(6)+'T00:00:00Z');
 const date=Date.parse(s.date+'T00:00:00Z');if(!Number.isFinite(date)||!Number.isFinite(expiry))return null;
 const intrinsic=Math.max(0,l.right==='C'?s.spot-l.strike:l.strike-s.spot);
 if(date>expiry)return null; // A past delivery needs a price path, not today's terminal spot.
 const t=(expiry-date)/86400000/365;
 if(t===0)return intrinsic;
 if(![s.iv,s.rate,s.dividend].every(Number.isFinite)||s.iv<=0)return null;
 const value=blackScholes(s.spot*Math.exp(-s.dividend*t),l.strike,t,s.iv,s.rate,l.right==='C'?'call':'put');
 return Number.isFinite(value)?Math.max(0,value):null;
}
export function scenarioTotals(items:AnalysisLeg[],s:Scenario,fee=0){
 let value=0,pnl=0,missing=0;
 for(const {leg:l} of items){const price=theoretical(l,s);if(price===null||l.avgCost===null||l.multiplier===null){missing++;continue;}const scale=l.quantity*l.multiplier;value+=scale*price;pnl+=scale*(price-l.avgCost);}
 return {value:missing?null:value,pnl:missing?null:pnl-fee,missing};
}
export function sensitivities(items:AnalysisLeg[],s:Scenario){
 const step=Math.max(.01,s.spot*.001),base=scenarioTotals(items,s).value;
 const up=scenarioTotals(items,{...s,spot:s.spot+step}).value,down=scenarioTotals(items,{...s,spot:Math.max(.0001,s.spot-step)}).value;
 const vol=scenarioTotals(items,{...s,iv:s.iv+.01}).value;
 const next=new Date(s.date+'T00:00:00Z');next.setUTCDate(next.getUTCDate()+1);
 const tomorrow=Number.isFinite(next.getTime())?scenarioTotals(items,{...s,date:next.toISOString().slice(0,10)}).value:null;
 return {delta:base===null||up===null||down===null?null:(up-down)/(2*step),gamma:base===null||up===null||down===null?null:(up-2*base+down)/(step*step),vega:base===null||vol===null?null:vol-base,theta:base===null||tomorrow===null?null:tomorrow-base};
}
export function liquidation(items:AnalysisLeg[],fee=0){
 let cash=0,pnl=0,missing=0;
 for(const {leg:l} of items){const price=l.quantity>0?l.bid:l.ask;if(price===undefined||price===null||price<0||l.avgCost===null||l.multiplier===null){missing++;continue;}const scale=l.quantity*l.multiplier;cash+=scale*price;pnl+=scale*(price-l.avgCost);}
 return {cash:missing?null:cash-fee,pnl:missing?null:pnl-fee,missing};
}
export function exposure(items:AnalysisLeg[]){
 const grouped=new Map<string,{key:string;value:number;pnl:number;gross:number;missing:number;legs:number}>();
 for(const {position,leg} of items){const key=underlyingKey(leg);const g=grouped.get(key)??{key,value:0,pnl:0,gross:0,missing:0,legs:0};const a=legAmounts(leg,position.source);g.legs++;if(a.value===null||a.pnl===null)g.missing++;g.value+=a.value??0;g.pnl+=a.pnl??0;g.gross+=Math.abs(a.value??0);grouped.set(key,g);}
 return [...grouped.values()].sort((a,b)=>b.gross-a.gross);
}
export function delivery(l:PositionLeg,spot:number){
 if(l.assetType!=='OPT'||l.strike===null||l.multiplier===null||!['C','P'].includes(l.right)||!Number.isFinite(spot)||spot<=0)return null;
 const itm=l.right==='C'?spot>l.strike:spot<l.strike;
 const shares=itm?l.quantity*l.multiplier*(l.right==='C'?1:-1):0;
 return {shares,cash:-shares*l.strike};
}
