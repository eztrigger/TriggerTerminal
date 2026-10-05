import {afterEach,expect,it,vi} from 'vitest';
afterEach(()=>{vi.unstubAllGlobals();vi.resetModules();vi.useRealTimers();});
it('a rate-limited quote endpoint does not block chart history',async()=>{
 vi.stubGlobal('fetch',vi.fn(async(url:string)=>{
  if(url.includes('fc.yahoo'))return new Response('',{headers:{'set-cookie':'session=test;'}});
  if(url.includes('getcrumb'))return new Response('crumb');
  if(url.includes('/v7/finance/quote'))return new Response('',{status:429});
  return Response.json({chart:{result:[{timestamp:[1],indicators:{quote:[{open:[1],high:[2],low:[1],close:[2],volume:[10]}]}}]}});
 }));
 const yahoo=await import('./yahoo.js');
 await expect(yahoo.quotes(['MCD'])).rejects.toThrow('429');
 expect(await yahoo.history('MCD','6mo','1d')).toHaveLength(1);
});
const chart=()=>Response.json({chart:{result:[{meta:{symbol:'MCD',regularMarketPrice:300,currency:'USD'},timestamp:[1],indicators:{quote:[{open:[1],high:[2],low:[1],close:[2],volume:[10]}]}}]}});
it('coalesces simultaneous history calls and serves repeated refreshes from a shared cache',async()=>{
 vi.useFakeTimers();const fetcher=vi.fn(async()=>chart());vi.stubGlobal('fetch',fetcher);
 const yahoo=await import('./yahoo.js');
 const requests=Promise.all(Array.from({length:20},()=>yahoo.history('MCD','6mo','1d')));
 await vi.runAllTimersAsync();expect(await requests).toHaveLength(20);expect(fetcher).toHaveBeenCalledTimes(1);
 await yahoo.history('MCD','6mo','1d');expect(fetcher).toHaveBeenCalledTimes(1);
 await vi.advanceTimersByTimeAsync(300001);
 const next=yahoo.history('MCD','6mo','1d');await vi.runAllTimersAsync();await next;expect(fetcher).toHaveBeenCalledTimes(2);
});
it('shares one session across option expirations and quotes and caches option chains for five minutes',async()=>{
 vi.useFakeTimers();const fetcher=vi.fn(async(url:string)=>{
  if(url.includes('fc.yahoo'))return new Response('',{headers:{'set-cookie':'session=test;'}});
  if(url.includes('getcrumb'))return new Response('crumb');
  if(url.includes('/quote?'))return Response.json({quoteResponse:{result:[]}});
  return Response.json({optionChain:{result:[{options:[{expirationDate:123,calls:[],puts:[]}]}]}});
 });vi.stubGlobal('fetch',fetcher);const yahoo=await import('./yahoo.js');
 const requests=Promise.all([yahoo.options('MCD',123),yahoo.options('MCD',456),yahoo.quotes(['MCD']),yahoo.options('MCD',123)]);
 await vi.runAllTimersAsync();await requests;
 expect(fetcher.mock.calls.filter(([url])=>url.includes('fc.yahoo'))).toHaveLength(1);
 expect(fetcher.mock.calls.filter(([url])=>url.includes('getcrumb'))).toHaveLength(1);
 expect(fetcher.mock.calls.filter(([url])=>url.includes('/options/'))).toHaveLength(2);
 await yahoo.options('MCD',123);expect(fetcher).toHaveBeenCalledTimes(5);
});
it('honors Retry-After and stops already queued requests during a 429 cooldown',async()=>{
 vi.useFakeTimers();const fetcher=vi.fn(async()=>new Response('',{status:429,headers:{'retry-after':'120'}}));vi.stubGlobal('fetch',fetcher);
 const {yahooRequest}=await import('./yahoo-transport.js');
 const requests=Promise.allSettled([yahooRequest('https://query1.finance.yahoo.com/one'),yahooRequest('https://query1.finance.yahoo.com/two')]);
 await vi.runAllTimersAsync();await requests;expect(fetcher).toHaveBeenCalledTimes(1);
 await vi.advanceTimersByTimeAsync(60000);await expect(yahooRequest('https://query1.finance.yahoo.com/three')).rejects.toThrow('cooling down');
 await vi.advanceTimersByTimeAsync(60001);const next=yahooRequest('https://query1.finance.yahoo.com/four');await vi.runAllTimersAsync();await next;expect(fetcher).toHaveBeenCalledTimes(2);
});
it('renews an invalid session once but never retries 429 in a tight loop',async()=>{
 vi.useFakeTimers();let quotes=0;const fetcher=vi.fn(async(url:string)=>{
  if(url.includes('fc.yahoo'))return new Response('',{headers:{'set-cookie':'session=test;'}});
  if(url.includes('getcrumb'))return new Response('crumb');
  quotes++;return quotes===1?new Response('',{status:401}):Response.json({quoteResponse:{result:[]}});
 });vi.stubGlobal('fetch',fetcher);const yahoo=await import('./yahoo.js');
 const request=yahoo.quotes(['MCD']);await vi.runAllTimersAsync();await request;
 expect(quotes).toBe(2);expect(fetcher.mock.calls.filter(([url])=>url.includes('getcrumb'))).toHaveLength(2);
});
it('spaces all requests and gives every session request a timeout signal',async()=>{
 vi.useFakeTimers();const starts:number[]=[];const fetcher=vi.fn(async(_url:string,init:RequestInit)=>{starts.push(Date.now());expect(init.signal).toBeDefined();return chart();});vi.stubGlobal('fetch',fetcher);
 const {yahooRequest}=await import('./yahoo-transport.js');const requests=Promise.all([yahooRequest('https://query1.finance.yahoo.com/one'),yahooRequest('https://query1.finance.yahoo.com/two'),yahooRequest('https://query1.finance.yahoo.com/three')]);
 await vi.runAllTimersAsync();await requests;expect(starts[1]-starts[0]).toBeGreaterThanOrEqual(500);expect(starts[2]-starts[1]).toBeGreaterThanOrEqual(500);
});
it('does not turn an empty response into a successful cache entry',async()=>{
 vi.useFakeTimers();const fetcher=vi.fn(async()=>Response.json({chart:{result:[]}}));vi.stubGlobal('fetch',fetcher);const yahoo=await import('./yahoo.js');
 const request=expect(yahoo.history('MCD','6mo','1d')).rejects.toThrow('empty');await vi.runAllTimersAsync();await request;
 await expect(yahoo.history('MCD','6mo','1d')).rejects.toThrow('empty');expect(fetcher).toHaveBeenCalledTimes(1);
});
it('retries a transient server failure once and preserves the real retrieval time on cache hits',async()=>{
 vi.useFakeTimers();let count=0;vi.stubGlobal('fetch',vi.fn(async()=>++count===1?new Response('',{status:503}):chart()));
 const yahoo=await import('./yahoo.js');const request=yahoo.history('MCD','6mo','1d');await vi.runAllTimersAsync();await request;
 const received=yahoo.historyRetrievedAt('MCD','6mo','1d');expect(received).toBeDefined();
 await vi.advanceTimersByTimeAsync(30000);await yahoo.history('MCD','6mo','1d');
 expect(count).toBe(2);expect(yahoo.historyRetrievedAt('MCD','6mo','1d')).toBe(received);
});
it('does not accept a throttling response as a crumb or hammer session creation',async()=>{
 vi.useFakeTimers();const fetcher=vi.fn(async(url:string)=>url.includes('fc.yahoo')?new Response('',{headers:{'set-cookie':'session=test;'}}):new Response('Too Many Requests',{status:429}));
 vi.stubGlobal('fetch',fetcher);const yahoo=await import('./yahoo.js');
 const request=expect(yahoo.options('AAPL')).rejects.toThrow('crumb');await vi.runAllTimersAsync();await request;
 await expect(yahoo.options('MSFT')).rejects.toThrow('cached failure');expect(fetcher).toHaveBeenCalledTimes(2);
});
