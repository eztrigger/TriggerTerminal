import {afterEach,expect,it,vi} from 'vitest';
import {createQuoteBatcher} from './quote-batcher.js';
afterEach(()=>vi.useRealTimers());
it('coalesces overlapping views and caches by contract while preserving requested order',async()=>{
 vi.useFakeTimers();const read=vi.fn(async(ids:string[])=>ids.map(id=>({id,price:10})));
 const quote=createQuoteBatcher(read,id=>id);
 const a=quote(['A','B','A']),b=quote(['B','C']);await vi.runAllTimersAsync();
 expect(await a).toEqual([{id:'A',price:10},{id:'B',price:10},{id:'A',price:10}]);
 expect(await b).toEqual([{id:'B',price:10},{id:'C',price:10}]);expect(read).toHaveBeenCalledTimes(1);
 await quote(['C','A']);expect(read).toHaveBeenCalledTimes(1);
 await vi.advanceTimersByTimeAsync(30001);const next=quote(['A']);await vi.runAllTimersAsync();await next;
 expect(read).toHaveBeenCalledTimes(2);
});
it('limits batches to 20 and serializes requests arriving while the worker is busy',async()=>{
 vi.useFakeTimers();let release!:()=>void;const gate=new Promise<void>(r=>release=r);
 const read=vi.fn(async(ids:string[])=>{await gate;return ids;});const quote=createQuoteBatcher(read,id=>id);
 const a=quote(Array.from({length:43},(_,i)=>String(i)));await vi.advanceTimersByTimeAsync(0);
 const b=quote(['extra']);await vi.advanceTimersByTimeAsync(0);expect(read).toHaveBeenCalledTimes(1);
 release();await a;await b;expect(read.mock.calls.map(c=>c[0].length)).toEqual([20,20,4]);
});
it('does not cache failed quotes and recovers after rejected reads',async()=>{
 vi.useFakeTimers();const read=vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce([{error:'missing'}]).mockResolvedValue([{price:2}]);
 const quote=createQuoteBatcher<string,any>(read,id=>id);
 const a=expect(quote(['A'])).rejects.toThrow('offline');await vi.runAllTimersAsync();await a;
 const b=quote(['A']);await vi.runAllTimersAsync();expect(await b).toEqual([{error:'missing'}]);
 const c=quote(['A']);await vi.runAllTimersAsync();expect(await c).toEqual([{price:2}]);expect(read).toHaveBeenCalledTimes(3);
});
