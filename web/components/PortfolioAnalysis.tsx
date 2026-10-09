"use client";
import {calendarProfitEstimate,spreadExpiryProbabilities} from '../lib/strategy-probabilities';
import {useAnalysisQuery,useAnalysisConnection} from '../lib/analysis-stream';
import AnalysisHoldingDetails from './AnalysisHoldingDetails';
import BasicStockScore from './BasicStockScore';
import OptionContractBoard from './OptionContractBoard';
import {automaticStrategies,recognizeStrategy} from '../lib/strategy-recognition';
import {unallocatedQuantity} from '../lib/option-overview';
import type {BasicScore} from '../../server/src/triggerpoints-basic';
import {useState,useEffect} from 'react';
import {useQuery,useMutation,useQueryClient} from '@tanstack/react-query';
import {RotateCw,ChevronRight,Plus,Layers3} from 'lucide-react';
import {apiGet,apiPost,apiDelete,fmt} from '../lib/api';
import {tr,uiLocale} from '../lib/i18n';
import {analysisLegs,type AnalysisLeg} from '../lib/portfolio-analysis';
import {legAmounts,assetLabel,expiryLabel,type Position,type PositionLeg} from '../lib/holdings-view';
import {useHoldingsMarket} from '../lib/use-holdings-market';
import {ledgerCash,type LedgerData} from './HoldingsLedger';
import StrategyPicker,{strategyLabel} from './StrategyPicker';
import {strategies as strategyCatalog} from '../../server/src/strategy-catalog';
import {category,contractKey,expirationAnalysis,expiryYears,profitProbability,type Allocation,type AnalysisStrategy,lifecycleScenario} from '../../server/src/analysis-engine';

type Data=LedgerData&{holdings:Position[]};
type Classes={positionId:number;legKey:string;category:string};
type Workspace={strategies:AnalysisStrategy[];classes:Classes[]};
type Research={marketQuote?:{price:number;source:string;marketDataType:number|null;fetchedAt:string}|null;secAsOf?:string|null;metricSources?:Record<string,{source:string;asOf:string|null}>;missing?:string[];source:string|null;price:number|null;currency:string|null;sector:string;industry:string;asOf:string|null;reportFresh:boolean;raw:Record<string,number|null>;scoring:BasicScore;applicable:boolean;fundRating:number|null;fundRisk:number|null;fetchedAt:string;errors:string[]};
const categories=[['cash','现金'],['stocks','股票'],['options','期权'],['futures','期货'],['funds','基金'],['deposits','定存']] as const;
const moduleLabels:Record<string,string>={quality:'盈利质量',growth:'成长与持续性',value:'估值',safety:'财务安全',market:'走势与可交易性',stewardship:'股东回报与治理'};
const metricLabels:Record<string,string>={returnOnEquity:'净资产收益率',roic:'投入资本回报率',operatingMargin:'营业利润率',cfoAssets:'经营现金流 / 资产',accruals:'应计利润比',earningsStability:'盈利稳定性',revenueCagr:'三年收入复合增长',perShareProfitGrowth:'每股经营利润增长',revenueGrowth:'收入同比增长',marginChange:'利润率改善',growthContinuity:'增长连续性',earningsYield:'盈利收益率',fcfYield:'自由现金流收益率',cfoEv:'经营现金流 / 企业价值',historicalValue:'历史估值位置',netDebtEbitda:'净负债 / EBITDA',interestCoverage:'利息覆盖倍数',debtCoverage:'短期偿债覆盖',cashflowHealth:'现金流健康',dilution:'股份稀释',momentum:'风险调整动量',trend:'中长期趋势',liquidity:'流动性',payoutCoverage:'股东回报现金覆盖',allocation:'资本配置结果',disclosure:'治理与披露'};
const reference=(x:AnalysisLeg)=>x.position.id+':'+contractKey(x.leg);
const money=(v:number|null|undefined,c='')=>v===Infinity?tr('无限'):v===null||v===undefined?'—':fmt(v)+(c?' '+c:'');
const pct=(v:number|null|undefined)=>v===null||v===undefined?'—':fmt(v*100,1)+'%';
const analysisError=(message:string)=>tr(({
 'A strategy must use the same underlying':'策略必须使用同一标的',
 'Allocated quantity exceeds the current position':'分配数量超过当前可用持仓',
 'Invalid allocation quantity':'分配数量或方向无效',
 'Duplicate contract allocation':'同一合约不能重复分配',
 'Contract identity is missing or ambiguous':'合约已变动或身份不唯一，请重新选择',
 'Position is no longer active':'持仓已失效，请刷新并重新选择',
 'Select at least one option contract':'请至少选择一张期权合约',
 'Strategy not found':'策略已变动，请刷新重试'
 } as Record<string,string>)[message]??'请检查账户、标的、币种和数量后重试');

