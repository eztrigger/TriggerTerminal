// Stable identifiers are shared by local persistence and the analysis interface.
export const strategyFamilies = ['Equity', 'Income & protection', 'Vertical', 'Volatility', 'Butterfly & condor', 'Calendar & diagonal', 'Ratio', 'Synthetic & arbitrage', 'Custom'] as const;
export type Strategy = {id:string; family:typeof strategyFamilies[number]; en:string; zh:string; aliases?:string[]};
const family=(category:Strategy['family'], entries:[string,string,string,string[]?][]):Strategy[]=>entries.map(([id,en,zh,aliases])=>({id,en,zh,aliases,family:category}));
export const strategies:Strategy[]=[
 ...family('Equity',[
 ['long-stock','Long stock','股票多头'],['short-stock','Short stock','股票空头'],['long-call','Long call','买入看涨期权'],['long-put','Long put','买入看跌期权'],['short-call','Naked call','裸卖看涨期权',['short call','uncovered call']],['short-put','Naked put','裸卖看跌期权',['short put','uncovered put']],['leaps-call','LEAPS call','长期看涨期权'],['leaps-put','LEAPS put','长期看跌期权']]),
 ...family('Income & protection',[
 ['cash-secured-put','Cash-secured put','现金担保看跌',['cash secured put','csp']],['covered-call','Covered call','备兑看涨',['buy write','buy-write']],['covered-put','Covered put','备兑看跌'],['protective-put','Protective put','保护性看跌',['married put']],['protective-call','Protective call','保护性看涨'],['collar','Collar','领口策略',['protective collar']],['covered-strangle','Covered strangle','备兑宽跨式',['covered combination']],['cash-backed-call','Cash-backed call','现金支持看涨',['cash secured call']],['wheel','Wheel','轮动收息'],['stock-repair','Stock repair','股票修复',['covered ratio spread']],['pmcc','Poor man’s covered call','长期看涨备兑',['poor mans covered call','poor man covered call','pmcc']]]),
 ...family('Vertical',[
 ['bull-call','Bull call spread','牛市看涨价差',['debit call spread']],['bear-call','Bear call spread','熊市看涨价差',['credit call spread']],['bull-put','Bull put spread','牛市看跌价差',['credit put spread']],['bear-put','Bear put spread','熊市看跌价差',['debit put spread']],['double-bull','Double bull spread','双牛市价差'],['double-bear','Double bear spread','双熊市价差']]),
 ...family('Volatility',[
 ['long-straddle','Long straddle','买入跨式'],['short-straddle','Short straddle','卖出跨式'],['long-strangle','Long strangle','买入宽跨式',['long combination']],['short-strangle','Short strangle','卖出宽跨式'],['long-guts','Long guts','买入内跨式'],['short-guts','Short guts','卖出内跨式'],['strip','Strip','双看跌跨式'],['strap','Strap','双看涨跨式']]),
 ...family('Butterfly & condor',[
 ['long-call-butterfly','Long call butterfly','买入看涨蝶式'],['short-call-butterfly','Short call butterfly','卖出看涨蝶式'],['long-put-butterfly','Long put butterfly','买入看跌蝶式'],['short-put-butterfly','Short put butterfly','卖出看跌蝶式'],['iron-butterfly','Short iron butterfly','卖出铁蝶',['iron butterfly']],['reverse-iron-butterfly','Long iron butterfly','买入铁蝶'],['long-call-condor','Long call condor','买入看涨秃鹰'],['short-call-condor','Short call condor','卖出看涨秃鹰'],['long-put-condor','Long put condor','买入看跌秃鹰'],['short-put-condor','Short put condor','卖出看跌秃鹰'],['iron-condor','Iron condor','卖出铁秃鹰',['short condor','short iron condor']],['reverse-iron-condor','Reverse iron condor','买入铁秃鹰',['long iron condor']],['broken-wing-call','Broken-wing call butterfly','折翼看涨蝶式'],['broken-wing-put','Broken-wing put butterfly','折翼看跌蝶式']]),
 ...family('Calendar & diagonal',[
 ['call-calendar','Long call calendar','看涨日历价差',['call calendar','call horizontal']],['put-calendar','Long put calendar','看跌日历价差',['put calendar','put horizontal']],['short-call-calendar','Short call calendar','反向看涨日历'],['short-put-calendar','Short put calendar','反向看跌日历'],['call-diagonal','Call diagonal','看涨对角价差'],['put-diagonal','Put diagonal','看跌对角价差'],['double-calendar','Double calendar','双日历价差'],['double-diagonal','Double diagonal','双对角价差']]),
 ...family('Ratio',[
 ['call-ratio','Call ratio spread','看涨比例价差',['short ratio call spread']],['put-ratio','Put ratio spread','看跌比例价差',['short ratio put spread']],['call-backspread','Call ratio backspread','看涨反向比例价差',['long ratio call spread']],['put-backspread','Put ratio backspread','看跌反向比例价差',['long ratio put spread']],['call-ladder','Call ladder','看涨阶梯'],['put-ladder','Put ladder','看跌阶梯']]),
 ...family('Synthetic & arbitrage',[
 ['synthetic-long-stock','Synthetic long stock','合成股票多头'],['synthetic-short-stock','Synthetic short stock','合成股票空头'],['synthetic-long-call','Synthetic long call','合成看涨多头'],['synthetic-long-put','Synthetic long put','合成看跌多头'],['conversion','Conversion','转换套利'],['reversal','Reversal','反向转换套利'],['long-box','Long box spread','买入箱式价差'],['short-box','Short box spread','卖出箱式价差']]),
 ...family('Custom',[['custom','Custom / unclassified','自定义 / 未分类']])
];
export const strategyIds=new Set(strategies.map(s=>s.id));
export function namedStrategy(name:string):string|null {
 const normalize=(s:string)=>s.toLowerCase().replace(/[’'–-]/g,' ').replace(/\s+/g,' ').trim();
 const n=normalize(name);return strategies.find(s=>[s.en,s.zh,...s.aliases??[]].some(a=>normalize(a)===n))?.id??null;
}
