import {afterAll,describe,it,expect,vi} from 'vitest';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
vi.mock('./ibkr.js',()=>({readIbkrSnapshot:vi.fn()}));
vi.mock('./db.js',async()=>{
 const fs=await import('node:fs');const os=await import('node:os');
 return {dataDir:fs.mkdtempSync(os.tmpdir()+'/holdings-test-main-')};
});
import {createHoldingsStore,holdingSchema} from './holdings.js';
const folder=mkdtempSync(join(tmpdir(),'holdings-test-'));
const store=createHoldingsStore(join(folder,'test.db'));
afterAll(()=>{store.db.close();rmSync(folder,{recursive:true,force:true});});
const leg={symbol:'AAPL',assetType:'OPT',quantity:-2,multiplier:100,currency:'USD',expiry:'20261218',right:'P',strike:100,avgCost:2,marketPrice:1};
const ib=(id:number,qty:number)=>({conId:id,symbol:'AAPL',localSymbol:'AAPL P100',secType:'OPT',quantity:qty,multiplier:100,currency:'USD',expiry:'20261218',right:'P',strike:100,unitCost:2,marketPrice:1,marketValue:-200,unrealizedPnl:200});
describe('holdings isolation and sync',()=>{
 it('removes one strategy member without changing holdings or accounting and cleans up empty groups',()=>{
  const accountId=store.addAccount({broker:'Test',name:'Detach',accountNumber:''});
  const a=store.save(holdingSchema.parse({accountId,name:'A',legs:[leg]}));
  const b=store.save(holdingSchema.parse({accountId,name:'B',legs:[leg]}));
  const id=store.group('Pair',[a,b]);
  const before=store.list();
  store.removeGroupMember(id,a);
  expect(store.list().groups.find(g=>g.id===id)?.positionIds).toEqual([b]);
  expect(store.list().holdings).toEqual(before.holdings);
  expect(store.ledger.list()).toEqual((({groups,accounts,holdings,...ledger})=>ledger)(before));
  expect(()=>store.removeGroupMember(id,a)).toThrow('仓位不属于此策略组');
  store.addGroupMembers(id,[a]);
  store.removeGroupMember(id,a);store.removeGroupMember(id,b);
  expect(store.list().groups.find(g=>g.id===id)).toBeUndefined();
  expect(store.list().holdings).toEqual(before.holdings);
 });
 it('appends group members atomically without changing positions or accounting',()=>{
  const accountId=store.addAccount({broker:'Test',name:'Group append',accountNumber:''});
  const add=(name:string)=>store.save(holdingSchema.parse({accountId,name,legs:[leg]}));
  const a=add('A'),b=add('B'),hut=add('HUT'),other=add('Other'),free=add('Free');
  const id=store.group('Cash Secured Put',[a,b]);
  store.group('Other group',[other,add('Other 2')]);
  const before=JSON.stringify(store.list().holdings);
  store.addGroupMembers(id,[hut]);store.addGroupMembers(id,[hut]);
  expect(store.list().groups.find(g=>g.id===id)?.positionIds).toEqual([a,b,hut]);
  expect(JSON.stringify(store.list().holdings)).toBe(before);
  expect(()=>store.addGroupMembers(id,[free,other])).toThrow('其他组合');
  expect(store.list().groups.find(g=>g.id===id)?.positionIds).not.toContain(free);
  const otherAccount=store.addAccount({broker:'Test',name:'Different',accountNumber:''});
  const foreign=store.save(holdingSchema.parse({accountId:otherAccount,name:'Foreign',legs:[leg]}));
  const positionsBefore=store.list().holdings;
  store.addGroupMembers(id,[foreign]);
  expect(store.list().groups.find(g=>g.id===id)?.positionIds).toContain(foreign);
  expect(store.list().holdings).toEqual(positionsBefore);
  expect(()=>store.addGroupMembers(id,[999999])).toThrow('有效的当前仓位');
  expect(()=>store.addGroupMembers(999999,[free])).toThrow('组合不存在');
 });
 it('saves signed multi-leg positions under named brokers and accounts',()=>{
  const id=store.addAccount({broker:'Test broker',name:'Taxable',accountNumber:'TEST'});
  const value=holdingSchema.parse({accountId:id,name:'Put spread',legs:[leg,{...leg,quantity:2,strike:90}]});
  const saved=store.save(value);
  const data:any=store.list();
  expect(data.holdings.find((h:any)=>h.id===saved).legs.map((l:any)=>l.quantity)).toEqual([-2,2]);
 });
 it('sync is idempotent and never overwrites manual rows or another IB account',()=>{
  const a=store.sync('U_TEST1',[ib(11,-2)],'2026-09-23T00:00:00Z');
  const manual=store.save(holdingSchema.parse({accountId:a,name:'Manual AAPL',legs:[leg]}));
  const b=store.sync('U_TEST2',[ib(11,-4)],'2026-09-23T00:00:00Z');
  store.sync('U_TEST1',[ib(11,-3)],'2026-09-23T01:00:00Z');
  let rows:any[]=store.list().holdings;
  expect(rows.filter(h=>h.accountId===a&&h.source==='IBKR')).toHaveLength(1);
  expect(rows.find(h=>h.id===manual).legs[0].quantity).toBe(-2);
  expect(rows.find(h=>h.accountId===b).legs[0].quantity).toBe(-4);
  store.sync('U_TEST1',[],'2026-09-23T02:00:00Z');
  rows=store.list().holdings;
  expect(rows.find(h=>h.accountId===a&&h.source==='IBKR').active).toBe(0);
  expect(rows.find(h=>h.id===manual).active).toBe(1);
  expect(rows.find(h=>h.accountId===b).active).toBe(1);
 });
 it('keeps strategy membership stable across sync and allows cross-account grouping without duplicates',()=>{
  const a=store.sync('U_GROUP',[ib(21,-2),ib(22,2)],'2026-09-24T00:00:00Z');
  const ids=(store.list().holdings as any[]).filter(h=>h.accountId===a).map(h=>h.id);
  const g=store.group('Spread',ids);
  expect(()=>store.group('Duplicate',ids)).toThrow('其他组合');
  store.sync('U_GROUP',[ib(21,-1)],'2026-09-24T01:00:00Z');
  expect(store.list().groups.find(x=>x.id===g)?.positionIds.sort()).toEqual(ids.sort());
  expect((store.list().holdings as any[]).filter(h=>ids.includes(h.id)&&h.active)).toHaveLength(1);
  const b=store.addAccount({broker:'Other',name:'Other',accountNumber:''});
  const bId=store.save(holdingSchema.parse({accountId:b,name:'Other leg',legs:[leg]}));
  store.db.prepare('DELETE FROM holding_groups WHERE id=?').run(g);
  expect(store.db.prepare('SELECT * FROM holding_group_members WHERE group_id=?').all(g)).toHaveLength(0);
  expect((store.list().holdings as any[]).filter(h=>ids.includes(h.id))).toHaveLength(2);
  const activeId=(store.list().holdings as any[]).find(h=>ids.includes(h.id)&&h.active).id;
  const before=store.list().holdings;
  const cross=store.group('Cross account',[activeId,bId]);
  expect(store.list().groups.find(x=>x.id===cross)?.positionIds).toEqual([activeId,bId].sort((a,b)=>a-b));
  expect(store.list().holdings).toEqual(before);
 });
 it('rejects edits to synced records' ,()=>{
  const row:any=store.list().holdings.find((h:any)=>h.source==='IBKR');
  expect(()=>store.save(holdingSchema.parse({accountId:row.accountId,name:'overwrite',legs:[leg]}),row.id)).toThrow('只能编辑');
 });
 it('rejects impossible option dates, missing details and fractional contracts',()=>{
  for(const change of [{expiry:'20260230'},{right:''},{quantity:.5},{quantity:0},{strike:null}]){
   expect(holdingSchema.safeParse({accountId:1,name:'bad',legs:[{...leg,...change}]}).success).toBe(false);
  }
 });
});

