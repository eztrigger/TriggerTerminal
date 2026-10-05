import {describe,it,expect,vi,afterAll} from 'vitest';
import {createServer} from 'node:http';
import {WebSocket} from 'ws';
vi.mock('./db.js',()=>({dataDir:'/tmp'}));
import {symbolsSchema,attachWatchlistStream} from './watchlist-stream.js';
describe('watchlist streaming boundary',()=>{
 it('accepts Canadian symbols, normalizes case and limits subscriptions',()=>{
  expect(symbolsSchema.parse(['ry.to','AAPL'])).toEqual(['RY.TO','AAPL']);
  expect(symbolsSchema.safeParse(['AAPL\nINJECT']).success).toBe(false);
  expect(symbolsSchema.safeParse(Array(41).fill('AAPL')).success).toBe(false);
 });
 it('rejects websocket connections without an authenticated ticket',async()=>{
  const server=createServer();attachWatchlistStream(server);
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  const port=(server.address() as {port:number}).port;
  const status=await new Promise<number>((resolve,reject)=>{
   const ws=new WebSocket(`ws://127.0.0.1:${port}/ws/watchlist`,{origin:'http://localhost:3000'});
   ws.on('unexpected-response',(_q,r)=>{resolve(r.statusCode!);r.resume();ws.terminate();});ws.on('error',()=>{});ws.on('open',()=>{ws.close();reject(new Error('unauthorized connection accepted'));});
  });
  expect(status).toBe(403);await new Promise<void>(resolve=>server.close(()=>resolve()));
 });
});
