"use client";
import {tr,uiLocale} from "../lib/i18n";
import {useEffect,useState} from 'react';
import {useMutation,useQuery} from '@tanstack/react-query';
import {apiGet,apiPost,fmt} from '../lib/api';
import type {PositionLeg} from '../lib/holdings-view';
export type InstrumentLeg=PositionLeg&{conId?:number;exchange?:string;primaryExchange?:string;contractName?:string};
type Match={conId:number;symbol:string;name:string;exchange:string;currency:string;type:string};
type Quote={conId:number;price:number;bid:number|null;ask:number|null;fetchedAt:string;basis:string;marketDataType:number|null};
export default function HoldingInstrumentPicker({leg,onPick,onQuote}:{leg:InstrumentLeg;onPick:(leg:InstrumentLeg)=>void;onQuote:(original:InstrumentLeg,quote:InstrumentLeg)=>void}){
 const [query,setQuery]=useState('');const [debounced,setDebounced]=useState('');
 useEffect(()=>{const timer=setTimeout(()=>setDebounced(query.trim()),450);return()=>clearTimeout(timer);},[query]);
 const fund=leg.assetType==='FUND';
 const search=useQuery({queryKey:['holding-instrument',debounced,fund,leg.currency],queryFn:()=>apiGet<Match[]>('/api/ibkr/search?'+new URLSearchParams({q:debounced,...(fund?{fund:'1',currency:leg.currency}:{})})),enabled:!!debounced&&debounced===query.trim(),retry:false,refetchOnWindowFocus:false});
 const quote=useMutation({mutationFn:(value:InstrumentLeg)=>apiPost<Quote>('/api/holdings/quote',value),onSuccess:(q,original)=>onQuote(original,{...original,conId:q.conId,marketPrice:q.price,bid:q.bid,ask:q.ask,quoteAt:q.fetchedAt,quoteBasis:q.basis,marketDataType:q.marketDataType,bidAskAt:q.fetchedAt,bidAskType:q.marketDataType})});
 const pick=(m:Match)=>{
  const value:InstrumentLeg={...leg,symbol:m.symbol,assetType:m.type==='FUND'?'FUND':leg.assetType==='ETF'?'ETF':'STK',currency:m.currency,conId:m.conId,exchange:m.type==='FUND'?m.exchange||'FUNDSERV':'SMART',primaryExchange:m.type==='FUND'?'':m.exchange,contractName:m.name,multiplier:1,expiry:'',right:'',strike:null,marketPrice:null,marketValue:null,unrealizedPnl:null,bid:null,ask:null,quoteAt:undefined,bidAskAt:undefined};
  onPick(value);setQuery('');setDebounced('');quote.mutate(value);
 };
 return <div className="holding-instrument-picker">
 {tr(['STK','ETF','FUND'].includes(leg.assetType)&&<><label>{tr("IBKR 标的搜索 ")}<input aria-label={tr("IBKR 标的搜索")} placeholder={tr(fund?'输入基金完整代码（FUNDSERV）':'输入代码或名称，例如 AAPL、RY、VFV')} value={query} disabled={quote.isPending} onChange={e=>setQuery(e.target.value)}/></label>
 {tr(debounced===query.trim()&&!!query&&<div className="holding-instrument-results">{tr(search.isFetching?<p>{tr("正在搜索 IBKR…")}</p>:search.error?<p className="down">{tr(search.error.message)}</p>:<>{tr(search.data?.filter(m=>['STK','FUND'].includes(m.type)).map(m=><button type="button" key={m.conId+':'+m.exchange} onClick={()=>pick(m)}><strong>{tr(m.symbol)}</strong><span>{tr(m.name)}</span><small>{tr(m.exchange)} · {tr(m.currency)} · {tr(m.type==='FUND'?'基金':'股票 / ETF')}</small></button>))}{tr(!search.data?.some(m=>['STK','FUND'].includes(m.type))&&<p>{tr("IBKR 未找到匹配合约，请检查代码、币种或资产类型。")}</p>)}</>)}</div>)}</>)}
 <div className="flex gap-2 items-center flex-wrap"><span className="dim">{tr(leg.conId?`${leg.contractName||leg.symbol} · ${leg.primaryExchange||leg.exchange||'IBKR'} · ${leg.currency} · 合约 ${leg.conId}`:'选择搜索结果可锁定具体市场与合约')}</span><button type="button" className="term-btn" disabled={quote.isPending||!leg.symbol} onClick={()=>quote.mutate(leg)}>{tr(quote.isPending?'读取报价…':'获取价格')}</button></div>
 {tr(quote.error&&<p role="alert" className="down">{tr(quote.error.message)}{tr("；保留原报价。")}</p>)}
 {tr(leg.quoteAt&&<p className="dim">Bid {tr(fmt(leg.bid,4))} / Ask {tr(fmt(leg.ask,4))}{tr(" · 估值 ")}{tr(fmt(leg.marketPrice,4))} {tr(leg.currency)}</p>)}
 {tr(fund&&<p className="dim">{tr("普通基金按 IBKR 实际提供的报价读取，可能无盘中 Bid / Ask；未开放给 API 的基金仍可手动记录。")}</p>)}
 </div>;
}
