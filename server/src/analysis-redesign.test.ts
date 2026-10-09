import {expect,it} from 'vitest';
import Database from 'better-sqlite3';
import {lifecycleScenario,category,contractKey,expirationAnalysis,expiryYears,itmProbability,normalCdf,profitProbability,percentileScore,triggerpoints,scoreModules,type AssetLeg} from './analysis-engine';
import {createAnalysisStore} from './analysis-store';
import {summarizeResearch} from './analysis-research';
const put:AssetLeg={symbol:'XYZ',assetType:'OPT',currency:'USD',expiry:'20261218',right:'P',strike:100,multiplier:100,quantity:-1,avgCost:4,marketPrice:2};
it('categorizes ETF as funds and deposits independently',()=>{expect(category('ETF')).toBe('funds');expect(category('FOP')).toBe('options');expect(category('DEPOSIT')).toBe('deposits');expect(category('OTHER')).toBe('unknown');});
it('calculates naked put and call bounds over all nonnegative underlying prices',()=>{
 const p=expirationAnalysis([put],'opening');expect(p.maxLoss).toBe(9600);expect(p.maxProfit).toBe(400);expect(p.breakEvens).toEqual([96]);
 const c=expirationAnalysis([{...put,right:'C'}],'opening');expect(c.maxLoss).toBe(Infinity);expect(c.maxProfit).toBe(400);expect(c.breakEvens).toEqual([104]);
});
it('uses actual ratios and stock allocations rather than strategy names',()=>{
 const stock={...put,assetType:'STK',quantity:100,multiplier:1,avgCost:95,marketPrice:102};
 const shortCall={...put,right:'C',strike:110};
 const covered=expirationAnalysis([stock,shortCall],'opening');expect(covered.maxLoss).toBe(9100);expect(covered.maxProfit).toBe(1900);
 const partial=expirationAnalysis([{...stock,quantity:50},shortCall],'opening');expect(partial.maxLoss).toBe(Infinity);
});
it('matches credit spread and opportunity-cost basis',()=>{
 const long={...put,quantity:1,strike:95,avgCost:1,marketPrice:.5};
 const initial=expirationAnalysis([put,long],'opening');expect(initial.maxLoss).toBe(200);expect(initial.maxProfit).toBe(300);expect(initial.breakEvens).toEqual([97]);
 const current=expirationAnalysis([put,long],'current');expect(current.maxLoss).toBe(350);expect(current.maxProfit).toBe(150);expect(current.breakEvens).toEqual([98.5]);
});
it('finds both straddle break-evens and correctly bounded iron condor tail',()=>{
 const straddle=expirationAnalysis([{...put,quantity:1,avgCost:4},{...put,quantity:1,right:'C',avgCost:3}],'opening');
 expect(straddle.maxLoss).toBe(700);expect(straddle.maxProfit).toBe(Infinity);expect(straddle.breakEvens).toEqual([93,107]);
 const condor=expirationAnalysis([{...put,strike:95,quantity:1,avgCost:1},put,{...put,right:'C',strike:110,avgCost:4},{...put,right:'C',strike:115,quantity:1,avgCost:1}],'opening');
 // Six dollars premium for a five-dollar width is an arbitrage input; generic math must still be exact.
 expect(condor.maxLoss).toBe(0);expect(condor.maxProfit).toBe(600);
});
it('rejects unsupported, mixed, missing and multi-expiry models',()=>{
 expect(expirationAnalysis([put,{...put,expiry:'20270115'}],'opening').reason).toBe('calendar');
 expect(expirationAnalysis([{...put,assetType:'FOP'}],'opening').reason).toBe('unsupported');
 expect(expirationAnalysis([put,{...put,currency:'CAD'}],'opening').reason).toBe('mixed');
 expect(expirationAnalysis([{...put,avgCost:null}],'opening').reason).toBe('missing');
 expect(expirationAnalysis([{...put,multiplier:null}],'opening').reason).toBe('invalid');
});
it('uses N(d2) and distinguishes ITM from profitable expiry',()=>{
 expect(normalCdf(0)).toBeCloseTo(.5,6);
 const c=itmProbability(100,100,1,.2,0,0,'C')!;expect(c).toBeCloseTo(.460172,5);
 expect(c+itmProbability(100,100,1,.2,0,0,'P')!).toBeCloseTo(1,8);
 const p=profitProbability(expirationAnalysis([put],'opening'),100,1,.2,0,0)!;
 expect(p).toBeGreaterThan(1-itmProbability(100,100,1,.2,0,0,'P')!);
 expect(profitProbability(expirationAnalysis([put,{...put,expiry:'20270115'}],'opening'),100,1,.2,0,0)).toBeNull();
 expect(itmProbability(100,100,0,.2,0,0,'C')).toBeNull();
});
it('sums two disjoint profitable regions rather than multiplying leg probabilities',()=>{
 const result=expirationAnalysis([{...put,quantity:1},{...put,right:'C',quantity:1}],'opening');
 const p=profitProbability(result,100,1,.2,0,0)!;
 const expected=itmProbability(100,92,1,.2,0,0,'P')!+itmProbability(100,108,1,.2,0,0,'C')!;
 expect(p).toBeCloseTo(expected,6);
});
it('handles US daylight saving expiry and rejects impossible dates',()=>{
 expect(expiryYears('20260717',new Date('2026-07-17T20:00:00Z'))).toBe(0);
 expect(expiryYears('20261218',new Date('2026-12-18T20:00:00Z'))).toBeCloseTo(1/(365*24),8);
 expect(expiryYears('20260230')).toBeNull();
});
it('protects score weights, coverage, ties and applicability',()=>{
 const scores=Object.fromEntries(Object.values(scoreModules).flatMap(m=>Object.keys(m.metrics).map(k=>[k,.7])));
 expect(Object.keys(scores)).toHaveLength(25);expect(triggerpoints(scores,true).score).toBe(70);
 expect(triggerpoints(scores,false).score).toBeNull();expect(triggerpoints(scores,true,false).score).toBeNull();
 delete scores.roic;expect(triggerpoints(scores,true)).toMatchObject({score:70,coverage:94,provisional:true});delete scores.operatingMargin;expect(triggerpoints(scores,true).score).toBeNull();
 expect(percentileScore(2,Array(20).fill(2))).toBe(.5);expect(percentileScore(2,[2])).toBeNull();
});
it('persists partial allocations across accounts and currencies but rejects mixed underlyings',()=>{
 const db=new Database(':memory:');db.exec('CREATE TABLE holding_positions(id INTEGER PRIMARY KEY,account_id INTEGER,active INTEGER,legs TEXT)');
 const add=(id:number,account:number,l:AssetLeg)=>db.prepare('INSERT INTO holding_positions VALUES(?,?,1,?)').run(id,account,JSON.stringify([l]));
 add(1,1,{...put,quantity:-5});add(2,2,{...put,quantity:1});
 const store=createAnalysisStore(db),key=contractKey(put);
 const id=store.save('First','custom',[{positionId:1,legKey:key,quantity:-2}]);
 expect(store.list().strategies[0].allocations[0].quantity).toBe(-2);
 store.save('Second','custom',[{positionId:1,legKey:key,quantity:-3}]);
 expect(()=>store.save('Too much','custom',[{positionId:1,legKey:key,quantity:-1}])).toThrow('exceeds');
 expect(()=>store.save('Wrong sign','custom',[{positionId:1,legKey:key,quantity:1}])).toThrow('Invalid');
 store.save('Cross','custom',[{positionId:1,legKey:key,quantity:-2},{positionId:2,legKey:key,quantity:1}],id);
 add(3,3,{...put,currency:'CAD',quantity:1});
 store.save('Cross currency','custom',[{positionId:1,legKey:key,quantity:-2},{positionId:3,legKey:contractKey({...put,currency:'CAD'}),quantity:1}],id);
 add(4,3,{...put,symbol:'OTHER',quantity:1});
 expect(()=>store.save('Mixed underlying','custom',[{positionId:1,legKey:key,quantity:-2},{positionId:4,legKey:contractKey({...put,symbol:'OTHER'}),quantity:1}],id)).toThrow('same underlying');
 expect(store.list().strategies[0].name).toBe('Cross currency');
 expect(store.list().strategies).toHaveLength(2);
 store.remove(id);expect(store.list().strategies).toHaveLength(1);expect(db.prepare('SELECT COUNT(*) AS n FROM holding_positions').get()).toEqual({n:4});db.close();
});
it('never invents rating, financial facts, or a total from sparse provider data',()=>{
 const data=summarizeResearch({},[],'fund');expect(data.fundRating).toBeNull();expect(data.fundRisk).toBeNull();expect(data.scoring.score).toBeNull();expect(data.scoring.coverage).toBe(0);
 expect(summarizeResearch({fundPerformance:{overallRisk:4,overallMorningstarRating:5}},[],'fund')).toMatchObject({fundRisk:4,fundRating:5});
});
it('models different cash and physical calendar paths through far expiry',()=>{
 const legs=[{...put,right:'C',strike:100,avgCost:3},{...put,right:'C',quantity:1,strike:100,expiry:'20270115',avgCost:5}];
 const prices={'20261218':120,'20270115':80};
 const physical=lifecycleScenario(legs,prices,'physical')!;
 expect(physical.steps[0]).toMatchObject({shares:-100,cash:10000});
 expect(physical.shares).toBe(-100);expect(physical.pnl).toBe(1800);
 expect(lifecycleScenario(legs,prices,'cash')?.pnl).toBe(-2200);
 const early=lifecycleScenario(legs,{'20261218':90,'20270115':120},'physical',true)!;
 expect(early.steps[0].shares).toBe(-100);expect(early.shares).toBe(0);expect(early.pnl).toBe(-200);
 expect(lifecycleScenario(legs,{'20261218':90},'physical')).toBeNull();
});
it('does not mix reporting and quote currencies in valuation yields',()=>{
 const r={price:{currency:'USD',regularMarketPrice:100,marketCap:1000},financialData:{financialCurrency:'CNY',freeCashflow:50,operatingCashflow:60},defaultKeyStatistics:{trailingEps:5,enterpriseValue:1200}};
 const research=summarizeResearch(r,[],'stock');expect(research.raw.fcfYield).toBeNull();expect(research.raw.earningsYield).toBeNull();
 const aligned=summarizeResearch({...r,financialData:{...r.financialData,financialCurrency:'USD'}},[],'stock');expect(aligned.raw.fcfYield).toBe(.05);
});
