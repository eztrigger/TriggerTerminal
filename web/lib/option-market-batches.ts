import {contractKey,type AssetLeg} from '../../server/src/analysis-engine';
export function optionMarketBatches<T extends AssetLeg>(legs:T[]):T[][]{
 const groups=new Map<string,T[]>();
 for(const leg of new Map(legs.filter(l=>l.assetType==='OPT').map(l=>[contractKey(l),l])).values()){
  const key=leg.symbol+'|'+leg.currency;groups.set(key,[...groups.get(key)??[],leg]);
 }
 return [...groups.values()].flatMap(rows=>Array.from({length:Math.ceil(rows.length/20)},(_,i)=>rows.slice(i*20,i*20+20)));
}
