"use client";
import {useState} from 'react';
import {useMutation,useQueryClient} from '@tanstack/react-query';
import {Trash2,X} from 'lucide-react';
import {tr} from '../lib/i18n';

export default function DeleteHoldingAccount({account,onClose,onDeleted}:{account:{id:number;broker:string;name:string;ibkrAccount:string|null};onClose:()=>void;onDeleted:()=>void}) {
 const [confirmation,setConfirmation]=useState('');const qc=useQueryClient();
 const remove=useMutation({mutationFn:async()=>{
  const r=await fetch('/api/holdings/accounts/'+account.id,{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({confirmation})});
  const d=await r.json();if(!r.ok)throw Error(d.error);
 },onSuccess:async()=>{await qc.invalidateQueries({queryKey:['holdings']});onDeleted();}});
 return <form className="closed-trades-editor" aria-label={tr('删除账户')} onSubmit={e=>{e.preventDefault();if(confirmation===account.name)remove.mutate();}}>
  <header><strong>{tr('删除账户')} · {account.broker} · {account.name}</strong><button type="button" className="term-btn" aria-label={tr('取消')} disabled={remove.isPending} onClick={onClose}><X size={14}/></button></header>
  <p className="closed-trades-warning" role="alert">{tr('将永久删除该账户及其全部本地持仓、现金、平仓和盈亏记录，无法撤销。不会关闭券商账户，也不会向券商下单。')}</p>
  {account.ibkrAccount&&<p>{tr('再次同步此 IBKR 账户会重新导入当前持仓，但无法恢复已删除的手动记录。')}</p>}
  <label>{tr('输入账户名称确认删除')}<input className="term-input" required autoComplete="off" value={confirmation} disabled={remove.isPending} onChange={e=>setConfirmation(e.target.value)}/></label>
  {remove.error&&<p className="down" role="alert">{tr(remove.error.message)}</p>}
  <footer><button className="term-btn down" disabled={remove.isPending||confirmation!==account.name}><Trash2 size={14}/>{tr(remove.isPending?'删除中…':'确认删除账户')}</button><button type="button" className="term-btn" disabled={remove.isPending} onClick={onClose}>{tr('取消')}</button></footer>
 </form>;
}
