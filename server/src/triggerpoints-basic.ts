/** Auditable heuristic v1. Thresholds are product rules, not empirical return forecasts. */
export type Evidence={source:string;asOf:string|null;filed?:string;url?:string;priceAsOf?:string|null;inputs?:unknown;formula?:string};
type Rule={key:string;label:string;weight:number;low:number;high:number;unit:'percent'|'ratio'|'checks';formula:string;core:boolean};
const rule=(key:string,label:string,weight:number,low:number,high:number,unit:Rule['unit'],formula:string,core=false):Rule=>({key,label,weight,low,high,unit,formula,core});
const general=[
 rule('operatingMargin','营业利润率',20,0,.2,'percent','operating income / revenue',true),
 rule('revenueGrowth','收入同比增长',15,-.1,.2,'percent','revenue / prior-year revenue - 1'),
 rule('cfoAssets','经营现金流 / 资产',20,0,.15,'percent','operating cash flow / average total assets',true),
 rule('debtCoverage','流动比率',15,.5,2,'ratio','current assets / current liabilities',true),
 rule('earningsYield','盈利收益率',15,0,.08,'percent','1 / trailing P/E, or EPS / price in the same currency'),
 rule('trend','中长期趋势',15,0,3,'checks','count(price > MA200, MA50 > MA200, MA200 > MA200 20 sessions ago)')
];
const bank=[
 rule('returnOnEquity','净资产收益率',35,0,.15,'percent','provider-reported return on equity',true),
 rule('revenueGrowth','收入同比增长',20,-.1,.15,'percent','revenue / prior-year revenue - 1'),
 rule('earningsYield','盈利收益率',30,0,.1,'percent','1 / trailing P/E, or EPS / price in the same currency',true),
 rule('trend','中长期趋势',15,0,3,'checks','count(price > MA200, MA50 > MA200, MA200 > MA200 20 sessions ago)')
];
export function basicTriggerpoints(raw:Record<string,number|null>,sources:Record<string,Evidence>,sector:string,industry:string,now=Date.now()){
 const profile=/\bbanks?\b/i.test(industry)?'bank':!sector||/financial|real estate/i.test(sector)?'unsupported':'general';
 const rules=profile==='bank'?bank:general;
 const metrics=rules.map(r=>{
  const value=raw[r.key]??null,evidence=sources[r.key]??null;
  const age=evidence?.asOf?(now-Date.parse(evidence.asOf))/86400000:NaN;
  const maxAge=r.key==='trend'?7:evidence?.source==='SEC EDGAR'?450:180;
  const priceAge=evidence?.priceAsOf?(now-Date.parse(evidence.priceAsOf))/86400000:NaN;
  const status=value===null||!Number.isFinite(value)?'missing':!evidence||!Number.isFinite(age)?'undated':age<0||age>maxAge?'stale':r.key==='earningsYield'&&(!Number.isFinite(priceAge)||priceAge<0||priceAge>7)?'stale':r.key==='trend'&&(!Number.isInteger(value)||value<0||value>3)||r.key==='debtCoverage'&&value<0?'invalid':'ready';
  const fraction=status==='ready'?Math.max(0,Math.min(1,(value!-r.low)/(r.high-r.low))):null;
  return {...r,value,evidence,status,maxAgeDays:maxAge,points:fraction===null?null:fraction*r.weight};
 });
 const coverage=metrics.reduce((a,m)=>a+(m.points===null?0:m.weight),0),earned=metrics.reduce((a,m)=>a+(m.points??0),0);
 const missingCore=metrics.filter(m=>m.core&&m.points===null).map(m=>m.key);
 const reasons=[...(profile==='unsupported'?['unsupported-profile']:[]),...(missingCore.length?['missing-core']:[]),...(coverage<80?['low-coverage']:[])];
 const score=reasons.length?null:Math.round(earned*100/coverage+1e-9);
 return {version:'basic-v1',profile,score,coverage,earned,provisional:coverage<100,missingCore,reasons,metrics,
  // Range if every unavailable metric received zero or full credit, using original 100-point weights.
  bounds:{low:Math.round(earned*10)/10,high:Math.round((earned+100-coverage)*10)/10}};
}
export type BasicScore=ReturnType<typeof basicTriggerpoints>;
