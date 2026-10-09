import {Router} from 'express';
import {randomBytes} from 'node:crypto';
import type {Server} from 'node:http';
import {WebSocketServer,WebSocket} from 'ws';
import {z} from 'zod';
import {apiKey} from './auth.js';
import {analysisLegSchema} from './analysis-market.js';
export const analysisStreamRouter=Router();
const tickets=new Map<string,number>();
analysisStreamRouter.post('/stream-ticket',(_req,res)=>{
 for(const [k,t] of tickets)if(t<Date.now())tickets.delete(k);
 if(tickets.size>=100){res.sendStatus(429);return;}
 const ticket=randomBytes(24).toString('hex');tickets.set(ticket,Date.now()+30000);
 res.set('Cache-Control','no-store').json({ticket,port:Number(process.env.API_PORT??4000)});
});
export function readTopic(raw:unknown){
 const msg=z.object({id:z.string().max(20000),path:z.string().max(300),body:z.unknown().optional()}).parse(raw);
 if(msg.path==='/api/holdings'||msg.path==='/api/holdings/analysis')return {...msg,body:undefined,ttl:3000};
 if(msg.path==='/api/analysis/market')return {...msg,body:z.object({legs:z.array(analysisLegSchema).min(1).max(40)}).parse(msg.body),ttl:30000};
 if(/^\/api\/analysis\/research\/[A-Za-z0-9.%^_-]+\?kind=(stock|fund)&currency=[A-Z]{3}$/.test(msg.path)&&!decodeURIComponent(msg.path).includes('/../'))return {...msg,body:undefined,ttl:3600000};
 throw new Error('Unsupported analysis subscription');
}
export function attachAnalysisStream(server:Server){
 const wss=new WebSocketServer({noServer:true,maxPayload:65536});
 type Topic=ReturnType<typeof readTopic> & {data?:unknown;at:number;pending?:Promise<void>;users:Map<WebSocket,Set<string>>};
 const topics=new Map<string,Topic>();const clients=new Set<WebSocket>();
 const send=(ws:WebSocket,msg:unknown)=>{if(ws.readyState===WebSocket.OPEN){if(ws.bufferedAmount>2e6){ws.close(1013);return;}ws.send(JSON.stringify(msg));}};
 const refresh=(t:Topic)=>{
  if(t.pending||Date.now()-t.at<t.ttl)return;
  t.pending=(async()=>{try{
   const addr=server.address();if(!addr||typeof addr==='string')return;
   const r=await fetch(`http://127.0.0.1:${addr.port}${t.path}`,{method:t.body?'POST':'GET',headers:{'x-api-key':apiKey,'content-type':'application/json'},body:t.body?JSON.stringify(t.body):undefined,signal:AbortSignal.timeout(60000)});
   if(!r.ok)throw new Error('Analysis source unavailable');
   t.data=await r.json();t.at=Date.now();for(const [ws,ids] of t.users)for(const id of ids)send(ws,{type:'data',id,data:t.data,at:t.at});
  }catch{t.at=Date.now()-t.ttl+5000;for(const [ws,ids] of t.users)for(const id of ids)send(ws,{type:'error',id});}finally{t.pending=undefined;}})();
 };
 server.on('upgrade',(req,socket,head)=>{
  const url=new URL(req.url??'/','http://localhost');if(url.pathname!=='/ws/analysis')return;
  const token=url.searchParams.get('ticket')??'';
  if(!['http://localhost:3000','http://127.0.0.1:3000',process.env.WEB_ORIGIN].includes(req.headers.origin)||!tickets.has(token)||tickets.get(token)!<Date.now()||clients.size>=12){socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');socket.destroy();return;}
  tickets.delete(token);wss.handleUpgrade(req,socket,head,ws=>wss.emit('connection',ws));
 });
 wss.on('connection',ws=>{
  clients.add(ws);let count=0;const budget=setInterval(()=>count=0,60000);
  ws.on('message',raw=>{try{
   if(++count>240){ws.close(1008);return;}
   const msg=JSON.parse(raw.toString());
   if(msg.type==='unsubscribe'){for(const t of topics.values()){const ids=t.users.get(ws);ids?.delete(msg.id);if(ids&&!ids.size)t.users.delete(ws);}return;}
   const parsed=readTopic(msg);const key=JSON.stringify([parsed.path,parsed.body]);let topic=topics.get(key);
   if(!topic){if(topics.size>=128){const idle=[...topics].find(([,t])=>!t.users.size&&!t.pending);if(idle)topics.delete(idle[0]);else throw new Error('Subscription limit');}topic={...parsed,at:0,users:new Map()};topics.set(key,topic);}
   const ids=topic.users.get(ws)??new Set<string>();ids.add(parsed.id);topic.users.set(ws,ids);if(topic.data!==undefined)send(ws,{type:'data',id:parsed.id,data:topic.data,at:topic.at});refresh(topic);
  }catch{send(ws,{type:'error'});}});
  ws.on('close',()=>{clearInterval(budget);clients.delete(ws);for(const t of topics.values())t.users.delete(ws);});ws.on('error',()=>ws.close());
 });
 const timer=setInterval(()=>{for(const t of topics.values())if(t.users.size)refresh(t);for(const ws of clients)send(ws,{type:'heartbeat'});},3000);timer.unref();
 server.on('close',()=>{clearInterval(timer);for(const ws of clients)ws.terminate();wss.close();});
}
