"use client";
import {useEffect,useMemo,useState} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {apiPost} from './api';
import {useMarketSource} from './use-market-source';
import {useWatchlistStream,type StreamContract,type StreamQuote} from './use-watchlist-stream';
import type {Position,PositionLeg} from './holdings-view';

export function holdingContract(leg:PositionLeg & {exchange?:string;primaryExchange?:string}):StreamContract {
 const contract={symbol:leg.symbol,assetType:leg.assetType,currency:leg.currency,conId:leg.conId,expiry:leg.expiry,right:leg.right,strike:leg.strike,multiplier:leg.multiplier,exchange:leg.exchange,primaryExchange:leg.primaryExchange};
 return {...contract,key:'holding:'+JSON.stringify(contract)};
}
export function applyHoldingQuote(leg:PositionLeg,quote:StreamQuote|undefined):PositionLeg {
 if(!quote||quote.price===null||!Number.isFinite(quote.price)||quote.price<0)return leg;
 const size=leg.multiplier===null?null:leg.quantity*leg.multiplier;
 return {...leg,marketPrice:quote.price,bid:quote.bid,ask:quote.ask,quoteAt:quote.receivedAt,bidAskAt:quote.receivedAt,quoteBasis:quote.basis,marketDataType:quote.marketDataType,bidAskType:quote.marketDataType,
  marketValue:size===null?null:quote.price*size,unrealizedPnl:size===null||leg.avgCost===null?null:(quote.price-leg.avgCost)*size};
}
export function useHoldingsMarket<T extends Position>(holdings:T[]) {
 const source=useMarketSource().data?.active;const qc=useQueryClient();
 const [pollError,setPollError]=useState('');
 const serialized=JSON.stringify([...new Map(holdings.filter(h=>h.active).flatMap(h=>h.legs.map(holdingContract)).map(c=>[c.key,c])).values()].sort((a,b)=>a.key.localeCompare(b.key)));
 const contracts=useMemo<StreamContract[]>(()=>JSON.parse(serialized),[serialized]);
 const stream=useWatchlistStream([],source==='api'?contracts:[]);
 useEffect(()=>{
  if(source!=='yahoo'||!contracts.length)return;
  let stopped=false;let timer:ReturnType<typeof setTimeout>;
  const poll=async()=>{
   try {
    const result=await apiPost<{skipped:number;details:string[]}>('/api/holdings/refresh-prices',{});
    if(stopped)return;
    setPollError(result.skipped?`${result.skipped} 个资产报价未更新：${result.details.join('；')}`:'');
    await qc.invalidateQueries({queryKey:['holdings']});
   } catch(e){if(!stopped)setPollError((e as Error).message);}
   finally{if(!stopped)timer=setTimeout(poll,30000);}
  };
  void poll();return()=>{stopped=true;clearTimeout(timer);};
 },[source,serialized,qc,contracts.length]);
 const rows=source==='api'?holdings.map(h=>h.active?{...h,legs:h.legs.map(l=>applyHoldingQuote(l,stream.quotes[holdingContract(l).key]))}:h):holdings;
 const errors=Object.entries(stream.errors).map(([key,error])=>`${contracts.find(c=>c.key===key)?.symbol??'资产'}：${error}`);
 return {rows,error:source==='yahoo'?pollError:errors.length?errors.slice(0,3).join('；'):contracts.length&&!stream.connected?stream.status:''};
}
