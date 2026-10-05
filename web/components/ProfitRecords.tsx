"use client";
import {useState} from 'react';
import {useMutation,useQueryClient} from '@tanstack/react-query';
import {Pencil,Save,X} from 'lucide-react';
import SortableTable,{SortRow} from './SortableTable';
import type {LedgerData} from './HoldingsLedger';
import {fmt} from '../lib/api';
import {tr,uiLocale} from '../lib/i18n';
const kinds:Record<string,string>={OPEN:'开仓',CLOSE:'平仓',EXERCISE:'行权 / 被行权',INCOME:'股息 / 利息收入',EXPENSE:'费用支出'};
type Row={event:LedgerData['events'][number];currency:string;amount:number};

export default function ProfitRecords({data,filter}:{data:LedgerData;filter:string}) {
 const qc=useQueryClient();const [edit,setEdit]=useState<Row|null>(null);const [amount,setAmount]=useState('');const [note,setNote]=useState('');
 const rows=data.events.filter(e=>!e.closedDeleted&&(!filter||e.accountId===Number(filter))).flatMap(event=>Object.entries(event.realized).map(([currency,amount])=>({event,currency,amount})));
 const totals=rows.reduce<Record<string,number>>((s,r)=>({...s,[r.currency]:(s[r.currency]??0)+r.amount}),{});
 const label=(r:Row)=>{const a=data.accounts.find(a=>a.id===r.event.accountId);return a?a.broker+' · '+a.name:'—';};
 const save=useMutation({mutationFn:async()=>{
  const r=await fetch('/api/holdings/profit-records/'+edit!.event.id,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision:edit!.event.revision??0,currency:edit!.currency,amount:Number(amount),note})});
  const result=await r.json();if(!r.ok)throw Error(result.error);
 },onSuccess:async()=>{await qc.invalidateQueries({queryKey:['holdings']});setEdit(null);}});
 return <section className="closed-trades"><header><h2>{tr('盈利记录')}</h2></header><div className="profit-record-totals">{Object.entries(totals).map(([c,n])=><span key={c}>{c} · {tr('已记录盈亏')} <strong className={n>=0?'up':'down'}>{fmt(n)}</strong></span>)}</div>
 {edit&&<form className="closed-trades-editor" onSubmit={e=>{e.preventDefault();save.mutate();}}><header><strong>{tr('修改已实现盈亏')} · {edit.event.asset?.symbol??tr(kinds[edit.event.kind]??edit.event.kind)} · {edit.currency}</strong><span>{label(edit)}</span></header><p className="closed-trades-warning">{tr('修改已实现盈亏会同步更新累计盈亏，不改变现金和持仓。现金请通过存款和取款调整。')}</p><div className="ledger-form-row"><label>{tr('已实现盈亏')}<input required type="number" step="any" value={amount} onChange={e=>setAmount(e.target.value)}/></label><label>{tr('更正备注')}<input maxLength={2000} value={note} onChange={e=>setNote(e.target.value)}/></label></div><footer><button className="term-btn active" disabled={save.isPending}><Save size={14}/>{tr('保存更正')}</button><button type="button" className="term-btn" disabled={save.isPending} onClick={()=>setEdit(null)}><X size={14}/>{tr('取消')}</button></footer>{save.error&&<p role="alert" className="down">{tr(save.error.message)}</p>}</form>}
 <div className="overflow-x-auto"><SortableTable className="data-table profit-record-table"><thead><tr>{['时间','账户','资产','操作','已实现盈亏','币种','更正备注'].map(s=><th key={s}>{tr(s)}</th>)}<th data-sort-disabled>{tr('操作')}</th></tr></thead><tbody>{rows.map(row=>{const {event:e,currency,amount}=row;return <SortRow key={e.id+currency} values={[Date.parse(e.at),label(row),e.asset?.symbol,tr(kinds[e.kind]??e.kind),amount,currency,e.profitNotes?.[currency]]}><td>{new Date(e.at).toLocaleString(uiLocale())}</td><td>{label(row)}</td><td>{e.asset?.symbol??'—'}</td><td>{tr(kinds[e.kind]??e.kind)}</td><td className={amount>=0?'up':'down'}>{fmt(amount)}</td><td>{currency}</td><td className="closed-trades-notes">{e.profitNotes?.[currency]}</td><td><button className="term-btn" title={tr('修改已实现盈亏')} aria-label={tr('修改已实现盈亏')} disabled={save.isPending} onClick={()=>{save.reset();setEdit(row);setAmount(String(amount));setNote(e.profitNotes?.[currency]??'');}}><Pencil size={14}/></button></td></SortRow>;})}</tbody></SortableTable></div>
 {!rows.length&&<p className="closed-trades-empty dim">{tr('暂无盈利记录')}</p>}
 <p className="dim closed-trades-scope">{tr('仅汇总本平台已记录的收益与亏损，不代表券商完整成交历史。')}</p></section>;
}
