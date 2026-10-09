"use client";
import { useState,useEffect,useRef } from 'react';
import { ChevronDown } from 'lucide-react';
import { useMutation,useQueryClient } from '@tanstack/react-query';
import SortableTable,{SortRow} from './SortableTable';
import { apiPost,fmt } from '../lib/api';
import { tr,uiLocale } from '../lib/i18n';
import { amounts,assetLabel,type Position,type PositionLeg } from '../lib/holdings-view';

export type CashInput={currency:string;amount:string};
export const cashPayload=(rows:CashInput[])=>rows.map(r=>({currency:r.currency.toUpperCase(),amount:Number(r.amount)}));
export type LedgerData={accounts:{id:number;broker:string;name:string;ibkrAccount:string|null}[];balances:{accountId:number;currency:string;cash:number;localCash?:number;initialCash:number;baseline:number;flows:number;startedAt:string}[];brokerCash:{accountId:number;currency:string;cash:number;at:string}[];events:{source?:string;pnlPending?:boolean;executionId?:string;id:number;accountId:number;kind:string;at:string;cash:Record<string,number>;realized:Record<string,number>;asset?:Partial<PositionLeg>&{symbol:string};quantity?:number;price?:number;fee?:number;delivery?:{shares:number;effectivePrice:number};note?:string;revision?:number;closedDeleted?:boolean;record?:{at:string;quantity:number;price:number;fee:number;note:string};profitNotes?:Record<string,string>;positionName?:string}[]};
export function ledgerCash(data:LedgerData,b:LedgerData['balances'][number]) {
 if(!data.accounts.find(a=>a.id===b.accountId)?.ibkrAccount)return b.cash;
 const actual=data.brokerCash.find(c=>c.accountId===b.accountId&&c.currency===b.currency)?.cash;
 return actual===undefined?undefined:actual+(b.localCash??0);
}
const kinds:Record<string,string>={IBKR_TRADE:'IBKR 成交',OPEN:'开仓',CLOSE:'平仓',EXERCISE:'行权 / 被行权',DEPOSIT:'存入现金',WITHDRAWAL:'取出现金',INCOME:'股息 / 利息收入',EXPENSE:'费用支出'};
const localTime=()=>{const d=new Date();return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,19);};

export function CashFields({value,onChange}:{value:CashInput[];onChange:(v:CashInput[])=>void}) {
 return <fieldset className="ledger-cash-fields"><legend>{tr('剩余现金')}</legend>{value.map((r,i)=><div key={i} className="ledger-form-row"><label>{tr('币种')}<input aria-label={tr('现金币种')+' '+(i+1)} required pattern="[A-Za-z]{3}" maxLength={3} value={r.currency} onChange={e=>onChange(value.map((v,j)=>i===j?{...v,currency:e.target.value.toUpperCase()}:v))}/></label><label>{tr('现金余额')}<input aria-label={tr('现金余额')+' '+(i+1)} required type="number" step="any" value={r.amount} onChange={e=>onChange(value.map((v,j)=>i===j?{...v,amount:e.target.value}:v))}/></label><button type="button" className="term-btn" disabled={value.length===1} onClick={()=>onChange(value.filter((_,j)=>i!==j))}>{tr('移除')}</button></div>)}<button type="button" className="term-btn" disabled={value.length>=20} onClick={()=>onChange([...value,{currency:'',amount:''}])}>{tr('添加币种')}</button></fieldset>;
}

