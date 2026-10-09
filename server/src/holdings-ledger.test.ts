import { afterEach,expect,it,vi } from 'vitest';
import { randomUUID } from 'node:crypto';
vi.mock('./ibkr.js',()=>({readIbkrSnapshot:vi.fn()}));
vi.mock('./db.js',async()=>({dataDir:(await import('node:fs')).mkdtempSync((await import('node:os')).tmpdir()+'/ledger-test-')}));
import {createHoldingsStore,holdingSchema} from './holdings.js';
import {cashSchema,actionSchema,createLedger,closeCorrectionSchema} from './holdings-ledger.js';
const stores:ReturnType<typeof createHoldingsStore>[]=[];
afterEach(()=>{stores.forEach(s=>s.db.close());stores.length=0;});
const stock={symbol:'XYZ',assetType:'STK',quantity:100,multiplier:1,currency:'USD',avgCost:80,marketPrice:100};
function setup(){const s=createHoldingsStore(':memory:');stores.push(s);const id=s.addAccount({broker:'Test',name:'Cash',accountNumber:'',cash:[{currency:'USD',amount:20000},{currency:'CAD',amount:5000}]});return {s,id};}
function add(s:ReturnType<typeof createHoldingsStore>,id:number,leg:any,extra:any={}){return s.save(holdingSchema.parse({accountId:id,name:'Test position',legs:[leg],...extra}));}
function action(s:ReturnType<typeof createHoldingsStore>,positionId:number,change:any={}){const h=s.list().holdings.find(h=>h.id===positionId)!;return {requestId:randomUUID(),expectedLegs:JSON.stringify(h.legs),index:0,quantity:Math.abs(h.legs[0].quantity),price:110,fee:1,at:new Date().toISOString(),kind:'CLOSE' as const,...change};}
function bal(s:ReturnType<typeof createHoldingsStore>,id:number,c='USD'){return (s.ledger.list().balances as any[]).find(b=>b.accountId===id&&b.currency===c);}
function equity(s:ReturnType<typeof createHoldingsStore>,id:number){return bal(s,id).cash+s.list().holdings.filter(h=>h.active&&h.accountId===id).flatMap(h=>h.legs).filter(l=>l.currency==='USD').reduce((n,l)=>n+l.quantity*l.multiplier*l.marketPrice,0);}
it('records a per-currency baseline, rejects duplicates and preserves existing accounts',()=>{
 const {s,id}=setup();add(s,id,stock);
 expect(bal(s,id)).toMatchObject({cash:20000,baseline:30000,flows:0});expect(bal(s,id,'CAD').baseline).toBe(5000);
 expect(()=>s.ledger.initialize(id,[{currency:'USD',amount:1}])).toThrow('已开始追踪');
 expect(cashSchema.safeParse([{currency:'usd',amount:0},{currency:'USD',amount:1}]).success).toBe(false);
});
it('supports partial closes, signed proceeds, fees, idempotency and stale-write rejection',()=>{
 const {s,id}=setup();const p=add(s,id,stock);const a=action(s,p,{quantity:40});
 s.ledger.act(p,a);s.ledger.act(p,a);
 expect(s.list().holdings[0].legs[0].quantity).toBe(60);expect(bal(s,id).cash).toBe(24399);
 expect(s.list().holdings[0].legs[0].marketPrice).toBe(100);
 expect(s.ledger.list().events[0].realized.USD).toBe(1199);
 expect(()=>s.ledger.act(p,{...a,requestId:randomUUID()})).toThrow('已更新');
 expect(()=>s.ledger.act(p,action(s,p,{quantity:61}))).toThrow();
 s.ledger.act(p,action(s,p,{quantity:60}));expect(s.list().holdings[0].active).toBe(0);
 expect(s.ledger.list().events.reduce((n,e)=>n+e.realized.USD,0)).toBe(2998);
});
it('closes short options and expiration at zero without inventing a market quote',()=>{
 const {s,id}=setup();const p=add(s,id,{...stock,assetType:'OPT',quantity:-2,multiplier:100,expiry:'20261218',right:'P',strike:100,avgCost:3,marketPrice:2});
 s.ledger.act(p,action(s,p,{quantity:1,price:0,fee:0}));
 expect(bal(s,id).cash).toBe(20000);expect(s.ledger.list().events[0].realized.USD).toBe(300);
 expect(s.list().holdings[0].legs[0].quantity).toBe(-1);
});
for(const [right,quantity,shares,basis] of [['C',1,100,103],['C',-1,-100,103],['P',1,-100,97],['P',-1,100,97]] as const)it(`carries premium into ${right} ${quantity} delivery and keeps total PnL consistent`,()=>{
 const {s,id}=setup();const p=add(s,id,{...stock,assetType:'OPT',quantity,multiplier:100,expiry:'20261218',right,strike:100,avgCost:3,marketPrice:right==='C'?10:0});
 const a=action(s,p,{kind:'EXERCISE',physicalDelivery:true,price:110,fee:2});s.ledger.act(p,a);
 const generated=s.list().holdings.find(h=>h.id!==p)!;
 expect(generated.legs[0]).toMatchObject({quantity:shares,avgCost:basis,assetType:'STK',multiplier:1});
 expect(bal(s,id).cash).toBe(20000-shares*100-2);
 expect(s.ledger.list().events[0].realized.USD).toBe(-2);
 s.ledger.act(generated.id,action(s,generated.id,{price:110,fee:1}));
 expect(s.ledger.list().events.reduce((n,e)=>n+e.realized.USD,0)).toBe(shares*(110-basis)-3);
});
it('delivers covered-call shares FIFO and creates a short only for the remainder',()=>{
 const {s,id}=setup();const held=add(s,id,{...stock,quantity:60});const option=add(s,id,{...stock,assetType:'OPT',quantity:-1,multiplier:100,expiry:'20261218',right:'C',strike:100,avgCost:3,marketPrice:10});
 s.ledger.act(option,action(s,option,{kind:'EXERCISE',physicalDelivery:true,price:110}));
 expect(s.list().holdings.find(h=>h.id===held)!.active).toBe(0);
 expect(s.list().holdings.find(h=>h.active)!.legs[0]).toMatchObject({quantity:-40,avgCost:103});
 expect(s.ledger.list().events[0].realized.USD).toBe(1379);
 const latest=s.ledger.list().events[0];s.ledger.undo(id,latest.id);
 expect(s.list().holdings).toHaveLength(2);expect(s.list().holdings.find(h=>h.id===held)!.legs[0].quantity).toBe(60);expect(bal(s,id).cash).toBe(20000);
});
it('rejects nonphysical delivery, futures, missing costs and rolls back all mutations',()=>{
 const {s,id}=setup();const p=add(s,id,{...stock,assetType:'OPT',quantity:1,multiplier:100,expiry:'20261218',right:'C',strike:100});
 const before=JSON.stringify(s.list());expect(()=>s.ledger.act(p,action(s,p,{kind:'EXERCISE'}))).toThrow('实物交割');expect(JSON.stringify(s.list())).toBe(before);
 expect(actionSchema.safeParse(action(s,p,{price:-1})).success).toBe(false);
 expect(()=>s.ledger.act(p,action(s,p,{quantity:.5}))).toThrow('整数');
});
it('excludes deposits and withdrawals from profit and tracks other income',()=>{
 const {s,id}=setup();const start=equity(s,id)-bal(s,id).baseline;
 const req={requestId:randomUUID(),currency:'USD',amount:1000,at:new Date().toISOString(),kind:'DEPOSIT' as const,note:''};
 s.ledger.flow(id,req);s.ledger.flow(id,req);
 expect(equity(s,id)-bal(s,id).baseline-bal(s,id).flows).toBe(start);
 s.ledger.flow(id,{...req,requestId:randomUUID(),kind:'INCOME',amount:50});
 expect(equity(s,id)-bal(s,id).baseline-bal(s,id).flows).toBe(50);
 expect(()=>s.ledger.flow(id,{...req,requestId:randomUUID(),at:'2000-01-01T00:00:00Z'})).toThrow('追踪起点');
});
it('deletion removes initial entries without realized PnL; recorded trades require undo',()=>{
 const {s,id}=setup();const p=add(s,id,stock);s.remove(p);expect(bal(s,id).baseline).toBe(20000);expect(s.ledger.list().events).toEqual([]);
 const trade=add(s,id,stock,{entryMode:'TRADE',requestId:randomUUID(),at:new Date().toISOString(),fee:2});expect(bal(s,id).cash).toBe(11998);
 expect(()=>s.remove(trade)).toThrow('关联成交');expect(()=>s.save(holdingSchema.parse({accountId:id,name:'edit',legs:[stock]}),trade)).toThrow('直接编辑');
 s.ledger.undo(id,s.ledger.list().events[0].id);expect(s.list().holdings).toEqual([]);expect(bal(s,id).cash).toBe(20000);expect(s.ledger.list().events).toEqual([]);
});
it('does not treat broker snapshot disappearance as a close or infer realized profit',()=>{
 const {s}=setup();const id=s.sync('U_TEST',[],'2026-09-30T00:00:00Z');s.ledger.syncCash(id,[{tag:'CashBalance',currency:'USD',value:'120'},{tag:'CashBalance',currency:'BASE',value:'180'}],new Date().toISOString());
 expect(s.ledger.list().brokerCash).toHaveLength(1);expect(s.ledger.list().events).toEqual([]);
 s.ledger.syncCash(id,[],new Date().toISOString());expect(s.ledger.list().brokerCash).toEqual([]);
});
it('carries historical entry commission into long and short costs without deducting cash again',()=>{
 const {s,id}=setup();
 const long=add(s,id,stock,{fee:10});
 const short=add(s,id,{...stock,quantity:-100},{fee:10});
 expect(s.list().holdings.find(h=>h.id===long)!.legs[0]).toMatchObject({avgCost:80.1,openingCommission:10});
 expect(s.list().holdings.find(h=>h.id===short)!.legs[0]).toMatchObject({avgCost:79.9,openingCommission:10});
 expect(bal(s,id).cash).toBe(20000);
 expect(s.ledger.list().events).toHaveLength(0);
 s.ledger.act(long,action(s,long,{price:80,fee:2}));
 expect(s.ledger.list().events[0].realized.USD).toBe(-12);
});
it('corrects opening cash after trades without changing profit, flows or history',()=>{
 const {s,id}=setup();const p=add(s,id,stock);
 s.ledger.act(p,action(s,p,{quantity:40,price:110,fee:1}));
 const before=bal(s,id);const pnl=equity(s,id)-before.baseline-before.flows;
 const events=JSON.stringify(s.ledger.list().events);
 s.ledger.correctOpeningCash(id,'USD',22000,20000);
 expect(bal(s,id)).toMatchObject({initialCash:22000,cash:before.cash+2000,baseline:before.baseline+2000,flows:before.flows});
 expect(equity(s,id)-bal(s,id).baseline-bal(s,id).flows).toBe(pnl);
 expect(JSON.stringify(s.ledger.list().events)).toBe(events);
 expect(bal(s,id,'CAD').initialCash).toBe(5000);
 expect(()=>s.ledger.correctOpeningCash(id,'USD',25000,20000)).toThrow('已变更');
 s.ledger.undo(id,s.ledger.list().events[0].id);
 expect(bal(s,id).cash).toBe(22000);
});
it('corrects cash available now without retroactively changing opening cash, profit or transfers',()=>{
 const {s,id}=setup();const p=add(s,id,{...stock,quantity:10.25});
 s.ledger.act(p,action(s,p,{quantity:2.25,price:110,fee:1}));
 const before=bal(s,id),events=JSON.stringify(s.ledger.list().events);
 const pnl=equity(s,id)-before.baseline-before.flows;
 s.ledger.correctCurrentCash(id,'USD',1234.56,before.cash);
 expect(bal(s,id)).toMatchObject({cash:1234.56,initialCash:20000,flows:before.flows});
 expect(equity(s,id)-bal(s,id).baseline-bal(s,id).flows).toBeCloseTo(pnl,6);
 expect(JSON.stringify(s.ledger.list().events)).toBe(events);
 expect(s.list().holdings[0].legs[0].quantity).toBe(8);
 expect(bal(s,id,'CAD').cash).toBe(5000);
 expect(()=>s.ledger.correctCurrentCash(id,'USD',500,before.cash)).toThrow('当前现金已变更');
 expect((s.db.prepare('SELECT kind FROM holding_cash_corrections').get() as any).kind).toBe('CURRENT');
 s.ledger.undo(id,s.ledger.list().events[0].id);
 expect(bal(s,id).cash).toBeCloseTo(1234.56-(2.25*110-1),6);
});
it('does not replace authoritative broker cash with a local balance correction',()=>{
 const {s}=setup();const id=s.sync('U_TEST',[],'2026-09-30T00:00:00Z');
 s.ledger.initialize(id,[{currency:'USD',amount:100}]);
 s.ledger.syncCash(id,[{tag:'CashBalance',currency:'USD',value:'200'}],new Date().toISOString());
 const before=JSON.stringify(s.list());
 expect(()=>s.ledger.correctCurrentCash(id,'USD',999,100)).toThrow('券商现金');
 expect(JSON.stringify(s.list())).toBe(before);
});
it('migrates original cash from historic cash movements without repricing opening holdings',()=>{
 const {s,id}=setup();const p=add(s,id,stock);
 s.ledger.act(p,action(s,p,{quantity:40,fee:5}));
 s.ledger.flow(id,{requestId:randomUUID(),currency:'USD',amount:1000,at:new Date().toISOString(),kind:'DEPOSIT',note:''});
 const baseline=bal(s,id).baseline;
 s.db.exec('ALTER TABLE holding_balances DROP COLUMN initial_cash');
 createLedger(s.db);
 expect(bal(s,id)).toMatchObject({initialCash:20000,baseline});
 createLedger(s.db);expect(bal(s,id).initialCash).toBe(20000);
});
const correction=(e:any,change:any={})=>closeCorrectionSchema.parse({revision:e.revision,quantity:e.quantity,price:e.price,fee:e.fee,at:e.at,note:'corrected',...change});
it('matches covered shares within the same multi-leg position on assignment and restores them on undo',()=>{
 const {s,id}=setup();const p=s.save(holdingSchema.parse({accountId:id,name:'Covered call',legs:[stock,{...stock,assetType:'OPT',quantity:-1,multiplier:100,expiry:'20261218',right:'C',strike:100,avgCost:3,marketPrice:10}]}));
 s.ledger.act(p,action(s,p,{index:1,quantity:1,kind:'EXERCISE',physicalDelivery:true,price:110,fee:2}));
 expect(s.list().holdings).toHaveLength(1);expect(s.list().holdings[0].active).toBe(0);
 expect(s.ledger.list().events[0].realized.USD).toBe(2298);expect(bal(s,id).cash).toBe(29998);
 s.ledger.undo(id,s.ledger.list().events[0].id);
 expect(s.list().holdings[0].legs.map(l=>l.quantity)).toEqual([100,-1]);expect(bal(s,id).cash).toBe(20000);
});
it('undo preserves refreshed quotes and notes and removes orphan corrections',()=>{
 const {s,id}=setup();const p=add(s,id,stock);s.ledger.act(p,action(s,p,{quantity:40}));
 const e=s.ledger.list().events[0];s.ledger.correctProfit(e.id,{revision:e.revision,currency:'USD',amount:50,note:'adjusted'});
 const h=s.list().holdings[0];s.applyPrices(h,[{price:120,bid:119,ask:121,fetchedAt:new Date().toISOString(),basis:'test',marketDataType:1}]);
 s.ledger.undo(id,e.id);
 expect(s.list().holdings[0].legs[0]).toMatchObject({quantity:100,marketPrice:120,marketValue:12000,unrealizedPnl:4000,bid:119,ask:121});
 expect(s.db.prepare('SELECT COUNT(*) AS n FROM holding_event_corrections').get()).toEqual({n:0});
});
it('uses the same second-resolution date boundary for close and correction',()=>{
 const {s,id}=setup();const p=add(s,id,stock);const at=new Date().toISOString().slice(0,19)+'Z';
 s.ledger.act(p,action(s,p,{at}));const e=s.ledger.list().events[0];
 expect(()=>s.ledger.correctClose(e.id,correction(e,{price:111}))).not.toThrow();
});
it('charges opening and partial-close commissions once across the entire trade',()=>{
 const {s,id}=setup();const p=add(s,id,stock,{entryMode:'TRADE',requestId:randomUUID(),at:new Date().toISOString(),fee:5});
 s.ledger.act(p,action(s,p,{quantity:40,price:110,fee:2}));
 s.ledger.act(p,action(s,p,{quantity:60,price:120,fee:3}));
 expect(s.ledger.list().events.reduce((n,e)=>n+(e.realized.USD??0),0)).toBe(3590);
 expect(bal(s,id).cash).toBe(23590);expect(s.list().holdings[0].active).toBe(0);
});
it('deletes an account and all dependent local records without affecting other accounts',()=>{
 const {s,id}=setup();const other=s.addAccount({broker:'Other',name:'Keep',accountNumber:'',cash:[{currency:'USD',amount:50}]});
 const p=add(s,id,stock),p2=add(s,id,{...stock,symbol:'ABC'});s.group('Strategy',[p,p2]);
 s.ledger.act(p,action(s,p));const e=s.ledger.list().events[0];
 s.ledger.correctProfit(e.id,{revision:e.revision,currency:'USD',amount:100,note:''});
 s.ledger.syncCash(id,[{tag:'CashBalance',currency:'USD',value:'1000'}],new Date().toISOString());
 const keep=JSON.stringify(s.ledger.list().balances.filter((b:any)=>b.accountId===other));
 expect(()=>s.removeAccount(id,'wrong')).toThrow('完整账户名称');expect(s.list().holdings).toHaveLength(2);
 s.removeAccount(id,'Cash');expect(s.list().accounts).toHaveLength(1);expect(s.list().holdings).toHaveLength(0);expect(s.list().groups).toHaveLength(0);
 for(const table of ['holding_events','holding_event_corrections','holding_broker_cash','holding_baseline_lots','holding_group_members'])expect(s.db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get()).toEqual({n:0});
 expect(JSON.stringify(s.ledger.list().balances.filter((b:any)=>b.accountId===other))).toBe(keep);
 expect(s.db.pragma('foreign_key_check')).toEqual([]);expect(()=>s.removeAccount(id,'Cash')).toThrow('账户不存在');
});
it('deletes synced accounts locally and permits explicit reimport',()=>{
 const {s}=setup();const id=s.sync('U_DELETE',[],new Date().toISOString());s.ledger.initialize(id,[{currency:'USD',amount:10}]);add(s,id,stock);
 const a=s.list().accounts.find((a:any)=>a.id===id) as any;s.removeAccount(id,a.name);
 expect(s.list().holdings).toHaveLength(0);expect(s.list().accounts.some((a:any)=>a.ibkrAccount==='U_DELETE')).toBe(false);
 s.sync('U_DELETE',[],new Date().toISOString());expect(s.list().accounts.some((a:any)=>a.ibkrAccount==='U_DELETE')).toBe(true);
});
it('reopens fractional remaining shares, replaces profit overrides and keeps undo consistent',()=>{
 const {s,id}=setup();const p=add(s,id,stock);s.ledger.act(p,action(s,p));
 let e=s.ledger.list().events[0];s.ledger.correctProfit(e.id,{revision:e.revision,currency:'USD',amount:12,note:''});
 e=s.ledger.list().events[0];s.ledger.correctClose(e.id,correction(e,{quantity:99.5,price:120,fee:2}));
 expect(bal(s,id).cash).toBe(31938);expect(s.ledger.list().events[0].realized.USD).toBe(3978);
 expect(s.list().holdings[0].legs[0].quantity).toBe(.5);expect(s.list().holdings[0].active).toBe(1);
 e=s.ledger.list().events[0];s.ledger.correctClose(e.id,correction(e));expect(bal(s,id).cash).toBe(31938);
 s.ledger.undo(id,e.id);expect(bal(s,id).cash).toBe(20000);expect(s.list().holdings[0].legs[0].quantity).toBe(100);
});
it('corrects short closes with the right cash direction and preserves note-only profit overrides',()=>{
 const {s,id}=setup();const p=add(s,id,{...stock,quantity:-10});s.ledger.act(p,action(s,p,{price:70}));
 let e=s.ledger.list().events[0];s.ledger.correctClose(e.id,correction(e,{quantity:8,price:60,fee:2}));
 expect(bal(s,id).cash).toBe(19518);expect(s.ledger.list().events[0].realized.USD).toBe(158);
 expect(s.list().holdings[0].legs[0].quantity).toBe(-2);
 e=s.ledger.list().events[0];s.ledger.correctProfit(e.id,{revision:e.revision,currency:'USD',amount:123,note:''});
 e=s.ledger.list().events[0];s.ledger.correctClose(e.id,correction(e,{note:'note only'}));expect(s.ledger.list().events[0].realized.USD).toBe(123);
});
it('corrects settlement by difference and rejects quantity changes with later trades',()=>{
 const {s,id}=setup();const p=add(s,id,stock);
 s.ledger.act(p,action(s,p,{quantity:40,price:110,fee:1}));const first=s.ledger.list().events[0];
 s.ledger.act(p,action(s,p,{quantity:60,price:120,fee:2}));
 const cash=bal(s,id).cash,positions=JSON.stringify(s.list().holdings);
 expect(()=>s.ledger.correctClose(first.id,correction(first,{quantity:75}))).toThrow('后续变动');
 expect(()=>s.ledger.correctClose(first.id,correction(first,{at:'2000-01-01T00:00:00Z'}))).toThrow('追踪起点');
 s.ledger.correctClose(first.id,correction(first,{price:111,fee:2}));
 expect(bal(s,id).cash).toBe(cash+39);expect(JSON.stringify(s.list().holdings)).toBe(positions);
 const result=s.ledger.list().events.find(e=>e.id===first.id)!;
 expect(result).toMatchObject({quantity:40,price:111,fee:2});
 expect(result.at).toBe(first.at);expect(result.realized.USD).toBe(1238);
 expect(()=>s.ledger.correctClose(first.id,correction(first))).toThrow('已变更');
 s.ledger.undo(id,s.ledger.list().events[0].id);s.ledger.undo(id,first.id);
 expect(bal(s,id).cash).toBe(20000);expect(s.list().holdings[0].legs[0].quantity).toBe(100);
});
it('edits realized profit independently, including losses and zero, without changing cash or equity PnL',()=>{
 const {s,id}=setup();const p=add(s,id,stock);s.ledger.act(p,action(s,p));
 const before=JSON.stringify(s.list().holdings),cash=bal(s,id).cash,total=equity(s,id)-bal(s,id).baseline;
 const e=s.ledger.list().events[0];
 s.ledger.correctProfit(e.id,{revision:e.revision,currency:'USD',amount:-123.45,note:'adjusted'});
 expect(s.ledger.list().events[0].realized.USD).toBe(-123.45);
 expect(bal(s,id).cash).toBe(cash);expect(equity(s,id)-bal(s,id).baseline).toBe(total);
 expect(JSON.stringify(s.list().holdings)).toBe(before);
 expect(()=>s.ledger.correctProfit(e.id,{revision:e.revision,currency:'USD',amount:100,note:''})).toThrow('已变更');
 s.ledger.correctProfit(e.id,{revision:e.revision+1,currency:'USD',amount:0,note:''});
 expect(s.ledger.list().events[0].realized.USD).toBe(0);expect(bal(s,id,'CAD').cash).toBe(5000);
});
it('deleting removes the latest reported profit, not cash or positions, and rejects later profit edits',()=>{
 const {s,id}=setup();const p=add(s,id,stock);s.ledger.act(p,action(s,p));const e=s.ledger.list().events[0];
 s.ledger.correctProfit(e.id,{revision:e.revision,currency:'USD',amount:123,note:''});
 const cash=bal(s,id).cash;s.ledger.deleteClose(e.id,e.revision+1);
 expect(s.ledger.list().events.filter(e=>e.kind==='CLOSE'&&!e.closedDeleted)).toHaveLength(0);
 expect(s.list().holdings[0].active).toBe(0);expect(bal(s,id).cash).toBe(cash);
 expect(s.ledger.list().events[0].realized.USD).toBe(0);
 expect(()=>s.ledger.undo(id,e.id)).toThrow('手动添加');
 expect(()=>s.ledger.correctProfit(e.id,{revision:e.revision+2,currency:'USD',amount:99,note:''})).toThrow('已删除');
 expect(s.db.prepare('SELECT COUNT(*) AS n FROM holding_event_corrections').get()).toEqual({n:2});
});
it('deleting a loss removes it from reported PnL without creating income or changing another account',()=>{
 const {s,id}=setup();const other=s.addAccount({broker:'Other',name:'Other',accountNumber:'',cash:[{currency:'USD',amount:50}]});
 const p=add(s,id,stock);s.ledger.act(p,action(s,p,{price:70,fee:2}));const e=s.ledger.list().events[0];
 expect(e.realized.USD).toBe(-1002);const cash=bal(s,id).cash;
 s.ledger.deleteClose(e.id,e.revision);
 expect(s.ledger.list().events[0].realized.USD).toBe(0);expect(bal(s,id).cash).toBe(cash);expect(bal(s,other).cash).toBe(50);
});
it('supports manual trades in IBKR accounts without overwriting broker cash or manual positions on sync',()=>{
 const {s}=setup();const id=s.sync('U_TEST',[],new Date().toISOString());s.ledger.initialize(id,[{currency:'USD',amount:20000}]);
 s.ledger.syncCash(id,[{tag:'CashBalance',currency:'USD',value:'20000'}],new Date().toISOString());
 const p=add(s,id,stock,{entryMode:'TRADE',requestId:randomUUID(),at:new Date().toISOString(),fee:2});
 expect(bal(s,id).localCash).toBe(-8002);
 s.sync('U_TEST',[],new Date().toISOString());expect(s.list().holdings.find(h=>h.id===p)!.active).toBe(1);
 s.ledger.act(p,action(s,p,{price:110,fee:1}));const e=s.ledger.list().events[0];
 expect(bal(s,id).localCash).toBe(2997);
 s.ledger.correctClose(e.id,correction(e,{price:111}));expect(bal(s,id).localCash).toBe(3097);
 s.ledger.syncCash(id,[{tag:'CashBalance',currency:'USD',value:'21000'}],new Date().toISOString());
 expect(bal(s,id).localCash).toBe(3097);expect((s.ledger.list().brokerCash[0] as any).cash).toBe(21000);
 s.ledger.undo(id,e.id);expect(bal(s,id).localCash).toBe(-8002);
 s.ledger.undo(id,s.ledger.list().events[0].id);expect(bal(s,id).localCash).toBe(0);
});
it('validates fractional stock closes but requires whole option contract counts in archive corrections',()=>{
 const {s,id}=setup();const p=add(s,id,{...stock,assetType:'OPT',quantity:-2,multiplier:100,expiry:'20261218',right:'P',strike:100,avgCost:3,marketPrice:2});
 s.ledger.act(p,action(s,p,{quantity:1,price:1,fee:1}));const e=s.ledger.list().events[0];
 expect(()=>s.ledger.correctClose(e.id,correction(e,{quantity:.5}))).toThrow('整数');
 expect(()=>correction(e,{price:-1})).toThrow();
 const cash=bal(s,id).cash;
 expect(()=>s.ledger.correctProfit(e.id,{revision:e.revision,currency:'CAD',amount:20,note:''})).toThrow('币种');
 expect(bal(s,id).cash).toBe(cash);
});
it('initializes CAD cash and account equity with fractional stock shares without rounding the quantity',()=>{
 const {s}=setup();const id=s.addAccount({broker:'Demo',name:'Fractional CAD',accountNumber:''});
 const p=add(s,id,{...stock,currency:'CAD',quantity:12.345678,avgCost:40,marketPrice:50});
 s.ledger.initialize(id,[{currency:'CAD',amount:1000.25}]);
 expect(bal(s,id,'CAD').baseline).toBeCloseTo(1617.5339,8);
 expect(s.list().holdings.find(h=>h.id===p)!.legs[0].quantity).toBe(12.345678);
 s.ledger.correctOpeningCash(id,'CAD',1500.25,1000.25);
 expect(bal(s,id,'CAD').baseline).toBeCloseTo(2117.5339,8);
});

