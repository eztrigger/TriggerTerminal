import {expect,it} from 'vitest';
import {strategies,strategyIds,namedStrategy} from './strategy-catalog';
import {analysisLegs,scenarioTotals,delivery,theoretical,liquidation,sensitivities,exposure} from '../../web/lib/portfolio-analysis';
import type {Position,PositionLeg} from '../../web/lib/holdings-view';
const stock:PositionLeg={symbol:'TD',assetType:'STK',quantity:12.5,multiplier:1,currency:'CAD',expiry:'',right:'',strike:null,avgCost:90,marketPrice:100,bid:99,ask:101};
const option:PositionLeg={...stock,assetType:'OPT',quantity:-1,multiplier:100,currency:'USD',expiry:'20261218',right:'P',strike:100,avgCost:4,marketPrice:2,bid:1.9,ask:2.1};
const p=(leg:PositionLeg):Position=>({id:1,accountId:1,name:'Test',notes:'',active:1,source:'MANUAL',updatedAt:'',legs:[leg]});
const s={spot:95,date:'2026-12-18',iv:.35,rate:.04,dividend:0};
it('has distinct, bilingual stable strategy IDs and conservative exact aliases',()=>{
 expect(strategies.length).toBeGreaterThan(65);expect(strategyIds.size).toBe(strategies.length);
 expect(namedStrategy('Cash Secured Put')).toBe('cash-secured-put');
 expect(namedStrategy('Naked Call')).toBe('short-call');expect(namedStrategy('my put idea')).toBeNull();
 expect(strategies.every(s=>s.en&&s.zh&&s.family)).toBe(true);
});
it('supports fractional stock holdings and signed option intrinsic P&L',()=>{
 expect(scenarioTotals(analysisLegs([p(stock)]),{...s,spot:100}).pnl).toBe(125);
 expect(scenarioTotals(analysisLegs([p(option)]),s).pnl).toBe(-100);
 expect(scenarioTotals(analysisLegs([p({...option,right:'C',quantity:1,avgCost:2})]),{...s,spot:110}).pnl).toBe(800);
});
it('does not invent past-expiry option values, unsupported futures or missing cost',()=>{
 expect(theoretical(option,{...s,date:'2026-12-19'})).toBeNull();
 expect(theoretical({...option,assetType:'FOP'},s)).toBeNull();
 expect(scenarioTotals(analysisLegs([p({...option,avgCost:null})]),s)).toMatchObject({pnl:null,missing:1});
 expect(theoretical(option,{...s,spot:NaN})).toBeNull();
});
it('matches published library benchmark and put-call parity with dividend yield',()=>{
 const call={...option,right:'C',strike:34};
 expect(theoretical(call,{spot:30,date:'2026-09-18',iv:.2,rate:.08,dividend:0})).toBeCloseTo(.238349,2);
 const scenario={spot:100,date:'2026-10-03',iv:.2,rate:.04,dividend:.02};
 const t=76/365;
 expect(theoretical({...option,right:'C'},scenario)!-theoretical(option,scenario)!).toBeCloseTo(100*Math.exp(-.02*t)-100*Math.exp(-.04*t),5);
});
it('delivery signs reconcile for long and short calls and puts',()=>{
 expect(delivery(option,95)).toEqual({shares:100,cash:-10000});
 expect(delivery({...option,right:'C'},110)).toEqual({shares:-100,cash:10000});
 expect(delivery({...option,quantity:1},95)).toEqual({shares:-100,cash:10000});
 expect(delivery({...option,right:'C',quantity:1},110)).toEqual({shares:100,cash:-10000});
 expect(delivery(option,100)).toEqual({shares:0,cash:-0});
});
it('liquidation uses conservative signed sides and total fees once',()=>{
 expect(liquidation(analysisLegs([p(stock)]),1)).toMatchObject({cash:1236.5,pnl:111.5});
 expect(liquidation(analysisLegs([p(option)]),1)).toMatchObject({cash:-211,pnl:189});
 expect(liquidation(analysisLegs([p({...option,ask:null})]))).toMatchObject({pnl:null,missing:1});
});
it('keeps currencies separate and Greeks use signed share equivalents',()=>{
 const groups=exposure(analysisLegs([p(stock),p(option)]));expect(groups).toHaveLength(2);
 expect(sensitivities(analysisLegs([p(stock)]),s).delta).toBeCloseTo(12.5);
 expect(sensitivities(analysisLegs([p(stock)]),s).theta).toBe(0);
});
