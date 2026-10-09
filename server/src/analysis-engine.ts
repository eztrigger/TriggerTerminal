export type AssetLeg={conId?:number;symbol:string;assetType:string;currency:string;expiry:string;right:string;strike:number|null;multiplier:number|null;quantity:number;avgCost:number|null;marketPrice:number|null};
export const contractKey=(l:AssetLeg)=>JSON.stringify([l.conId??null,l.symbol,l.assetType,l.currency,l.expiry,l.right,l.strike,l.multiplier]);
export type Allocation={positionId:number;legKey:string;quantity:number};
export type AnalysisStrategy={id:number;name:string;strategyId:string;allocations:Allocation[]};
export const category=(type:string)=>type==='CASH'?'cash':type==='STK'?'stocks':['OPT','FOP'].includes(type)?'options':type==='FUT'?'futures':['ETF','FUND'].includes(type)?'funds':type==='DEPOSIT'?'deposits':'unknown';
export function normalCdf(x:number){
 if(x===Infinity)return 1;if(x===-Infinity)return 0;
 const t=1/(1+.2316419*Math.abs(x)),d=.3989422804014327*Math.exp(-x*x/2);
 const p=1-d*t*(.319381530+t*(-.356563782+t*(1.781477937+t*(-1.821255978+t*1.330274429))));
 return x>=0?p:1-p;
}
export function itmProbability(spot:number,strike:number,t:number,iv:number,rate:number,dividend:number,right:string){
 if(![spot,strike,t,iv,rate,dividend].every(Number.isFinite)||spot<=0||strike<=0||t<=0||iv<=0||!['C','P'].includes(right))return null;
 const d2=(Math.log(spot/strike)+(rate-dividend-iv*iv/2)*t)/(iv*Math.sqrt(t));
 return normalCdf(right==='C'?d2:-d2);
}
// Standard US equity expiry at 16:00 New York, with DST inferred for that date.
export function expiryYears(expiry:string,now=new Date()){
 if(!/^\d{8}$/.test(expiry))return null;
 const date=expiry.slice(0,4)+'-'+expiry.slice(4,6)+'-'+expiry.slice(6,8);
 const sample=new Date(date+'T20:00:00Z');if(!Number.isFinite(sample.getTime())||sample.toISOString().slice(0,10)!==date)return null;
 const hour=Number(new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',hour:'2-digit',hourCycle:'h23'}).format(sample));
 const end=sample.getTime()+(16-hour)*3600000;
 return Math.max(0,(end-now.getTime())/(365*86400000));
}
export function expirationAnalysis(legs:AssetLeg[],basis:'opening'|'current'){
 const reason=!legs.length?'empty':new Set(legs.map(l=>l.symbol+'|'+l.currency)).size!==1?'mixed':legs.some(l=>!['STK','ETF','OPT'].includes(l.assetType))?'unsupported':new Set(legs.filter(l=>l.assetType==='OPT').map(l=>l.expiry)).size!==1?'calendar':legs.some(l=>l.multiplier===null||!Number.isFinite(l.multiplier)||l.multiplier<=0||!Number.isFinite(l.quantity)||l.quantity===0||(l.assetType==='OPT'&&(l.strike===null||!Number.isFinite(l.strike)||l.strike<=0||!['C','P'].includes(l.right))))?'invalid':legs.some(l=>!Number.isFinite(basis==='opening'?l.avgCost:l.marketPrice)||(basis==='opening'?l.avgCost:l.marketPrice)===null)?'missing':null;
 if(reason)return {reason,maxLoss:null,maxProfit:null,breakEvens:[] as number[],knots:[] as number[],pnl:(_s:number):number|null=>null,tailSlope:0};
 const cost=legs.reduce((sum,l)=>sum+l.quantity*l.multiplier!*(basis==='opening'?l.avgCost!:l.marketPrice!),0);
 const pnl=(s:number)=>legs.reduce((sum,l)=>sum+l.quantity*l.multiplier!*(['STK','ETF'].includes(l.assetType)?s:Math.max(0,l.right==='C'?s-l.strike!:l.strike!-s)),0)-cost;
 const knots=[0,...new Set(legs.filter(l=>l.assetType==='OPT').map(l=>l.strike!))].sort((a,b)=>a-b);
 const tailSlope=legs.reduce((sum,l)=>sum+(['STK','ETF'].includes(l.assetType)||l.right==='C'?l.quantity*l.multiplier!:0),0);
 const values=knots.map(pnl),min=Math.min(...values),max=Math.max(...values),breakEvens:number[]=[];
 for(let i=0;i<knots.length-1;i++){
  const a=knots[i],b=knots[i+1],pa=pnl(a),pb=pnl(b);
  if(Math.abs(pa)<1e-9)breakEvens.push(a);
  if(pa*pb<0)breakEvens.push(a+(b-a)*(-pa)/(pb-pa));
 }
 const last=knots.at(-1)!,pv=pnl(last);
 if(Math.abs(pv)<1e-9)breakEvens.push(last);
 if(tailSlope!==0&&-pv/tailSlope>0)breakEvens.push(last-pv/tailSlope);
 return {reason:null,maxLoss:tailSlope<0?Infinity:Math.max(0,-min),maxProfit:tailSlope>0?Infinity:Math.max(0,max),breakEvens:[...new Set(breakEvens)],knots,pnl,tailSlope};
}
export function profitProbability(result:ReturnType<typeof expirationAnalysis>,spot:number,t:number,iv:number,rate:number,dividend:number){
 if(result.reason||![spot,t,iv,rate,dividend].every(Number.isFinite)||spot<=0||t<=0||iv<=0)return null;
 const cdf=(s:number)=>s===0?0:s===Infinity?1:normalCdf((Math.log(s/spot)-(rate-dividend-iv*iv/2)*t)/(iv*Math.sqrt(t)));
 const edges=[0,...result.breakEvens.filter(x=>x>0),Infinity].sort((a,b)=>a-b);let probability=0;
 for(let i=0;i<edges.length-1;i++){
  const a=edges[i],b=edges[i+1],probe=b===Infinity?a+Math.max(1,spot):(a+b)/2;
  if(result.pnl(probe)!>0)probability+=cdf(b)-cdf(a);
 }
 return Math.min(1,Math.max(0,probability));
}
export const scoreModules={
 quality:{weight:20,metrics:{roic:6,operatingMargin:4,cfoAssets:4,accruals:3,earningsStability:3}},
 growth:{weight:20,metrics:{revenueCagr:6,perShareProfitGrowth:5,revenueGrowth:4,marginChange:3,growthContinuity:2}},
 value:{weight:20,metrics:{earningsYield:5,fcfYield:5,cfoEv:5,historicalValue:5}},
 safety:{weight:20,metrics:{netDebtEbitda:6,interestCoverage:5,debtCoverage:4,cashflowHealth:3,dilution:2}},
 market:{weight:10,metrics:{momentum:5,trend:3,liquidity:2}},
 stewardship:{weight:10,metrics:{payoutCoverage:4,allocation:3,disclosure:3}}
};
export function percentileScore(target:number|null,peers:number[],higher=true){
 if(target===null||!Number.isFinite(target)||peers.length<20||peers.some(x=>!Number.isFinite(x))||!peers.includes(target))return null;
 const p=(peers.filter(x=>x<target).length+(peers.filter(x=>x===target).length-1)/2)/(peers.length-1);
 return Math.min(1,Math.max(0,((higher?p:1-p)-.1)/.8));
}
export function triggerpoints(scores:Record<string,number|null>,coreReady:boolean,applicable=true){
 const modules=Object.entries(scoreModules).map(([id,m])=>{
  let earned=0,available=0;
  const metrics=Object.entries(m.metrics).map(([key,weight])=>{
   const s=scores[key];const valid=typeof s==='number'&&Number.isFinite(s)&&s>=0&&s<=1;
   if(valid){earned+=s*weight;available+=weight;}
   return {key,weight,points:valid?s!*weight:null};
  });
  return {id,weight:m.weight,earned,available,metrics};
 });
 const available=modules.reduce((n,m)=>n+m.available,0);
 const eligible=applicable&&coreReady&&available>=85&&modules.every(m=>m.available/m.weight>=.6);
 return {score:eligible?Math.round(modules.reduce((n,m)=>n+m.earned*m.weight/m.available,0)):null,coverage:available,provisional:available<100,modules};
}
export function lifecycleScenario(legs:AssetLeg[],prices:Record<string,number>,settlement:'physical'|'cash',earlyShort=false){
 if(!legs.length||new Set(legs.map(l=>l.symbol+'|'+l.currency)).size!==1||legs.some(l=>!['STK','ETF','OPT'].includes(l.assetType)||l.multiplier===null||l.multiplier<=0||l.avgCost===null||(l.assetType==='OPT'&&(!['C','P'].includes(l.right)||l.strike===null||l.strike<=0))))return null;
 const expiries=[...new Set(legs.filter(l=>l.assetType==='OPT').map(l=>l.expiry))].sort();
 if(!expiries.length||expiries.some(e=>!Number.isFinite(prices[e])||prices[e]<=0))return null;
 if(earlyShort&&legs.some(l=>l.assetType==='OPT'&&l.expiry===expiries[0]&&l.quantity>0))return null;
 let cash=-legs.reduce((sum,l)=>sum+l.quantity*l.multiplier!*l.avgCost!,0),shares=legs.filter(l=>['STK','ETF'].includes(l.assetType)).reduce((sum,l)=>sum+l.quantity*l.multiplier!,0);
 const steps:{expiry:string;price:number;shares:number;cash:number;early:boolean}[]=[];
 for(const expiry of expiries){const price=prices[expiry];let shareChange=0,cashChange=0;
  for(const l of legs.filter(l=>l.assetType==='OPT'&&l.expiry===expiry)){
   const itm=l.right==='C'?price>l.strike!:price<l.strike!;
   // Early short assignment is a user-selected path, not an estimated exercise policy.
   const exercise=itm||(earlyShort&&expiry===expiries[0]&&l.quantity<0);
   if(!exercise)continue;
   if(settlement==='cash')cashChange+=l.quantity*l.multiplier!*Math.max(0,l.right==='C'?price-l.strike!:l.strike!-price);
   else{const change=l.quantity*l.multiplier!*(l.right==='C'?1:-1);shareChange+=change;cashChange-=change*l.strike!;}
  }
  cash+=cashChange;shares+=shareChange;steps.push({expiry,price,shares:shareChange,cash:cashChange,early:earlyShort&&expiry===expiries[0]});
 }
 const terminalPrice=prices[expiries.at(-1)!];
 return {pnl:cash+shares*terminalPrice,cash,shares,terminalPrice,steps};
}
