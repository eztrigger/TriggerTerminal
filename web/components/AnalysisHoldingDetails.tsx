'use client';
import {createContext,useContext,useState} from 'react';
import {useMutation,useQueryClient} from '@tanstack/react-query';
import {apiDelete,fmt} from '../lib/api';
import {tr,uiLocale} from '../lib/i18n';
import {legAmounts,type Position,type PositionGroup,type PositionLeg} from '../lib/holdings-view';
import {PositionNote} from './HoldingsPositions';
import QuoteStatus from './QuoteStatus';
export const AnalysisHoldingContext=createContext<{positions:Position[];accounts:{id:number;broker:string;name:string}[];groups:PositionGroup[];onEdit:(p:Position)=>void;onStatus:(p:Position)=>void}|null>(null);
export default function AnalysisHoldingDetails({position,leg,compact=false}:{position:Position;leg:PositionLeg;compact?:boolean}){
 const ctx=useContext(AnalysisHoldingContext),qc=useQueryClient(),[confirm,setConfirm]=useState(false);
 const original=ctx?.positions.find(p=>p.id===position.id)??position;
 const index=original.legs.findIndex(l=>l===leg||(l.symbol===leg.symbol&&l.expiry===leg.expiry&&l.right===leg.right&&l.strike===leg.strike&&l.conId===leg.conId));
 const account=ctx?.accounts.find(a=>a.id===position.accountId);
 const option=['OPT','FOP'].includes(leg.assetType),a=legAmounts(leg,position.source);
 const remove=useMutation({mutationFn:()=>apiDelete('/api/holdings/positions/'+original.id),onSuccess:()=>qc.invalidateQueries({queryKey:['holdings']})});
 if(compact)return <div className="pa-holding-details pa-holding-compact"><dl className="pa-asset-facts">
 <div><dt>{tr('账户')}</dt><dd>{account?.name??'—'}</dd></div>
 <div><dt>{tr('净成本')}</dt><dd>{fmt(a.cost)} <small>{leg.currency}</small></dd></div>
 <div><dt>{tr('单位成本')}</dt><dd>{fmt(leg.avgCost,4)}</dd></div>
 <div><dt>{tr('估值价')}</dt><dd>{fmt(leg.marketPrice,4)}</dd></div>
 <div><dt>{tr('市值')}</dt><dd>{fmt(a.value)} <small>{leg.currency}</small></dd></div>
 </dl>{ctx&&original.source==='MANUAL'&&<div className="pa-compact-actions"><button className="term-btn" onClick={()=>ctx.onEdit(original)}>{tr('编辑仓位')}</button><button className="term-btn" onClick={()=>ctx.onStatus(original)}>{tr('平仓 / 行权')}</button></div>}</div>;
 return <div className="pa-holding-details"><dl className="pa-asset-facts">
 {account&&<div><dt>{tr('账户')}</dt><dd>{account.broker} · {account.name}</dd></div>}<div><dt>{tr('仓位')}</dt><dd>{original.name}</dd></div><div><dt>{tr('数据来源')}</dt><dd>{original.source} · {new Date(original.updatedAt).toLocaleString(uiLocale())}</dd></div>
 <div><dt>{tr('合约乘数')}</dt><dd>{fmt(leg.multiplier,0)}</dd></div><div><dt>{tr('净成本')}</dt><dd>{fmt(a.cost)} {leg.currency}</dd></div>
 {option&&<><div><dt>{tr('单位成本')}</dt><dd>{fmt(leg.avgCost,4)}</dd></div><div><dt>{tr('估值价')}</dt><dd>{fmt(leg.marketPrice,4)}</dd></div><div><dt>{tr('市值')}</dt><dd>{fmt(a.value)} {leg.currency}</dd></div></>}
 {!option&&<><div><dt>{tr('Bid 买价')}</dt><dd>{fmt(leg.bid,4)}</dd></div><div><dt>{tr('Ask 卖价')}</dt><dd>{fmt(leg.ask,4)}</dd></div></>}
 </dl><p>{tr('估值价')} · <QuoteStatus type={leg.marketDataType} at={leg.quoteAt} detail={leg.quoteBasis}/>{!option&&<> · Bid / Ask · <QuoteStatus type={leg.bidAskType} at={leg.bidAskAt}/></>}</p>
 {ctx?.groups.filter(g=>g.positionIds.includes(original.id)).map(g=><p key={g.id}>{tr('原持仓分组')} · {g.name}</p>)}
 {index>=0&&<PositionNote position={original} index={index}/>}
 {original.legs.length>1&&original.notes&&<p>{tr('仓位备注')} · {original.notes}</p>}
 {ctx&&original.source==='MANUAL'&&<div className="pa-toolbar"><button className="term-btn" onClick={()=>ctx.onEdit(original)}>{tr('编辑仓位')}</button><button className="term-btn" onClick={()=>ctx.onStatus(original)}>{tr('平仓 / 行权')}</button><button className="term-btn down" onClick={()=>setConfirm(!confirm)}>{tr('删除仓位')}</button></div>}
 {confirm&&<div role="alert"><p>{tr('删除此仓位会移除其浮动盈亏，不改变现金，也不生成平仓记录。确认删除？')}</p><button className="term-btn down" disabled={remove.isPending} onClick={()=>remove.mutate()}>{tr('确认删除')}</button><button className="term-btn" onClick={()=>setConfirm(false)}>{tr('取消')}</button></div>}
 {remove.error&&<p role="alert">{tr('操作失败，请重试')}</p>}
 </div>;
}
