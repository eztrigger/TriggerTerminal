"use client";
import OptionInOutProbability from './OptionInOutProbability';
import AnalysisHoldingDetails from './AnalysisHoldingDetails';
import {useEffect,useState,type ReactNode} from 'react';
import {readAnalysis,useAnalysisUpdates} from '../lib/analysis-stream';
import {useQueries} from '@tanstack/react-query';
import {Hourglass,Clock3,RotateCw,ShieldAlert,ArrowLeftRight,ChevronRight} from 'lucide-react';
import {optionMarketBatches} from '../lib/option-market-batches';
import {apiPost,fmt} from '../lib/api';
import {tr,uiLocale} from '../lib/i18n';
import {assetLabel,expiryLabel,type PositionLeg} from '../lib/holdings-view';
import type {AnalysisLeg} from '../lib/portfolio-analysis';
import {contractKey} from '../../server/src/analysis-engine';
import {legProfitProbability} from '../lib/strategy-probabilities';
import {assignmentProbability as expiryItmProbability,optionReference,optionMoneyness,expiryCountdown,optionBreakEven,optionLiquidity,shortOptionObligation} from '../lib/option-overview';

type MarketLeg=PositionLeg&{dividend?:{source:string;method:string;asOf:string;url?:string}|null;volume:number|null;openInterest:number|null;volumeSource:string|null;openInterestSource:string|null;bookSource:string|null;bookAt:string|null;bookMarketDataType:number|null;iv:number|null;underlyingPrice:number|null;dividendYield:number|null;rate:{value:number}|null;price:number|null;source:string|null;fetchedAt:string|null;marketDataType:number|null};
type Market={options:MarketLeg[];fetchedAt:string};
type Props={hideHoldingDetails?:boolean;selectionMode?:boolean;renderExpanded?:(x:AnalysisLeg)=>ReactNode;analysisOnly?:boolean;onOpen?:(x:AnalysisLeg)=>void;items:AnalysisLeg[];available:(x:AnalysisLeg)=>number;selected:Set<string>;toggle:(x:AnalysisLeg)=>void;accounts:{id:number;name:string}[]};
export default function OptionContractBoard(props:Props){
 const [now,setNow]=useState(()=>Date.now());
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),30000);return()=>clearInterval(timer);},[]);
 const items=[...props.items].sort((a,b)=>(a.leg.expiry||'99999999').localeCompare(b.leg.expiry||'99999999')||a.leg.symbol.localeCompare(b.leg.symbol));
 return <div className="oa-board"><ContractGroup {...props} items={items} now={now}/></div>;
}

