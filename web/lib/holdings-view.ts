export type PositionLeg={notes?:string;conId?:number;symbol:string;assetType:string;quantity:number;multiplier:number|null;currency:string;expiry:string;right:string;strike:number|null;avgCost:number|null;bidAskAt?:string;bidAskType?:number|null;bid?:number|null;ask?:number|null;quoteAt?:string;quoteBasis?:string;marketDataType?:number|null;marketPrice:number|null;marketValue?:number|null;unrealizedPnl?:number|null};
export type Position={id:number;accountId:number;name:string;notes:string;source:string;active:number;updatedAt:string;strategyId?:string;legs:PositionLeg[]};
export type PositionGroup={id:number;name:string;positionIds:number[];strategyId?:string};
export function underlyingGroups(rows:Position[]) {
 const groups=new Map<string,ReturnType<typeof displayGroups>[number]>();
 for(const row of rows){
  const legs=row.legs.filter(l=>!row.active||l.quantity!==0);
  const symbols=new Set(legs.map(l=>l.symbol.trim().toUpperCase()));
  for(const symbol of symbols){
   const key=symbol||'unknown:'+row.id;
   let group=groups.get(key);
   if(!group){group={key:'symbol:'+key,name:symbol||row.name,groupId:null,rows:[],incomplete:false};groups.set(key,group);}
   group.rows.push({...row,legs:legs.filter(l=>l.symbol.trim().toUpperCase()===symbol)});
  }
 }
 return [...groups.values()];
}
export function parseHoldingQuantity(value:string,whole=false):number|null {
 const text=value.trim();
 if(!/^[+-]?(?:(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(text))return null;
 const quantity=Number(text.replaceAll(',',''));
 return Number.isFinite(quantity)&&quantity!==0&&(!whole||Number.isInteger(quantity))?quantity:null;
}
export function legAmounts(l:PositionLeg,source:string){
 if(l.quantity===0)return {cost:0,value:0,pnl:0};
 const scale=l.multiplier===null?null:l.quantity*l.multiplier;
 return {cost:scale!==null&&l.avgCost!==null?scale*l.avgCost:null,
 value:source==='IBKR'?l.marketValue??null:scale!==null&&l.marketPrice!==null?scale*l.marketPrice:null,
 pnl:source==='IBKR'?l.unrealizedPnl??null:scale!==null&&l.avgCost!==null&&l.marketPrice!==null?scale*(l.marketPrice-l.avgCost):null};
}
export function amounts(rows:Position[]){
 const result:Record<string,{cost:number;value:number;pnl:number;missingCost:number;missingValue:number;missingPnl:number}>={};
 for(const h of rows)for(const l of h.legs){const t=result[l.currency]??(result[l.currency]={cost:0,value:0,pnl:0,missingCost:0,missingValue:0,missingPnl:0});const a=legAmounts(l,h.source);for(const k of ['cost','value','pnl'] as const){if(a[k]===null)t[k==='cost'?'missingCost':k==='value'?'missingValue':'missingPnl']++;else t[k]+=a[k]!;}}
 return result;
}
export const expiryLabel=(v:string)=>v?`${v.slice(0,4)}-${v.slice(4,6)}-${v.slice(6,8)}`:'—';
export function dte(expiry:string,now=new Date()){
 if(!/^\d{8}$/.test(expiry))return null;
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
 return Math.round((Date.parse(expiryLabel(expiry)+'T00:00:00Z')-Date.parse(today+'T00:00:00Z'))/86400000);
}
export function structure(legs:PositionLeg[]):string{
 if(legs.length===1){const l=legs[0];return ['OPT','FOP'].includes(l.assetType)?`${l.quantity>0?'买入':'卖出'} ${l.right==='C'?'Call':'Put'}`:l.assetType==='STK'?'股票':l.assetType;}
 const options=legs.every(l=>l.assetType==='OPT'&&l.strike!==null);
 const same=(key:keyof PositionLeg)=>new Set(legs.map(l=>l[key])).size===1;
 if(!options||!same('symbol')||!same('currency')||!same('multiplier')||legs[0].multiplier===null)return '自定义组合';
 const [a,b]=legs;
 if(legs.length===2&&Math.abs(a.quantity)===Math.abs(b.quantity)){
  if(a.expiry===b.expiry&&a.right===b.right&&a.quantity*b.quantity<0&&a.strike!==b.strike)return `${a.right==='C'?'Call':'Put'} 垂直价差`;
  if(a.expiry===b.expiry&&a.right!==b.right&&a.quantity*b.quantity>0&&(a.strike===b.strike||(a.right==='P'?a.strike!<b.strike!:b.strike!<a.strike!)))return `${a.quantity>0?'买入':'卖出'}${a.strike===b.strike?'跨式 Straddle':'宽跨式 Strangle'}`;
  if(a.expiry!==b.expiry&&a.right===b.right&&a.quantity*b.quantity<0)return a.strike===b.strike?'日历价差 Calendar':'对角价差 Diagonal';
 }
 if(legs.length===4&&same('expiry')&&new Set(legs.map(l=>Math.abs(l.quantity))).size===1){
  const p=legs.filter(l=>l.right==='P').sort((a,b)=>a.strike!-b.strike!);const c=legs.filter(l=>l.right==='C').sort((a,b)=>a.strike!-b.strike!);
  if(p.length===2&&c.length===2&&p[0].strike!<p[1].strike!&&p[1].strike!<c[0].strike!&&c[0].strike!<c[1].strike!&&p[0].quantity>0&&p[1].quantity<0&&c[0].quantity<0&&c[1].quantity>0)return '铁鹰 Iron Condor';
 }
 return '自定义组合';
}
export function displayGroups(rows:Position[],groups:PositionGroup[]){
 const used=new Set<number>();
 const result=groups.flatMap(g=>{const members=rows.filter(h=>g.positionIds.includes(h.id));if(!members.length)return [];members.forEach(h=>used.add(h.id));return [{key:'g'+g.id,name:g.name,groupId:g.id,rows:members,incomplete:members.length!==g.positionIds.length}];});
 return [...result,...rows.filter(h=>!used.has(h.id)).map(h=>({key:'p'+h.id,name:h.name,groupId:null as number|null,rows:[h],incomplete:false}))];
}

export const legIdentity=(leg:PositionLeg)=>JSON.stringify([leg.conId??null,leg.symbol,leg.assetType,leg.currency,leg.expiry,leg.right,leg.strike,leg.multiplier]);
export const assetLabel=(leg:PositionLeg)=>[leg.symbol,leg.assetType,...(['OPT','FOP'].includes(leg.assetType)?[expiryLabel(leg.expiry),leg.strike,leg.right==='C'?'Call':'Put']:[]),leg.currency].join(' · ');
