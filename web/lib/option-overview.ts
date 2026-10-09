import {expiryYears,itmProbability,normalCdf,contractKey,type Allocation,type AssetLeg} from '../../server/src/analysis-engine';
export const optionReference=(positionId:number,leg:AssetLeg)=>positionId+':'+contractKey(leg);
export function unallocatedQuantity(positionId:number,leg:AssetLeg,allocations:Allocation[]){
 const used=allocations.filter(a=>a.positionId===positionId&&a.legKey===contractKey(leg)).reduce((sum,a)=>sum+Math.abs(a.quantity),0);
 return Math.max(0,Math.abs(leg.quantity)-used);
}
export function optionMoneyness(leg:AssetLeg,spot:number|null){
 if(spot===null||!Number.isFinite(spot)||spot<=0||leg.strike===null||leg.strike<=0||!['C','P'].includes(leg.right))return null;
 const signed=(spot-leg.strike)*(leg.right==='C'?1:-1);
 return {state:Math.abs(signed)<1e-8?'atm':signed>0?'itm':'otm',amount:Math.abs(signed),fraction:Math.abs(spot-leg.strike)/spot,move:(leg.strike-spot)/spot};
}
export function expiryCountdown(expiry:string,now:number){
 const years=expiryYears(expiry,new Date(now));if(years===null)return null;
 const minutes=Math.ceil(years*365*24*60);
 return {minutes,days:Math.floor(minutes/1440),hours:Math.floor(minutes%1440/60),remainder:minutes%60,tone:minutes===0?'expired':minutes<=1440?'urgent':minutes<=7*1440?'soon':'normal'};
}
// The UI's assignment estimate is expiry ITM probability for both position sides.
export function assignmentProbability(leg:AssetLeg,spot:number|null,iv:number|null,rate:number|null,dividend:number|null,now:number){
 const t=expiryYears(leg.expiry,new Date(now));
 return itmProbability(spot??NaN,leg.strike??NaN,t??NaN,iv??NaN,rate??NaN,dividend??NaN,leg.right);
}
export function directionalProbability(leg:AssetLeg,spot:number|null,iv:number|null,rate:number|null,dividend:number|null,now:number){
 const t=expiryYears(leg.expiry,new Date(now));
 const p=itmProbability(spot??NaN,leg.strike??NaN,t??NaN,iv??NaN,rate??NaN,dividend??NaN,leg.right);
 return p===null?null:leg.quantity<0?1-p:p;
}
export function optionBreakEven(leg:AssetLeg){
 if(leg.assetType!=='OPT'||leg.strike===null||leg.avgCost===null||leg.avgCost<0||!['C','P'].includes(leg.right))return null;
 return leg.strike+(leg.right==='C'?leg.avgCost:-leg.avgCost);
}

// First passage of log-price under risk-neutral GBM. Upper/lower barriers use the
// same drifted-Brownian formula after reflecting the lower barrier.
// https://www.stat.uchicago.edu/~yibi/teaching/stat317/2021/Lectures/Lecture25.pdf
export function barrierTouchProbability(spot:number,strike:number,t:number,iv:number,rate:number,dividend:number){
 if(![spot,strike,t,iv,rate,dividend].every(Number.isFinite)||spot<=0||strike<=0||t<=0||iv<=0)return null;
 const logBarrier=Math.log(strike)-Math.log(spot),a=Math.abs(logBarrier);
 if(a<1e-12)return 1;
 const variance=iv*iv,mu=(rate-dividend-variance/2)*Math.sign(logBarrier),scale=iv*Math.sqrt(t);
 const z1=(mu*t-a)/scale,z2=(-mu*t-a)/scale;
 // Combine the exponential with the Gaussian tail before exponentiating, to
 // avoid Infinity * 0 for low IV, high drift or a far-away strike.
 let reflected:number;
 if(z2 < -8){const u=1/(z2*z2),mills=1-u+3*u*u-15*u**3+105*u**4;reflected=Math.exp(-.5*z1*z1-Math.log(-z2)-.5*Math.log(2*Math.PI)+Math.log(mills));}
 else reflected=Math.exp(2*mu*a/variance)*normalCdf(z2);
 const p=normalCdf(z1)+reflected;
 return Number.isFinite(p)?Math.max(0,Math.min(1,p)):null;
}
export function touchProbability(leg:AssetLeg,spot:number|null,iv:number|null,rate:number|null,dividend:number|null,now:number){
 return barrierTouchProbability(spot??NaN,leg.strike??NaN,expiryYears(leg.expiry,new Date(now))??NaN,iv??NaN,rate??NaN,dividend??NaN);
}
const nonnegative=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>=0;
export function optionLiquidity(leg:AssetLeg,quantity:number,bid:number|null|undefined,ask:number|null|undefined){
 const book=nonnegative(bid)&&nonnegative(ask)&&ask>0&&ask>=bid;
 const units=leg.multiplier!==null&&Number.isFinite(leg.multiplier)&&leg.multiplier>0&&quantity>0?quantity*leg.multiplier:null;
 const spread=book?ask-bid:null,mid=book?(ask+bid)/2:null;
 const exitPrice=book?(leg.quantity<0?ask:bid>0?bid:null):null;
 const closeCash=exitPrice!==null&&units!==null?exitPrice*units*(leg.quantity<0?-1:1):null;
 return {spread,spreadFraction:spread!==null&&mid!==null?spread/mid:null,noBid:book&&bid===0,
  closeCash,closePnl:exitPrice!==null&&units!==null&&leg.avgCost!==null?(exitPrice-leg.avgCost)*Math.sign(leg.quantity)*units:null,
  halfSpreadCost:spread!==null&&units!==null?spread/2*units:null};
}
export function shortOptionObligation(leg:AssetLeg,quantity:number,spot:number|null,mark:number|null){
 if(leg.assetType!=='OPT'||leg.quantity>=0||!['C','P'].includes(leg.right)||!quantity||quantity<0||leg.multiplier===null||leg.multiplier<=0||leg.strike===null||leg.strike<=0)return null;
 const shares=quantity*leg.multiplier,gross=shares*leg.strike;
 const intrinsic=spot!==null&&spot>0?Math.max(0,leg.right==='C'?spot-leg.strike:leg.strike-spot):null;
 const extrinsic=intrinsic!==null&&mark!==null&&Number.isFinite(mark)&&mark>=intrinsic?mark-intrinsic:null;
 return {shares,gross,extrinsic,itm:intrinsic===null?null:intrinsic>0,
  maxLoss:leg.right==='C'?Infinity:leg.avgCost!==null?Math.max(0,leg.strike-leg.avgCost)*shares:null};
}
