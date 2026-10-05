"use client";
import {useState} from 'react';
import {useMutation,useQueryClient} from '@tanstack/react-query';
import {Pencil,Trash2,Save,X,Search} from 'lucide-react';
import SortableTable,{SortRow} from './SortableTable';
import {type LedgerData} from './HoldingsLedger';
import {fmt} from '../lib/api';
import {tr,uiLocale} from '../lib/i18n';
type Event=LedgerData['events'][number];
const dateInput=(at:string)=>{const d=new Date(at);return Number.isFinite(d.getTime())?new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,19):'';};
const assetName=(e:Event)=>[e.asset?.symbol,e.asset?.assetType==='OPT'?e.asset.expiry:'',e.asset?.right,e.asset?.strike??''].filter(v=>v!==''&&v!==undefined).join(' ');

export default function ClosedTrades({data,filter}:{data:LedgerData;filter:string}) {
 const qc=useQueryClient();const [search,setSearch]=useState('');const [from,setFrom]=useState('');const [to,setTo]=useState('');
 const [edit,setEdit]=useState<Event|null>(null);const [remove,setRemove]=useState<Event|null>(null);
 const [draft,setDraft]=useState({quantity:'',price:'',fee:'',at:'',note:''});
 const account=(e:Event)=>{const a=data.accounts.find(a=>a.id===e.accountId);return a?a.broker+' · '+a.name:'—';};
 const events=data.events.map(e=>({...e,...e.record})).filter(e=>e.kind==='CLOSE'&&!e.closedDeleted&&(!filter||e.accountId===Number(filter))).filter(e=>{
  const day=dateInput(e.at).slice(0,10);
  return (!from||day>=from)&&(!to||day<=to)&&[assetName(e),account(e),e.positionName,e.note].join(' ').toLowerCase().includes(search.toLowerCase());
 }).sort((a,b)=>Date.parse(b.at)-Date.parse(a.at)||b.id-a.id);
 const mutate=useMutation({mutationFn:async({event,method}:{event:Event;method:'PUT'|'DELETE'})=>{
  const payload=method==='DELETE'?{revision:event.revision??0}:{revision:event.revision??0,quantity:Number(draft.quantity),price:Number(draft.price),fee:Number(draft.fee),at:draft.at===dateInput(event.at)?event.at:new Date(draft.at).toISOString(),note:draft.note};
  const response=await fetch('/api/holdings/closed-trades/'+event.id,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
  const result=await response.json();if(!response.ok)throw Error(result.error);
 },onSuccess:async()=>{await qc.invalidateQueries({queryKey:['holdings']});setEdit(null);setRemove(null);}});
 const startEdit=(e:Event)=>{mutate.reset();setRemove(null);setEdit(e);setDraft({quantity:String(e.quantity),price:String(e.price),fee:String(e.fee??0),at:dateInput(e.at),note:e.note??''});};
 return <section className="closed-trades"><header><h2>{tr('已平仓记录')} <small>{events.length}</small></h2></header>
 <div className="closed-trades-filters"><label className="closed-trades-search"><Search size={14} aria-hidden="true"/><input aria-label={tr('搜索平仓记录')} placeholder={tr('搜索资产、账户或备注')} value={search} onChange={e=>setSearch(e.target.value)}/></label><label>{tr('开始日期')}<input type="date" value={from} max={to||undefined} onChange={e=>setFrom(e.target.value)}/></label><label>{tr('结束日期')}<input type="date" value={to} min={from||undefined} onChange={e=>setTo(e.target.value)}/></label></div>
 {edit&&<form className="closed-trades-editor" onSubmit={e=>{e.preventDefault();mutate.mutate({event:edit,method:'PUT'});}}><p className="closed-trades-warning" role="note">{tr('修改成交会按差额更新现金和已实现盈亏；修改数量会同步调整剩余持仓。修改价格、数量或佣金会覆盖该笔手动盈利更正。已有后续持仓变动时不能修改数量。')}</p><header><strong>{tr('更正平仓记录')} · {assetName(edit)}</strong><span>{account(edit)}</span></header><div className="ledger-form-row"><label>{tr('数量')}<input required type="number" min="0.00000001" step={edit.asset?.assetType==='OPT'?1:'any'} value={draft.quantity} onChange={e=>setDraft({...draft,quantity:e.target.value})}/></label><label>{tr('成交单价')}<input required type="number" min="0" step="any" value={draft.price} onChange={e=>setDraft({...draft,price:e.target.value})}/></label><label>{tr('佣金（本次总额）')}<input required type="number" min="0" step="any" value={draft.fee} onChange={e=>setDraft({...draft,fee:e.target.value})}/></label><label>{tr('成交时间')}<input required type="datetime-local" step="1" value={draft.at} onChange={e=>setDraft({...draft,at:e.target.value})}/></label></div><label className="closed-trades-note">{tr('备注')}<textarea rows={2} maxLength={2000} value={draft.note} onChange={e=>setDraft({...draft,note:e.target.value})}/></label><footer><button className="term-btn active" disabled={mutate.isPending}><Save size={14}/>{tr('保存更正')}</button><button type="button" className="term-btn" disabled={mutate.isPending} onClick={()=>setEdit(null)}><X size={14}/>{tr('取消')}</button></footer></form>}
 {remove&&<section className="closed-trades-confirm" role="alert"><strong>{tr('删除平仓记录')} · {assetName(remove)} · {account(remove)}</strong><p>{tr('删除会剔除该笔已实现盈亏，不改变现金，也不恢复持仓。需要恢复持仓时请手动添加。')}</p><button className="term-btn down" disabled={mutate.isPending} onClick={()=>mutate.mutate({event:remove,method:'DELETE'})}>{tr('确认删除')}</button><button className="term-btn" disabled={mutate.isPending} onClick={()=>setRemove(null)}>{tr('取消')}</button></section>}
 {mutate.error&&<p role="alert" className="down">{tr(mutate.error.message)}</p>}
 <div className="overflow-x-auto"><SortableTable className="data-table closed-trades-table"><thead><tr>{['平仓时间','账户','资产','仓位 / 策略','方向','数量','成本单价','平仓单价','佣金（本次总额）','已实现盈亏','币种','备注'].map(s=><th key={s}>{tr(s)}</th>)}<th data-sort-disabled>{tr('操作')}</th></tr></thead><tbody>{events.map(e=>{
  const currency=e.asset?.currency??Object.keys(e.realized)[0];const pnl=e.realized[currency];const side=(e.asset?.quantity??0)>0?'卖出平仓':'买入平仓';
  return <SortRow key={e.id} values={[Date.parse(e.at),account(e),assetName(e),e.positionName,tr(side),e.quantity,e.asset?.avgCost,e.price,e.fee,pnl,currency,e.note]}><td>{new Date(e.at).toLocaleString(uiLocale())}</td><td>{account(e)}</td><td>{assetName(e)}</td><td>{e.positionName}</td><td>{tr(side)}</td><td>{fmt(e.quantity,4)}</td><td>{fmt(e.asset?.avgCost,4)}</td><td>{fmt(e.price,4)}</td><td>{fmt(e.fee)}</td><td className={pnl>=0?'up':'down'}>{fmt(pnl)}</td><td>{currency}</td><td className="closed-trades-notes">{e.note}</td><td><div className="closed-trades-actions"><button className="term-btn" disabled={mutate.isPending} title={tr('更正平仓记录')} aria-label={tr('更正平仓记录')} onClick={()=>startEdit(e)}><Pencil size={14}/></button><button className="term-btn down" disabled={mutate.isPending} title={tr('删除平仓记录')} aria-label={tr('删除平仓记录')} onClick={()=>{mutate.reset();setEdit(null);setRemove(e);}}><Trash2 size={14}/></button></div></td></SortRow>;
 })}</tbody></SortableTable></div>
 {!events.length&&<p className="closed-trades-empty dim">{tr('暂无符合条件的平仓记录')}</p>}
 <p className="dim closed-trades-scope">{tr('仅包含本平台已记录的平仓；券商快照不会自动生成历史成交。')}</p>
 </section>;
}
