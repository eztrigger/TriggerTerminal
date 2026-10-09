"use client";
import {useEffect,useState} from 'react';
import {useMarketSource} from './use-market-source';
import {apiGet,type Quote,apiPost} from './api';
export type StreamQuote={symbol:string;price:number|null;bid:number|null;ask:number|null;volume:number|null;changePercent:number|null;marketDataType:number|null;receivedAt:string;basis:string};
export type StreamContract={key:string;symbol:string;assetType:string;currency:string;conId?:number;expiry:string;right:string;strike:number|null;multiplier:number|null;exchange?:string;primaryExchange?:string};
const recentQuotes=new Map<string,Record<string,StreamQuote>>();
let restored=false;
function restoreQuotes(){
 if(restored||typeof window==='undefined')return;restored=true;
 try{const saved=JSON.parse(localStorage.getItem('terminal-stream-snapshot-v1')??'null');if(saved?.at>Date.now()-86400000&&Array.isArray(saved.rows))for(const [key,quotes] of saved.rows)recentQuotes.set(key,quotes);}catch{}
 window.addEventListener('pagehide',()=>{try{localStorage.setItem('terminal-stream-snapshot-v1',JSON.stringify({at:Date.now(),rows:[...recentQuotes]}));}catch{}});
}

export function useWatchlistStream(symbols:string[],contracts?:StreamContract[]){
 const [quotes,setQuotes]=useState<Record<string,StreamQuote>>({});
 const [status,setStatus]=useState('正在连接…');const [connected,setConnected]=useState(false);
 const [errors,setErrors]=useState<Record<string,string>>({});
 const key=contracts?JSON.stringify(contracts):symbols.join(',');
 const contractMode=contracts!==undefined;
 const source=useMarketSource().data?.active;
 useEffect(()=>{
  let stopped=false;let socket:WebSocket|undefined;let retry:ReturnType<typeof setTimeout>|undefined;let watchdog:ReturnType<typeof setInterval>|undefined;let attempts=0;let lastMessage=Date.now();
  restoreQuotes();const cacheKey=source+':'+key;setQuotes(recentQuotes.get(cacheKey)??{});setErrors({});setConnected(false);
  if(!key||(contractMode&&JSON.parse(key).length===0)){setStatus('添加代码以订阅 IBKR 行情');return;}
  if(!source)return;
  if(source==='yahoo'&&contractMode)return;
  if(source==='yahoo'){
   const poll=async()=>{
    try{
     const rows=await apiGet<Array<Quote & {time:number|null}>>('/api/quotes?symbols='+encodeURIComponent(key));
     if(stopped)return;
     const next:Record<string,StreamQuote>={};const failures:Record<string,string>={};
     for(const q of rows)next[q.symbol]={symbol:q.symbol,price:q.price,bid:q.bid,ask:q.ask,volume:q.volume,changePercent:q.changePercent,marketDataType:3,receivedAt:q.time?new Date(q.time*1000).toISOString():new Date().toISOString(),basis:'Yahoo Finance'};
     for(const symbol of key.split(','))if(!next[symbol]||next[symbol].price==null)failures[symbol]='Yahoo Finance 暂无报价';
     setQuotes(next);setErrors(failures);setConnected(true);setStatus('Yahoo Finance');
    }catch(e){if(!stopped){setConnected(false);setStatus((e as Error).message);}}
    finally{if(!stopped)retry=setTimeout(poll,30000);}
   };
   void poll();return()=>{stopped=true;if(retry)clearTimeout(retry);};
  }
  const connect=async()=>{
   setStatus(attempts?'连接中断，正在重连…':'正在连接 IBKR 推送…');setConnected(false);
   try{
    const {ticket,port}=await apiPost<{ticket:string;port:number}>('/api/ibkr/stream-ticket',{});
    if(stopped)return;
    socket=new WebSocket(`${window.location.protocol==='https:'?'wss':'ws'}://${window.location.hostname}:${port}/ws/watchlist?ticket=${encodeURIComponent(ticket)}`);
    lastMessage=Date.now();
    socket.onopen=()=>socket?.send(JSON.stringify(contractMode?{contracts:JSON.parse(key)}:{symbols:key.split(',')}));
    socket.onmessage=e=>{
     lastMessage=Date.now();attempts=0;
     try{const msg=JSON.parse(e.data);
      if(msg.type==='reset'){setErrors({});}
      if(msg.type==='status'){setConnected(msg.connected);setStatus(msg.message);}
      if(msg.type==='quotes'){setQuotes(prev=>{const next={...prev};for(const q of msg.quotes)if(q.price!==null)next[q.symbol]=q;recentQuotes.set(cacheKey,next);if(recentQuotes.size>20)recentQuotes.delete(recentQuotes.keys().next().value!);return next;});setErrors(prev=>{const next={...prev};for(const q of msg.quotes)if(q.price!==null)delete next[q.symbol];return next;});}
      if(msg.type==='quoteError'){if(msg.symbol)setErrors(prev=>({...prev,[msg.symbol]:msg.message}));else setStatus(msg.message);}
     }catch{}
    };
    socket.onerror=()=>socket?.close();
    socket.onclose=()=>{if(stopped)return;setConnected(false);setStatus('连接中断，显示上次报价，正在重连…');retry=setTimeout(connect,Math.min(15000,1000*2**Math.min(attempts++,4)));};
   }catch(e){if(stopped)return;setStatus((e as Error).message);retry=setTimeout(connect,5000);}
  };
  void connect();watchdog=setInterval(()=>{if(socket?.readyState===WebSocket.OPEN&&Date.now()-lastMessage>25000)socket.close();},5000);
  return()=>{stopped=true;if(retry)clearTimeout(retry);if(watchdog)clearInterval(watchdog);socket?.close();};
 },[key,source,contractMode]);
 return {quotes,status,connected,errors};
}
