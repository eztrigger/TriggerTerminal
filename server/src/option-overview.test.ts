import {expect,it} from 'vitest';
import {assignmentProbability,expiryCountdown,optionMoneyness,directionalProbability,optionBreakEven,unallocatedQuantity,barrierTouchProbability,touchProbability,optionLiquidity,shortOptionObligation} from '../../web/lib/option-overview';
import {contractKey} from './analysis-engine';
const leg={symbol:'XYZ',assetType:'OPT',currency:'USD',expiry:'20261218',right:'P',strike:100,multiplier:100,quantity:-5,avgCost:4,marketPrice:2};
it('keeps partial unallocated quantities and distinguishes the same contract across accounts',()=>{
 const allocations=[{positionId:1,legKey:contractKey(leg),quantity:-2},{positionId:2,legKey:contractKey(leg),quantity:-5}];
 expect(unallocatedQuantity(1,leg,allocations)).toBe(3);expect(unallocatedQuantity(2,leg,allocations)).toBe(0);
 expect(unallocatedQuantity(3,leg,allocations)).toBe(5);
});
it('computes call and put moneyness independently of whether the option was sold',()=>{
 expect(optionMoneyness(leg,110)).toMatchObject({state:'otm',amount:10,fraction:10/110});
 expect(optionMoneyness({...leg,right:'C'},110)?.state).toBe('itm');
 expect(optionMoneyness(leg,100)?.state).toBe('atm');expect(optionMoneyness(leg,null)).toBeNull();
 expect(optionBreakEven(leg)).toBe(96);expect(optionBreakEven({...leg,right:'C'})).toBe(104);
});
it('uses a live DST-aware countdown and never shows negative time',()=>{
 expect(expiryCountdown('20261218',Date.parse('2026-12-18T20:00:00Z'))).toMatchObject({hours:1,days:0,tone:'urgent'});
 expect(expiryCountdown('20260717',Date.parse('2026-07-17T19:00:00Z'))?.hours).toBe(1);
 expect(expiryCountdown('20261218',Date.parse('2026-12-19T20:00:00Z'))?.minutes).toBe(0);
 expect(expiryCountdown('20260230',Date.now())).toBeNull();
});
it('shows long ITM and short OTM probabilities as complements, never fabricating missing inputs',()=>{
 const now=Date.parse('2026-10-07T12:00:00Z');
 const sold=directionalProbability(leg,110,.3,.04,0,now)!;
 const bought=directionalProbability({...leg,quantity:1},110,.3,.04,0,now)!;
 expect(sold+bought).toBeCloseTo(1);expect(sold).toBeGreaterThan(.5);
 expect(directionalProbability(leg,110,null,.04,0,now)).toBeNull();
 expect(directionalProbability(leg,110,.3,.04,null,now)).toBeNull();
});
it('matches independent numerical integration of first-passage density for upper and lower barriers',()=>{
 // Reference values from Simpson integration of a/(sigma*sqrt(2*pi*t^3))*exp(-(a-mu*t)^2/(2*sigma^2*t)).
 expect(barrierTouchProbability(100,110,.5,.3,.05,.01)).toBeCloseTo(.6497548542951114,6);
 expect(barrierTouchProbability(110,100,.5,.3,.05,.01)).toBeCloseTo(.6566723346620804,6);
 expect(barrierTouchProbability(100,100,1,.2,.03,0)).toBe(1);
 expect(barrierTouchProbability(100,110,0,.2,.03,0)).toBeNull();
 const now=Date.parse('2026-10-07T12:00:00Z');
 expect(touchProbability(leg,110,null,.04,0,now)).toBeNull();
 // Touching the exact strike from now is independent of Call/Put and buy/sell.
 expect(touchProbability(leg,110,.3,.04,0,now)).toBe(touchProbability({...leg,quantity:5,right:'C'},110,.3,.04,0,now));
});
it('keeps tiny-volatility barrier estimates finite rather than producing Infinity times zero',()=>{
 expect(barrierTouchProbability(100,110,1,.0001,.5,0)).toBeCloseTo(1);
 expect(barrierTouchProbability(100,110,1,.0001,-.5,0)).toBeCloseTo(0);
 for(const K of [1,99,101,10000]){const p=barrierTouchProbability(100,K,.01,.0001,.4,0)!;expect(p).toBeGreaterThanOrEqual(0);expect(p).toBeLessThanOrEqual(1);}
});
it('prices closing longs at bid and shorts at ask, scales only the remaining units and rejects broken books',()=>{
 expect(optionLiquidity(leg,2,1,1.4)).toMatchObject({closeCash:-280,closePnl:520});
 expect(optionLiquidity({...leg,quantity:2},2,1,1.4)).toMatchObject({closeCash:200,closePnl:-600});
 expect(optionLiquidity(leg,2,1,1.4).halfSpreadCost).toBeCloseTo(40);
 expect(optionLiquidity(leg,2,1,1.4).spreadFraction).toBeCloseTo(.4/1.2);
 for(const [bid,ask] of [[null,1],[2,1],[0,0],[NaN,1]])expect(optionLiquidity(leg,2,bid,ask).closeCash).toBeNull();
 expect(optionLiquidity({...leg,quantity:1},2,0,1)).toMatchObject({noBid:true,closeCash:null});
});
it('separates put delivery cash from max loss and flags naked call loss without assuming coverage',()=>{
 expect(shortOptionObligation(leg,2,95,5.01)).toMatchObject({shares:200,gross:20000,maxLoss:19200,itm:true});
 expect(shortOptionObligation({...leg,right:'C'},2,105,5.01)?.maxLoss).toBe(Infinity);
 expect(shortOptionObligation(leg,2,95,4)?.extrinsic).toBeNull(); // Inconsistent/stale mark below intrinsic.
 expect(shortOptionObligation({...leg,quantity:1},2,95,5)).toBeNull();
});

it('uses expiry ITM probability for assignment on either side, not short OTM probability',()=>{
 const now=Date.parse('2026-10-07T12:00:00Z');
 const p=assignmentProbability(leg,110,.3,.04,0,now)!;
 expect(p).toBeLessThan(.5);
 expect(assignmentProbability({...leg,quantity:5},110,.3,.04,0,now)).toBe(p);
 expect(p+directionalProbability(leg,110,.3,.04,0,now)!).toBeCloseTo(1);
 expect(assignmentProbability(leg,110,null,.04,0,now)).toBeNull();
});
