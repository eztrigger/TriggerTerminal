import { Router } from 'express';
import Database from 'better-sqlite3';
import { join } from 'node:path';
import { z } from 'zod';
import { dataDir } from './db.js';
import { quoteHoldings } from './holdings-quotes.js';
import { readIbkrSnapshot } from './ibkr.js';
import {strategyIds} from './strategy-catalog.js';
import { createLedger, cashSchema, actionSchema, flowSchema, closeCorrectionSchema,profitCorrectionSchema } from './holdings-ledger.js';

const text=z.string().trim().min(1).max(100);
const nullableNumber=z.number().finite().nullable();
const date=z.string().regex(/^\d{8}$/).refine(s=>{const d=new Date(s.slice(0,4)+'-'+s.slice(4,6)+'-'+s.slice(6,8)+'T00:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10).replaceAll('-','')===s;},'无效到期日');
export const legSchema=z.object({
 openingCommission:z.number().finite().nonnegative().optional(),
 notes:z.string().max(2000).optional(),
 symbol:text,assetType:z.enum(['STK','ETF','FUND','OPT','FUT','FOP','CASH','OTHER']),
 quantity:z.number().finite().refine(n=>n!==0,'数量不能为零'),multiplier:z.number().finite().positive().nullable(),
 currency:z.string().trim().min(1).max(12).transform(s=>s.toUpperCase()),
 expiry:z.union([date,z.literal('')]).default(''),right:z.enum(['C','P','']).default(''),
 strike:nullableNumber.default(null),avgCost:nullableNumber.default(null),marketPrice:nullableNumber.default(null),
 exchange:z.string().max(40).optional(),primaryExchange:z.string().max(40).optional(),contractName:z.string().max(200).optional(),
 bid:nullableNumber.optional(),ask:nullableNumber.optional(),quoteAt:z.string().optional(),quoteBasis:z.string().optional(),marketDataType:nullableNumber.optional(),bidAskAt:z.string().optional(),bidAskType:nullableNumber.optional(),
 conId:z.number().int().positive().optional(),marketValue:nullableNumber.optional(),unrealizedPnl:nullableNumber.optional(),
}).superRefine((l,c)=>{
 if(['OPT','FOP'].includes(l.assetType)&&(!l.expiry||!l.right||l.strike===null||l.strike<0||!Number.isInteger(l.quantity)))
  c.addIssue({code:'custom',message:'期权需要有效到期日、Call/Put、行权价和整数张数'});
});
const strategySchema=z.string().refine(id=>strategyIds.has(id),'Invalid strategy classification');
export const holdingSchema=z.object({strategyId:strategySchema.optional(),accountId:z.number().int().positive(),name:text,notes:z.string().max(2000).default(''),legs:z.array(legSchema).min(1).max(64),entryMode:z.enum(['INITIAL','TRADE']).default('INITIAL'),requestId:z.string().uuid().optional(),at:z.string().datetime().optional(),fee:z.number().finite().nonnegative().default(0)});
const accountSchema=z.object({broker:text,name:text,accountNumber:z.string().trim().max(100).default(''),cash:cashSchema.optional()});
export function createHoldingsStore(path:string){
 const db=new Database(path);db.pragma('journal_mode = WAL');db.pragma('foreign_keys = ON');
 db.exec(`CREATE TABLE IF NOT EXISTS holding_accounts(id INTEGER PRIMARY KEY,broker TEXT NOT NULL,name TEXT NOT NULL,account_number TEXT NOT NULL DEFAULT '',ibkr_account TEXT UNIQUE,last_sync TEXT);
 CREATE TABLE IF NOT EXISTS holding_positions(id INTEGER PRIMARY KEY,account_id INTEGER NOT NULL REFERENCES holding_accounts(id),name TEXT NOT NULL,notes TEXT NOT NULL DEFAULT '',source TEXT NOT NULL,external_key TEXT,legs TEXT NOT NULL,active INTEGER NOT NULL DEFAULT 1,updated_at TEXT NOT NULL,UNIQUE(account_id,source,external_key));`);
 db.exec(`CREATE TABLE IF NOT EXISTS holding_groups(id INTEGER PRIMARY KEY,name TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS holding_group_members(position_id INTEGER PRIMARY KEY REFERENCES holding_positions(id),group_id INTEGER NOT NULL REFERENCES holding_groups(id) ON DELETE CASCADE);`);
 for(const table of ['holding_positions','holding_groups'])if(!(db.prepare('PRAGMA table_info('+table+')').all() as {name:string}[]).some(c=>c.name==='strategy_id'))db.exec('ALTER TABLE '+table+" ADD COLUMN strategy_id TEXT NOT NULL DEFAULT 'custom'");
 const ledger=createLedger(db);
 const addGroupMembers=db.transaction((groupId:number,ids:number[])=>{
  if(!db.prepare('SELECT 1 FROM holding_groups WHERE id=?').get(groupId))throw new Error('组合不存在');
  const members=db.prepare('SELECT position_id FROM holding_group_members WHERE group_id=?').all(groupId) as {position_id:number}[];
  const all=[...new Set([...members.map(m=>m.position_id),...ids])];
  if(!ids.length||new Set(ids).size!==ids.length||all.length>64)throw new Error('请选择仓位，组合最多包含 64 项');
  const rows=all.map(id=>db.prepare('SELECT account_id,active FROM holding_positions WHERE id=?').get(id) as any);
  if(rows.some(r=>!r)||ids.some(id=>!(db.prepare('SELECT active FROM holding_positions WHERE id=?').get(id) as any)?.active))throw new Error('请选择有效的当前仓位');
  for(const id of ids){
   const member=db.prepare('SELECT group_id FROM holding_group_members WHERE position_id=?').get(id) as {group_id:number}|undefined;
   if(member&&member.group_id!==groupId)throw new Error('部分仓位已属于其他组合，请先解除分组');
   db.prepare('INSERT OR IGNORE INTO holding_group_members(position_id,group_id) VALUES(?,?)').run(id,groupId);
  }
 });
 const removeGroupMember=db.transaction((groupId:number,positionId:number)=>{
  const result=db.prepare('DELETE FROM holding_group_members WHERE group_id=? AND position_id=?').run(groupId,positionId);
  if(!result.changes)throw new Error('仓位不属于此策略组');
  db.prepare('DELETE FROM holding_groups WHERE id=? AND NOT EXISTS (SELECT 1 FROM holding_group_members WHERE group_id=?)').run(groupId,groupId);
 });
 const group=db.transaction((name:string,ids:number[])=>{
  const rows=ids.map(id=>db.prepare('SELECT account_id,active FROM holding_positions WHERE id=?').get(id) as any);
  if(rows.some(r=>!r||!r.active))throw new Error('请选择有效的当前仓位');
  if(ids.some(id=>db.prepare('SELECT 1 FROM holding_group_members WHERE position_id=?').get(id)))throw new Error('部分仓位已属于其他组合，请先解除分组');
  const id=Number(db.prepare('INSERT INTO holding_groups(name) VALUES(?)').run(name).lastInsertRowid);
  for(const position of ids)db.prepare('INSERT INTO holding_group_members(position_id,group_id) VALUES(?,?)').run(position,id);
  return id;
 });
 const list=()=>({groups:db.prepare('SELECT id,name,strategy_id AS strategyId FROM holding_groups ORDER BY id').all().map((g:any)=>({...g,positionIds:db.prepare('SELECT position_id FROM holding_group_members WHERE group_id=?').all(g.id).map((m:any)=>m.position_id)})),accounts:db.prepare('SELECT id,broker,name,account_number AS accountNumber,ibkr_account AS ibkrAccount,last_sync AS lastSync FROM holding_accounts ORDER BY id').all(),holdings:db.prepare('SELECT id,account_id AS accountId,name,notes,source,active,updated_at AS updatedAt,strategy_id AS strategyId,legs FROM holding_positions ORDER BY id DESC').all().map((r:any)=>({...r,legs:JSON.parse(r.legs)}))});
 const addAccount=db.transaction((value:z.infer<typeof accountSchema>)=>{const id=Number(db.prepare('INSERT INTO holding_accounts(broker,name,account_number) VALUES(?,?,?)').run(value.broker,value.name,value.accountNumber).lastInsertRowid);if(value.cash)ledger.initialize(id,value.cash);return id;});
 const save=db.transaction((value:z.infer<typeof holdingSchema>,id?:number)=>{
  if(!db.prepare('SELECT id FROM holding_accounts WHERE id=?').get(value.accountId))throw new Error('账户不存在');
  if(id){
   const row:any=db.prepare('SELECT source,account_id FROM holding_positions WHERE id=?').get(id);
   if(!row||row.source!=='MANUAL')throw new Error('只能编辑手动仓位，IBKR 仓位请通过同步更新');
   ledger.beforeEdit(id);
   if(row.account_id!==value.accountId&&(ledger.tracked(row.account_id)||ledger.tracked(value.accountId)))throw new Error('追踪账户的仓位不能直接转移，请分别记录转出和转入');
   if(row.account_id!==value.accountId&&db.prepare('SELECT 1 FROM holding_group_members WHERE position_id=?').get(id))throw new Error('请先解除策略分组，再更改所属账户');
   db.prepare('UPDATE holding_positions SET account_id=?,name=?,notes=?,legs=?,updated_at=?,strategy_id=COALESCE(?,strategy_id) WHERE id=?').run(value.accountId,value.name,value.notes,JSON.stringify(value.legs),new Date().toISOString(),value.strategyId??null,id);
   ledger.baselineLot(id);
   return id;
  }
  if(value.requestId&&ledger.duplicate(value.requestId,value.accountId)) {
   const prior:any=db.prepare('SELECT payload FROM holding_events WHERE request_id=?').get(value.requestId);
   return JSON.parse(prior.payload).positionId as number;
  }
  if(value.entryMode==='INITIAL'&&value.fee>0) {
   if(new Set(value.legs.map(l=>l.currency)).size!==1||value.legs.some(l=>l.avgCost===null||l.multiplier===null))throw new Error('填写期初佣金时，请按币种分别录入并填写成本和乘数');
   const units=value.legs.reduce((sum,l)=>sum+Math.abs(l.quantity*l.multiplier!),0);
   value={...value,legs:value.legs.map(l=>{const allocated=value.fee*Math.abs(l.quantity*l.multiplier!)/units;return {...l,openingCommission:allocated,avgCost:l.avgCost!+allocated/(l.quantity*l.multiplier!)};})};
  }
  const saved=Number(db.prepare("INSERT INTO holding_positions(account_id,name,notes,source,legs,updated_at) VALUES(?,?,?,'MANUAL',?,?)").run(value.accountId,value.name,value.notes,JSON.stringify(value.legs),new Date().toISOString()).lastInsertRowid);
  if(value.strategyId)db.prepare('UPDATE holding_positions SET strategy_id=? WHERE id=?').run(value.strategyId,saved);
  if(value.entryMode==='TRADE') {if(!value.requestId||!value.at)throw new Error('新增成交需要时间和请求标识');ledger.opened(saved,value.requestId,value.at,value.fee);}else ledger.baselineLot(saved);
  return saved;
 });
 const sync=db.transaction((account:string,positions:any[],at:string)=>{
  db.prepare("INSERT OR IGNORE INTO holding_accounts(broker,name,account_number,ibkr_account) VALUES('IBKR',?,?,?)").run('IBKR '+account[0]+'••••'+account.slice(-3),account,account);
  const a:any=db.prepare('SELECT id FROM holding_accounts WHERE ibkr_account=?').get(account);
  db.prepare("UPDATE holding_positions SET active=0,updated_at=? WHERE account_id=? AND source='IBKR'").run(at,a.id);
  const put=db.prepare("INSERT INTO holding_positions(account_id,name,source,external_key,legs,updated_at) VALUES(?,?,'IBKR',?,?,?) ON CONFLICT(account_id,source,external_key) DO UPDATE SET name=excluded.name,legs=excluded.legs,active=1,updated_at=excluded.updated_at");
  for(const p of positions){
   if(p.quantity===0)continue;
   const previous:any=db.prepare("SELECT legs FROM holding_positions WHERE account_id=? AND source='IBKR' AND external_key=?").get(a.id,String(p.conId));
   const old=previous?JSON.parse(previous.legs)[0]:{};
   const leg={notes:old.notes,bid:old.bid??null,ask:old.ask??null,bidAskAt:old.bidAskAt,bidAskType:old.bidAskType,symbol:p.symbol,assetType:p.secType,quantity:p.quantity,multiplier:['STK','CASH'].includes(p.secType)?1:p.multiplier,currency:p.currency,expiry:p.expiry,right:p.right,strike:p.strike,avgCost:p.unitCost,marketPrice:p.marketPrice,marketValue:p.marketValue,unrealizedPnl:p.unrealizedPnl,conId:p.conId};
   put.run(a.id,p.localSymbol||p.symbol,String(p.conId),JSON.stringify([leg]),at);
  }
  db.prepare('UPDATE holding_accounts SET last_sync=? WHERE id=?').run(at,a.id);
  return a.id as number;
 });
 const applyPrices=db.transaction((original:any, quotes:any[])=>{
  const row:any=db.prepare('SELECT legs,updated_at,active FROM holding_positions WHERE id=?').get(original.id);
  if(!row?.active||row.updated_at!==original.updatedAt||row.legs!==JSON.stringify(original.legs))return 0;
  let updated=0;
  const legs=original.legs.map((leg:any,i:number)=>{
   const q=quotes[i];if(!q||typeof q.price!=='number'||!Number.isFinite(q.price)||q.price<0)return leg;
   updated++;
   const size=typeof leg.multiplier==='number'?leg.quantity*leg.multiplier:null;
   return {...leg,bid:q.bid??null,ask:q.ask??null,bidAskAt:q.fetchedAt,bidAskType:q.marketDataType,marketPrice:q.price,marketValue:size===null?null:q.price*size,
    unrealizedPnl:size===null||leg.avgCost===null?null:(q.price-leg.avgCost)*size,
    quoteAt:q.fetchedAt,quoteBasis:q.basis,marketDataType:q.marketDataType};
  });
  if(updated)db.prepare('UPDATE holding_positions SET legs=?,updated_at=? WHERE id=?').run(JSON.stringify(legs),new Date().toISOString(),original.id);
  return updated;
 });
 const remove=db.transaction((id:number)=>{
  const row:any=db.prepare('SELECT source FROM holding_positions WHERE id=?').get(id);
  if(!row)throw new Error('仓位不存在');
  if(row.source!=='MANUAL')throw new Error('IBKR 同步仓位不能删除，请通过 IBKR 同步更新');
  ledger.beforeRemove(id);
  db.prepare('DELETE FROM holding_group_members WHERE position_id=?').run(id);
  db.prepare('DELETE FROM holding_positions WHERE id=?').run(id);
  db.prepare('DELETE FROM holding_groups WHERE id NOT IN (SELECT group_id FROM holding_group_members)').run();
 });
 const removeAccount=db.transaction((id:number,confirmation:string)=>{
  const row:any=db.prepare('SELECT name FROM holding_accounts WHERE id=?').get(id);
  if(!row)throw new Error('账户不存在');
  if(confirmation!==row.name)throw new Error('请输入完整账户名称以确认删除');
  db.prepare('DELETE FROM holding_event_corrections WHERE event_id IN (SELECT id FROM holding_events WHERE account_id=?)').run(id);
  for(const table of ['holding_events','holding_cash_corrections','holding_balances','holding_broker_cash'])db.prepare(`DELETE FROM ${table} WHERE account_id=?`).run(id);
  const groups=db.prepare('SELECT DISTINCT group_id FROM holding_group_members WHERE position_id IN (SELECT id FROM holding_positions WHERE account_id=?)').all(id) as {group_id:number}[];
  db.prepare('DELETE FROM holding_group_members WHERE position_id IN (SELECT id FROM holding_positions WHERE account_id=?)').run(id);
  db.prepare('DELETE FROM holding_baseline_lots WHERE position_id IN (SELECT id FROM holding_positions WHERE account_id=?)').run(id);
  db.prepare('DELETE FROM holding_positions WHERE account_id=?').run(id);
  for(const g of groups)db.prepare('DELETE FROM holding_groups WHERE id=? AND NOT EXISTS (SELECT 1 FROM holding_group_members WHERE group_id=?)').run(g.group_id,g.group_id);
  db.prepare('DELETE FROM holding_accounts WHERE id=?').run(id);
 });
 return {db,list:()=>({...list(),...ledger.list()}),addAccount,save,sync,group,addGroupMembers,removeGroupMember,applyPrices,remove,removeAccount,ledger};
}
const store=createHoldingsStore(join(dataDir,'holdings.db'));
const snapshotSchema=z.object({connected:z.literal(true),positionsComplete:z.literal(true),account:z.string().min(1),syncedAt:z.string(),fields:z.array(z.object({tag:z.string(),currency:z.string(),value:z.string()})).default([]),positions:z.array(z.object({
 conId:z.number().int().positive(),symbol:text,localSymbol:z.string(),secType:z.string(),quantity:z.number().finite(),multiplier:nullableNumber,currency:text,expiry:z.string(),right:z.string(),strike:nullableNumber,unitCost:nullableNumber,marketPrice:nullableNumber,marketValue:nullableNumber,unrealizedPnl:nullableNumber
}))});
export const holdingsRouter=Router();
holdingsRouter.use((_q,r,n)=>{r.set('Cache-Control','no-store');n();});
holdingsRouter.get('/',(_q,r)=>r.json(store.list()));
holdingsRouter.post('/accounts/:id/initialize',(q,r)=>{
 const p=cashSchema.safeParse(q.body.cash);if(!p.success){r.status(400).json({error:'请填写有效的分币种剩余现金'});return;}
 try{r.json(store.ledger.initialize(Number(q.params.id),p.data));}catch(e){r.status(400).json({error:(e as Error).message});}
});
holdingsRouter.post('/accounts/:id/cash',(q,r)=>{
 const p=flowSchema.safeParse(q.body);if(!p.success){r.status(400).json({error:'资金记录无效'});return;}
 try{store.ledger.flow(Number(q.params.id),p.data);r.json({ok:true});}catch(e){r.status(400).json({error:(e as Error).message});}
});
holdingsRouter.post('/accounts/:id/opening-cash',(q,r)=>{
 const p=z.object({currency:z.string().regex(/^[A-Z]{3}$/),amount:z.number().finite(),expected:z.number().finite()}).safeParse(q.body);
 if(!p.success){r.status(400).json({error:'请填写有效的初始现金'});return;}
 try{store.ledger.correctOpeningCash(Number(q.params.id),p.data.currency,p.data.amount,p.data.expected);r.json({ok:true});}catch(e){r.status(400).json({error:(e as Error).message});}
});
holdingsRouter.post('/accounts/:id/current-cash',(q,r)=>{
 const p=z.object({currency:z.string().regex(/^[A-Z]{3}$/),amount:z.number().finite(),expected:z.number().finite()}).safeParse(q.body);
 if(!p.success){r.status(400).json({error:'请填写有效的当前现金'});return;}
 try{store.ledger.correctCurrentCash(Number(q.params.id),p.data.currency,p.data.amount,p.data.expected);r.json({ok:true});}catch(e){r.status(400).json({error:(e as Error).message});}
});
holdingsRouter.post('/positions/:id/transaction',(q,r)=>{
 const p=actionSchema.safeParse(q.body);if(!p.success){r.status(400).json({error:'请填写有效数量、价格、费用和成交时间'});return;}
 try{store.ledger.act(Number(q.params.id),p.data);r.json({ok:true});}catch(e){r.status(400).json({error:(e as Error).message});}
});
holdingsRouter.post('/accounts/:id/undo',(q,r)=>{
 const p=z.object({eventId:z.number().int().positive()}).safeParse(q.body);if(!p.success){r.status(400).json({error:'记录无效'});return;}
 try{store.ledger.undo(Number(q.params.id),p.data.eventId);r.json({ok:true});}catch(e){r.status(400).json({error:(e as Error).message});}
});
holdingsRouter.put('/closed-trades/:id',(q,r)=>{
 const p=closeCorrectionSchema.safeParse(q.body);
 if(!p.success){r.status(400).json({error:'平仓更正信息无效'});return;}
 try{store.ledger.correctClose(Number(q.params.id),p.data);r.json({ok:true});}catch(e){r.status(400).json({error:(e as Error).message});}
});
holdingsRouter.delete('/closed-trades/:id',(q,r)=>{
 const p=z.object({revision:z.number().int().nonnegative()}).safeParse(q.body);
 if(!p.success){r.status(400).json({error:'平仓更正信息无效'});return;}
 try{store.ledger.deleteClose(Number(q.params.id),p.data.revision);r.json({ok:true});}catch(e){r.status(400).json({error:(e as Error).message});}
});
holdingsRouter.put('/profit-records/:id',(q,r)=>{
 const p=profitCorrectionSchema.safeParse(q.body);
 if(!p.success){r.status(400).json({error:'盈利更正信息无效'});return;}
 try{store.ledger.correctProfit(Number(q.params.id),p.data);r.json({ok:true});}catch(e){r.status(400).json({error:(e as Error).message});}
});
holdingsRouter.post('/accounts',(q,r)=>{
 const p=accountSchema.extend({cash:cashSchema}).safeParse(q.body);if(!p.success){r.status(400).json({error:'请输入账户信息及各币种剩余现金'});return;}
 try{r.status(201).json({id:store.addAccount(p.data)});}catch(e){r.status(400).json({error:(e as Error).message});}
});
holdingsRouter.put('/accounts/:id',(q,r)=>{
 const p=accountSchema.safeParse(q.body);if(!p.success){r.status(400).json({error:'账户信息无效'});return;}
 const row:any=store.db.prepare('SELECT ibkr_account FROM holding_accounts WHERE id=?').get(q.params.id);
 if(!row){r.status(404).json({error:'账户不存在'});return;}
 store.db.prepare('UPDATE holding_accounts SET broker=?,name=?,account_number=? WHERE id=?').run(p.data.broker,p.data.name,row.ibkr_account??p.data.accountNumber,q.params.id);
 r.json({ok:true});
});
holdingsRouter.delete('/accounts/:id',(q,r)=>{
 const p=z.object({confirmation:z.string().min(1).max(100)}).safeParse(q.body);
 const id=Number(q.params.id);
 if(!p.success||!Number.isSafeInteger(id)||id<=0){r.status(400).json({error:'请输入完整账户名称以确认删除'});return;}
 try{store.removeAccount(id,p.data.confirmation);r.json({ok:true});}catch(e){r.status(400).json({error:(e as Error).message});}
});
for(const method of ['post','put'] as const)holdingsRouter[method](method==='post'?'/positions':'/positions/:id',(q,r)=>{
 const p=holdingSchema.safeParse(q.body);if(!p.success){r.status(400).json({error:p.error.issues.map(i=>i.message).join('；')});return;}
 try{r.json({id:store.save(p.data,method==='put'?Number((q.params as {id:string}).id):undefined)});}catch(e){r.status(400).json({error:(e as Error).message});}
});
holdingsRouter.post('/positions/:id/status',(q,r)=>{
 r.status(400).json({error:'归档已停用，请填写实际成交进行平仓'});
});
holdingsRouter.post('/sync',(q,r,next)=>{void(async()=>{
 const account=typeof q.body.account==='string'?q.body.account:'';
 const snap=snapshotSchema.parse(await readIbkrSnapshot(account));
 if(account&&snap.account!==account)throw new Error('账户不匹配，未更新本地仓位');
 const accountId=store.db.transaction(()=>{const id=store.sync(snap.account,snap.positions,snap.syncedAt);store.ledger.syncCash(id,snap.fields,snap.syncedAt);return id;})();
 r.json({accountId,count:snap.positions.length,syncedAt:snap.syncedAt});
})().catch(e=>r.status(503).json({error:e instanceof Error?e.message:'IBKR 同步失败，本地数据未修改'}));});

const groupSchema=z.object({name:text,strategyId:strategySchema.default('custom'),positionIds:z.array(z.number().int().positive()).min(2).max(64)}).refine(v=>new Set(v.positionIds).size===v.positionIds.length);
holdingsRouter.delete('/groups/:id/members/:positionId',(q,r)=>{
 const id=Number(q.params.id),positionId=Number(q.params.positionId);
 if(!Number.isSafeInteger(id)||id<=0||!Number.isSafeInteger(positionId)||positionId<=0){r.status(400).json({error:'仓位不属于此策略组'});return;}
 try{store.removeGroupMember(id,positionId);r.json({ok:true});}catch(e){r.status(400).json({error:(e as Error).message});}
});
holdingsRouter.post('/groups/:id/members',(q,r)=>{
 const p=z.object({positionIds:z.array(z.number().int().positive()).min(1).max(64)}).safeParse(q.body);
 const id=Number(q.params.id);
 if(!p.success||!Number.isSafeInteger(id)||id<=0){r.status(400).json({error:'请选择仓位，组合最多包含 64 项'});return;}
 try{store.addGroupMembers(id,p.data.positionIds);r.json({ok:true});}catch(e){r.status(400).json({error:(e as Error).message});}
});
holdingsRouter.post('/groups',(q,r)=>{
 const p=groupSchema.safeParse(q.body);if(!p.success){r.status(400).json({error:'请输入组合名称并选择至少两项不同仓位'});return;}
 try{const id=store.db.transaction(()=>{const id=store.group(p.data.name,p.data.positionIds);store.db.prepare('UPDATE holding_groups SET strategy_id=? WHERE id=?').run(p.data.strategyId,id);return id;})();r.json({id});}catch(e){r.status(400).json({error:(e as Error).message});}
});
holdingsRouter.delete('/groups/:id',(q,r)=>{store.db.prepare('DELETE FROM holding_groups WHERE id=?').run(q.params.id);r.json({ok:true});});

holdingsRouter.post('/classification',(q,r)=>{
 const p=z.object({kind:z.enum(['position','group']),id:z.number().int().positive(),strategyId:strategySchema}).safeParse(q.body);
 if(!p.success){r.status(400).json({error:'Invalid strategy classification'});return;}
 const table=p.data.kind==='group'?'holding_groups':'holding_positions';
 const result=store.db.prepare('UPDATE '+table+' SET strategy_id=? WHERE id=?').run(p.data.strategyId,p.data.id);
 if(!result.changes){r.status(404).json({error:'Record not found'});return;}r.json({ok:true});
});

let refreshing=false;
holdingsRouter.post('/refresh-prices',(q,r)=>{void(async()=>{
 const p=z.object({accountId:z.number().int().positive().optional()}).safeParse(q.body);
 if(!p.success){r.status(400).json({error:'账户筛选无效'});return;}
 if(refreshing){r.status(409).json({error:'正在刷新报价，请稍候'});return;}
 refreshing=true;
 try {
  const rows=store.list().holdings.filter(h=>h.active&&(!p.data.accountId||h.accountId===p.data.accountId));
  const legs=rows.flatMap(h=>h.legs);
  const quotes:any[]=[];
  for(let i=0;i<legs.length;i+=20){
   try{quotes.push(...await quoteHoldings(legs.slice(i,i+20)) as any[]);}
   catch(e){quotes.push(...legs.slice(i,i+20).map(()=>({error:e instanceof Error?e.message:'报价失败'})));}
  }
  let offset=0,updated=0;
  for(const row of rows){updated+=store.applyPrices(row,quotes.slice(offset,offset+row.legs.length));offset+=row.legs.length;}
  const details=[...new Set(quotes.flatMap((v,i)=>v.error?[`${legs[i].symbol}：${v.error}`]:[]))];
  r.json({updated,skipped:legs.length-updated,details:details.slice(0,8),fetchedAt:new Date().toISOString()});
 } finally {refreshing=false;}
})().catch(e=>r.status(503).json({error:e instanceof Error?e.message:'刷新失败'}));});

holdingsRouter.post('/positions/:id/legs/:index/notes',(q,r)=>{
 const p=z.object({notes:z.string().max(2000),identity:z.string()}).safeParse(q.body);
 const index=Number(q.params.index);
 const row=store.list().holdings.find(h=>h.id===Number(q.params.id));
 if(!p.success||!Number.isSafeInteger(index)||index<0||!row?.legs[index]){r.status(400).json({error:'资产或笔记无效'});return;}
 const leg=row.legs[index];
 const identity=JSON.stringify([leg.conId??null,leg.symbol,leg.assetType,leg.currency,leg.expiry,leg.right,leg.strike,leg.multiplier]);
 if(identity!==p.data.identity){r.status(409).json({error:'资产已变更，请刷新后编辑'});return;}
 row.legs[index]={...leg,notes:p.data.notes};
 store.db.prepare('UPDATE holding_positions SET legs=?,notes=? WHERE id=?').run(JSON.stringify(row.legs),row.legs.length===1?'':row.notes,row.id);
 r.json({ok:true});
});

holdingsRouter.post('/positions/:id/notes',(q,r)=>{
 const p=z.object({notes:z.string().max(2000)}).safeParse(q.body);
 if(!p.success){r.status(400).json({error:'笔记最多 2000 字'});return;}
 const changed=store.db.prepare('UPDATE holding_positions SET notes=? WHERE id=?').run(p.data.notes,q.params.id);
 if(!changed.changes){r.status(404).json({error:'仓位不存在'});return;}
 r.json({ok:true});
});

holdingsRouter.delete('/positions/:id',(q,r)=>{
 const id=Number(q.params.id);
 if(!Number.isSafeInteger(id)||id<1){r.status(400).json({error:'无效仓位'});return;}
 try{store.remove(id);r.json({ok:true});}catch(e){r.status(400).json({error:(e as Error).message});}
});
holdingsRouter.post('/quote',(q,r)=>{void(async()=>{
 const p=legSchema.safeParse(q.body);
 if(!p.success){r.status(400).json({error:'请填写有效合约信息'});return;}
 const result=await quoteHoldings([p.data]) as any[];
 if(result[0]?.error){r.status(503).json({error:result[0].error});return;}
 r.json(result[0]);
})().catch(e=>r.status(503).json({error:(e as Error).message}));});
