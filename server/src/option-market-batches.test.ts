import {it,expect} from 'vitest';
import {optionMarketBatches} from '../../web/lib/option-market-batches';
const leg={symbol:'MCD',assetType:'OPT',currency:'USD',expiry:'20261218',right:'P',strike:100,multiplier:100,quantity:-1,avgCost:4,marketPrice:2};
it('separates symbols and currencies to satisfy the market endpoint, deduplicating accounts',()=>{
 const result=optionMarketBatches([leg,{...leg,quantity:-2},{...leg,symbol:'AAPL'},{...leg,currency:'CAD'}]);
 expect(result).toHaveLength(3);expect(result.map(b=>b.length)).toEqual([1,1,1]);
 for(const batch of result)expect(new Set(batch.map(l=>l.symbol+'|'+l.currency)).size).toBe(1);
});
it('chunks large groups within the endpoint limit and skips stock legs',()=>{
 const rows=Array.from({length:43},(_,i)=>({...leg,strike:100+i}));
 expect(optionMarketBatches([...rows,{...leg,assetType:'STK'}]).map(b=>b.length)).toEqual([20,20,3]);
 expect(optionMarketBatches([])).toEqual([]);
});