function resolved(s:AnalysisStrategy,items:AnalysisLeg[],all:AnalysisStrategy[]){
 const rows:AnalysisLeg[]=[];let invalid=false;
 for(const a of s.allocations){
  const matches=items.filter(x=>x.position.id===a.positionId&&contractKey(x.leg)===a.legKey);
  const total=all.flatMap(g=>g.allocations).filter(x=>x.positionId===a.positionId&&x.legKey===a.legKey).reduce((n,x)=>n+Math.abs(x.quantity),0);
  if(matches.length!==1||Math.sign(matches[0].leg.quantity)!==Math.sign(a.quantity)||total>Math.abs(matches[0].leg.quantity)+1e-8){invalid=true;continue;}
  rows.push({...matches[0],leg:{...matches[0].leg,quantity:a.quantity}});
 }
 const keys=new Set(rows.map(x=>x.leg.symbol.trim().toUpperCase()));
 return {rows,invalid:invalid||keys.size!==1||!rows.some(x=>['OPT','FOP'].includes(x.leg.assetType))};
}
function Metric({label,value}:{label:string;value:string}){return <div className="pa-metric"><span>{tr(label)}</span><strong>{value}</strong></div>;}
function Empty({label='此分类暂无资产'}:{label?:string}){return <div className="pa-empty"><Layers3 size={24}/><p>{tr(label)}</p><a href="/holdings" className="term-btn">{tr('添加或同步仓位')}</a></div>;}
export default function PortfolioAnalysis({embedded=false,holdings,accountFilter}:{embedded?:boolean;holdings?:Position[];accountFilter?:string}){
 const Container=embedded?'section':'main';
 const connected=useAnalysisConnection();
 const [tab,setTab]=useState(()=>typeof window==='undefined'?'options':sessionStorage.getItem('analysis-asset-tab')||'options'),[account,setAccount]=useState('');const qc=useQueryClient();
 useEffect(()=>{sessionStorage.setItem('analysis-asset-tab',tab);},[tab]);
 const q=useAnalysisQuery<Data>({queryKey:['holdings'],path:'/api/holdings'});
 const w=useAnalysisQuery<Workspace>({queryKey:['analysis-workspace'],path:'/api/holdings/analysis'});
 const live=useHoldingsMarket(holdings?[]:q.data?.holdings??[]);
 const market={...live,rows:holdings??live.rows};
 useEffect(()=>{if(accountFilter!==undefined)setAccount(accountFilter);},[accountFilter]);
 const items=analysisLegs(market.rows).filter(x=>!account||x.position.accountId===Number(account));
 const classes=w.data?.classes??[],strategies=w.data?.strategies??[];
 const type=(x:AnalysisLeg)=>classes.find(c=>c.positionId===x.position.id&&c.legKey===contractKey(x.leg))?.category??category(x.leg.assetType);
 const selected=items.filter(x=>type(x)===tab),unknown=items.filter(x=>type(x)==='unknown');
 const classify=useMutation({mutationFn:(body:Classes)=>apiPost('/api/holdings/analysis/classes',body),onSuccess:()=>qc.invalidateQueries({queryKey:['analysis-workspace']})});
 return <Container className={(embedded?'analysis-embedded ':'')+'analysis-page '+(tab==='options'?'options-view':'')}><div className="analysis-inner">{!embedded&&<header className="pa-header"><div><span className="pa-eyebrow">TRIGGERPOINTS</span><h1>{tr(embedded?'持仓分析':'仓位分析')}</h1></div><div className="pa-toolbar">{!embedded&&<select aria-label={tr('账户')} value={account} onChange={e=>setAccount(e.target.value)}><option value="">{tr('全部账户')}</option>{q.data?.accounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select>}<button className="term-btn" disabled={q.isFetching||w.isFetching} onClick={()=>{void q.refetch();void w.refetch();}}><RotateCw size={14}/>{tr('刷新')}</button></div></header>}
 <nav className="pa-categories" aria-label={tr('资产分类')}>{categories.map(([id,label])=><button key={id} aria-current={tab===id?'page':undefined} onClick={()=>setTab(id)}>{tr(label)}<span>{items.filter(x=>type(x)===id).length}</span></button>)}</nav>
 <div className="pa-context"><span>{tr(connected?'WebSocket 已连接 · 后台更新':'正在重连 · 保留上次数据')}{q.data&&' · '+tr('最近快照')+' '+new Date(q.dataUpdatedAt).toLocaleString(uiLocale())}</span>{!embedded&&<a href="/holdings">{tr('管理持仓')} <ChevronRight size={13}/></a>}</div>
 {(q.error||w.error)&&<p role="alert" className="pa-notice down">{tr('读取失败，请刷新重试')}</p>}
 {market.error&&<p role="status" className="pa-notice">{tr('部分行情未更新，保留上次快照')}</p>}
 {q.isPending||w.isPending?<p className="pa-empty">{tr('正在读取持仓…')}</p>:<>
 {tab==='options'&&<Options key={account} items={items.filter(x=>['STK','ETF','OPT','FOP'].includes(x.leg.assetType))} strategies={strategies} accounts={q.data?.accounts??[]} allItems={analysisLegs(market.rows)} />}
 {tab==='stocks'&&<AssetOverview items={selected} kind="stock" accounts={q.data?.accounts??[]}/>}
 {tab==='funds'&&<AssetOverview items={selected} kind="fund" accounts={q.data?.accounts??[]}/>}
 {tab==='futures'&&<AssetOverview items={selected} kind="future" accounts={q.data?.accounts??[]}/>}
 {tab==='cash'&&<Cash data={q.data} account={account} items={selected}/>}
 {tab==='deposits'&&<><p className="pa-intro">{tr('定存仅展示持仓，不参与评分。利率和到期说明可记录在资产备注中。')}</p><AssetTable items={selected}/></>}
 </>}
 {!!unknown.length&&<details className="pa-details"><summary>{tr('待分类资产')} · {unknown.length}</summary><p className="dim">{tr('确认资产类型后归入相应分类，原始持仓记录保留。')}</p>{unknown.map((x,i)=><div className="pa-classify" key={reference(x)+i}><strong>{assetLabel(x.leg)}</strong><AnalysisHoldingDetails position={x.position} leg={x.leg}/><select aria-label={tr('资产分类')} defaultValue="unknown" disabled={classify.isPending} onChange={e=>classify.mutate({positionId:x.position.id,legKey:contractKey(x.leg),category:e.target.value})}><option value="unknown">{tr('待分类')}</option>{categories.map(([id,label])=><option key={id} value={id}>{tr(label)}</option>)}</select></div>)}{classify.error&&<p role="alert">{analysisError(classify.error.message)}</p>}</details>}
 <footer className="pa-footer">{tr('分析只读取和整理本地仓位，不向券商下单。')}</footer></div></Container>;
}
function AssetTable({items}:{items:AnalysisLeg[]}){
 if(!items.length)return <Empty/>;
 return <div className="pa-table-wrap"><table className="pa-table"><thead><tr>{['资产','数量','单位成本','估值价','市值','未实现盈亏'].map(s=><th key={s}>{tr(s)}</th>)}</tr></thead><tbody>{items.map((x,i)=>{const a=legAmounts(x.leg,x.position.source);return <tr key={reference(x)+i}><td><b>{x.leg.symbol}</b><small>{x.position.name} · {x.leg.currency}</small><details><summary>{tr('详情')}</summary><AnalysisHoldingDetails position={x.position} leg={x.leg}/></details></td><td>{fmt(x.leg.quantity,4)}</td><td>{money(x.leg.avgCost)}</td><td>{money(x.leg.marketPrice)}</td><td>{money(a.value)}</td><td className={a.pnl!==null?(a.pnl>=0?'up':'down'):''}>{money(a.pnl)}</td></tr>;})}</tbody></table></div>;
}
function Cash({data,account,items}:{data:Data|undefined;account:string;items:AnalysisLeg[]}){
 const balances=data?.balances.filter(b=>!account||b.accountId===Number(account))??[];
 const broker=data?.brokerCash.filter(b=>(!account||b.accountId===Number(account))&&!balances.some(a=>a.accountId===b.accountId&&a.currency===b.currency))??[];
 return <><p className="pa-intro">{tr('现金仅展示余额，不参与评分。各币种独立列示。')}</p>{!balances.length&&!broker.length&&!items.length?<Empty/>:<div className="pa-table-wrap"><table className="pa-table"><thead><tr>{['账户','币种','现金余额'].map(s=><th key={s}>{tr(s)}</th>)}</tr></thead><tbody>{[...balances.map(b=>({...b,cash:ledgerCash(data!,b)})),...broker].map(b=><tr key={b.accountId+':'+b.currency}><td>{data?.accounts.find(a=>a.id===b.accountId)?.name}</td><td>{b.currency}</td><td>{money(b.cash)}</td></tr>)}</tbody></table></div>}{items.length>0&&<details className="pa-details"><summary>{tr('现金类持仓记录')}</summary><AssetTable items={items}/></details>}</>;
}
function Options({items,allItems,strategies,accounts}:{items:AnalysisLeg[];allItems:AnalysisLeg[];strategies:AnalysisStrategy[];accounts:Data['accounts']}){
 const qc=useQueryClient(),[selection,setSelection]=useState<Record<string,Allocation>>({});
 const [editor,setEditor]=useState<{id?:number;strategyId:string;autoDetect?:boolean}|null>(null),[chosen,setChosen]=useState<number|null>(null),[deleting,setDeleting]=useState<number|null>(null);
 const [strategyTab,setStrategyTab]=useState('all');
 const auto=automaticStrategies(allItems,strategies);
 const combined=[...strategies,...auto].map(s=>({...s,name:strategyLabel(s.strategyId)}));
 const relevant=combined.filter(s=>s.allocations.some(a=>items.some(x=>x.position.id===a.positionId&&contractKey(x.leg)===a.legKey)));
 const save=useMutation({mutationFn:()=>apiPost<{id:number}>('/api/holdings/analysis/strategies',{...editor,name:strategyCatalog.find(s=>s.id===editor?.strategyId)?.zh??strategyCatalog.find(s=>s.id==='custom')!.zh,allocations:Object.values(selection)}),onSuccess:data=>{qc.setQueryData<Workspace>(['analysis-workspace'],old=>old?{...old,strategies:[...old.strategies.filter(s=>s.id!==data.id),{id:data.id,name:strategyLabel(editor!.strategyId),strategyId:editor!.strategyId,allocations:Object.values(selection)}]}:old);setChosen(data.id);setStrategyTab(editor?.strategyId??'');setEditor(null);setSelection({});}});
 const remove=useMutation({mutationFn:(id:number)=>apiDelete('/api/holdings/analysis/strategies/'+id),onSuccess:(_data,id)=>{qc.setQueryData<Workspace>(['analysis-workspace'],old=>old?{...old,strategies:old.strategies.filter(s=>s.id!==id)}:old);setDeleting(null);setChosen(null);}});
 const available=(x:AnalysisLeg)=>unallocatedQuantity(x.position.id,x.leg,strategies.filter(s=>s.id!==editor?.id).flatMap(s=>s.allocations));
 const rows=(editor?allItems:items).filter(x=>['OPT','FOP'].includes(x.leg.assetType)||(!!editor&&['STK','ETF'].includes(x.leg.assetType))).filter(x=>!editor||available(x)>0||!!selection[reference(x)]);
 const selectedSymbols=new Set(Object.values(selection).map(a=>allItems.find(x=>reference(x)===a.positionId+':'+a.legKey)?.leg.symbol.trim().toUpperCase()).filter(Boolean));
 const mixedSymbols=selectedSymbols.size>1;
 const toggle=(x:AnalysisLeg)=>setSelection(old=>{const key=reference(x),next={...old};if(next[key])delete next[key];else next[key]={positionId:x.position.id,legKey:contractKey(x.leg),quantity:Math.sign(x.leg.quantity)*available(x)};return next;});
 const types=[...new Set(relevant.map(s=>s.strategyId))].sort((a,b)=>Number(a==='custom')-Number(b==='custom'));
 const activeType=types.includes(strategyTab)?strategyTab:'all';
 const tabGroups=relevant.filter(s=>s.strategyId===activeType);
 const group=tabGroups.find(s=>s.id===chosen);
 const suggested=recognizeStrategy(Object.values(selection).flatMap(a=>{const x=allItems.find(x=>reference(x)===a.positionId+':'+a.legKey);return x?[{...x.leg,quantity:a.quantity}]:[];}));
 useEffect(()=>{if(editor?.autoDetect&&editor.strategyId!==suggested)setEditor(old=>old?{...old,strategyId:suggested}:null);},[suggested,editor?.autoDetect,editor?.strategyId]);
 const edit=(s:AnalysisStrategy)=>{setSelection(Object.fromEntries(s.allocations.map(a=>[a.positionId+':'+a.legKey,a])));setEditor({id:s.id>0?s.id:undefined,strategyId:s.strategyId,autoDetect:s.id<0});save.reset();};
 return <><div className="pa-section-heading"><div><h2>{tr('期权工作区')}</h2><p>{tr('查看全部期权仓位，点击一行展开分析。')}</p></div></div>
 <div className="pa-strategy-tabs" role="tablist" aria-label={tr('仓位与策略')}><button role="tab" aria-selected={activeType==='all'} onClick={()=>{setStrategyTab('all');setChosen(null);}}>{tr('全部仓位')}</button>{types.map(id=><button key={id} role="tab" aria-selected={activeType===id} onClick={()=>{setStrategyTab(id);setChosen(null);}}>{strategyLabel(id)} <span>{relevant.filter(s=>s.strategyId===id).length}</span></button>)}</div>
 {activeType==='all'&&!editor&&(!rows.length?<Empty label="暂无期权合约"/>:<OptionContractBoard items={rows} available={available} selected={new Set()} toggle={()=>{}} accounts={accounts} renderExpanded={x=>{
 const matches=relevant.filter(s=>s.allocations.some(a=>a.positionId===x.position.id&&a.legKey===contractKey(x.leg)));
 return matches.length?matches.map(s=><div key={s.id}><div className="pa-toolbar"><span>{strategyLabel(s.strategyId)} · {tr(s.id<0?'自动识别':'手动修正')}</span><button className="term-btn" onClick={()=>edit(s)}>{tr('修改策略')}</button></div><GroupedStrategyDetail group={s} items={allItems} strategies={combined} accounts={accounts}/></div>):<OptionContractBoard analysisOnly items={[x]} available={available} selected={new Set()} toggle={()=>{}} accounts={accounts}/>;
 }}/>) }
 {editor&&<form className="pa-editor" onSubmit={e=>{e.preventDefault();save.mutate();}}><div className="pa-section-heading"><h3>{tr('修改策略')}</h3><span>{Object.keys(selection).length} {tr('项资产')}</span></div><div className="pa-form-grid"><StrategyPicker value={editor.strategyId} onChange={strategyId=>setEditor({...editor,strategyId,autoDetect:false})}/></div>
 <OptionContractBoard selectionMode items={rows} available={available} selected={new Set(Object.keys(selection))} toggle={toggle} accounts={accounts}/>
 {mixedSymbols&&<p role="alert" className="pa-notice">{tr('策略必须使用同一标的')}</p>}
 {Object.entries(selection).map(([key,a])=>{const x=allItems.find(x=>reference(x)===key);return <label className="pa-allocation" key={key}><span>{x?assetLabel(x.leg):tr('合约已变动，请移除并重新选择')}{x?' · '+(accounts.find(account=>account.id===x.position.accountId)?.name??''):''}</span><input required aria-label={tr('分配数量')+' '+(x?.leg.symbol??'')} type="number" step={x&&['STK','ETF'].includes(x.leg.assetType)?'any':1} min={x&&['STK','ETF'].includes(x.leg.assetType)?0.000001:1} max={x?available(x):undefined} value={Math.abs(a.quantity)||''} onChange={e=>setSelection(old=>({...old,[key]:{...a,quantity:Math.sign(x?.leg.quantity??a.quantity)*Number(e.target.value)}}))}/><button type="button" className="term-btn" onClick={()=>setSelection(old=>{const next={...old};delete next[key];return next;})}>{tr('移除')}</button></label>;})}
 <p className="dim">{tr('同标的可跨账户、跨币种归组；不改变持仓或现金，分配数量不能重复。')}</p>{save.error&&<p role="alert" className="down">{tr('保存失败，请检查合约与分配数量')} · {analysisError(save.error.message)}</p>}<div className="pa-toolbar"><button className="term-btn active" disabled={save.isPending||!Object.keys(selection).length||mixedSymbols}>{tr(save.isPending?'保存中…':'保存策略')}</button><button className="term-btn" type="button" onClick={()=>{setEditor(null);setSelection({});}}>{tr('取消')}</button></div></form>}
 {activeType!=='all'&&!editor&&<>

 <p className="pa-note">{tr('自动识别合约结构；卖出看跌不自动视为现金担保。手动分配优先，组合可跨账户。')}</p>

 {!tabGroups.length?<Empty label="暂无期权合约"/>:<div className="pa-strategy-positions">{tabGroups.map(s=><div key={s.id} className="pa-strategy-position"><button className="pa-strategy-open" aria-expanded={group?.id===s.id} onClick={()=>setChosen(group?.id===s.id?null:s.id)}><strong>{s.name}</strong><span>{tr(s.id<0?'自动识别':'手动修正')} · {s.allocations.length} {tr('项合约')}</span><span>{s.allocations.map(a=>{const x=allItems.find(x=>reference(x)===a.positionId+':'+a.legKey);return x?assetLabel(x.leg)+' × '+Math.abs(a.quantity)+' · '+(accounts.find(account=>account.id===x.position.accountId)?.name??''):'—';}).join(' / ')}</span><span className="pa-analysis-affordance">{tr(group?.id===s.id?'收起':'分析')}<ChevronRight size={14}/></span></button><button className="term-btn" onClick={()=>edit(s)}>{tr('修改策略')}</button>{s.id>0&&<button className="term-btn" onClick={()=>setDeleting(s.id)}>{tr('恢复自动识别')}</button>}
 {deleting===s.id&&<div className="pa-notice" role="alert">{tr('仅解除分析策略，持仓和现金保留。')} <button className="term-btn" disabled={remove.isPending} onClick={()=>remove.mutate(s.id)}>{tr('确认解除')}</button><button className="term-btn" onClick={()=>setDeleting(null)}>{tr('取消')}</button></div>}
 {group?.id===s.id&&<div className="pa-strategy-expanded"><GroupedStrategyDetail key={s.id} group={s} items={allItems} strategies={combined} accounts={accounts}/></div>}</div>)}</div>}
 {remove.error&&<p role="alert" className="down">{analysisError(remove.error.message)}</p>}
 </>}

 </>;
}
function GroupedStrategyDetail(props:{group:AnalysisStrategy;items:AnalysisLeg[];strategies:AnalysisStrategy[];accounts:Data['accounts']}){
 const check=resolved(props.group,props.items,props.strategies);
 const currencies=[...new Set(check.rows.map(x=>x.leg.currency))];
 if(check.invalid||currencies.length<=1)return <><p className="pa-note">{tr('跨账户归组仅用于分析，不代表券商认可抵押或保证金抵扣。')}</p><StrategyDetail {...props}/></>;
 return <><p className="pa-notice">{tr('此策略包含多个币种，以下分别计算，不直接合并盈亏或概率。跨账户归组不代表保证金抵扣。')}</p>{currencies.map(currency=>{
  const refs=new Set(check.rows.filter(x=>x.leg.currency===currency).map(reference));
  const group={...props.group,name:props.group.name+' · '+currency,allocations:props.group.allocations.filter(a=>refs.has(a.positionId+':'+a.legKey))};
  if(!check.rows.some(x=>x.leg.currency===currency&&['OPT','FOP'].includes(x.leg.assetType)))return <section key={currency}><h3>{currency}</h3><AssetTable items={check.rows.filter(x=>x.leg.currency===currency)}/></section>;
  return <StrategyDetail key={currency} {...props} group={group}/>;
 })}</>;
}
function StrategyDetail({group,items,strategies,accounts}:{group:AnalysisStrategy;items:AnalysisLeg[];strategies:AnalysisStrategy[];accounts:Data['accounts']}){
 const resolvedGroup=resolved(group,items,strategies),heldLegs=resolvedGroup.rows.map(x=>x.leg),first=heldLegs.find(l=>l.assetType==='OPT')??heldLegs[0];
 const basis='opening' as const;
 const [manualSpot,setManualSpot]=useState(''),[manualIv,setManualIv]=useState(''),[rate,setRate]=useState(''),[dividend,setDividend]=useState('');
 const symbol=first?.symbol??'',expiry=heldLegs.filter(l=>l.assetType==='OPT').map(l=>l.expiry).sort()[0]??first?.expiry??'';
 type MarketOption={rate?:{value:number}|null;dividendYield?:number|null;priceSource:string|null;conId?:number;expiry:string;right:string;strike:number|null;iv:number|null;price:number|null;source:string|null;marketDataType:number|null;receivedAt:string|null};
 type Chain={spot:number|null;source:string|null;fetchedAt:string;options:MarketOption[];rate:{value:number;source:string;asOf:string}|null;dividend:{value:number;source:string}|null;warnings:string[]};
 const requested=[...heldLegs].sort((a,b)=>a.expiry.localeCompare(b.expiry));
 const chain=useAnalysisQuery<Chain>({queryKey:['analysis-contract-market',requested.map(contractKey)],path:'/api/analysis/market',body:{legs:requested},enabled:!!symbol&&!!expiry&&first?.assetType==='OPT'&&!resolvedGroup.invalid,staleTime:60000});
 const match=(l:PositionLeg)=>chain.data?.options.find(o=>l.conId?o.conId===l.conId:o.expiry===l.expiry&&o.right===l.right&&o.strike===l.strike);
 const legs=heldLegs.map(l=>({...l,marketPrice:match(l)?.price??null}));
 const autoSpot=chain.data?.spot??null;
 const spot=manualSpot.trim()?Number(manualSpot):autoSpot;
 const nearest=chain.data?.options.filter(o=>o.expiry===expiry&&o.iv!==null&&o.iv>0).sort((a,b)=>Math.abs((a.strike??0)-(spot??0))-Math.abs((b.strike??0)-(spot??0)))[0];
 const iv=manualIv.trim()?Number(manualIv)/100:nearest?.iv??null;
 const modelRate=rate.trim()?Number(rate)/100:chain.data?.rate?.value??NaN,modelDividend=dividend.trim()?Number(dividend)/100:chain.data?.dividend?.value??NaN;
 const t=expiryYears(expiry),result=expirationAnalysis(resolvedGroup.invalid?[]:legs,basis);
 const expired=t===0,invalid=resolvedGroup.invalid||expired;
 const calendar=result.reason==='calendar'&&!invalid?calendarProfitEstimate(legs.map(l=>({...l,iv:manualIv.trim()?Number(manualIv)/100:match(l)?.iv??null})),basis,spot??NaN,iv??NaN,modelRate,modelDividend):null;
 const spread=invalid?null:spreadExpiryProbabilities(legs,spot??NaN,t??NaN,iv??NaN,modelRate,modelDividend);
 const probability=invalid?null:calendar?.probability??profitProbability(result,spot??NaN,t??NaN,iv??NaN,modelRate,modelDividend);
 const unit=first?.currency??'';
 const markedRows=resolvedGroup.rows.map(x=>({...x,leg:{...x.leg,marketPrice:match(x.leg)?.price??x.leg.marketPrice}}));
 const pnls=markedRows.map(x=>legAmounts(x.leg,x.position.source).pnl);
 const holdingPnl=!resolvedGroup.invalid&&pnls.length&&pnls.every(p=>p!==null)?pnls.reduce<number>((sum,p)=>sum+p!,0):null;
 const risk=invalid||result.reason?tr('需核查'):result.maxLoss===Infinity?tr('极高'):legs.some(l=>l.quantity<0&&l.assetType==='OPT')?tr('中高'):tr('中');
 const riskReason=invalid?tr('合约到期或分配与当前持仓不一致'):result.reason?tr('当前结构需要专项模型'):result.maxLoss===Infinity?tr('存在无限损失敞口'):legs.some(l=>l.quantity<0&&l.assetType==='OPT')?tr('损失有界，仍有行权与资金风险'):tr('损失有界，仍有权利金损失风险');
 const reason:Record<string,string>={empty:'缺少有效策略腿',mixed:'多个标的或币种不能共用到期模型',unsupported:'期货期权需专门模型，暂不输出边界',calendar:'跨到期日策略需日期与波动率情景，不能给出固定最大盈亏',invalid:'合约数据不完整',missing:'缺少成本或当前估值价'};
 return <section className="pa-strategy-detail"><div className="pa-section-heading"><div><h2>{group.name}</h2><p>{tr(riskReason)}</p></div><div className="pa-market-highlight"><div><span>{tr('标的现价')}</span><strong>{money(autoSpot,unit)}</strong></div><div><span>{tr('持仓盈亏')}</span><strong className={holdingPnl===null?'':holdingPnl>=0?'up':'down'}>{money(holdingPnl,unit)}</strong></div></div></div>
 <div className="pa-metrics pa-strategy-metrics" aria-live="polite"><Metric label="结构风险" value={risk}/><Metric label="最大损失" value={invalid?'—':money(result.maxLoss,unit)}/><Metric label="最大盈利" value={invalid?'—':money(result.maxProfit,unit)}/><Metric label={result.reason==='calendar'?'近月到期平仓盈利概率':'到期盈利概率'} value={pct(probability)}/><Metric label="盈亏平衡价" value={invalid||result.reason?'—':result.breakEvens.length?result.breakEvens.map(v=>fmt(v)).join(' / ')+' '+unit:tr('无独立盈亏平衡点')}/></div>
 <div className="pa-strategy-holdings">{markedRows.map(x=><div key={reference(x)}>{resolvedGroup.rows.length>1&&<div className="pa-holding-leg-label">{assetLabel(x.leg)} · {tr(x.leg.quantity<0?'卖出':'买入')}</div>}<AnalysisHoldingDetails compact position={x.position} leg={x.leg}/></div>)}</div>
 {calendar&&<p className="pa-note">{tr('Calendar 概率按近月到期时平掉整个组合估算；远月按各腿当前 IV 不变、剩余期限与当时股价估值。采用欧式模型近似，不含提前行权、滑点和额外费用。')}</p>}
 {spread&&<div className="pa-metrics"><Metric label="到期仅卖出腿价内" value={pct(spread.shortOnly)}/><Metric label="到期仅买入腿价内" value={pct(spread.longOnly)}/><Metric label="到期两腿均价内" value={pct(spread.both)}/><Metric label="到期两腿均价外" value={pct(spread.neither)}/></div>}
 {spread&&<p className="pa-note">{tr('按同一到期股价联合计算；仅卖出腿价内时可能产生单边交割。价内概率不是实际指派概率，未包含提前行权及到期后价格变动。')}</p>}
 {result.reason&&<p role="status" className="pa-notice">{tr(reason[result.reason]??reason.invalid)}</p>}{invalid&&<p role="alert" className="pa-notice down">{tr('策略分配需核查，暂停显示组合结果。请编辑分配。')}</p>}

 <details className="pa-details"><summary>{tr('概率假设与行情')} · {manualIv?tr('手动波动率'):tr('期权链隐含波动率')}</summary><div className="pa-form-grid"><label>{tr('当前标的价格')}<input type="number" step="any" min="0.0001" value={manualSpot} placeholder={autoSpot===null?tr('等待行情或手动填写'):String(autoSpot)} onChange={e=>setManualSpot(e.target.value)}/></label><label>{tr('年化波动率')} %<input type="number" min="0.01" max="500" step="any" value={manualIv} placeholder={iv===null?tr('等待行情或手动填写'):String(+(iv*100).toFixed(2))} onChange={e=>setManualIv(e.target.value)}/></label><label>{tr('无风险利率')} %<input type="number" step="any" min="-10" max="50" value={rate} placeholder={chain.data?.rate?fmt(chain.data.rate.value*100,3):tr('待补数据')} onChange={e=>setRate(e.target.value)}/></label><label>{tr('连续股息率')} %<input type="number" step="any" min="0" max="50" value={dividend} placeholder={chain.data?.dividend?fmt(chain.data.dividend.value*100,3):tr('待补数据')} onChange={e=>setDividend(e.target.value)}/></label></div>
 <p className="dim">{tr('组合概率使用近月最接近现价的持有合约 IV；Calendar 远月估值使用各腿 IV，手动 IV 覆盖组合内各腿。下方单腿分析独立使用持仓成本与各自假设。')}</p><p className="dim">{tr('美元利率使用财政部收益率曲线近似；股息率由 IBKR 预期股息现值换算。缺失时需手填，手填值仅为假设。到期时间按美股 16:00 纽约时间。')}</p>
 <p className="pa-note">{tr('无风险利率')} · {rate?tr('手动假设'):chain.data?.rate?chain.data.rate.source+' · '+chain.data.rate.asOf:tr('待补数据')} · {tr('连续股息率')} · {dividend?tr('手动假设'):chain.data?.dividend?chain.data.dividend.source:tr('待补数据')}</p>
 {chain.data?.warnings.length?<p className="pa-notice">{tr('待补数据')} · {chain.data.warnings.map(w=>tr(({ 'identity-mismatch':'合约数据不完整','price-missing':'缺少当前报价','ibkr-unavailable':'IBKR 连接不可用','yahoo-options-unavailable':'Yahoo 期权补充不可用','iv-missing':'部分合约缺少 IV','rate-unavailable':'利率来源不可用','rate-missing':'缺少有效利率','dividend-missing':'缺少预期股息数据'} as Record<string,string>)[w]??w)).join(' · ')}</p>:null}<p className="dim">{tr('概率为风险中性模型估计，不是实际获利频率，也不是提前行权概率。美式行权、离散分红、跳跃和波动率曲面未完整建模。')}</p>
 <div className="pa-toolbar"><span>{chain.data?.source??tr('尚无行情来源')} · {chain.data?.fetchedAt?new Date(chain.data.fetchedAt).toLocaleString(uiLocale()):'—'}</span><button className="term-btn" disabled={chain.isFetching||!symbol||!expiry} onClick={()=>void chain.refetch()}>{tr(chain.isFetching?'正在获取行情…':'刷新期权行情')}</button></div>{chain.error&&<p role="status">{tr('期权行情读取失败，可输入假设进行估计')}</p>}
 </details>
 {result.reason==='calendar'&&!resolvedGroup.invalid&&<CalendarPaths legs={legs} basis={basis}/>}
 {!resolvedGroup.invalid&&<OptionContractBoard hideHoldingDetails analysisOnly items={resolvedGroup.rows} available={x=>Math.abs(x.leg.quantity)} selected={new Set()} toggle={()=>{}} accounts={accounts}/>}

 </section>;
}
function AssetOverview({items,kind,accounts}:{items:AnalysisLeg[];kind:'stock'|'fund'|'future';accounts:Data['accounts']}){
 const [opened,setOpened]=useState<string|null>(null);
 if(!items.length)return <Empty/>;
 return <><p className="pa-note">{tr('点击仓位查看基本信息与分析')}</p><div className={'pa-asset-ledger '+(kind==='stock'?'pa-stock-ledger':'')}><div className="pa-asset-columns" aria-hidden="true">{['资产 / 账户','持仓数量','单位成本','估值价',kind==='future'?'名义敞口':'市值',...(kind==='stock'?['基础评分']:[]),'未实现盈亏',''].map((label,i)=><span key={i}>{tr(label)}</span>)}</div>
 {items.map((x,i)=>{const l=x.leg,key=reference(x)+':'+i,open=opened===key,a=legAmounts(l,x.position.source);
 const value=kind==='future'?l.multiplier!==null&&l.marketPrice!==null?Math.abs(l.quantity*l.multiplier*l.marketPrice):null:a.value;
 return <section key={key} className={'pa-asset-position '+(open?'is-open':'')}><button className="pa-asset-row" aria-expanded={open} onClick={()=>setOpened(open?null:key)}>
 <span><b>{l.symbol}{kind==='future'&&l.expiry?' · '+expiryLabel(l.expiry):''}</b><small>{accounts.find(a=>a.id===x.position.accountId)?.name??'—'} · {l.currency}</small></span>
 <span><b>{fmt(l.quantity,kind==='future'?0:4)}</b><small>{tr(l.quantity<0?'空头':'多头')}</small></span><span><b>{fmt(l.avgCost,2)}</b></span><span><b>{fmt(l.marketPrice,2)}</b></span><span><b>{money(value)}</b><small>{l.currency}</small></span>{kind==='stock'&&<StockScoreCell leg={l}/>}<span className="pa-row-pnl"><b className={a.pnl!==null?(a.pnl>=0?'up':'down'):''}>{money(a.pnl)}</b><small>{l.currency}</small></span><span className="pa-analysis-affordance">{tr(open?'收起':'分析')}<ChevronRight size={14}/></span>
 </button>{open&&<div className="pa-asset-analysis"><AnalysisHoldingDetails position={x.position} leg={l}/>{kind==='future'?<Futures items={[x]}/>:<ResearchAssets items={[x]} kind={kind}/>}</div>}</section>;
 })}</div></>;
}
function StockScoreCell({leg}:{leg:PositionLeg}){
 const research=useAnalysisQuery<Research>({queryKey:['analysis-research',leg.symbol,'stock',leg.currency],path:'/api/analysis/research/'+encodeURIComponent(leg.symbol)+'?kind=stock&currency='+encodeURIComponent(leg.currency),staleTime:3600000});
 const s=research.data?.scoring;
 const score=s?.version==='basic-v1'&&s.score!==null&&Number.isFinite(s.score)?s.score:null;
 return <span className={'pa-row-score '+(score===null||score===50?'':score>50?'up':'down')}><b>{score===null?'—':fmt(score,0)}{score!==null&&<em> / 100</em>}</b>{score!==null&&<span className="pa-signal-track" aria-hidden="true"><i style={{width:Math.max(0,Math.min(100,score))+'%'}}/></span>}<small>{tr(research.isPending?'正在抓取分析…':research.isError?'评分读取失败':score===null?'仅分项':s?.provisional?'暂估总分':'完整基础分')}</small></span>;
}
function ResearchAssets({items,kind}:{items:AnalysisLeg[];kind:'stock'|'fund'}){
 const rows=items,symbol=rows[0]?.leg.symbol??'';
 const research=useAnalysisQuery<Research>({queryKey:['analysis-research',symbol,kind,rows[0]?.leg.currency],path:'/api/analysis/research/'+encodeURIComponent(symbol)+'?kind='+kind+'&currency='+encodeURIComponent(rows[0]?.leg.currency??''),enabled:!!symbol,staleTime:3600000});
 const r=research.data;
 if(!items.length)return <Empty/>;
 return <><div className="pa-section-heading"><div><h2>{tr(kind==='stock'?'股票 triggerpoints':'基金评级')}</h2><p>{tr(kind==='stock'?'固定规则 · 可逐项复核':'保留外部评级的原始尺度')}</p></div></div>
 <section className="pa-research"><div className="pa-section-heading"><h3>{symbol}</h3><button className="term-btn" disabled={research.isFetching} onClick={()=>void research.refetch()}>{tr(research.isFetching?'正在抓取分析…':'抓取分析')}</button></div>
 {research.error&&<p role="alert" className="pa-notice">{tr('分析数据读取失败，请稍后重试')}</p>}
 {kind==='stock'?<><BasicStockScore score={r?.scoring} industry={r?.industry}/>
 </>:<><div className="pa-metrics"><Metric label="Morningstar 星级" value={r?.fundRating?('★'.repeat(r.fundRating)+' '+r.fundRating+'/5'):tr('暂无评级')}/><Metric label="Morningstar 风险等级" value={r?.fundRisk?tr(['低','偏低','中等','偏高','高'][r.fundRisk-1]):tr('暂无评级')}/></div><p className="pa-note">{tr('星级反映历史风险调整表现，不等于未来收益预测。风险评级保留供应商尺度；评级缺失不自动补分。')}</p></>}
 {r?.errors.includes('Research currency differs from position currency')&&<p className="pa-notice">{tr('数据币种与持仓不符，未使用该标的数据。请核对交易所和代码。')}</p>}
 {r?.errors.length? <p className="pa-note">{tr('供应商部分数据暂不可用，缺失项保持空白。')} {r.errors.filter(e=>e!=='Research currency differs from position currency').map(e=>tr(({'yahoo-research-unavailable':'Yahoo 财报或评级不可用','history-unavailable':'历史行情不可用','sec-unavailable':'SEC 财报不可用','ibkr-quote-unavailable':'IBKR 连接不可用'} as Record<string,string>)[e]??e)).join(' · ')}</p>:null}
 {r?.missing?.length?<details className="pa-details"><summary>{tr('待补数据')} · {r.missing.length}</summary><p>{r.missing.map(k=>tr(metricLabels[k]??({fundRating:'Morningstar 星级',fundRisk:'Morningstar 风险等级'} as Record<string,string>)[k]??k)).join(' · ')}</p></details>:null}
 {r?.marketQuote&&<p className="pa-note">IBKR · {tr('估值价')} {money(r.marketQuote.price,r.currency??rows[0]?.leg.currency)} · {new Date(r.marketQuote.fetchedAt).toLocaleString(uiLocale())}</p>}
 <p className="pa-note">{r?.source??tr('尚无行情来源')} · {tr('获取时间')} {r?.fetchedAt?new Date(r.fetchedAt).toLocaleString(uiLocale()):'—'} · {tr('获取时间不代表财务或评级生效日期')}</p>
 </section></>;
}
function Futures({items}:{items:AnalysisLeg[]}){
 const [margin,setMargin]=useState(''),[equity,setEquity]=useState('');
 const x=items[0],l=x?.leg;
 if(!l)return <Empty/>;
 const valid=l.marketPrice!==null&&Number.isFinite(l.marketPrice)&&l.multiplier!==null;
 const notional=valid?Math.abs(l.quantity*l.multiplier!*l.marketPrice!):null;
 const m=margin.trim()?Number(margin):NaN,e=equity.trim()?Number(equity):NaN;
 return <><div className="pa-section-heading"><div><h2>{tr('期货基础风险')}</h2><p>{tr('按价格情景计算，不把保证金当作最大损失。')}</p></div></div>
 <div className="pa-metrics"><Metric label="方向" value={tr(l.quantity>0?'多头':'空头')}/><Metric label="名义敞口" value={money(notional,l.currency)}/><Metric label="名义敞口 / 账户权益" value={notional!==null&&e>0?fmt(notional/e,2)+'×':'—'}/><Metric label="保证金占权益" value={m>=0&&e>0?pct(m/e):'—'}/></div>
 <details className="pa-details" open><summary>{tr('保证金与账户权益')}</summary><div className="pa-form-grid"><label>{tr('本合约总保证金')} · {l.currency}<input type="number" min="0" step="any" value={margin} onChange={event=>setMargin(event.target.value)}/></label><label>{tr('账户权益')} · {l.currency}<input type="number" min="0.01" step="any" value={equity} onChange={event=>setEquity(event.target.value)}/></label></div><p className="dim">{tr('请输入券商最新数据。当前未抓取分合约保证金；币种须与合约一致。')}</p></details>
 <div className="pa-table-wrap"><table className="pa-table"><thead><tr>{['标的变动','情景价格','相对当前增量盈亏'].map(s=><th key={s}>{tr(s)}</th>)}</tr></thead><tbody>{[-.2,-.1,-.05,0,.05,.1,.2].map(change=>{const delta=valid?Math.abs(l.marketPrice!)*change:null;const pnl=delta!==null?l.quantity*l.multiplier!*delta:null;return <tr key={change}><td>{pct(change)}</td><td>{money(delta===null?null:l.marketPrice!+delta)}</td><td className={pnl!==null?(pnl>=0?'up':'down'):''}>{money(pnl,l.currency)}</td></tr>;})}</tbody></table></div><p className="pa-note">{tr('线性价格情景不含汇率、逐日结算、手续费或追加保证金。实际亏损可能超过初始保证金。')}</p>
 </>;
}

function CalendarPaths({legs,basis}:{legs:AnalysisLeg['leg'][];basis:'opening'|'current'}){
 const expiries=[...new Set(legs.filter(l=>l.assetType==='OPT').map(l=>l.expiry))].sort();
 const [prices,setPrices]=useState<Record<string,string>>({}),[settlement,setSettlement]=useState<''|'physical'|'cash'>(''),[early,setEarly]=useState(false);
 const modeled=legs.map(l=>basis==='opening'?l:{...l,avgCost:l.marketPrice});
 const result=settlement?lifecycleScenario(modeled,Object.fromEntries(expiries.map(e=>[e,prices[e]?.trim()?Number(prices[e]):NaN])),settlement,early):null;
 return <details className="pa-details" open><summary>{tr('持有至远月到期的交割路径')}</summary><div className="pa-form-grid"><label>{tr('结算方式')}<select value={settlement} onChange={e=>{setSettlement(e.target.value as typeof settlement);setEarly(false);}}><option value="">{tr('请选择合约实际结算方式')}</option><option value="physical">{tr('标准实物股票交割')}</option><option value="cash">{tr('现金结算')}</option></select></label>{expiries.map(expiry=><label key={expiry}>{expiryLabel(expiry)} · {tr('该时点标的价格')}<input type="number" min=".0001" step="any" value={prices[expiry]??''} onChange={e=>setPrices({...prices,[expiry]:e.target.value})}/></label>)}</div>
 {settlement==='physical'&&legs.filter(l=>l.assetType==='OPT'&&l.expiry===expiries[0]).every(l=>l.quantity<0)&&<label className="pa-inline"><input type="checkbox" checked={early} onChange={e=>setEarly(e.target.checked)}/>{tr('假设近月短腿在该时点提前被行权')}</label>}
 <p className="pa-note">{tr('勾选提前行权时，第一个时点代表提前行权时点；其标的价格由你填写。仅模拟一次近月短腿行权，其余腿假设价内到期行权。')}</p>
 <div className="pa-metrics"><Metric label="路径情景盈亏" value={money(result?.pnl,legs[0]?.currency)}/><Metric label="远月后股票数量" value={result?fmt(result.shares,4):'—'}/><Metric label="含期初成本的净现金" value={money(result?.cash,legs[0]?.currency)}/></div>
 {result&&<div className="pa-table-wrap"><table className="pa-table"><thead><tr>{['交割时点','股票数量变化','现金变化'].map(s=><th key={s}>{tr(s)}</th>)}</tr></thead><tbody>{result.steps.map(step=><tr key={step.expiry}><td>{expiryLabel(step.expiry)}{step.early?' · '+tr('提前行权假设'):''}</td><td>{fmt(step.shares,4)}</td><td>{money(step.cash,legs[0]?.currency)}</td></tr>)}</tbody></table></div>}
 <p className="pa-note">{tr('这里展示指定路径的结果，不代表最大盈亏或路径发生概率。未模拟保证金强平、分红、利息、费用与部分指派。跨期概率需行权与波动率路径模型，暂不输出。')}</p></details>;
}
