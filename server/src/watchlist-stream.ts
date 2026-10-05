import {Router} from 'express';
import {randomBytes} from 'node:crypto';
import {spawn,type ChildProcessWithoutNullStreams} from 'node:child_process';
import {createInterface} from 'node:readline';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
import type {Server} from 'node:http';
import {WebSocketServer,WebSocket} from 'ws';
import {z} from 'zod';
import {dataDir} from './db.js';
import {marketSource} from './market-source.js';
const root=join(dirname(fileURLToPath(import.meta.url)),'..','..');
export const symbolsSchema=z.array(z.string().trim().toUpperCase().regex(/^\^?[A-Z0-9.-]{1,24}$/)).max(40);
export const contractsSchema=z.array(z.object({key:z.string().min(1).max(500),symbol:z.string().min(1).max(100),assetType:z.enum(['STK','ETF','OPT','FUND','FUT','FOP','CASH','OTHER']),currency:z.string().min(1).max(12),conId:z.number().int().positive().optional(),expiry:z.string().max(8),right:z.enum(['C','P','']),strike:z.number().finite().nullable(),multiplier:z.number().finite().positive().nullable(),exchange:z.string().max(40).optional(),primaryExchange:z.string().max(40).optional()})).max(60);
const tickets=new Map<string,number>();
export const watchlistRouter=Router();
watchlistRouter.post('/stream-ticket',(_q,r)=>{
 if(marketSource.active==='yahoo'){r.status(409).json({error:'Yahoo Finance 模式使用 HTTP 行情'});return;}
 for(const [t,expires] of tickets)if(expires<Date.now())tickets.delete(t);
 if(tickets.size>=100){r.status(429).json({error:'连接请求过多'});return;}
 const ticket=randomBytes(24).toString('hex');tickets.set(ticket,Date.now()+30000);
 r.set('Cache-Control','no-store').json({ticket,port:Number(process.env.API_PORT??4000)});
});
export function attachWatchlistStream(server:Server){
 const wss=new WebSocketServer({noServer:true,maxPayload:65536});
 const clients=new Map<WebSocket,Set<string>>();
 const contracts=new Map<WebSocket,z.infer<typeof contractsSchema>>();
 let child:ChildProcessWithoutNullStreams|undefined;
 let timer:NodeJS.Timeout|undefined;
 const send=(ws:WebSocket,value:unknown)=>{if(ws.readyState===WebSocket.OPEN){if(ws.bufferedAmount>1024*1024){ws.close(1013,'客户端处理过慢');return;}ws.send(JSON.stringify(value));}};
 const broadcast=(value:any)=>{for(const [ws,symbols] of clients){if(value.type==='quotes'){const quotes=value.quotes.filter((q:any)=>symbols.has(q.symbol));if(quotes.length)send(ws,{...value,quotes});}else if(value.type!=='quoteError'||!value.symbol||symbols.has(value.symbol))send(ws,value);}};
 const sync=()=>{
  if(timer)clearTimeout(timer);
  timer=setTimeout(()=>{
   const allContracts=[...new Map([...contracts.values()].flat().map(c=>[c.key,c])).values()];
   const symbols=[...new Set([...clients.entries()].filter(([ws])=>!contracts.has(ws)).flatMap(([,s])=>[...s]))];
   if(!symbols.length&&!allContracts.length){child?.kill();child=undefined;return;}
   try{
    const cfg=JSON.parse(readFileSync(join(dataDir,'ibkr.json'),'utf8'));
    if(!child){
     const proc=spawn(join(root,'bridge/.venv/bin/python'),['-u',join(root,'bridge/watchlist_worker.py')],{stdio:['pipe','pipe','pipe']});child=proc;proc.stderr.on('data',()=>{});
     createInterface({input:proc.stdout}).on('line',line=>{try{broadcast(JSON.parse(line));}catch{}});
     const ended=()=>{if(child!==proc)return;child=undefined;for(const ws of clients.keys())ws.close(1011,'IBKR 推送服务重连');};
     proc.on('exit',ended);proc.on('error',ended);proc.stdin.on('error',ended);
    }
    child.stdin.write(JSON.stringify({symbols,contracts:allContracts,port:cfg.port,clientId:cfg.clientId>999995?cfg.clientId-4:cfg.clientId+4})+'\n');
   }catch{broadcast({type:'status',connected:false,message:'无法读取 IBKR 连接配置'});}
  },200);
 };
 server.on('upgrade',(req,socket,head)=>{
  if(marketSource.active==='yahoo'){socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');socket.destroy();return;}
  const url=new URL(req.url??'/','http://localhost');
  const token=url.searchParams.get('ticket')??'';
  const origin=req.headers.origin;
  if(url.pathname!=='/ws/watchlist'||!['http://localhost:3000','http://127.0.0.1:3000',process.env.WEB_ORIGIN].filter(Boolean).includes(origin)||!tickets.has(token)||tickets.get(token)!<Date.now()||clients.size>=12){socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');socket.destroy();return;}
  tickets.delete(token);
  wss.handleUpgrade(req,socket,head,ws=>wss.emit('connection',ws));
 });
 wss.on('connection',ws=>{
  clients.set(ws,new Set());send(ws,{type:'status',connected:false,message:'正在订阅 IBKR 行情…'});
  ws.on('message',raw=>{
   try{
    const msg=JSON.parse(raw.toString());const requested=msg.contracts===undefined?undefined:contractsSchema.parse(msg.contracts);
    const symbols=requested?requested.map(c=>c.key):symbolsSchema.parse(msg.symbols);
    if(requested?.some(c=>!c.key.startsWith('holding:')))throw new Error('Invalid contract key');
    const other=[...clients.entries()].filter(([c])=>c!==ws).flatMap(([,s])=>[...s]);
    if(new Set([...other,...symbols]).size>60)throw new Error('订阅超过 60 个不同标的');
    if(requested)contracts.set(ws,requested);else contracts.delete(ws);
    clients.set(ws,new Set(symbols));send(ws,{type:'reset'});sync();
   }catch{send(ws,{type:'status',connected:false,message:'订阅无效或超过总计 60 个合约上限'});}
  });
  ws.on('close',()=>{clients.delete(ws);contracts.delete(ws);sync();});ws.on('error',()=>ws.close());
 });
 const heartbeat=setInterval(()=>{for(const ws of clients.keys())send(ws,{type:'heartbeat'});},10000);heartbeat.unref();
 process.once('exit',()=>child?.kill());server.on('close',()=>{clearInterval(heartbeat);if(timer)clearTimeout(timer);for(const ws of clients.keys())ws.terminate();child?.kill();wss.close();});
}