it('applies each asset commission independently and edits without doubling it',()=>{
 const {s,id}=setup();
 const legs=[{...stock,quantity:10},{...stock,symbol:'ABC',quantity:-20}];
 const input=holdingSchema.parse({accountId:id,name:'XYZ / ABC',legs,legFees:[2,6]});
 const p=s.save(input);
 expect(s.list().holdings[0].legs).toMatchObject([{avgCost:80.2,openingCommission:2},{avgCost:79.7,openingCommission:6}]);
 s.save(input,p);
 expect(s.list().holdings[0].legs).toMatchObject([{avgCost:80.2,openingCommission:2},{avgCost:79.7,openingCommission:6}]);
 expect(bal(s,id).cash).toBe(20000);
 expect(s.ledger.list().events).toHaveLength(0);
});
it('deducts asset trade fees exactly once and retains their allocation',()=>{
 const {s,id}=setup();
 const input=holdingSchema.parse({accountId:id,name:'XYZ / ABC',legs:[{...stock,quantity:10},{...stock,symbol:'ABC',quantity:20}],legFees:[2,6],entryMode:'TRADE',requestId:randomUUID(),at:new Date().toISOString()});
 const p=s.save(input);expect(s.save(input)).toBe(p);
 expect(bal(s,id).cash).toBe(17592);
 expect(s.ledger.list().events[0].realized.USD).toBe(-8);
 expect(s.list().holdings[0].legs).toMatchObject([{avgCost:80,tradeCommission:2},{avgCost:80,tradeCommission:6}]);
});
it('rejects mismatched or conflicting commissions without changing holdings or balances',()=>{
 const {s,id}=setup();const before=JSON.stringify(s.list());
 for(const extra of [{legFees:[]},{legFees:[1],fee:1}])expect(()=>add(s,id,stock,extra)).toThrow('逐项佣金');
 expect(()=>add(s,id,{...stock,avgCost:null},{legFees:[1]})).toThrow('单位成本');
 expect(JSON.stringify(s.list())).toBe(before);
});