it('refresh recalculates short-option PnL and retains unavailable legs and concurrent edits',()=>{
 const accountId=store.addAccount({broker:'Test',name:'Refresh',accountNumber:''});
 const value=holdingSchema.parse({accountId,name:'Spread',legs:[leg,{...leg,quantity:2,strike:90}]});
 const id=store.save(value);
 const row=store.list().holdings.find(h=>h.id===id)!;
 expect(store.applyPrices(row,[{price:0.5,fetchedAt:'2026-09-24T12:00:00Z',basis:'买卖中间价',marketDataType:3},{error:'no quote'}])).toBe(1);
 const fresh=store.list().holdings.find(h=>h.id===id)!;
 expect(fresh.legs[0]).toMatchObject({quantity:-2,avgCost:2,marketPrice:.5,marketValue:-100,unrealizedPnl:300});
 expect(fresh.legs[1]).toEqual(row.legs[1]);
 store.save({...value,name:'Edited',legs:[{...value.legs[0],quantity:-3},value.legs[1]]},id);
 expect(store.applyPrices(fresh,[{price:9},{price:9}])).toBe(0);
 expect(store.list().holdings.find(h=>h.id===id)!.legs[0].quantity).toBe(-3);
});

it('keeps broker-position notes and last bid/ask through synchronization',()=>{
 const accountId=store.sync('U_NOTES',[ib(77,-2)],'2026-09-24T00:00:00Z');
 const row=store.list().holdings.find(h=>h.accountId===accountId)!;
 store.db.prepare('UPDATE holding_positions SET notes=? WHERE id=?').run('Keep my plan',row.id);
 store.applyPrices(row,[{price:1.5,bid:1,ask:2,fetchedAt:'2026-09-24T01:00:00Z',marketDataType:3}]);
 store.sync('U_NOTES',[ib(77,-2)],'2026-09-24T02:00:00Z');
 const updated=store.list().holdings.find(h=>h.id===row.id)!;
 expect(updated.notes).toBe('Keep my plan');
 expect(updated.legs[0]).toMatchObject({bid:1,ask:2,bidAskAt:'2026-09-24T01:00:00Z'});
 updated.legs[0].notes='Asset-specific note';
 store.db.prepare('UPDATE holding_positions SET legs=? WHERE id=?').run(JSON.stringify(updated.legs),updated.id);
 store.sync('U_NOTES',[ib(77,-3)],'2026-09-24T03:00:00Z');
 expect(store.list().holdings.find(h=>h.id===row.id)!.legs[0].notes).toBe('Asset-specific note');
});
it('deletes manual holdings and memberships but rejects synced holdings',()=>{
 const accountId=store.addAccount({broker:'Test',name:'Delete',accountNumber:''});
 const a=store.save(holdingSchema.parse({accountId,name:'A',legs:[leg]}));
 const b=store.save(holdingSchema.parse({accountId,name:'B',legs:[leg]}));
 store.group('Pair',[a,b]);store.remove(a);
 expect(store.list().holdings.some(h=>h.id===a)).toBe(false);
 expect(store.list().groups.some(g=>g.positionIds.includes(a))).toBe(false);
 expect(store.list().holdings.some(h=>h.id===b)).toBe(true);
 const ibAccount=store.sync('U_PROTECTED',[ib(777,1)],'2026-09-24T00:00:00Z');
 const row=store.list().holdings.find(h=>h.accountId===ibAccount)!;
 expect(()=>store.remove(row.id)).toThrow('不能删除');
 expect(store.list().holdings.some(h=>h.id===row.id)).toBe(true);
});
it('persists exact Canadian and fund identities with their quotes',()=>{
 for(const assetType of ['STK','ETF','FUND']){
  const accountId=store.addAccount({broker:'Test',name:assetType,accountNumber:''});
  const id=store.save(holdingSchema.parse({accountId,name:'CAD instrument',legs:[{...leg,assetType,symbol:'RY',quantity:5,currency:'CAD',conId:123,multiplier:1,exchange:assetType==='FUND'?'FUNDSERV':'SMART',primaryExchange:'TSE',bid:10,ask:11,quoteAt:'2026-09-24T12:00:00Z'}]}));
  expect(store.list().holdings.find(h=>h.id===id)!.legs[0]).toMatchObject({conId:123,currency:'CAD',primaryExchange:'TSE',bid:10,ask:11});
 }
});