function ContractGroup({now,...props}:Props&{now:number}){
 const batches=optionMarketBatches(props.items.map(x=>x.leg));
 useAnalysisUpdates(batches.map(legs=>({queryKey:['option-overview',legs.map(contractKey)],path:'/api/analysis/market',body:{legs}})));
 const queries=useQueries({queries:batches.map(legs=>({queryKey:['option-overview',legs.map(contractKey)],queryFn:()=>readAnalysis<Market>('/api/analysis/market',{legs}),staleTime:60000,retry:false,refetchOnWindowFocus:false}))});
 const lookup=(leg:PositionLeg)=>queries[batches.findIndex(batch=>batch.some(l=>contractKey(l)===contractKey(leg)))];
 const fetching=queries.some(q=>q.isFetching);
 return <section className={'oa-underlying '+(props.analysisOnly?'oa-analysis-only':'')+(props.selectionMode?' oa-selectable':' oa-clean')}><div className="oa-list-tools"><button type="button" className="pa-quiet-refresh" title={tr('刷新期权行情')} aria-label={tr('刷新期权行情')} disabled={fetching||!batches.length} onClick={()=>void Promise.allSettled(queries.map(q=>q.refetch()))}><RotateCw size={14} className={fetching?'is-refreshing':''}/></button></div>
 {!props.analysisOnly&&<div className="oa-list-heading" aria-hidden="true">{props.selectionMode&&<span/>}<span>{tr('合约 / 账户')}</span><span>{tr('持仓数量')}</span><span>{tr('到期 / 剩余时间')}</span><span>{tr('价内 / 价外')}</span><span>{tr('盈利概率')}</span><span>{tr('到期位置概率')} · IN / OUT</span><span>{tr('持仓盈亏')}</span><span/></div>}<div className="oa-cards">{props.items.map(x=><ContractCard hideHoldingDetails={props.hideHoldingDetails} selectionMode={props.selectionMode} renderExpanded={props.renderExpanded?()=>props.renderExpanded!(x):undefined} analysisOnly={props.analysisOnly} onOpen={props.onOpen?()=>props.onOpen!(x):undefined} key={optionReference(x.position.id,x.leg)} x={x} now={now} free={props.available(x)} selected={props.selected.has(optionReference(x.position.id,x.leg))} toggle={()=>props.toggle(x)} disabled={props.items.filter(y=>optionReference(y.position.id,y.leg)===optionReference(x.position.id,x.leg)).length!==1} account={props.accounts.find(a=>a.id===x.position.accountId)?.name??''} market={lookup(x.leg)?.data?.options.find(o=>contractKey(o)===contractKey(x.leg))} fetchedAt={lookup(x.leg)?.data?.fetchedAt} loading={!!lookup(x.leg)?.isFetching} failed={!!lookup(x.leg)?.error}/>)}</div></section>;
}
function ContractCard({hideHoldingDetails,selectionMode,renderExpanded,analysisOnly,onOpen,x,now,free,selected,toggle,disabled,account,market,fetchedAt,loading,failed}:{hideHoldingDetails?:boolean;selectionMode?:boolean;renderExpanded?:()=>ReactNode;x:AnalysisLeg;now:number;free:number;selected:boolean;toggle:()=>void;disabled:boolean;account:string;market?:MarketLeg;fetchedAt?:string;loading:boolean;failed:boolean;analysisOnly?:boolean;onOpen?:()=>void}){
 const l=x.leg,sold=l.quantity<0,stock=['STK','ETF'].includes(l.assetType);
 const [expanded,setExpanded]=useState(false);
 const quantity=Math.abs(l.quantity);
 const [assumptions,setAssumptions]=useState({spot:'',iv:'',rate:'',dividend:''});
 const hasAssumptions=Object.values(assumptions).some(v=>v.trim());
 const spot=assumptions.spot.trim()?Number(assumptions.spot):market?.underlyingPrice??null;
 const iv=assumptions.iv.trim()?Number(assumptions.iv)/100:market?.iv??null;
 const rate=assumptions.rate.trim()?Number(assumptions.rate)/100:market?.rate?.value??null;
 const dividend=assumptions.dividend.trim()?Number(assumptions.dividend)/100:market?.dividendYield??null;
 const supported=l.assetType==='OPT'&&l.currency==='USD'&&l.multiplier===100&&!['SPX','SPXW','XSP','NDX','RUT','MRUT','VIX','NANOS'].includes(l.symbol.toUpperCase());
 const countdown=supported?expiryCountdown(l.expiry,now):null;
 const m=stock?null:optionMoneyness(l,spot);
 const probability=supported?legProfitProbability(l,spot,iv,rate,dividend,now):null;
 const itm=supported?expiryItmProbability(l,spot,iv,rate,dividend,now):null;
 const itmLabel=<OptionInOutProbability probability={itm} sold={sold}/>;
 const moneynessTone=!m||m.state==='atm'?'':(m.state==='itm')!==sold?'up':'down';
 const zoneTone=(itmZone:boolean)=>itmZone!==sold?'up':'down';
 const priceSpan=m&&spot!==null?Math.max(Math.abs(spot-l.strike!)*1.4,l.strike!*.05):1;
 const spotX=m&&spot!==null?50+(spot-l.strike!)/priceSpan*42:50;
 const breakEven=optionBreakEven(l);
 const mark=market?.price??l.marketPrice;
 const pnl=mark!==null&&l.avgCost!==null&&l.multiplier!==null?(mark-l.avgCost)*Math.sign(l.quantity)*quantity*l.multiplier:null;
 const liquidity=optionLiquidity(l,quantity,market?.bid,market?.ask);
 const obligation=supported?shortOptionObligation(l,quantity,spot,mark):null;
 const amount=(v:number|null|undefined)=>v===Infinity?tr('无限'):v===null||v===undefined?'—':fmt(v,2)+' '+l.currency;
 const missing=[l.avgCost===null?'单位成本':null,spot===null?'标的现价':null,iv===null?'隐含波动率':null,rate===null?'无风险利率':null,dividend===null?'连续股息率':null].filter(Boolean) as string[];
 const time=countdown===null?'—':countdown.minutes===0?tr('已到期'):countdown.days>0?`${countdown.days} ${tr('天')} ${countdown.hours} ${tr('小时')}`:countdown.hours>0?`${countdown.hours} ${tr('小时')} ${countdown.remainder} ${tr('分钟')}`:`${countdown.remainder} ${tr('分钟')}`;
 return <article className={'oa-card '+(selected?'is-selected':'')}>
 {analysisOnly?<div className="oa-analysis-heading"><strong>{assetLabel(l)}</strong><span>{account} · {tr(sold?'卖出':'买入')} {fmt(quantity,stock?4:0)} {tr(stock?'股':'张')}</span></div>:<div className="oa-position-row">{selectionMode&&<input type="checkbox" aria-label={tr('选择合约')+' '+assetLabel(l)+' '+account} checked={selected} disabled={disabled||(!selected&&free<=0)} onChange={toggle}/>}
 <button type="button" className="oa-position-open" disabled={selectionMode&&(disabled||(!selected&&free<=0))} aria-expanded={selectionMode||onOpen?undefined:expanded} onClick={()=>selectionMode?toggle():onOpen?onOpen():setExpanded(!expanded)}>
 <span className="oa-row-contract"><b>{l.symbol} · {stock?tr('股票'):fmt(l.strike,2)+' '+(l.right==='C'?'Call':'Put')} <em className={sold?'sold':''}>{tr(sold?'卖出':'买入')}</em></b><small>{account} · {l.currency}</small></span>
 <span><b>{fmt(quantity,stock?4:0)}</b>{selectionMode&&<small>{tr('未分配')} {fmt(free,stock?4:0)}</small>}</span>
 <span className={'oa-row-expiry '+(countdown?.tone??'')}><b>{stock?'—':expiryLabel(l.expiry)}</b><small>{stock?'—':time}</small></span>
 <span className={'oa-row-moneyness '+moneynessTone}><span className="oa-current-state"><b>{m?(m.state==='itm'?'IN':m.state==='otm'?'OUT':'ATM'):'—'}</b><small>{m?tr(m.state==='itm'?'价内':m.state==='otm'?'价外':'平值')+' '+fmt(m.fraction*100,2)+'%':tr(loading?'正在获取行情…':failed?'行情读取失败':'等待标的现价')}</small></span><small className="oa-current-spot">{tr('现价')} <b>{fmt(spot,2)}</b></small></span>
 <span className={'oa-row-probability '+(probability===null||probability===.5?'':probability>.5?'up':'down')}><span className="oa-probability-pair"><b>{probability===null?'—':fmt(probability*100,1)+'%'}</b></span>{probability!==null&&<span className="pa-signal-track" aria-hidden="true"><i style={{width:probability*100+'%'}}/></span>}<small>{probability===null&&supported&&!loading&&!failed&&missing.length?tr('缺少数据')+' · '+missing.map(s=>tr(s)).join(' / '):tr(probability!==null?'到期盈利概率':loading?'正在获取行情…':failed?'行情读取失败':!supported?'此合约暂不支持概率模型':'数据待补充')}</small></span>
 <span className="oa-row-itm">{stock?'—':<OptionInOutProbability probability={itm} sold={sold}/>}</span>
 <span className="oa-row-pnl"><b className={pnl!==null?(pnl>=0?'up':'down'):''}>{fmt(pnl,2)}</b><small>{l.currency}</small></span>
 <span className="pa-analysis-affordance">{tr(selectionMode?(selected?'已选择':'选择'):expanded?'收起':'分析')}<ChevronRight size={14} className={expanded?'is-open':''}/></span>
 </button></div>}
 {(analysisOnly||expanded)&&(renderExpanded?<div className="oa-expanded">{renderExpanded()}</div>:<div className="oa-expanded">
 {!stock&&<div className={'oa-countdown '+(countdown?.tone??'normal')}><Hourglass size={27} aria-hidden="true"/><div><span>{tr('距离到期')}</span><strong>{time}</strong></div><div className="oa-expiry"><b>{expiryLabel(l.expiry)}</b><small>{tr(supported?'纽约 16:00 参考截止':'具体截止时间待确认')}</small></div></div>}
 {!stock&&<div className="oa-main-metrics"><div className={'oa-moneyness '+(m?.state??'unknown')+' '+moneynessTone}><span>{tr('价内 / 价外距离')}</span><strong>{m?tr(m.state==='itm'?'价内':m.state==='otm'?'价外':'平值'):'—'} {m&&m.state!=='atm'?fmt(m.fraction*100,2)+'%':''}</strong><small>{m?fmt(m.amount,2)+' '+l.currency+' · '+tr('按现价计算距离'):tr('等待标的现价')}</small>
 {m&&spot!==null&&<div className="oa-strike-map" role="img" aria-label={tr('现价与行权价位置')+' · '+tr('标的现价')+' '+fmt(spot,2)+' · '+tr('行权价')+' '+fmt(l.strike,2)}>
 <div className="oa-map-zones"><span className={(l.right==='P'?'itm':'otm')+' '+zoneTone(l.right==='P')}>{tr(l.right==='P'?'价内':'价外')}</span><span className={(l.right==='C'?'itm':'otm')+' '+zoneTone(l.right==='C')}>{tr(l.right==='C'?'价内':'价外')}</span></div>
 <div className="oa-map-axis"><div className="oa-map-distance" style={{left:Math.min(50,spotX)+'%',width:Math.abs(spotX-50)+'%'}}/><div className="oa-map-strike"><i/><small>{tr('行权价')}<b>{fmt(l.strike,2)}</b></small></div><div className="oa-map-spot" style={{left:spotX+'%'}}><small>{tr('标的现价')}<b>{fmt(spot,2)}</b></small><i/></div></div>
 <div className="oa-map-caption"><span>↔ {fmt(m.amount,2)} {l.currency}</span><small>{tr('示意范围随价格距离调整')}</small></div>
 </div>}</div>
 <div className="oa-probability"><div className="oa-probability-caption"><span>{tr('盈利概率')}</span>{itmLabel}</div><div className="oa-ring-layout"><div className="oa-probability-ring" role="img" aria-label={tr('到期盈利概率')+' '+(probability===null?'—':fmt(probability*100,1)+'%')}><svg viewBox="0 0 140 140" aria-hidden="true"><circle className="oa-ring-base" cx="70" cy="70" r="58"/><circle className="oa-ring-value" cx="70" cy="70" r="58" pathLength="100" strokeDasharray={`${(probability??0)*100} 100`} transform="rotate(-90 70 70)"/></svg><div><strong>{probability===null?'—':fmt(probability*100,1)+'%'}</strong><small>{tr('到期盈利概率')}</small></div></div><div className="oa-ring-legend"><span><i/>{tr('盈利')} <b>{probability===null?'—':fmt(probability*100,1)+'%'}</b></span><span><i/>{tr('未盈利')} <b>{probability===null?'—':fmt((1-probability)*100,1)+'%'}</b></span><small>{tr(hasAssumptions?'含手动假设':probability!==null?'模型估计':loading?'正在获取行情…':!supported?'此合约暂不支持概率模型':countdown?.minutes===0?'已到期':failed?'行情读取失败':'数据待补充')}</small></div></div></div></div>}


 {!hideHoldingDetails&&<AnalysisHoldingDetails position={x.position} leg={l}/>}
 {!hideHoldingDetails&&<dl className="oa-secondary"><div><dt>{tr('标的现价')}</dt><dd>{fmt(spot,2)} {l.currency}</dd></div>{!analysisOnly&&<div><dt>{tr('盈亏平衡价')}</dt><dd>{fmt(breakEven,2)} {l.currency}</dd></div>}<div><dt>{tr('持仓盈亏')}</dt><dd className={pnl!==null?(pnl>=0?'up':'down'):''}>{fmt(pnl,2)} {l.currency}</dd></div></dl>}
 {!stock&&<div className="oa-focus-grid">
 {sold&&<section className="oa-focus-block oa-assignment"><h4><ShieldAlert size={15}/>{tr('指派与资金风险')}</h4><p className="oa-risk-flag">{tr(!obligation?'交割规格待确认':obligation.itm===null?'等待标的现价':obligation.itm&&countdown&&countdown.days<7?'价内且临近到期':obligation.itm?'已价内，留意指派':'价外仍需留意指派')}</p>
 <dl><div><dt>{tr(l.right==='P'?'接货资金（毛额）':'需交付股数')}</dt><dd>{l.right==='P'?amount(obligation?.gross):obligation?fmt(obligation.shares,0)+' '+tr('股'):'—'}</dd></div><div><dt>{tr('未计覆盖的单腿最大损失')}</dt><dd className={obligation?.maxLoss===Infinity?'down':''}>{amount(obligation?.maxLoss)}</dd></div><div><dt>{tr('每股剩余时间价值')}</dt><dd>{amount(obligation?.extrinsic)}</dd></div></dl>
 {obligation?.extrinsic!==null&&obligation?.extrinsic!==undefined&&obligation.itm&&obligation.extrinsic<=.05&&<p className="oa-risk-flag">{tr('价内且时间价值不高于 0.05，需重点留意提前指派。')}</p>}
 <small>{tr('按持仓数量及标准实物交割情景计算；毛额不是保证金，未核验现金、股票覆盖或组合抵扣。')}</small>{l.right==='C'&&<small>{tr('除息前提前指派风险可能上升；此处尚未核验除息日。')}</small>}
 </section>}
 <section className="oa-focus-block oa-execution"><h4><ArrowLeftRight size={15}/>{tr('流动性与平仓成本')}</h4><p className="oa-risk-flag">{tr(liquidity.noBid?'买价为零，缺少有效买盘':liquidity.spreadFraction===null?'等待有效双边报价':liquidity.spreadFraction>=.2?'买卖价差达到中间价的 20% 以上':'按当前盘口估算')}</p>
 <dl><div><dt>Bid / Ask</dt><dd>{fmt(market?.bid,2)} / {fmt(market?.ask,2)}</dd></div><div><dt>{tr('买卖价差 / 中间价')}</dt><dd>{amount(liquidity.spread)}{liquidity.spreadFraction===null?'':' · '+fmt(liquidity.spreadFraction*100,1)+'%'}</dd></div><div><dt>{tr(sold?'按 Ask 买回支出':'按 Bid 卖出收入')}</dt><dd>{amount(liquidity.closeCash===null?null:Math.abs(liquidity.closeCash))}</dd></div><div><dt>{tr('盘口平仓盈亏')}</dt><dd className={liquidity.closePnl!==null?(liquidity.closePnl>=0?'up':'down'):''}>{amount(liquidity.closePnl)}</dd></div><div><dt>{tr('较中间价多付的价差成本')}</dt><dd>{amount(liquidity.halfSpreadCost)}</dd></div><div><dt>{tr('成交量 / 未平仓量')}</dt><dd>{fmt(market?.volume,0)} / {fmt(market?.openInterest,0)}</dd></div></dl>
 <small>{tr('按持仓数量计算，未计佣金、滑点和盘口深度；报价不保证成交。未平仓量通常非实时。')}</small>
 <small>{tr('盘口来源')} · {market?.bookSource??'—'} · {tr(({1:'实时',2:'冻结',3:'延迟',4:'延迟冻结'} as Record<number,string>)[market?.bookMarketDataType??0]??'行情时效未知')}{market?.bookAt?' · '+new Date(market.bookAt).toLocaleString(uiLocale()):''}</small><small>{tr('成交量 / 未平仓量')} · {market?.volumeSource??'—'} / {market?.openInterestSource??'—'}</small>
 </section></div>}
 {!stock&&<details className="oa-details"><summary>{tr('概率依据与补充数据')}{probability===null&&missing.length?' · '+missing.map(s=>tr(s)).join(' / '):''}</summary><p>{tr('盈利概率按到期净收益大于零计算，包含持仓成本；买卖方向影响结果，价内不等于盈利。不含额外手续费与税费。')}</p><div className="pa-form-grid">{([['spot','标的现价',spot,1],['iv','隐含波动率',iv,100],['rate','无风险利率',rate,100],['dividend','连续股息率',dividend,100]] as const).map(([key,label,value,scale])=><label key={key}>{tr(label)}{scale===100?' %':''}<input aria-label={tr(label)+' '+assetLabel(l)} type="number" step="any" min={key==='rate'?-10:0} value={assumptions[key]} placeholder={value===null?tr('待补数据'):fmt(value*scale,3)} onChange={e=>setAssumptions({...assumptions,[key]:e.target.value})}/></label>)}</div>{market?.dividend&&<p>{tr('股息率来源')} · {market.dividend.source} · {tr(market.dividend.method==='issuer-no-dividend-policy'?'按公司不派息政策估计为 0':market.dividend.method==='trailing-dividend-yield-proxy'?'按历史股息率估计':'按券商股息现值估计')} · {market.dividend.asOf.slice(0,10)}</p>}<p>{tr('概率为风险中性模型估计，不是实际获利频率，也不是提前行权概率。美式行权、离散分红、跳跃和波动率曲面未完整建模。')}</p><p>{tr('倒计时按标准美股期权到期日纽约 16:00 估算，并非券商行权截止时间。')}</p></details>}

 </div>)}
 </article>;
}
