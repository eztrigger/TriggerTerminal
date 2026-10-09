import { technical } from './technical.js';
import { pools, type Pool, type Review, type Params, type Technical, type Check, type Snapshot, type Candidate, type Account, type StockResult, type Run } from './schema.js';

const test=(name:string,value:boolean|null|undefined,detail=''):Check=>({name,state:value==null?'unknown':value?'pass':'fail',detail});
const has=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v);
const every=(values:(boolean|null)[]):boolean|null=>values.includes(false)?false:values.includes(null)?null:true;
const yes=(c:Check[])=>c.every(x=>x.state==='pass');
const inRange=(n:number|null,min:number,max:number)=>n==null?null:n>=min&&n<=max;
const dateDiff=(a:string,b:string)=>Math.round((Date.parse(a.slice(0,10))-Date.parse(b.slice(0,10)))/86400000);
export function evidenceValid(r:Review,scope:string,asOf:string):boolean{
  return r.evidence.some(e=>e.scope===scope&&e.reviewed&&e.fact.trim()&&e.publishedAt&&e.publishedAt<=asOf.slice(0,10)&&(scope!=='financial'||e.periodEnd&&e.version&&e.periodEnd<=e.publishedAt))&&!!r.reviewedAt&&dateDiff(asOf,r.reviewedAt)>=0&&dateDiff(asOf,r.reviewedAt)<=30;
}
export function evaluateStock(snapshot:Snapshot|null,r:Review,p:Params,market:Run['market'],account:Account|null,industry:Technical|null,asOf:string):StockResult{
  const t=technical(snapshot?.bars??[],r.eventDate,asOf),m=r.metrics;
  const metric=(key:keyof typeof m,scope='financial')=>evidenceValid(r,scope,asOf)&&has(m[key])?m[key]!:null;
  const check=(key:keyof Review['checks'],scope='financial'):boolean|null=>!evidenceValid(r,scope,asOf)||!r.checks[key]||r.checks[key]==='unknown'?null:r.checks[key]==='pass';
  const financial=(name:string,key:keyof typeof m,rule:(v:number)=>boolean)=>{const v=metric(key);return test(name,v==null?null:rule(v),v==null?'缺少已审核、带报告期和版本的来源':String(v));};
  const cmp=(name:string,n:number|null,rule:(n:number)=>boolean)=>test(name,n==null?null:rule(n),n==null?'数据缺失':String(Math.round(n*1000)/1000));
  const common:Check[]=[test('IBKR 股票日线',!!snapshot&&t.bars>=252,`${t.bars} 根有效完成日线；不足252日进入观察`),
    test('美国上市普通股资格',check('securityEligible','security'),snapshot?`${snapshot.stockType} · ${snapshot.exchange}${r.adr?' · ADR':''}`:'无合约主数据'),
    cmp('市值门槛',metric('marketCapB','security'),x=>x>=p.minMarketCapB),cmp('20日平均成交额',t.dollarVolume20,x=>x>=p.minDollarVolumeM*1e6),
    test('财务与经营可信度',check('financialReliable')),test('事件日历复核',check('eventsReviewed','event')),
    test('下一财报日期已确认',evidenceValid(r,'event',asOf)&&r.earningsConfirmed&&r.earningsDate?dateDiff(r.earningsDate,asOf)>0:null,r.earningsDate||'缺少公司IR确认日期'),
    test('公司行为已复核',check('corporateActionsReviewed','event')),test('已审核保守估值',metric('valueLow','valuation')==null?null:metric('valueLow','valuation')!>0&&has(m.valueHigh)&&m.valueHigh!>=m.valueLow!),
    test('SPY/VIX 市场数据',market.spy?.bars&&market.spy.bars>=252&&has(market.vix)&&has(market.vix3m)?true:null,'未取得时不判定普通风险环境'),
  ];
  if(snapshot?.exchange&&/OTC|PINK|VALUE|GREY/i.test(snapshot.exchange))common.push(test('排除 OTC',false,snapshot.exchange));
  if(snapshot?.stockType&&/ETF|ETN|FUND|WARRANT|PREFERRED/i.test(snapshot.stockType))common.push(test('排除非普通股',false,snapshot.stockType));
  if(t.asOf)common.push(test('日线新鲜度',dateDiff(asOf,t.asOf)<=5,t.asOf));
  const ordinary=r.model==='ordinary';
  const quality=ordinary?[financial('三财年 FCF > 0','fcf1',x=>x>0),financial('前一财年 FCF > 0','fcf2',x=>x>0),financial('前二财年 FCF > 0','fcf3',x=>x>0),financial('TTM 净利润 > 0','ttmProfit',x=>x>0),financial('净负债/EBITDA ≤ 2.5','netDebtEbitda',x=>x<=2.5),financial('利息保障 ≥ 5','interestCoverage',x=>x>=5)]:[test('特殊行业审核模型',check('industryApproved'),r.model)];
  const trendA=every([t.close!=null&&t.ma200!=null?t.close>t.ma200:null,t.ma200Up,inRange(t.drawdown60,5,15),inRange(t.rsi,35,55)]);
  const trendB=every([t.adx==null?null:t.adx<20,t.ma50Change20==null?null:Math.abs(t.ma50Change20)<=2,t.rangeLow!=null&&t.rangeHigh!=null&&t.close!=null?t.close>=t.rangeLow&&t.close<=(t.rangeLow+t.rangeHigh)/2:null]);
  const trendC=every([t.close!=null&&t.ma200!=null?t.close>t.ma200:null,t.ma50Up10,inRange(t.rsi,40,65),t.close!=null&&t.ma50!=null&&t.atr!=null?t.close<=t.ma50+2*t.atr:null]);
  const eventAge=r.eventDate?dateDiff(asOf,r.eventDate):null;
  const d5=metric('eventDrop5','event'),d20=metric('eventDrop20','event'),rel=metric('eventRelative','event');
  const funds=ordinary?[financial('压力资金覆盖 ≥ 1.5','capitalCoverage',x=>x>=1.5),financial('资金覆盖 ≥ 24个月','runwayMonths',x=>x>=24)]:[test('特殊行业资金模型',check('industryApproved'))];
  const paths:{pool:Pool;checks:Check[]}[]=[
    {pool:'A',checks:[...quality,test('A 趋势/回撤/RSI',trendA)]},
    {pool:'B',checks:[...(ordinary?['profit1','profit2','profit3','fcf1','fcf2','fcf3'].map(k=>financial(`${k} > 0`,k as keyof typeof m,x=>x>0)):[test('特殊行业审核模型',check('industryApproved'))]),financial('12季度营业利润率标准差 ≤ 3pp','marginStd',x=>x<=3&&x>=0),test('商业模式稳定',check('businessStable')),test('B 区间/ADX/均线',trendB)]},
    {pool:'C',checks:[financial('三年收入 CAGR ≥ 10%','revenueCagr',x=>x>=10),...(ordinary?[financial('TTM FCF > 0','ttmFcf',x=>x>0)]:[test('特殊行业审核模型',check('industryApproved'))]),financial('EPS 90日下修不超5%','epsRevision',x=>x>=-5),test('无重大融资缺口',check('fundingAdequate')),test('SBC与稀释计入估值',check('dilutionIncluded','valuation')),test('行业相对质量已复核',check('qualityRelative')),test('C 趋势/RSI/ATR',trendC)]},
    {pool:'D',checks:[test('事件发生于90日内',eventAge==null?null:eventAge>=0&&eventAge<=90),test('事件跌幅与行业相对跌幅',d5==null&&d20==null||rel==null?null:((d5!=null&&d5<=-15)||(d20!=null&&d20<=-25))&&rel!<=-10),test('事件损害可界定',check('eventDamageBounded','event')),cmp('修复证据 ≥ 2',metric('repairCount','event'),x=>x>=2),cmp('已兑现证据 ≥ 1',metric('realizedRepairCount','event'),x=>x>=1),...funds,test('D 五日不破低且三日>MA10',t.eventStable)]},
    {pool:'E',checks:[...funds,financial('两季度改善指标 ≥ 2','improvementCount',x=>x>=2),test('改善指标独立性',check('operatingEvidenceIndependent')),test('SBC与稀释计入估值',check('dilutionIncluded','valuation')),test('E 20日不创新低且MA20上升',every([t.noNewLow20,t.ma20Up5]))]},
    {pool:'F',checks:[...quality,test('行业20日跌幅 ≥ 10%',industry?.return20==null?null:industry.return20<=-10,r.industryEtf||'需设置可核实行业基准'),test('相对行业不落后超过5pp',industry?.return20==null||t.return20==null?null:t.return20-industry.return20>=-5),test('行业基准选择已审核',evidenceValid(r,'industry',asOf)?true:null),financial('EPS 90日下修不超5%','epsRevision',x=>x>=-5),test('无公司独立恶化',check('noIndependentDeterioration','event')),test('F 三日无新低',t.noNewLow3)]},
  ].filter(path=>p.pools.includes(path.pool as Pool)) as {pool:Pool;checks:Check[]}[];
  for(const path of paths){
    path.checks.push(test('无日线风险否决',t.risks.length===0,t.risks.join('；')));
    if(!['D','E'].includes(path.pool))path.checks.push(test('无周线结构冲突',t.weeklyConflict===true?false:true,t.weeklyConflict==null?'104周样本/结构不足：不加周期确认分':'完成周线'));
    if(p.patternRequired)path.checks.push(test('匹配且有效的已确认形态',t.patterns.some(x=>x.state==='confirmed'&&x.pools.includes(path.pool)&&x.strikeCap!=null),'形态不能替代机会池的独立趋势条件'));
  }
  const matched=paths.filter(x=>yes(x.checks)),tags=matched.map(x=>x.pool);
  const highRisk=tags.some(x=>['C','D','E'].includes(x));
  const bear=market.spy?.close!=null&&market.spy.ma200!=null&&market.spy.close<market.spy.ma200&&market.spy.ma50Up10===false;
  const stressed=bear&&((market.vix??0)>=30||(market.vix!=null&&market.vix3m!=null&&market.vix/market.vix3m>1));
  if(stressed)common.push(test('高风险市场人工复核',r.evidence.some(e=>e.scope==='event'&&e.reviewed&&e.fact.includes('市场风险'))&&evidenceValid(r,'event',asOf)?true:null,'SPY弱势叠加VIX压力；新开预算减半'));
  const allCandidates:Candidate[]=[];
  for(const o of snapshot?.options??[]){
    const dte=dateDiff(o.expiry,asOf),premium=o.bid!=null?o.bid-p.feesPerContract/100:null,cost=premium==null?null:o.strike-premium,capital=100*o.strike*p.contracts;
    const premium30=o.bid!=null?((100*o.bid-p.feesPerContract)/(100*o.strike))*30/dte*100:null;
    const mid=o.bid!=null&&o.ask!=null?(o.bid+o.ask)/2:null;
    const low=metric('valueLow','valuation');
    const stress=[.9,.8,.7].map(f=>premium!=null&&snapshot?.spot!=null?100*p.contracts*(premium-Math.max(o.strike-snapshot.spot*f,0)):NaN);
    const base:Check[]=[...common,test('标准股票 Put / 乘数100',o.right==='P'&&o.multiplier===100&&check('standardDelivery','security')===true,'交割条款需复核'),
      test('有效 Bid/Ask',o.bid==null||o.ask==null?null:o.bid>0&&o.ask>=o.bid),cmp('OI 门槛',o.oi,x=>x>=p.minOi),test('相对价差门槛',mid&&o.ask!=null&&o.bid!=null?(o.ask-o.bid)/mid*100<=p.maxSpreadPct:null),
      test('实时行情确认',o.marketDataType==null?null:o.marketDataType===1,({1:'实时',2:'冻结报价，仅供研究，交易前需刷新实时行情',3:'延迟报价，仅供研究',4:'延迟冻结报价，仅供研究'} as Record<number,string>)[o.marketDataType??0]??'行情类型未确认'),
      test('买盘数量覆盖计划张数',o.bidSize==null?null:o.bidSize>=p.contracts,'显示深度不是成交保证'),test('报价接收时间可用',o.receivedAt&&snapshot?.spotAt?true:null),
      test('财报日期缓冲',r.earningsConfirmed&&r.earningsDate?dateDiff(r.earningsDate,o.expiry)>=p.earningsBufferDays:null,r.earningsDate||'未知'),
      test('无跨期重大二元节点',r.events.some(e=>!e.resolved&&e.binary&&!e.date)?null:!r.events.some(e=>!e.resolved&&e.binary&&e.date>=asOf.slice(0,10)&&e.date<=o.expiry)),
      cmp('30日净权利金门槛',premium30,x=>x>=p.minPremium30Pct),test('正净权利金',premium==null?null:premium>0),
    ];
    const portfolio:Check[]=[];const verifiedAccount=!!account&&account.cashConfirmed&&account.exposuresConfirmed&&has(account.nav)&&account.nav>0&&has(account.cash)&&dateDiff(asOf,account.asOf)>=0&&dateDiff(asOf,account.asOf)<=1;
    if(verifiedAccount){
      const total=account!.positions.reduce((s,x)=>s+x.putObligation,0),same=account!.positions.filter(x=>x.symbol===r.symbol).reduce((s,x)=>s+Math.abs(x.marketValue)+x.putObligation,0);
      const sector=account!.positions.filter(x=>x.sector===r.sector).reduce((s,x)=>s+Math.abs(x.marketValue)+x.putObligation,0);
      const week=(date:string)=>{const d=new Date(date+'T00:00:00Z');d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7));return d.toISOString().slice(0,10);};
      const weekOb=account!.positions.filter(x=>x.expiry&&week(x.expiry)===week(o.expiry)).reduce((s,x)=>s+x.putObligation,0);
      const nav=account!.nav!,budget=nav*p.maxCspPct/100;
      portfolio.push(test('现金100%覆盖（扣除已有Put义务）',account!.cash!-total>=capital),test('单股持仓与义务上限',same+capital<=nav*(highRisk||stressed?p.singleRiskPct:p.singleNormalPct)/100),test('行业暴露上限',r.sector?sector+capital<=nav*p.sectorPct/100:null),test('CSP总预算 / 风险状态新开预算',total+capital<=budget&&capital<=Math.max(0,budget-total)*(bear?.5:1)),test('同到期周预算',weekOb+capital<=budget*p.expiryWeekPct/100));
      if(tags.some(x=>x==='D'||x==='E'))portfolio.push(test('D/E合计预算',account!.positions.filter(x=>x.highRisk).reduce((s,x)=>s+Math.abs(x.marketValue)+x.putObligation,0)+capital<=nav*p.eventPct/100));
    }
    const eligiblePaths=paths.filter(path=>yes(path.checks));
    for(const path of eligiblePaths.length?eligiblePaths:paths){
      const factor=({A:.9,B:.9,C:.85,D:.8,E:.75,F:.85})[path.pool];
      const poolMin=['A','C'].includes(path.pool)?30:21,deltaLow=['A','B'].includes(path.pool)?.15:.1,deltaHigh=['A','B'].includes(path.pool)?.25:.2;
      const caps=t.patterns.filter(x=>x.state==='confirmed'&&x.pools.includes(path.pool)&&x.strikeCap!=null).map(x=>x.strikeCap!);
      const filters:Check[]=[...base,...path.checks,...portfolio,test('机会池DTE与可调范围',dte>=Math.max(poolMin,p.dteMin)&&dte<=Math.min(45,p.dteMax)),test('机会池Delta与可调范围',o.delta==null?null:o.delta<0&&Math.abs(o.delta)>=Math.max(deltaLow,p.deltaMin)&&Math.abs(o.delta)<=Math.min(deltaHigh,p.deltaMax)),test('接股成本≤保守价值折扣上限',cost==null||low==null?null:cost<=low*factor,low==null?'缺少估值':`≤ ${(low*factor).toFixed(2)}`)];
      if(p.patternRequired)filters.push(test('行权价≤形态技术上限',caps.length?o.strike<=Math.min(...caps):null,caps.length?String(Math.min(...caps)):'无事前确认支撑'));
      if(path.pool==='B')filters.push(test('行权价≤此前60日区间下界',t.rangeLow==null?null:o.strike<=t.rangeLow));
      if((o.iv??0)>.6)filters.push(test('IV>60%尾部风险复核',r.evidence.some(e=>e.scope==='event'&&e.reviewed&&e.fact.includes('高IV'))?true:null));
      const state=statusFor(filters,true),discount=cost!=null&&low?100*(1-cost/low):null;
      const confirmed=t.patterns.some(x=>x.state==='confirmed'&&x.pools.includes(path.pool));
      const scores:Record<string,number|null>={quality:yes(path.checks.filter(x=>!x.name.includes('形态')&&!x.name.includes('趋势')&&!x.name.includes('周线')&&!x.name.includes('日线')))?25:null,
        valuation:discount==null?null:Math.min(20,Math.max(0,discount)),technical:yes(path.checks)?5+(confirmed?5:0)+(confirmed&&t.weeklyConflict===false?5:0):0,
        economics:premium30==null?null:Math.min(5,Math.max(0,premium30/p.minPremium30Pct*2.5||0))+(o.oi!=null&&o.oi>=p.minOi?5:0)+(mid&&o.ask!=null&&o.bid!=null&&(o.ask-o.bid)/mid<=p.maxSpreadPct/100?5:0),
        events:check('eventsReviewed','event')===true?15:null,portfolio:verifiedAccount&&yes(portfolio)?10:null};
      const weights=p.ranking==='value'?{quality:1,valuation:1.5,technical:1,economics:1/3,events:1,portfolio:1}:p.ranking==='premium'?{quality:1,valuation:.75,technical:1,economics:4/3,events:1,portfolio:1}:null;
      const score=Object.values(scores).every(has)?Object.entries(scores).reduce((sum,[k,v])=>sum+v!*(weights?.[k as keyof typeof weights]??1),0):null;
      const age=o.receivedAt?(Date.parse(asOf)-Date.parse(o.receivedAt))/1000:Infinity;
      const synced=o.receivedAt&&snapshot?.spotAt?Math.abs(Date.parse(o.receivedAt)-Date.parse(snapshot.spotAt))<=60000:false;
      allCandidates.push({id:`${r.symbol}:${o.conId}:${path.pool}`,symbol:r.symbol,pool:path.pool,tags:tags.length?tags:[path.pool],risk:highRisk||['C','D','E'].includes(path.pool)||stressed?'高风险研究':'常规研究',status:state,option:o,dte,netPremium:premium,effectiveCost:cost,discountPct:discount,premium30Pct:premium30,cash:capital,stress:stress.map(x=>Number.isFinite(x)?x:null),checks:filters,score,scores,evidencePct:Math.round(filters.filter(x=>x.state!=='unknown').length/filters.length*100),personalized:verifiedAccount,marketBudgetFactor:bear?.5:1,
        execution:o.marketDataType===1&&snapshot?.marketDataType===1&&age>=0&&age<=60&&synced?'扫描时实时研究报价 · 非成交承诺':'仅研究 · 延迟/冻结/时间不同步或过期',nextStep:filters.find(x=>x.state!=='pass')?.name??'限价、交割条款、账户现金及最新事件复核'});
    }
  }
  const qualified=allCandidates.filter(c=>c.status==='可研究交易');
  // Deduplicate one contract across pools, retaining the stricter risk tags.
  const unique=[...new Map(qualified.sort((a,b)=>a.effectiveCost!-b.effectiveCost!).map(c=>[c.option.conId,c])).values()];
  const frontier=unique.filter(a=>!unique.some(b=>b!==a&&b.cash<=a.cash&&(b.premium30Pct??0)>=(a.premium30Pct??0)&&b.stress[1]!=null&&a.stress[1]!=null&&b.stress[1]>=a.stress[1]&&b.dte<=a.dte&&(b.cash<a.cash||(b.premium30Pct??0)>(a.premium30Pct??0)||b.stress[1]>a.stress[1]||b.dte<a.dte)));
  const candidates=(frontier.length?frontier:allCandidates.sort((a,b)=>a.checks.filter(x=>x.state!=='pass').length-b.checks.filter(x=>x.state!=='pass').length)).sort((a,b)=>(b.score??-1)-(a.score??-1)||(b.premium30Pct??0)-(a.premium30Pct??0)).filter((c,i,a)=>a.findIndex(x=>x.option.conId===c.option.conId)===i).slice(0,3);
  const status=qualified.length?'可研究交易':candidates.length?candidates[0].status:statusFor([...common,...(matched.length?[]:paths.flatMap(x=>x.checks))],false);
  return {symbol:r.symbol,snapshot,technical:t,review:r,checks:common,paths,candidates,status,errors:snapshot?.errors??[],publicData:null};
}
function statusFor(checks:Check[],hasOptions:boolean):string{
  if(checks.some(x=>x.state==='fail'&&/普通股资格|排除|财务与经营可信度/.test(x.name)))return '排除';
  if(checks.some(x=>x.state!=='pass'&&/事件日历|下一财报|二元节点|事件损害|公司行为/.test(x.name)))return '事件待核查';
  if(checks.some(x=>x.state==='unknown'))return '数据不足';
  if(checks.some(x=>x.state==='fail'))return '等待入场';
  return hasOptions?'可研究交易':'仅适合股票研究';
}
