"use client";
import {tr,uiLocale} from "../lib/i18n";
import QuoteStatus from "./QuoteStatus";
import SortableTable, { SortRow } from "./SortableTable";
import {Fragment,useState} from 'react';
import {Layers,FolderPlus,FolderMinus,Pencil} from 'lucide-react';
import {useMutation,useQueryClient} from '@tanstack/react-query';
import {apiPost,apiDelete,fmt} from '../lib/api';
import {assetLabel,legIdentity,amounts,legAmounts,structure,dte,expiryLabel,displayGroups,underlyingGroups,type Position,type PositionGroup} from '../lib/holdings-view';
import StrategyPicker,{strategyLabel} from './StrategyPicker';
type Account={id:number;broker:string;name:string};
function metricSortValue(metrics: ReturnType<typeof amounts>, field: 'cost' | 'value' | 'pnl') {
 const missing = field === 'cost' ? 'missingCost' : field === 'value' ? 'missingValue' : 'missingPnl';
 if (!Object.keys(metrics).length || Object.values(metrics).some(value => value[missing])) return null;
 return Object.entries(metrics).sort(([a], [b]) => a.localeCompare(b)).map(([currency, value]) => [currency, value[missing] ? null : value[field]]);
}
export default function HoldingsPositions({rows,groups,accounts,onEdit,onStatus,archived}:{rows:Position[];groups:PositionGroup[];accounts:Account[];onEdit:(h:Position)=>void;onStatus:(h:Position)=>void;archived:boolean}){
 const [grouping,setGrouping]=useState('strategy');
 const [expanded,setExpanded]=useState<Set<string>>(new Set());
 const toggle=(key:string)=>setExpanded(old=>{const next=new Set(old);if(next.has(key))next.delete(key);else next.add(key);return next;});
 const [query,setQuery]=useState('');const [kind,setKind]=useState('all');const [sort,setSort]=useState('updated');const [selected,setSelected]=useState<number[]>([]);const [name,setName]=useState('');const qc=useQueryClient();
 const refresh=()=>qc.invalidateQueries({queryKey:['holdings']});
 const [targetGroup,setTargetGroup]=useState('');
 const joinGroup=useMutation({mutationFn:()=>apiPost('/api/holdings/groups/'+targetGroup+'/members',{positionIds:selected}),onSuccess:()=>{setSelected([]);setTargetGroup('');refresh();}});
 const [strategyId,setStrategyId]=useState('custom');
 const group=useMutation({mutationFn:()=>apiPost('/api/holdings/groups',{name,strategyId,positionIds:selected}),onSuccess:()=>{setSelected([]);setName('');setStrategyId('custom');refresh();}});
 const ungroup=useMutation({mutationFn:(id:number)=>apiDelete('/api/holdings/groups/'+id),onSuccess:refresh});
 const [detachSelection,setDetachSelection]=useState<Record<string,string>>({});
 const detach=useMutation({mutationFn:({groupId,positionId}:{groupId:number;positionId:number})=>apiDelete('/api/holdings/groups/'+groupId+'/members/'+positionId),onSuccess:(_data,{groupId})=>{setDetachSelection(old=>({...old,['g'+groupId]:''}));refresh();}});
 const [deleting,setDeleting]=useState<number|null>(null);
 const remove=useMutation({mutationFn:(id:number)=>apiDelete('/api/holdings/positions/'+id),onSuccess:()=>{setDeleting(null);setSelected([]);refresh();}});
 const cards=(grouping==='symbol'?underlyingGroups(rows):displayGroups(rows,groups)).filter(g=>{const legs=g.rows.flatMap(r=>r.legs);return (kind==='all'||(kind==='options'&&legs.some(l=>['OPT','FOP'].includes(l.assetType)))||(kind==='strategy'&&legs.length>1))&&(!query||[g.name,...legs.map(l=>l.symbol)].join(' ').toLowerCase().includes(query.toLowerCase()));});
 const expiry=(g:typeof cards[number])=>g.rows.flatMap(r=>r.legs).map(l=>l.expiry).filter(Boolean).sort()[0]??'99999999';
 cards.sort((a,b)=>sort==='expiry'?expiry(a).localeCompare(expiry(b)):Math.max(...b.rows.map(r=>Date.parse(r.updatedAt)))-Math.max(...a.rows.map(r=>Date.parse(r.updatedAt))));
 const near=cards.filter(g=>{const n=dte(expiry(g));return n!==null&&n>=0&&n<=7;}).length;
 return <div className="positions-desk">
 <div className="positions-heading"><h2>{tr(archived?'历史持仓（含旧归档）':'持仓明细')}</h2><div className="positions-count"><b>{tr(cards.length)}</b>{tr(grouping==='symbol'?' 个标的 ':' 项仓位 / 策略 ')}<span>· {tr(near)}{tr(" 项七天内到期")}</span></div></div>
 <div className="positions-filters"><select aria-label={tr("分组方式")} value={grouping} onChange={e=>{setGrouping(e.target.value);setSelected([]);setExpanded(new Set());setDeleting(null);}}><option value="strategy">{tr("按仓位 / 策略")}</option><option value="symbol">{tr("按标的分组")}</option></select><input aria-label={tr("搜索仓位与策略")} placeholder={tr("搜索标的或策略名称…")} value={query} onChange={e=>setQuery(e.target.value)}/><div className="positions-tabs">{tr([['all','全部'],['options','期权'],['strategy','多腿策略']].map(([v,label])=><button key={v} aria-pressed={kind===v} onClick={()=>setKind(v)}>{tr(label)}</button>))}</div><select aria-label={tr("仓位排序")} value={sort} onChange={e=>setSort(e.target.value)}><option value="updated">{tr("最近更新")}</option><option value="expiry">{tr("最先到期")}</option></select></div>
 {tr(!archived&&selected.length>0&&<div className="positions-groupbar">{tr(selected.length>0&&<><strong>{tr("已选 ")}{tr(selected.length)}{tr(" 项")}</strong><StrategyPicker value={strategyId} onChange={id=>{setStrategyId(id);if(!name)setName(strategyLabel(id));}}/><input aria-label={tr("新组合名称")} placeholder={tr("给策略起个名字")} value={name} maxLength={100} onChange={e=>setName(e.target.value)}/><button className="term-btn active" disabled={selected.length<2||!name.trim()||group.isPending} onClick={()=>group.mutate()}>{tr("建立策略分组")}</button><button className="term-btn" onClick={()=>setSelected([])}>{tr("取消选择")}</button></>)}</div>)}
 {!archived&&grouping==='strategy'&&selected.length>0&&<div className="positions-join-group"><FolderPlus size={16} aria-hidden="true"/><select aria-label={tr('加入已有组')} value={targetGroup} onChange={e=>setTargetGroup(e.target.value)} disabled={joinGroup.isPending}><option value="">{tr('选择已有组合')}</option>{groups.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select><button className="term-btn active" disabled={!targetGroup||joinGroup.isPending} onClick={()=>joinGroup.mutate()}>{tr(joinGroup.isPending?'保存中…':'加入已有组')}</button></div>}
 {tr((group.error||ungroup.error||remove.error||joinGroup.error)&&<p role="alert" className="down">{tr(group.error?.message||ungroup.error?.message||remove.error?.message||joinGroup.error?.message)}</p>)}
 <div className="holdings-table-wrap"><SortableTable key={grouping+sort} className="holdings-compact-table"><thead><tr><th></th><th>{tr(grouping==='symbol'?'标的':'仓位 / 策略')}</th><th>{tr("账户")}</th><th>{tr("数量")}</th><th>{tr("到期")}</th><th>Bid / Ask</th><th>{tr("净成本")}</th><th>{tr("净市值")}</th><th>{tr("未实现盈亏")}</th><th>Notes</th><th></th></tr></thead><tbody>
 {cards.map(g=>{const legs=g.rows.flatMap(h=>h.legs);const accountNames=[...new Set(g.rows.map(h=>{const a=accounts.find(a=>a.id===h.accountId);return a?a.broker+' · '+a.name:'—';}))].join(' / ');const metrics=amounts(g.rows);const dates=[...new Set(legs.map(l=>l.expiry).filter(Boolean))].sort();const days=dates.length?dte(dates[0]):null;const open=expanded.has(g.key);const one=legs.length===1?legs[0]:null;const noteCount=g.rows.reduce((n,h)=>n+h.legs.filter(l=>l.notes?.trim()).length+(h.notes.trim()?1:0),0);
 return <Fragment key={g.key}><SortRow values={[null, g.name, accountNames, one ? one.quantity : legs.length, dates[0], [one?.bid, one?.ask], metricSortValue(metrics, "cost"), metricSortValue(metrics, "value"), metricSortValue(metrics, "pnl"), noteCount]} className={open?'expanded':''}><td>{grouping!=='symbol'&&!archived&&!g.groupId&&<input aria-label={tr('选择')+' '+g.name} type="checkbox" checked={selected.includes(g.rows[0].id)} onChange={e=>setSelected(e.target.checked?[...selected,g.rows[0].id]:selected.filter(id=>id!==g.rows[0].id))}/>}</td>
 <td className={g.groupId?'holding-group-identity':undefined}><button className="holding-row-title" aria-expanded={open} onClick={()=>toggle(g.key)}>{g.groupId?<Layers size={15} aria-label={tr('策略组')}/>:tr(open?'▾':'▸')} {g.name}</button>{g.groupId?<small>{tr('成员仓位')} · {g.rows.length}{g.incomplete?tr(' · 分组不完整'):''}</small>:<small>{[...new Set(legs.map(l=>l.symbol))].join(' / ')} · {tr(grouping==='symbol'?'标的资产':structure(legs))}</small>}</td>
 <td>{accountNames}<small>{tr(g.rows.every(h=>h.source==='IBKR')?'IBKR 同步':g.rows.every(h=>h.source==='MANUAL')?'手动':'混合来源')}</small></td>
 <td>{tr(one?`${one.quantity>0?'买':'卖'} ${Math.abs(one.quantity)}`:`${legs.length} 条腿`)}</td>
 <td>{tr(dates.length?expiryLabel(dates[0]):'—')}{tr(days!==null&&<small className={days<=7?'down':''}>{tr(days<0?'已过期':days+' 天')}{tr(dates.length>1?' · 多到期日':'')}</small>)}</td>
 <td>{tr(one?<span title={tr(one.bidAskAt?'获取于 '+new Date(one.bidAskAt).toLocaleString(uiLocale()):'')}>{tr(fmt(one.bid,2))} / {tr(fmt(one.ask,2))}<small>{tr(one.currency)}</small><QuoteStatus type={one.bidAskType} at={one.bidAskAt}/></span>:<button className="dim" onClick={()=>toggle(g.key)}>{tr("逐腿查看")}</button>)}</td>
 <td>{tr(Object.entries(metrics).map(([c,t])=><div key={c}>{tr(t.missingCost?'—':fmt(t.cost))}<small>{tr(c)}</small></div>))}</td>
 <td>{tr(Object.entries(metrics).map(([c,t])=><div key={c}>{tr(t.missingValue?'—':fmt(t.value))}<small>{tr(c)}</small></div>))}</td>
 <td>{tr(Object.entries(metrics).map(([c,t])=><div key={c} className={t.missingPnl?'dim':t.pnl>=0?'up':'down'}>{tr(t.missingPnl?'—':(t.pnl>0?'+':'')+fmt(t.pnl))}<small>{tr(c)}</small></div>))}</td>
 <td><button className="holding-notes-preview" title={tr("查看资产备注")} onClick={()=>toggle(g.key)}>{tr(noteCount?`${noteCount} 条备注`:'添加备注')}</button></td>
 <td><button className="term-btn" aria-label={tr('展开仓位')+' '+g.name} aria-expanded={open} onClick={()=>toggle(g.key)}>{tr(open?'收起':'详情')}</button></td></SortRow>
 {open&&<tr className="holding-expanded-row"><td colSpan={11}>
 {g.rows.filter(h=>h.legs.length>1&&h.notes.trim()).map(h=><details key={h.id} className="legacy-position-note"><summary>{h.name}{tr(" · 旧策略备注（未分配到资产）")}</summary><p>{h.notes}</p></details>)}
<div className="strategy-details"><div className="overflow-x-auto"><SortableTable className="data-table whitespace-nowrap"><thead><tr><th></th><th>{tr("仓位")}</th><th>{tr("账户")}</th><th>{tr("方向 / 数量")}</th><th>{tr("标的与合约")}</th><th>{tr("到期日")}</th><th>{tr("乘数")}</th><th>{tr("币种")}</th><th>{tr("单位成本")}</th><th>{tr("Bid 买价")}</th><th>{tr("Ask 卖价")}</th><th>{tr("估值价")}</th><th>{tr("市值")}</th><th>{tr("未实现盈亏")}</th><th>{tr("资产备注")}</th></tr></thead><tbody>{g.rows.flatMap(h=>h.legs.map((l,i)=>{const v=legAmounts(l,h.source);return <SortRow values={[null,h.name,accounts.find(a=>a.id===h.accountId)?.name, l.quantity, [l.symbol, l.strike, l.right], l.expiry, l.multiplier, l.currency, l.avgCost, l.bid, l.ask, l.marketPrice, v.value, v.pnl]} key={h.id+':'+i}><td>{i===0&&<input type="checkbox" aria-label={tr('选择')+' '+h.name} checked={detachSelection[g.key]===String(h.id)} onChange={e=>{setDetachSelection(old=>({...old,[g.key]:e.target.checked?String(h.id):''}));setDeleting(null);detach.reset();}}/>}</td><td>{i===0&&<div className="position-inline-identity"><strong>{h.name}</strong>{h.source==='MANUAL'&&<button className="term-btn position-edit-icon" title={tr('编辑')+' '+h.name} aria-label={tr('编辑')+' '+h.name} onClick={()=>onEdit(rows.find(r=>r.id===h.id)!)}><Pencil size={14}/></button>}</div>}</td><td className="position-account-secondary">{accounts.find(a=>a.id===h.accountId)?.broker} · {accounts.find(a=>a.id===h.accountId)?.name}</td><td><span className={l.quantity<0?'position-side short':'position-side long'}>{tr(l.quantity<0?'空头':'多头')} {tr(Math.abs(l.quantity))}</span></td><td><b>{tr(l.symbol)}</b> · {tr(['OPT','FOP'].includes(l.assetType)?`${l.strike} ${l.right==='C'?'Call':'Put'}`:l.assetType)}</td><td>{tr(expiryLabel(l.expiry))}</td><td>{tr(fmt(l.multiplier,0))}</td><td>{tr(l.currency)}</td><td>{tr(fmt(l.avgCost,4))}</td><td>{tr(fmt(l.bid,4))}<div><QuoteStatus type={l.bidAskType} at={l.bidAskAt}/></div></td><td>{tr(fmt(l.ask,4))}</td><td>{tr(fmt(l.marketPrice,4))}<div><QuoteStatus type={l.marketDataType} at={l.quoteAt} detail={l.quoteBasis}/></div></td><td>{tr(fmt(v.value))}</td><td className={v.pnl===null?'dim':v.pnl>=0?'up':'down'}>{tr(fmt(v.pnl))}</td><td className="asset-notes-cell"><PositionNote position={rows.find(r=>r.id===h.id)!} index={rows.find(r=>r.id===h.id)!.legs.indexOf(l)}/></td></SortRow>}))}</tbody></SortableTable></div><div className="strategy-actions selection-actions">
{(()=>{const chosen=g.rows.find(h=>String(h.id)===detachSelection[g.key]);const original=chosen&&rows.find(r=>r.id===chosen.id);return <>
<span className="selection-caption">{chosen?chosen.name:tr('请选择一个仓位')}</span>
<button className="term-btn" disabled={!original||original.source!=='MANUAL'||!original.active} onClick={()=>original&&onStatus(original)}>{tr(grouping==='symbol'?'原仓位平仓 / 行权':'平仓 / 行权')}</button>
{grouping!=='symbol'&&<button className="term-btn down" disabled={!original||original.source!=='MANUAL'||remove.isPending} onClick={()=>{if(original){setDeleting(original.id);remove.reset();}}}>{tr('删除仓位')}</button>}
{g.groupId&&<button className="term-btn" disabled={!original||detach.isPending} title={tr('仅解除分组，不删除仓位或改变账目')} onClick={()=>original&&detach.mutate({groupId:g.groupId!,positionId:original.id})}><FolderMinus size={14}/>{tr('移出策略')}</button>}
{original&&deleting===original.id&&<div className="position-delete-confirm" role="alert">{tr("删除此仓位会移除其浮动盈亏，不改变现金，也不生成平仓记录。确认删除？")}<button className="term-btn down" disabled={remove.isPending} onClick={()=>remove.mutate(original.id)}>{tr('确认删除')}</button><button className="term-btn" disabled={remove.isPending} onClick={()=>setDeleting(null)}>{tr('取消')}</button></div>}
</>;})()}
{detach.error&&detach.variables?.groupId===g.groupId&&<p className="down" role="alert">{tr(detach.error.message)}</p>}
{g.groupId&&<button className="term-btn" disabled={ungroup.isPending} onClick={()=>ungroup.mutate(g.groupId!)}>{tr('解除策略分组')}</button>}
</div></div></td></tr>}</Fragment>;
 })}</tbody></SortableTable></div>
 {tr(!cards.length&&<div className="positions-noresults"><strong>{tr(query||kind!=='all'?'没有符合条件的仓位':'让每一笔策略都有清晰的全貌')}</strong><p>{tr(query||kind!=='all'?'试试其他关键词或切回全部仓位。':'同步 IBKR 或添加手动仓位，即可在这里查看组合盈亏与到期时间。')}</p></div>)}
 <details className="positions-footnote"><summary>{tr("计算口径")}</summary><p>{tr("按原币种汇总，空头市值为负。净成本不含历史已实现盈亏；DTE 按纽约日期计算。历史持仓不是成交记录；已实现盈亏请查看现金与盈亏账本。")}</p></details>
 </div>;
}

export function PositionNote({position,index}:{position:Position;index:number}){
 const leg=position.legs[index];const title=assetLabel(leg);const notes=leg.notes??(position.legs.length===1?position.notes:'');
 const [open,setOpen]=useState(false);
 const [draft,setDraft]=useState<string|null>(null);
 const qc=useQueryClient();
 const save=useMutation({mutationFn:(notes:string)=>apiPost('/api/holdings/positions/'+position.id+'/legs/'+index+'/notes',{notes,identity:legIdentity(leg)}),onSuccess:async()=>{await qc.invalidateQueries({queryKey:['holdings']});setDraft(null);}});
 return <details className="position-note asset-note" open={open} onToggle={e=>setOpen(e.currentTarget.open)} aria-label={tr('Notes · '+title)}>
 <summary>{tr(notes.trim()?'查看备注':'添加备注')}</summary><header className="position-note-header"><div><strong>Notes</strong><span>{tr(title)}</span></div>{draft===null&&<button className="term-btn" onClick={()=>{setOpen(true);setDraft(notes);save.reset();}}>{tr(notes.trim()?'编辑':'＋ 添加笔记')}</button>}</header>
 {draft===null ? (notes.trim()?<p className="position-note-body">{notes}</p>:<p className="position-note-empty">{tr("暂无笔记")}</p>) : <>
 <label className="sr-only" htmlFor={'position-note-'+position.id+'-'+index}>{tr("资产笔记 · ")}{tr(title)}</label><textarea autoFocus id={'position-note-'+position.id+'-'+index} rows={4} maxLength={2000} placeholder={tr("记录开仓逻辑、调整计划或提醒…")} value={draft} disabled={save.isPending} onChange={e=>{setDraft(e.target.value);save.reset();}}/>
 <div className="position-note-footer"><span className={save.error?'down':'dim'} role={save.error?'alert':undefined}>{tr(save.error?save.error.message:`${draft.length} / 2000`)}</span><div className="flex gap-2"><button className="term-btn" disabled={save.isPending} onClick={()=>{setDraft(null);save.reset();}}>{tr("取消")}</button><button className="term-btn active" disabled={save.isPending} onClick={()=>save.mutate(draft)}>{tr(save.isPending?'保存中…':'保存笔记')}</button></div></div></>}
 </details>;
}
