'use client';
import {useEffect,useSyncExternalStore} from 'react';
import {useQuery,useQueryClient,type QueryKey} from '@tanstack/react-query';
import {apiGet,apiPost} from './api';
type Listener=(data:unknown,error?:boolean)=>void;
const subscriptions=new Map<string,{path:string;body?:unknown;listeners:Set<Listener>}>();
let connected=false;const statusListeners=new Set<()=>void>();
function setConnected(value:boolean){connected=value;for(const fn of statusListeners)fn();}
export function useAnalysisConnection(){return useSyncExternalStore(fn=>{statusListeners.add(fn);return()=>{statusListeners.delete(fn);};},()=>connected,()=>false);}
let socket:WebSocket|undefined,retry:ReturnType<typeof setTimeout>|undefined,connecting=false;
function connect(){
 if(connecting||socket?.readyState===WebSocket.OPEN||!subscriptions.size)return;
 connecting=true;
 void apiPost<{ticket:string;port:number}>('/api/analysis/stream-ticket',{}).then(({ticket,port})=>{
  if(!subscriptions.size){connecting=false;return;}
  socket=new WebSocket(`${location.protocol==='https:'?'wss':'ws'}://${location.hostname}:${port}/ws/analysis?ticket=${encodeURIComponent(ticket)}`);
  let lastMessage=Date.now();const watchdog=setInterval(()=>{if(Date.now()-lastMessage>20000)socket?.close();},5000);
  socket.onopen=()=>{connecting=false;setConnected(true);for(const [id,s] of subscriptions)socket?.send(JSON.stringify({id,path:s.path,body:s.body}));};
  socket.onmessage=e=>{lastMessage=Date.now();try{const m=JSON.parse(e.data);if(m.type==='data'||m.type==='error')for(const fn of subscriptions.get(m.id)?.listeners??[])fn(m.data,m.type==='error');}catch{}};
  socket.onerror=()=>socket?.close();socket.onclose=()=>{clearInterval(watchdog);setConnected(false);connecting=false;socket=undefined;if(subscriptions.size)retry=setTimeout(connect,2000);};
 }).catch(()=>{connecting=false;if(subscriptions.size)retry=setTimeout(connect,3000);});
}
export function subscribeAnalysis(path:string,body:unknown,listener:Listener){
 const id=JSON.stringify([path,body]);let s=subscriptions.get(id);
 if(!s){s={path,body,listeners:new Set()};subscriptions.set(id,s);}
 s.listeners.add(listener);if(socket?.readyState===WebSocket.OPEN)socket.send(JSON.stringify({id,path,body}));connect();
 return()=>{s!.listeners.delete(listener);if(!s!.listeners.size){subscriptions.delete(id);if(socket?.readyState===WebSocket.OPEN)socket.send(JSON.stringify({type:'unsubscribe',id}));}if(!subscriptions.size){if(retry)clearTimeout(retry);socket?.close();}};
}
export function readAnalysis<T>(path:string,body?:unknown):Promise<T>{
 return new Promise((resolve,reject)=>{
  let finished=false;let cancel=()=>{};
  const fallback=()=>{if(finished)return;finished=true;cancel();clearTimeout(timer);(body?apiPost<T>(path,body):apiGet<T>(path)).then(resolve,reject);};
  const timer=setTimeout(fallback,8000);
  cancel=subscribeAnalysis(path,body,(data,error)=>{if(error){fallback();return;}if(finished)return;finished=true;clearTimeout(timer);cancel();resolve(data as T);});
 });
}
export function useAnalysisUpdates(entries:{queryKey:QueryKey;path:string;body?:unknown}[]){
 const qc=useQueryClient(),key=JSON.stringify(entries);
 useEffect(()=>{const stops=(JSON.parse(key) as typeof entries).map(e=>subscribeAnalysis(e.path,e.body,(data,error)=>{if(!error)qc.setQueryData(e.queryKey,data);}));return()=>stops.forEach(stop=>stop());},[key,qc]);
}
export function useAnalysisQuery<T>({queryKey,path,body,enabled=true,staleTime=30000}:{queryKey:QueryKey;path:string;body?:unknown;enabled?:boolean;staleTime?:number}){
 useAnalysisUpdates(enabled?[{queryKey,path,body}]:[]);
 return useQuery<T>({queryKey,queryFn:()=>readAnalysis<T>(path,body),enabled,staleTime,retry:false});
}
