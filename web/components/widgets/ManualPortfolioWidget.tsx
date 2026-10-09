"use client";
import {tr,uiLocale} from "../../lib/i18n";
import {useEffect,useState} from 'react';
import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import {apiGet,apiPost,fmt} from '../../lib/api';
import {type InstrumentLeg} from '../HoldingInstrumentPicker';
import Legacy from './LegacyManualPortfolioWidget';
import PortfolioAnalysis from '../PortfolioAnalysis';
import {AnalysisHoldingContext} from '../AnalysisHoldingDetails';
import {useAnalysisQuery} from '../../lib/analysis-stream';
import HoldingsPositions from '../HoldingsPositions';
import ClosedTrades from '../ClosedTrades';
import ProfitRecords from '../ProfitRecords';
import HoldingQuantityInput from '../HoldingQuantityInput';
import DeleteHoldingAccount from '../DeleteHoldingAccount';
import {Trash2} from 'lucide-react';
import { CashFields,cashPayload,LedgerOverview,LedgerManager,PositionTransaction,type CashInput,type LedgerData } from '../HoldingsLedger';
import {useHoldingsMarket} from '../../lib/use-holdings-market';
import {amounts,type PositionGroup} from '../../lib/holdings-view';
type Leg=InstrumentLeg&{entryFee?:number;openingCommission?:number};
type Account={id:number;broker:string;name:string;accountNumber:string;ibkrAccount:string|null;lastSync:string|null};
type Holding={id:number;accountId:number;name:string;notes:string;source:string;active:number;updatedAt:string;strategyId?:string;legs:Leg[]};
type Data=Omit<LedgerData,'accounts'> & {accounts:Account[];holdings:Holding[];groups:PositionGroup[]};
const blank=():Leg=>({symbol:'',assetType:'STK',quantity:1,multiplier:1,currency:'USD',expiry:'',right:'',strike:null,avgCost:null,marketPrice:null});
const types:Record<string,string>={STK:'股票',ETF:'ETF',FUND:'基金（非 ETF）',OPT:'期权',FUT:'期货',FOP:'期货期权',CASH:'现金 / 外汇',CRYPTO:'加密资产',OTHER:'其他资产',DEPOSIT:'定存'};
const nullable=(s:string)=>s.trim()===''?null:Number(s);
async function put(path:string,body:unknown){const r=await fetch(path,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const d=await r.json();if(!r.ok)throw new Error(d.error);return d;}
export default function Holdings(){
 const qc=useQueryClient();
 const [tab,setTab]=useState('positions'),[showSync,setShowSync]=useState(false);
 const [managedAccount,setManagedAccount]=useState<number|null>(null);
 const [deleteAccount,setDeleteAccount]=useState<Account|null>(null);
 const [filter,setFilter]=useState('');const [archived,setArchived]=useState(false);const [legacy,setLegacy]=useState(false);const [reveal,setReveal]=useState(false);
 const [accountForm,setAccountForm]=useState<{id?:number;broker:string;name:string;accountNumber:string}|null>(null);
 const [accountCash,setAccountCash]=useState<CashInput[]>([{currency:'USD',amount:''},{currency:'CAD',amount:''}]);
 const [transaction,setTransaction]=useState<Holding|null>(null);
 const [entryMode,setEntryMode]=useState('TRADE');const [entryAt,setEntryAt]=useState('');const [entryRequest,setEntryRequest]=useState(()=>crypto.randomUUID());
 const [form,setForm]=useState<{id?:number;accountId:number;name:string;notes:string;strategyId?:string;legs:Leg[]}|null>(null);
 const [ibAccount,setIbAccount]=useState('');const [auto,setAuto]=useState(false);const [notice,setNotice]=useState('');
 const q=useAnalysisQuery<Data>({queryKey:['holdings'],path:'/api/holdings'});
 const accounts=q.data?.accounts??[];
 const market=useHoldingsMarket(q.data?.holdings??[]);
 const ib=useQuery({queryKey:['ibkr-snapshot',ibAccount],queryFn:()=>apiGet<{account:string;accounts:string[]}>('/api/ibkr/snapshot?account='+encodeURIComponent(ibAccount)),retry:false,refetchOnWindowFocus:false});
 const refresh=()=>qc.invalidateQueries({queryKey:['holdings']});
 const prices=useMutation({mutationFn:()=>apiPost<{updated:number;skipped:number;details:string[];fetchedAt:string}>('/api/holdings/refresh-prices',filter?{accountId:Number(filter)}:{}),onSuccess:d=>{refresh();setNotice(`已更新 ${d.updated} 个资产${d.skipped?`，${d.skipped} 个未更新（保留原值）`:''}。${d.details.join('；')}`);}});
 const saveAccount=useMutation({mutationFn:()=>accountForm!.id?put('/api/holdings/accounts/'+accountForm!.id,accountForm):apiPost('/api/holdings/accounts',{...accountForm,cash:cashPayload(accountCash)}),onSuccess:()=>{setAccountForm(null);refresh();}});
 const save=useMutation({mutationFn:()=>{
  const f=form!,body={...f,name:[...new Set(f.legs.map(l=>l.symbol.trim()))].join(' / ').slice(0,100),autoPrice:true,legFees:f.legs.map(l=>l.entryFee??0),fee:0,entryMode:f.id?'INITIAL':entryMode,legs:f.legs.map(({entryFee,...l})=>l)};
  return f.id?put('/api/holdings/positions/'+f.id,body):apiPost('/api/holdings/positions',{...body,requestId:entryRequest,at:entryMode==='TRADE'?new Date(entryAt).toISOString():undefined});
 },onSuccess:()=>{setForm(null);refresh();setNotice('仓位已保存到本地，没有向券商下单。');}});
 const sync=useMutation({mutationFn:()=>apiPost<{accountId:number;count:number; syncedAt:string;executionsComplete?:boolean}>('/api/holdings/sync',{account:ibAccount||ib.data?.account||''}),onSuccess:d=>{refresh();setNotice('IBKR 同步完成：'+d.count+' 个持仓；手动仓位保持不变。'+tr(d.executionsComplete?'已同步可获取的成交及已实现盈亏。':'成交回报暂不可用，保留已同步盈亏，请稍后重试。'));}});
 useEffect(()=>{if(!auto)return;const t=setInterval(()=>{if(!sync.isPending)sync.mutate();},30000);return()=>clearInterval(t);},[auto,ibAccount,sync.isPending]);
 const label=(a:Account)=>a.broker+' · '+a.name;
 const rows=market.rows.filter(h=>(!filter||h.accountId===Number(filter))&&(archived?!h.active:!!h.active));
 const editLeg=(i:number,key:keyof Leg,v:string|number|null)=>setForm(f=>f?{...f,legs:f.legs.map((l,j)=>j===i?{...l,...(['symbol','currency','expiry','right','strike','multiplier'].includes(key)?{conId:undefined,exchange:undefined,primaryExchange:undefined,contractName:undefined,marketPrice:null,bid:null,ask:null,quoteAt:undefined,bidAskAt:undefined}:{}),[key]:v}:l)}:f);
 const ledgerData:LedgerData={accounts,balances:q.data?.balances??[],brokerCash:q.data?.brokerCash??[],events:q.data?.events??[]};
 return <section className="holdings-workspace">
 <div className="holdings-topline">
 <div className="holdings-navigation"><nav aria-label={tr("仓位管理导航")}>{tr([['positions','持仓分析'],['accounts','账户管理']].map(([id,title])=><button key={id} aria-current={tab===id?'page':undefined} onClick={()=>setTab(id)}>{tr(title)}{tr(id==='sync'&&auto&&<i aria-label={tr("自动同步已开启")}/>)}</button>))}</nav>{tab==='positions'&&<button className="term-btn active" onClick={()=>{if(!accounts.length){setTab('accounts');setAccountCash([{currency:'USD',amount:''},{currency:'CAD',amount:''}]);setAccountForm({broker:'',name:'',accountNumber:''});saveAccount.reset();return;}setEntryMode('TRADE');setEntryAt(new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,19));setEntryRequest(crypto.randomUUID());setForm({accountId:Number(filter)||accounts[0].id,name:'',notes:'',legs:[blank()]});save.reset();}}>{tr("＋ 添加仓位")}</button>}</div>
 <LedgerOverview docked data={ledgerData} rows={market.rows} filter={filter} unavailable={q.isPending||(!q.data&&!!q.error)}/>
 </div>

 {tr(market.error&&<p role="status" className="dim py-2">{tr(market.error)}</p>)}
 {tr(prices.error&&<p role="alert" className="down">{tr(prices.error.message)}</p>)}{tr(notice&&<p role="status" className="up">{tr(notice)}</p>)}{tr(sync.error&&<p role="alert" className="down">{tr("同步失败，本地仓位未改动：")}{tr(sync.error.message)}</p>)}{tr(q.error&&<p className="down">{tr(q.error.message)}</p>)}
 <div hidden={tab!=='positions'} className="holdings-view-controls"><button className="term-btn" disabled={prices.isPending||archived||!rows.length} onClick={()=>{setNotice('');prices.mutate();}}>{tr(prices.isPending?'正在获取报价…':'↻ 刷新价格')}</button><select aria-label={tr("筛选券商账户")} value={filter} onChange={e=>setFilter(e.target.value)}><option value="">{tr("全部券商 / 账户")}</option>{accounts.map(a=><option key={a.id} value={a.id}>{label(a)}</option>)}</select><select aria-label={tr("仓位状态")} value={archived?'history':'active'} onChange={e=>setArchived(e.target.value==='history')}><option value="active">{tr('当前')}</option><option value="history">{tr('历史')}</option></select></div>

 {tr(accountForm&&<form className="holdings-editor space-y-4" onSubmit={e=>{e.preventDefault();saveAccount.mutate();}}><h3 className="font-bold">{tr(accountForm.id?'编辑':'新增')}{tr("券商账户")}</h3><div className="flex gap-3 flex-wrap">{tr((['broker','name','accountNumber'] as const).map((key,i)=><label key={key}>{tr(['券商名称','账户昵称','账户号（可选）'][i])} <input aria-label={tr(['券商名称','账户昵称','账户号'][i])} required={i<2} maxLength={100} value={accountForm[key]} disabled={key==='accountNumber'&&!!accounts.find(a=>a.id===accountForm.id)?.ibkrAccount} onChange={e=>setAccountForm({...accountForm,[key]:e.target.value})}/></label>))}</div>{!accountForm.id&&<CashFields value={accountCash} onChange={setAccountCash}/>}<button className="term-btn active" disabled={saveAccount.isPending}>{tr("保存账户")}</button><button type="button" className="term-btn ml-2" onClick={()=>setAccountForm(null)}>{tr("取消")}</button>{tr(saveAccount.error&&<p className="down">{tr(saveAccount.error.message)}</p>)}</form>)}
 {form&&<form className="holdings-editor position-entry" onSubmit={e=>{e.preventDefault();save.mutate();}}>
 <h3>{tr(form.id?'编辑仓位':'新增仓位 / 多腿组合')}</h3>
 <div className="position-entry-meta"><label>{tr('归属账户')}<select aria-label={tr('仓位归属账户')} value={form.accountId} onChange={e=>setForm({...form,accountId:Number(e.target.value)})}>{accounts.map(a=><option key={a.id} value={a.id}>{label(a)}</option>)}</select></label>
 {!form.id&&<><label>{tr('录入方式')}<select value={entryMode} onChange={e=>setEntryMode(e.target.value)}><option value="INITIAL">{tr('期初已有持仓（不扣现金）')}</option><option value="TRADE">{tr('新增成交（更新现金）')}</option></select></label>{entryMode==='TRADE'&&<label>{tr('成交时间')}<input type="datetime-local" step="1" required value={entryAt} onChange={e=>setEntryAt(e.target.value)}/></label>}</>}
 </div>
 {accounts.find(a=>a.id===form.accountId)?.ibkrAccount&&<p className="position-entry-note">{tr('这是独立手动仓位，IBKR 同步不会覆盖；请勿重复录入已有券商仓位。')}</p>}
 <div className="position-entry-scroll"><table className="position-entry-table"><thead><tr>{['序号','资产类型','代码 / 标的','数量','乘数','币种',...(form.legs.some(l=>['OPT','FOP','FUT'].includes(l.assetType))?['到期日','方向','行权价']:[]),'单位成本','佣金（本资产）','操作'].map(t=><th key={t}>{tr(t)}</th>)}</tr></thead><tbody>
 {form.legs.map((l,i)=>{const option=['OPT','FOP'].includes(l.assetType),derivative=option||l.assetType==='FUT';return <tr key={i}><td className="position-entry-index">{i+1}.</td>
 <td><select aria-label={tr('资产类型 '+(i+1))} value={l.assetType} onChange={e=>setForm({...form,legs:form.legs.map((x,j)=>i===j?{...x,conId:undefined,exchange:undefined,primaryExchange:undefined,contractName:undefined,quoteAt:undefined,bidAskAt:undefined,bid:null,ask:null,marketPrice:null,assetType:e.target.value,multiplier:['OPT','FOP'].includes(e.target.value)?100:1,right:['OPT','FOP'].includes(e.target.value)?'C':'',expiry:'',strike:null}:x)})}>{Object.entries(types).map(([v,t])=><option key={v} value={v}>{tr(t)}</option>)}</select></td>
 <td><input aria-label={tr('标的 '+(i+1))} required value={l.symbol} onChange={e=>editLeg(i,'symbol',e.target.value.toUpperCase())}/></td>
 <td><HoldingQuantityInput label={tr('数量 '+(i+1))} whole={option} value={l.quantity} onChange={quantity=>editLeg(i,'quantity',quantity)}/></td>
 <td><input aria-label={tr('乘数 '+(i+1))} type="number" min=".000001" step="any" required value={l.multiplier??''} onChange={e=>editLeg(i,'multiplier',nullable(e.target.value))}/></td>
 <td><input aria-label={tr('币种 '+(i+1))} required maxLength={12} value={l.currency} onChange={e=>editLeg(i,'currency',e.target.value.toUpperCase())}/></td>
 {form.legs.some(l=>['OPT','FOP','FUT'].includes(l.assetType))&&<><td>{derivative?<input aria-label={tr('到期日 '+(i+1))} required type="date" value={l.expiry?l.expiry.slice(0,4)+'-'+l.expiry.slice(4,6)+'-'+l.expiry.slice(6,8):''} onChange={e=>editLeg(i,'expiry',e.target.value.replaceAll('-',''))}/>:<span className="dim">—</span>}</td><td>{option?<select aria-label={tr('期权方向 '+(i+1))} value={l.right} onChange={e=>editLeg(i,'right',e.target.value)}><option value="C">Call</option><option value="P">Put</option></select>:<span className="dim">—</span>}</td><td>{option?<input aria-label={tr('行权价 '+(i+1))} required type="number" min="0" step="any" value={l.strike??''} onChange={e=>editLeg(i,'strike',nullable(e.target.value))}/>:<span className="dim">—</span>}</td></>}
 <td><input aria-label={tr('成本 '+(i+1))} type="number" step="any" value={l.avgCost??''} onChange={e=>editLeg(i,'avgCost',nullable(e.target.value))}/></td>
 <td><input aria-label={tr('佣金（本资产）')+' '+(i+1)} type="number" min="0" step="any" required value={l.entryFee??0} onChange={e=>editLeg(i,'entryFee',nullable(e.target.value))}/></td>

 <td><button type="button" className="position-entry-remove" aria-label={tr('移除此腿')+' '+(i+1)} disabled={form.legs.length===1} onClick={()=>setForm({...form,legs:form.legs.filter((_,j)=>j!==i)})}><Trash2 size={15}/></button></td></tr>;})}
 </tbody></table></div>
 <div className="position-entry-help"><span>{tr('数量（负数为空头）')}</span>{!form.id&&<span>{tr(entryMode==='INITIAL'?'历史佣金计入成本，不再扣现金；成本已含佣金时填 0。':'本次佣金从现金扣除并计入已实现盈亏；成交单价不含佣金。')}</span>}</div>
 <footer><button type="button" className="term-btn" disabled={form.legs.length>=64||save.isPending} onClick={()=>setForm({...form,legs:[...form.legs,{...blank(),symbol:form.legs[0].symbol}]})}>{tr('＋ 添加资产')}</button><div><button type="button" className="term-btn" disabled={save.isPending} onClick={()=>setForm(null)}>{tr('取消')}</button><button className="term-btn active" disabled={save.isPending}>{tr(save.isPending?'获取价格并保存…':'保存仓位')}</button></div></footer>
 {save.error&&<p role="alert" className="down">{tr(save.error.message)}</p>}
 </form>}
 {tab==='positions'&&archived&&<ClosedTrades history data={ledgerData} filter={filter}/>}
 {tab==='positions'&&archived&&ledgerData.events.some(e=>!e.closedDeleted&&e.kind!=='CLOSE'&&e.source!=='IBKR'&&Object.keys(e.realized).length>0&&(!filter||e.accountId===Number(filter)))&&<ProfitRecords data={{...ledgerData,events:ledgerData.events.filter(e=>e.kind!=='CLOSE'&&e.source!=='IBKR')}} filter={filter}/>}
 <div hidden={tab!=='positions'}>{archived?rows.length>0&&<details className="holdings-legacy"><summary>{tr('归档持仓快照')} · {rows.length}</summary><HoldingsPositions rows={rows} groups={q.data?.groups??[]} accounts={accounts} archived onEdit={h=>{setForm({id:h.id,accountId:h.accountId,name:h.name,notes:h.notes,strategyId:h.strategyId,legs:h.legs.map(l=>({...l,entryFee:l.openingCommission??0,avgCost:l.avgCost!==null&&l.multiplier?l.avgCost-(l.openingCommission??0)/(l.quantity*l.multiplier):l.avgCost}))});save.reset();}} onStatus={h=>setTransaction(h)}/></details>:tab==='positions'&&<AnalysisHoldingContext.Provider value={{positions:market.rows,accounts,groups:q.data?.groups??[],onEdit:h=>{setForm({id:h.id,accountId:h.accountId,name:h.name,notes:h.notes,strategyId:h.strategyId,legs:h.legs.map(l=>({...l,entryFee:l.openingCommission??0,avgCost:l.avgCost!==null&&l.multiplier?l.avgCost-(l.openingCommission??0)/(l.quantity*l.multiplier):l.avgCost}))});save.reset();},onStatus:h=>setTransaction(h)}}><PortfolioAnalysis embedded holdings={market.rows} accountFilter={filter}/></AnalysisHoldingContext.Provider>}</div>

 {transaction&&<PositionTransaction position={transaction} onDone={()=>setTransaction(null)}/>}
 <div hidden={tab!=='accounts'} className="holdings-tab-panel"><header><div><h2>{tr("券商与账户 ")}<small>{tr(accounts.length)}</small></h2><p>{tr("管理账户信息与历史记录。")}</p></div><button className="term-btn active" onClick={()=>{setAccountForm({broker:'',name:'',accountNumber:''});saveAccount.reset();}}>{tr("＋ 添加账户")}</button></header><button type="button" className="term-btn" aria-expanded={showSync} aria-controls="account-ibkr-sync" onClick={()=>setShowSync(v=>!v)}>{tr("IBKR 账户与同步")}{auto?' · '+tr("自动同步已开启"):''}</button> <div id="account-ibkr-sync" hidden={!showSync}><div className="holdings-sync"><div className="flex gap-2 items-center flex-wrap"><strong>{tr("IBKR 持仓同步")}</strong><select aria-label={tr("同步 IBKR 账户")} value={ibAccount||ib.data?.account||''} onChange={e=>{setIbAccount(e.target.value);setAuto(false);}}><option value="">{tr("Gateway 默认账户")}</option>{tr(ib.data?.accounts.map(a=><option key={a} value={a}>{tr(reveal?a:a[0]+'••••'+a.slice(-3))}</option>))}</select><button className="term-btn" disabled={sync.isPending} onClick={()=>sync.mutate()}>{tr(sync.isPending?'同步中…':'同步到仓位页')}</button><button className="term-btn" onClick={()=>void ib.refetch()}>{tr("重读 IB 账户")}</button><label><input type="checkbox" checked={auto} onChange={e=>setAuto(e.target.checked)}/>{tr(" 每 30 秒同步所选 IB 账户")}</label></div><p className="dim">{tr("同步当前仓位、现金及可获取的成交盈亏。成交按编号去重并保存在本地；较早成交可能超出 Gateway 的查询范围。策略自动识别，可手动修改。")}</p>{tr(ib.error&&<p className="dim">{tr("Gateway 暂不可用，仍可管理手动仓位。")}</p>)}</div></div><label className="holdings-privacy"><input type="checkbox" checked={reveal} onChange={e=>setReveal(e.target.checked)}/>{tr(" 显示完整账户号")}</label><div className="holdings-accounts">{accounts.map(a=><div key={a.id} className="holdings-account-section"><div className="holdings-account"><span className="holdings-account-icon">{tr(a.broker.slice(0,1))}</span><strong>{label(a)}</strong><span className="dim ml-2">{a.accountNumber?(reveal?a.accountNumber:'••••'+a.accountNumber.slice(-3)):tr('未填账户号')} · {tr(a.lastSync?'上次同步 '+new Date(a.lastSync).toLocaleString(uiLocale()):'手动账户')}</span><button className="term-btn ml-2" onClick={()=>{setAccountForm({id:a.id,broker:a.broker,name:a.name,accountNumber:a.accountNumber});saveAccount.reset();}}>{tr("编辑账户")}</button><button className="term-btn ml-2" aria-expanded={managedAccount===a.id} onClick={()=>setManagedAccount(managedAccount===a.id?null:a.id)}>{tr(managedAccount===a.id?'收起资金管理':'管理现金与记录')}</button><button className="term-btn down ml-2" title={tr("删除账户")} aria-label={tr("删除账户")} disabled={sync.isPending||saveAccount.isPending||save.isPending||!!deleteAccount} onClick={()=>{setAuto(false);setDeleteAccount(a);}}><Trash2 size={14}/></button></div>{deleteAccount?.id===a.id&&<DeleteHoldingAccount key={a.id} account={deleteAccount} onClose={()=>setDeleteAccount(null)} onDeleted={()=>{setDeleteAccount(null);setManagedAccount(null);setAccountForm(null);setForm(null);setTransaction(null);if(filter===String(a.id))setFilter('');setNotice('账户及关联本地记录已删除。');}}/>}<LedgerOverview compact data={ledgerData} rows={market.rows} filter={String(a.id)} unavailable={q.isPending||(!q.data&&!!q.error)}/>{tab==='accounts'&&managedAccount===a.id&&<LedgerManager key={a.id} accountId={a.id} data={ledgerData} rows={market.rows}/>}</div>)}</div>{tr(!accounts.length&&<p className="dim">{tr("添加券商账户，或在“IBKR 同步”中导入已有账户。")}</p>)}<details className="holdings-legacy" onToggle={e=>setLegacy(e.currentTarget.open)}><summary>{tr("历史手动账本")}</summary><p className="dim">{tr("原有交易记录保留在此，不重复计入仓位汇总。")}</p>{tr(legacy&&<Legacy/>)}</details></div>
 </section>;
}