export function LedgerOverview({data,rows,filter,unavailable,compact=false,docked=false,currencyFilter=''}:{data:LedgerData;rows:Position[];filter:string;unavailable:boolean;compact?:boolean;docked?:boolean;currencyFilter?:string}) {
 const accounts=data.accounts.filter(a=>!filter||a.id===Number(filter));
 const active=rows.filter(h=>h.active&&accounts.some(a=>a.id===h.accountId));
 const totals=amounts(active);
 const events=data.events.filter(e=>!e.closedDeleted&&accounts.some(a=>a.id===e.accountId));
 const currencies=[...new Set([...(compact?[]:['USD','CAD']),...Object.keys(totals),...events.flatMap(e=>Object.keys(e.realized)),...data.balances.filter(b=>accounts.some(a=>a.id===b.accountId)).map(b=>b.currency),...data.brokerCash.filter(b=>accounts.some(a=>a.id===b.accountId)).map(b=>b.currency)])].filter(c=>!currencyFilter||c===currencyFilter);
 if(compact&&!currencies.length)return <p className="account-pnl-empty dim">{tr('累计盈亏')} · {tr('暂无持仓或盈亏记录')}</p>;
 return <div className={compact?'account-pnl-summary':docked?'holdings-summary-dock':'holdings-overview ledger-overview'} aria-label={docked?tr('账户汇总'):undefined}>{currencies.map(c=>{
  const t=totals[c];let cash=0,missing=false,realized=0,missingRealized=false;
  for(const a of accounts){const b=data.balances.find(b=>b.accountId===a.id&&b.currency===c);const anyBaseline=data.balances.some(b=>b.accountId===a.id);const has=active.some(h=>h.accountId===a.id&&h.legs.some(l=>l.currency===c&&l.quantity!==0));const broker=data.brokerCash.find(b=>b.accountId===a.id&&b.currency===c);
   if(!anyBaseline||(!b&&(has||broker)))missing=true;
   if(a.ibkrAccount){if(!broker&&(b||has))missing=true;cash+=(broker?.cash??0)+(b?.localCash??0);missingRealized=true;}else cash+=b?.cash??0;

   realized+=events.filter(e=>e.accountId===a.id).reduce((n,e)=>n+(e.realized[c]??0),0);
  }
  const equity=cash+(t?.value??0);const pnl=realized+(t?.pnl??0);
  const pnlMissing=unavailable||!!t?.missingPnl;
  const valueMissing=unavailable||!!t?.missingValue;
  if(compact){
   return <section key={c}><span title={tr('累计盈亏包含已记录的已实现盈亏和当前持仓未实现盈亏，不包含入出金。')}>{c} · {tr('累计盈亏')}</span><strong className={pnlMissing?'dim':pnl>=0?'up':'down'}>{pnlMissing?'—':fmt(pnl)}</strong>{pnlMissing&&<small>{tr('数据不足')}</small>}{missingRealized&&<small>{tr('仅含已记录盈亏，券商历史未补全')}</small>}</section>;
  }
  const items:Array<[string,number,boolean,boolean]>=[['总资产',equity,valueMissing||missing,false],['累计盈亏',pnl,pnlMissing,true],['现金余额',cash,unavailable||missing,false],['净持仓市值',t?.value??0,valueMissing,false],['已实现盈亏',realized,unavailable,true],['未实现盈亏',t?.pnl??0,pnlMissing,true]];
  if(docked){
   const metric=([label,n,unknown,color]:typeof items[number])=><div key={label}><span>{tr(label)}</span><strong className={unknown?'dim':color?n>=0?'up':'down':''}>{unknown?'—':fmt(n)}</strong></div>;
   return <details key={c} className="holdings-summary-currency"><summary title={tr('展开或收起资金明细')}><strong>{c}</strong><div className="holdings-summary-primary">{[items[3],items[5],items[1]].map(metric)}</div><ChevronDown aria-hidden="true" size={14}/></summary><div className="holdings-summary-detail"><span>{filter?accounts[0]?.name:tr('全部账户')}</span><div className="holdings-summary-secondary">{[items[0],items[2],items[4]].map(metric)}</div>{missing&&<small>{tr('部分账户尚未设置初始资产或缺少现金数据')}</small>}{missingRealized&&<small>{tr('已计入已同步的 IBKR 成交盈亏，较早历史可能不完整')}</small>}</div></details>;
  }
  return <section key={c} className="holdings-currency"><header><strong>{c}</strong><span>{filter?accounts[0]?.name:tr('全部账户')}</span></header><div className="ledger-metrics">{items.map(([label,n,unknown,color])=><div key={label}><span>{tr(label)}</span><strong className={unknown?'dim':color?n>=0?'up':'down':''}>{unknown?'—':fmt(n)}</strong></div>)}</div>{missing&&<small className="dim">{tr('部分账户尚未设置初始资产或缺少现金数据')}</small>}{missingRealized&&<small className="dim">{tr('已计入已同步的 IBKR 成交盈亏，较早历史可能不完整')}</small>}</section>;
 })}</div>;
}

