import {it,expect} from 'vitest';
import {recognizeStrategy,automaticStrategies} from '../../web/lib/strategy-recognition';
import {contractKey} from './analysis-engine';
import type {AnalysisLeg} from '../../web/lib/portfolio-analysis';
const leg={symbol:'MCD',assetType:'OPT',currency:'USD',expiry:'20261218',right:'P',strike:100,multiplier:100,quantity:-3,avgCost:4,marketPrice:2};
const item=(id:number,l=leg,accountId=id)=>({position:{id,accountId},leg:l}) as AnalysisLeg;
it('recognizes short puts without assuming cash security and long/short calls',()=>{
 expect(recognizeStrategy([leg])).toBe('short-put');
 expect(recognizeStrategy([{...leg,right:'C'}])).toBe('short-call');
 expect(recognizeStrategy([{...leg,quantity:1}])).toBe('long-put');
});
it('recognizes consistent spreads and calendars but rejects mixed or unequal structures',()=>{
 expect(recognizeStrategy([leg,{...leg,quantity:3,strike:90}])).toBe('bull-put');
 expect(recognizeStrategy([leg,{...leg,quantity:3,expiry:'20270115'}])).toBe('put-calendar');
 expect(recognizeStrategy([leg,{...leg,quantity:2,strike:90}])).toBe('custom');
 expect(recognizeStrategy([leg,{...leg,quantity:3,strike:90,currency:'CAD'}])).toBe('custom');
});
it('manual allocations take priority, residuals remain classified, independent records stay separate',()=>{
 const items=[item(1),item(2)];
 const manual=[{id:1,name:'manual',strategyId:'custom',allocations:[{positionId:1,legKey:contractKey(leg),quantity:-2}]}];
 const auto=automaticStrategies(items,manual);
 expect(auto).toHaveLength(2);expect(auto[0].allocations[0].quantity).toBe(-1);expect(auto[1].allocations[0].quantity).toBe(-3);
 expect(automaticStrategies([item(1)],[{...manual[0],allocations:[{...manual[0].allocations[0],quantity:-3}]}])).toEqual([]);
});
it('recognizes multi-leg records without requiring matching accounts',()=>{
 const rows=[item(1),item(1,{...leg,quantity:3,strike:90},2)];
 expect(automaticStrategies(rows,[])[0].strategyId).toBe('bull-put');
 expect(recognizeStrategy(rows.map(x=>x.leg))).toBe('bull-put');
});
