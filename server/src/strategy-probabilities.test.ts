import {expect,it} from 'vitest';
import {legProfitProbability,spreadExpiryProbabilities,calendarProfitEstimate,europeanValue} from '../../web/lib/strategy-probabilities';
import {expiryYears,itmProbability} from './analysis-engine.js';
const now=new Date('2026-10-08T04:00:00Z');
const leg={symbol:'TEST',assetType:'OPT',currency:'USD',expiry:'20261120',right:'P',strike:105,multiplier:100,quantity:-1,avgCost:6,marketPrice:6,iv:.3};
const t=expiryYears(leg.expiry,now)!;
it('uses premium-adjusted break-even, not ITM, and reverses long/short profitability',()=>{
 const p=legProfitProbability(leg,100,.3,.04,0,+now)!;
 expect(p).toBeCloseTo(1-itmProbability(100,99,t,.3,.04,0,'P')!,10);
 expect(p+legProfitProbability({...leg,quantity:1},100,.3,.04,0,+now)!).toBeCloseTo(1);
 expect(legProfitProbability({...leg,avgCost:null},100,.3,.04,0,+now)).toBeNull();
});
it('computes single-leg exercise zones jointly for credit and debit spreads',()=>{
 const s=spreadExpiryProbabilities([leg,{...leg,strike:95,quantity:1}],100,t,.3,.04,0)!;
 expect(s.shortOnly).toBeCloseTo(itmProbability(100,105,t,.3,.04,0,'P')!-itmProbability(100,95,t,.3,.04,0,'P')!,10);
 expect(s.longOnly).toBe(0);expect(s.shortOnly+s.longOnly+s.both+s.neither).toBeCloseTo(1);
 const debit=spreadExpiryProbabilities([{...leg,quantity:1},{...leg,strike:95,quantity:-1}],100,t,.3,.04,0)!;
 expect(debit.longOnly).toBeCloseTo(s.shortOnly);expect(debit.shortOnly).toBe(0);
 expect(spreadExpiryProbabilities([leg,{...leg,expiry:'20261218'}],100,t,.3,.04,0)).toBeNull();
});
it('retains far-leg time value and estimates near-expiry liquidation profit',()=>{
 const near={...leg,right:'C',strike:100,avgCost:3},far={...near,expiry:'20261218',quantity:1,avgCost:5};
 const result=calendarProfitEstimate([near,far],'opening',100,.3,.04,0,now)!;
 const remaining=expiryYears(far.expiry,now)!-t;
 expect(result.pnl(100)).toBeCloseTo((europeanValue(100,100,remaining,.3,.04,0,'C')-2)*100,8);
 expect(result.breakEvens).toHaveLength(2);
 const [low,high]=result.breakEvens;
 expect(result.probability).toBeCloseTo(itmProbability(100,low,t,.3,.04,0,'C')!-itmProbability(100,high,t,.3,.04,0,'C')!,6);
 expect(result.probability).toBeGreaterThan(0);expect(result.probability).toBeLessThan(1);
 const reverse=calendarProfitEstimate([{...near,quantity:1},{...far,quantity:-1}],'opening',100,.3,.04,0,now)!;
 expect(result.probability+reverse.probability).toBeCloseTo(1,5);
 expect(calendarProfitEstimate([near,{...far,iv:null}],'opening',100,.3,.04,0,now)).toBeNull();
});
