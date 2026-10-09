import {it,expect,vi} from 'vitest';
import express from 'express';
import {createServer} from 'node:http';
import {WebSocket} from 'ws';
vi.mock('./auth.js',()=>({apiKey:'test-key'}));
import {analysisStreamRouter,attachAnalysisStream,readTopic} from './analysis-stream.js';
it('allows only bounded read subscriptions',()=>{
 expect(readTopic({id:'a',path:'/api/holdings'}).ttl).toBe(3000);
 expect(()=>readTopic({id:'a',path:'/api/holdings/positions'})).toThrow();
 expect(()=>readTopic({id:'a',path:'http://example.com/'})).toThrow();
 expect(()=>readTopic({id:'a',path:'/api/analysis/market',body:{legs:[]}})).toThrow();
 expect(readTopic({id:'a',path:'/api/analysis/research/AAPL?kind=stock&currency=USD'}).ttl).toBe(3600000);
});
it('authenticates tickets, shares an in-flight read, and replays cached data',async()=>{
 const app=express();app.use(express.json());app.use('/api/analysis',analysisStreamRouter);let reads=0;
 app.get('/api/holdings',async(req,res)=>{expect(req.header('x-api-key')).toBe('test-key');reads++;await new Promise(r=>setTimeout(r,40));res.json({holdings:[{id:reads}]});});
 const server=createServer(app);attachAnalysisStream(server);await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));const port=(server.address() as any).port;
 const sockets:WebSocket[]=[];
 const open=async()=>{const {ticket}=await (await fetch(`http://127.0.0.1:${port}/api/analysis/stream-ticket`,{method:'POST',headers:{'content-type':'application/json'},body:'{}'})).json() as any;const ws=new WebSocket(`ws://127.0.0.1:${port}/ws/analysis?ticket=${ticket}`,{origin:'http://localhost:3000'});sockets.push(ws);await new Promise<void>((resolve,reject)=>{ws.once('open',resolve);ws.once('error',reject);});return ws;};
 const read=(ws:WebSocket,id:string)=>new Promise<any>(resolve=>{ws.once('message',x=>resolve(JSON.parse(String(x))));ws.send(JSON.stringify({id,path:'/api/holdings'}));});
 try{const [a,b]=await Promise.all([open(),open()]);const result=await Promise.all([read(a,'a'),read(b,'b')]);expect(result.map(r=>r.data.holdings[0].id)).toEqual([1,1]);expect(reads).toBe(1);expect((await read(a,'a')).data.holdings[0].id).toBe(1);expect(reads).toBe(1);
 const pushed=await new Promise<any>(resolve=>{const listener=(x:any)=>{const m=JSON.parse(String(x));if(m.type==='data'&&m.data.holdings[0].id>1){a.off('message',listener);resolve(m);}};a.on('message',listener);});expect(pushed.data.holdings[0].id).toBe(2);
 await new Promise<void>(resolve=>{const ws=new WebSocket(`ws://127.0.0.1:${port}/ws/analysis?ticket=bad`,{origin:'http://localhost:3000'});ws.on('error',()=>resolve());});
 }finally{for(const ws of sockets)ws.terminate();await new Promise<void>(r=>server.close(()=>r()));}
},12000);
