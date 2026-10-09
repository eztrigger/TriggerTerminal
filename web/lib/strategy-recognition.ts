import {contractKey,type AssetLeg,type AnalysisStrategy} from '../../server/src/analysis-engine';
import type {AnalysisLeg} from './portfolio-analysis';
import {unallocatedQuantity} from './option-overview';
// Identify structure only; a short put alone does not establish cash collateral.
export function recognizeStrategy(legs:AssetLeg[]):string {
 if(!legs.length||new Set(legs.map(l=>l.symbol.trim().toUpperCase())).size!==1)return 'custom';
 if(legs.length===1){const l=legs[0];return ['OPT','FOP'].includes(l.assetType)&&['C','P'].includes(l.right)?(l.quantity>0?'long-':'short-')+(l.right==='C'?'call':'put'):'custom';}
 if(legs.some(l=>l.assetType!=='OPT'||!l.strike||!l.multiplier)||new Set(legs.map(l=>l.currency+'|'+l.multiplier)).size!==1)return 'custom';
 if(legs.length!==2)return 'custom';
 const [a,b]=[...legs].sort((a,b)=>a.strike!-b.strike!);
 if(Math.abs(a.quantity)!==Math.abs(b.quantity))return 'custom';
 if(a.expiry===b.expiry){
  if(a.right===b.right&&a.quantity*b.quantity<0&&a.strike!==b.strike)return a.right==='C'?(a.quantity>0?'bull-call':'bear-call'):(a.quantity>0?'bull-put':'bear-put');
  if(a.right!==b.right&&a.quantity*b.quantity>0){const put=legs.find(l=>l.right==='P'),call=legs.find(l=>l.right==='C');if(!put||!call)return 'custom';return (a.quantity>0?'long-':'short-')+(put.strike===call.strike?'straddle':put.strike!<call.strike!?'strangle':'guts');}
 }
 if(a.right===b.right&&a.expiry!==b.expiry&&a.quantity*b.quantity<0){
  const near=a.expiry<b.expiry?a:b;
  if(a.strike===b.strike)return (near.quantity>0?'short-':'')+(a.right==='C'?'call-calendar':'put-calendar');
  return a.right==='C'?'call-diagonal':'put-diagonal';
 }
 return 'custom';
}
export function automaticStrategies(items:AnalysisLeg[],manual:AnalysisStrategy[]):AnalysisStrategy[]{
 const residual=items.filter(x=>['OPT','FOP'].includes(x.leg.assetType)).map(x=>({...x,leg:{...x.leg,quantity:Math.sign(x.leg.quantity)*unallocatedQuantity(x.position.id,x.leg,manual.flatMap(s=>s.allocations))}})).filter(x=>x.leg.quantity);
 const positions=new Map<string,AnalysisLeg[]>();
 for(const x of residual){const key=x.position.id+'|'+x.leg.symbol+'|'+x.leg.currency;positions.set(key,[...positions.get(key)??[],x]);}
 const groups:AnalysisStrategy[]=[];
 for(const rows of positions.values()){
  const recognized=recognizeStrategy(rows.map(x=>x.leg));
  // Preserve explicit multi-leg positions when recognizable; don't invent pairings across unrelated records.
  for(const bundle of recognized==='custom'?rows.map(x=>[x]):[rows]){
   const strategyId=recognizeStrategy(bundle.map(x=>x.leg));
   groups.push({id:-(groups.length+1),name:bundle[0].leg.symbol,strategyId,allocations:bundle.map(x=>({positionId:x.position.id,legKey:contractKey(x.leg),quantity:x.leg.quantity}))});
  }
 }
 return groups;
}
