import {expiryYears,expirationAnalysis,profitProbability,itmProbability,normalCdf,type AssetLeg} from '../../server/src/analysis-engine';
export function legProfitProbability(leg:AssetLeg,spot:number|null,iv:number|null,rate:number|null,dividend:number|null,now:number){
 return profitProbability(expirationAnalysis([leg],'opening'),spot??NaN,expiryYears(leg.expiry,new Date(now))??NaN,iv??NaN,rate??NaN,dividend??NaN);
}
// Mutually exclusive terminal-price events, not independent-leg probabilities.
export function spreadExpiryProbabilities(legs:AssetLeg[],spot:number,t:number,iv:number,rate:number,dividend:number){
 if(legs.length!==2||legs.some(l=>l.assetType!=='OPT'||!Number.isFinite(l.quantity)||!l.quantity||l.multiplier!==100||!Number.isFinite(l.strike)||!(l.strike!>0)||!['C','P'].includes(l.right))||new Set(legs.map(l=>l.symbol+'|'+l.currency+'|'+l.expiry)).size!==1||itmProbability(spot,1,t,iv,rate,dividend,'C')===null)return null;
 const cdf=(s:number)=>s===0?0:s===Infinity?1:normalCdf((Math.log(s/spot)-(rate-dividend-iv*iv/2)*t)/(iv*Math.sqrt(t)));
 const edges=[0,...new Set(legs.map(l=>l.strike!)),Infinity].sort((a,b)=>a-b);
 let shortOnly=0,longOnly=0,both=0,neither=0;
 for(let i=1;i<edges.length;i++){
  const a=edges[i-1],b=edges[i],s=b===Infinity?a+spot:(a+b)/2,p=cdf(b)-cdf(a);
  const inside=legs.filter(l=>l.right==='C'?s>l.strike!:s<l.strike!);
  if(inside.length===2)both+=p;else if(!inside.length)neither+=p;else if(inside[0].quantity<0)shortOnly+=p;else longOnly+=p;
 }
 return {shortOnly,longOnly,both,neither,oneLeg:shortOnly+longOnly};
}
export function europeanValue(spot:number,strike:number,t:number,iv:number,rate:number,dividend:number,right:string){
 if(t<=0)return Math.max(0,right==='C'?spot-strike:strike-spot);
 const v=iv*Math.sqrt(t),d1=(Math.log(spot/strike)+(rate-dividend+iv*iv/2)*t)/v,d2=d1-v;
 return right==='C'?spot*Math.exp(-dividend*t)*normalCdf(d1)-strike*Math.exp(-rate*t)*normalCdf(d2):strike*Math.exp(-rate*t)*normalCdf(-d2)-spot*Math.exp(-dividend*t)*normalCdf(-d1);
}
// Liquidate the whole calendar at the earliest expiry. Later legs retain time value.
export function calendarProfitEstimate(legs:(AssetLeg&{iv:number|null})[],basis:'opening'|'current',spot:number,distributionIv:number,rate:number,dividend:number,now=new Date()){
 const terms=legs.map(l=>expiryYears(l.expiry,now)),horizon=Math.min(...terms.map(t=>t??NaN));
 if(legs.length<2||new Set(legs.map(l=>l.symbol+'|'+l.currency)).size!==1||new Set(legs.map(l=>l.expiry)).size<2||![spot,distributionIv,rate,dividend,horizon].every(Number.isFinite)||spot<=0||distributionIv<=0||horizon<=0||legs.some(l=>l.assetType!=='OPT'||l.multiplier!==100||!Number.isFinite(l.quantity)||!l.quantity||!Number.isFinite(l.strike)||!(l.strike!>0)||!['C','P'].includes(l.right)||l.iv===null||!Number.isFinite(l.iv)||l.iv<=0||(basis==='opening'?l.avgCost:l.marketPrice)===null||!Number.isFinite(basis==='opening'?l.avgCost:l.marketPrice)))return null;
 const pnl=(s:number)=>legs.reduce((n,l,i)=>n+l.quantity*l.multiplier!*(europeanValue(s,l.strike!,terms[i]!-horizon,l.iv!,rate,dividend,l.right)-(basis==='opening'?l.avgCost!:l.marketPrice!)),0);
 const s=(z:number)=>spot*Math.exp((rate-dividend-distributionIv**2/2)*horizon+distributionIv*Math.sqrt(horizon)*z);
 let probability=0;const roots:number[]=[];const steps=4096;
 for(let i=0;i<steps;i++){
  const a=-10+20*i/steps,b=-10+20*(i+1)/steps,pa=pnl(s(a)),pb=pnl(s(b));
  if((pa>0)!==(pb>0)){
   let lo=a,hi=b;for(let j=0;j<35;j++){const mid=(lo+hi)/2;if((pnl(s(mid))>0)===(pa>0))lo=mid;else hi=mid;}
   const z=(lo+hi)/2;roots.push(s(z));probability+=pa>0?normalCdf(z)-normalCdf(a):normalCdf(b)-normalCdf(z);
  }else if(pnl(s((a+b)/2))>0)probability+=normalCdf(b)-normalCdf(a);
 }
 return {probability:Math.max(0,Math.min(1,probability)),breakEvens:roots,horizon,pnl};
}