it('persists classification separately without altering names, notes or ledger and retains it through IBKR sync',()=>{
 const accountId=store.addAccount({broker:'Test',name:'Classified',accountNumber:''});
 const id=store.save(holdingSchema.parse({accountId,name:'My custom label',strategyId:'cash-secured-put',notes:'Private notes',legs:[leg]}));
 expect(store.list().holdings.find(h=>h.id===id)).toMatchObject({strategyId:'cash-secured-put',name:'My custom label',notes:'Private notes'});
 store.save(holdingSchema.parse({accountId,name:'My custom label',notes:'Private notes',legs:[leg]}),id);
 expect(store.list().holdings.find(h=>h.id===id)?.strategyId).toBe('cash-secured-put');
 const a=store.sync('U_CLASSIFY',[ib(909,-1)],'2026-10-03T00:00:00Z');
 const imported=store.list().holdings.find(h=>h.accountId===a)!;
 const before=store.ledger.list();
 store.db.prepare('UPDATE holding_positions SET strategy_id=? WHERE id=?').run('cash-secured-put',imported.id);
 store.sync('U_CLASSIFY',[ib(909,-2)],'2026-10-03T01:00:00Z');
 expect(store.list().holdings.find(h=>h.id===imported.id)?.strategyId).toBe('cash-secured-put');
 expect(store.ledger.list()).toEqual(before);
 expect(holdingSchema.safeParse({accountId,name:'Bad',strategyId:'made-up',legs:[leg]}).success).toBe(false);
});
