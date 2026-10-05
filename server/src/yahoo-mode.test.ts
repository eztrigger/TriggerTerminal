import {expect,it,vi} from 'vitest';
import express from 'express';
import type {AddressInfo} from 'node:net';
vi.mock('./market-source.js',()=>({marketSource:{active:'yahoo'}}));
vi.mock('./providers/yahoo.js',()=>({historyRetrievedAt:vi.fn(()=>undefined),quoteFromChart:vi.fn(async(symbol:string)=>({symbol,price:123,source:'yahoo'})),quotes:vi.fn(async(symbols:string[])=>symbols.map(symbol=>({symbol,price:123,source:'yahoo'}))),history:vi.fn(async()=>[{time:1,open:1,high:2,low:1,close:2,volume:1}])}));
vi.mock('./providers/nasdaq.js',()=>({quote:vi.fn(()=>{throw new Error('unexpected Nasdaq request');})}));
import {marketRouter} from './routes/market.js';
import {watchlistRouter,attachWatchlistStream} from './watchlist-stream.js';
import {WebSocket} from 'ws';
it('Yahoo mode serves HTTP quotes/history and denies WebSocket tickets and upgrades',async()=>{
 const app=express();app.use('/api',marketRouter);app.use('/ibkr',watchlistRouter);
 const server=app.listen(0,'127.0.0.1');attachWatchlistStream(server);
 await new Promise<void>(resolve=>server.once('listening',resolve));
 const base=`http://127.0.0.1:${(server.address() as AddressInfo).port}`;
 try{
  const quotes=await fetch(base+'/api/quotes?symbols=TSLA').then(r=>r.json());
  expect(quotes[0].source).toBe('yahoo');
  const history=await fetch(base+'/api/history/TSLA?meta=1').then(r=>r.json());
  expect(history.source).toBe('Yahoo');
  expect((await fetch(base+'/ibkr/stream-ticket',{method:'POST'})).status).toBe(409);
  const ws=new WebSocket(base.replace('http:','ws:')+'/ws/watchlist');
  await new Promise<void>((resolve,reject)=>{ws.on('error',e=>{expect(e.message).toContain('403');resolve();});ws.on('open',()=>{ws.close();reject(new Error('WebSocket unexpectedly opened'));});});
 }finally{await new Promise<void>(resolve=>server.close(()=>resolve()));}
});