export function PositionTransaction({position,onDone}:{position:Position;onDone:()=>void}) {
 const dialog=useRef<HTMLElement>(null);
 useEffect(()=>{const previous=document.activeElement as HTMLElement|null;dialog.current?.querySelector<HTMLElement>('select')?.focus();return()=>previous?.focus();},[]);
 const [index,setIndex]=useState(position.legs.findIndex(l=>l.quantity!==0));
 const [kind,setKind]=useState('CLOSE');const [quantity,setQuantity]=useState('');const [price,setPrice]=useState('');const [fee,setFee]=useState('0');const [at,setAt]=useState(localTime);const [physical,setPhysical]=useState(false);const [requestId]=useState(()=>crypto.randomUUID());
 const qc=useQueryClient();const l=position.legs[index];
 const save=useMutation({mutationFn:()=>apiPost('/api/holdings/positions/'+position.id+'/transaction',{requestId,expectedLegs:JSON.stringify(position.legs),index,kind,quantity:Number(quantity),price:Number(price),fee:Number(fee),at:new Date(at).toISOString(),physicalDelivery:physical}),onSuccess:async()=>{await qc.invalidateQueries({queryKey:['holdings']});onDone();}});
 const shares=l?Math.sign(l.quantity)*Number(quantity)*(l.multiplier??0)*(l.right==='C'?1:-1):0;
 const cost=l&&l.strike!==null&&l.avgCost!==null?l.strike+(l.right==='C'?1:-1)*l.avgCost:null;
 if(!l)return null;
 return <div className="ledger-modal-backdrop"><section ref={dialog} role="dialog" aria-modal="true" aria-label={tr('记录平仓或行权')} className="ledger-modal" onKeyDown={e=>{if(e.key==='Escape'&&!save.isPending)onDone();if(e.key==='Tab'){const nodes=Array.from(dialog.current?.querySelectorAll<HTMLElement>('input:not([disabled]),select:not([disabled]),button:not([disabled])')??[]);const first=nodes[0],last=nodes[nodes.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}}}><header><h2>{tr('记录平仓或行权')}</h2><strong>{position.name}</strong></header><form onSubmit={e=>{e.preventDefault();save.mutate();}}>
  <label>{tr('资产')}<select value={index} onChange={e=>{setIndex(Number(e.target.value));setQuantity('');setPrice('');setKind('CLOSE');setPhysical(false);}}>{position.legs.map((l,i)=>l.quantity!==0&&<option key={i} value={i}>{assetLabel(l)}</option>)}</select></label>
  <div className="ledger-form-row"><label>{tr('操作')}<select value={kind} onChange={e=>{setKind(e.target.value);setPrice('');}}><option value="CLOSE">{tr('平仓')}</option>{l.assetType==='OPT'&&<option value="EXERCISE">{tr(l.quantity>0?'行权':'被行权')}</option>}</select></label><label>{tr('数量')}<input required type="number" min={l.assetType==='OPT'?1:0.00000001} max={Math.abs(l.quantity)} step={l.assetType==='OPT'?1:'any'} value={quantity} onChange={e=>setQuantity(e.target.value)}/></label></div>
  <div className="ledger-form-row"><label>{tr(kind==='CLOSE'?'成交单价':'交割时股票估值价')}<input required type="number" min="0" step="any" value={price} onChange={e=>setPrice(e.target.value)}/></label><label>{tr('佣金（本次总额）')}<input required type="number" min="0" step="any" value={fee} onChange={e=>setFee(e.target.value)}/></label></div>
  <label>{tr('成交时间')}<input required type="datetime-local" step="1" value={at} onChange={e=>setAt(e.target.value)}/></label>
  {kind==='EXERCISE'&&<><label className="ledger-check"><input required type="checkbox" checked={physical} onChange={e=>setPhysical(e.target.checked)}/>{tr('确认实物交割：每张股数等于合约乘数，不含现金或其他资产')}</label><dl className="ledger-preview"><dt>{tr('股票数量变化')}</dt><dd>{fmt(shares,4)}</dd><dt>{tr('含权利金的调整成本')}</dt><dd>{fmt(cost,4)} {l.currency}</dd><dt>{tr('现金变化')}</dt><dd>{fmt(-shares*(l.strike??0)-Number(fee))} {l.currency}</dd></dl></>}
  {kind==='CLOSE'&&quantity&&price&&<dl className="ledger-preview"><dt>{tr('预计已实现盈亏')}</dt><dd>{l.avgCost===null||l.multiplier===null?'—':fmt(Math.sign(l.quantity)*Number(quantity)*l.multiplier*(Number(price)-l.avgCost)-Number(fee))} {l.currency}</dd></dl>}
  <p className="dim">{tr('仅记录已发生的成交，不向券商下单。')}</p>{save.error&&<p role="alert" className="down">{tr(save.error.message)}</p>}<footer><button type="button" className="term-btn" disabled={save.isPending} onClick={onDone}>{tr('取消')}</button><button className="term-btn active" disabled={save.isPending}>{tr('确认记账')}</button></footer>
 </form></section></div>;
}

function CurrentCashEditor({accountId,balance}:{accountId:number;balance:LedgerData['balances'][number]}) {
 const [draft,setDraft]=useState<{amount:string;expected:number}|null>(null);
 const qc=useQueryClient();
 const save=useMutation({mutationFn:()=>apiPost('/api/holdings/accounts/'+accountId+'/current-cash',{currency:balance.currency,amount:Number(draft!.amount),expected:draft!.expected}),onSuccess:async()=>{await qc.invalidateQueries({queryKey:['holdings']});setDraft(null);}});
 return draft?<form className="opening-cash-editor" onSubmit={e=>{e.preventDefault();save.mutate();}}><label>{tr('当前现金')} · {balance.currency}<input aria-label={tr('当前现金')+' '+balance.currency} type="number" step="any" required value={draft.amount} onChange={e=>setDraft({...draft,amount:e.target.value})}/></label><small>{tr('更正当前余额不改变累计盈亏或持仓。实际存款、取款请使用资金变动。')}</small><div><button className="term-btn active" disabled={save.isPending}>{tr('保存更正')}</button><button type="button" className="term-btn" disabled={save.isPending} onClick={()=>setDraft(null)}>{tr('取消')}</button></div>{save.error&&<p role="alert" className="down">{tr(save.error.message)}</p>}</form>:<button className="term-btn" onClick={()=>{save.reset();setDraft({amount:String(balance.cash),expected:balance.cash});}}>{tr('更正余额')}</button>;
}

export function LedgerManager({data,rows,accountId}:{data:LedgerData;rows:Position[];accountId:number}) {
 const id=accountId;const a=data.accounts.find(a=>a.id===id);
 const [cash,setCash]=useState<CashInput[]>([{currency:'USD',amount:''},{currency:'CAD',amount:''}]);const [kind,setKind]=useState('DEPOSIT');const [currency,setCurrency]=useState('USD');const [amount,setAmount]=useState('');const [at,setAt]=useState(localTime);const [note,setNote]=useState('');const [requestId,setRequestId]=useState(()=>crypto.randomUUID());const [confirmUndo,setConfirmUndo]=useState<number|null>(null);
 const qc=useQueryClient();const refresh=()=>qc.invalidateQueries({queryKey:['holdings']});
 const init=useMutation({mutationFn:()=>apiPost('/api/holdings/accounts/'+id+'/initialize',{cash:cashPayload(cash)}),onSuccess:refresh});
 const transfer=useMutation({mutationFn:()=>apiPost('/api/holdings/accounts/'+id+'/cash',{requestId,kind,currency,amount:Number(amount),at:new Date(at).toISOString(),note}),onSuccess:()=>{refresh();setAmount('');setNote('');setRequestId(crypto.randomUUID());setAt(localTime());}});
 const undo=useMutation({mutationFn:(eventId:number)=>apiPost('/api/holdings/accounts/'+id+'/undo',{eventId}),onSuccess:()=>{refresh();setConfirmUndo(null);}});
 const balances=data.balances.filter(b=>b.accountId===id);const events=data.events.filter(e=>e.accountId===id);const latestId=Math.max(0,...data.events.filter(e=>e.accountId===id&&e.source!=='IBKR').map(e=>e.id));
 const currencyOptions=balances.map(b=>b.currency).join(',');
 useEffect(()=>{setCurrency(currencyOptions.split(',')[0]||'USD');setKind('DEPOSIT');setAt(localTime());},[id,currencyOptions]);
 return <div className="ledger-manager"><header><h3>{tr('账户资金')} · {a?.name}</h3></header>
 {!a?<p>{tr('请先添加账户')}</p>:<>
 {balances.length===0?<form className="ledger-setup" onSubmit={e=>{e.preventDefault();init.mutate();}}><h3>{tr('设置追踪起点')}</h3><CashFields value={cash} onChange={setCash}/><div>{tr('填写当前剩余现金，无需追溯开户存款。')}</div><button className="term-btn active" disabled={init.isPending}>{tr('开始追踪')}</button></form>:<><div className="overflow-x-auto"><SortableTable className="data-table account-cash-table"><thead><tr>{['币种','追踪开始','当前现金','操作'].map(s=><th key={s}>{tr(s)}</th>)}</tr></thead><tbody>{balances.map(b=><SortRow key={b.currency} values={[b.currency,Date.parse(b.startedAt),ledgerCash(data,b)]}><td>{b.currency}</td><td>{new Date(b.startedAt).toLocaleString(uiLocale())}</td><td>{fmt(ledgerCash(data,b))}</td><td>{a.ibkrAccount?<span className="dim">{tr('券商同步')}</span>:<CurrentCashEditor accountId={id} balance={b}/>}</td></SortRow>)}</tbody></SortableTable></div>
 <form className="ledger-flow" onSubmit={e=>{e.preventDefault();transfer.mutate();}}><h3>{tr('资金变动')}</h3><div className="ledger-form-row"><label>{tr('类型')}<select value={kind} onChange={e=>setKind(e.target.value)}>{['DEPOSIT','WITHDRAWAL',...(!a.ibkrAccount?['INCOME','EXPENSE']:[])].map(k=><option key={k} value={k}>{tr(kinds[k])}</option>)}</select></label><label>{tr('币种')}<select value={currency} onChange={e=>setCurrency(e.target.value)}>{balances.map(b=><option key={b.currency}>{b.currency}</option>)}</select></label><label>{tr('金额')}<input required type="number" min="0.00000001" step="any" value={amount} onChange={e=>setAmount(e.target.value)}/></label><label>{tr('成交时间')}<input required type="datetime-local" step="1" value={at} onChange={e=>setAt(e.target.value)}/></label><label>{tr('备注')}<input maxLength={500} value={note} onChange={e=>setNote(e.target.value)}/></label><button className="term-btn active" disabled={transfer.isPending}>{tr('确认记账')}</button></div></form></>}
 {a.ibkrAccount&&<p className="dim">{tr('券商现金来自同步，手动成交现金调整单独累计。请勿重复录入已被券商同步的成交；券商完整已实现盈亏仍不估算。')}</p>}
 {a.ibkrAccount&&<p className="dim">{tr('手动现金调整')} · {balances.map(b=><span key={b.currency}>{b.currency} {fmt(b.localCash??0)} </span>)}</p>}
 <h3>{tr('成交与资金记录')}</h3><div className="overflow-x-auto"><SortableTable className="data-table"><thead><tr>{['时间','操作','资产','数量','成交单价','佣金（本次总额）','现金变化','已实现盈亏','备注','操作'].map((s,i)=><th key={i}>{tr(s)}</th>)}</tr></thead><tbody>{events.map((e,i)=><SortRow key={e.id} values={[Date.parse(e.at),tr(kinds[e.kind]),e.asset?.symbol,e.quantity,e.price,e.fee,Object.entries(e.cash).sort(),Object.entries(e.realized).sort(),e.note]}><td>{new Date(e.at).toLocaleString(uiLocale())}</td><td>{tr(kinds[e.kind])}</td><td>{e.asset?.symbol??'—'}</td><td>{fmt(e.quantity,4)}</td><td>{fmt(e.price,4)}</td><td>{fmt(e.fee)}</td><td>{Object.entries(e.cash).map(([c,n])=><div key={c}>{fmt(n)} {c}</div>)}</td><td>{Object.entries(e.realized).map(([c,n])=><div key={c} className={n>=0?'up':'down'}>{fmt(n)} {c}</div>)}</td><td>{e.closedDeleted&&<span>{tr('平仓记录已删除，现金结算保留，盈亏已剔除')}</span>}{e.source==='IBKR'&&<span>{tr(e.pnlPending?'券商盈亏回报待补齐':'券商回报')}</span>}{e.note}{e.delivery&&<span>{tr('股票数量变化')} {fmt(e.delivery.shares,4)} · {tr('调整成本')} {fmt(e.delivery.effectivePrice,4)}</span>}</td><td>{e.source!=='IBKR'&&!e.closedDeleted&&e.id===latestId&&(confirmUndo===e.id?<><span>{tr('撤销会反向调整现金和盈亏，并恢复成交前的持仓数量。')}</span><button className="term-btn down" disabled={undo.isPending} onClick={()=>undo.mutate(e.id)}>{tr('确认撤销')}</button><button className="term-btn" onClick={()=>setConfirmUndo(null)}>{tr('取消')}</button></>:<button className="term-btn" onClick={()=>setConfirmUndo(e.id)}>{tr('撤销最近记录')}</button>)}</td></SortRow>)}</tbody></SortableTable></div>
 <details><summary>{tr('计算口径')}</summary><p>{tr('累计盈亏 = 已记录的已实现盈亏 + 当前持仓未实现盈亏。删除仓位或平仓记录会移除对应盈亏贡献。入出金不计入盈亏，各币种独立计算。')}</p><p>{tr('行权按先进先出抵扣反向股票，权利金并入股票调整成本。此为投资跟踪账本，不是税务报表。')}</p></details>
 </>}{[init.error,transfer.error,undo.error].filter(Boolean).map((e,i)=><p key={i} role="alert" className="down">{tr(e!.message)}</p>)}
 </div>;
}
