import Database from 'better-sqlite3';
import {randomUUID,createHash} from 'node:crypto';
import {chmodSync,existsSync} from 'node:fs';
import {z} from 'zod';
import {D,amount,accountSchema,positionSchema,commandSchema,closeSchema,flowSchema,summarize,type CryptoAccount,type CryptoPosition,type CryptoEvent} from './schema.js';
import {walletSchema,type WalletSnapshot,type Wallet} from './wallets.js';

type State={account:CryptoAccount;positions:CryptoPosition[];events:CryptoEvent[]};
export function createCryptoStore(path:string){
 const db=new Database(path);if(path!==':memory:')chmodSync(path,0o600);db.pragma('journal_mode=WAL');
 db.exec(`CREATE TABLE IF NOT EXISTS crypto_accounts(id INTEGER PRIMARY KEY AUTOINCREMENT,state TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS crypto_requests(id TEXT PRIMARY KEY,hash TEXT NOT NULL,result TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS crypto_wallets(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,network TEXT NOT NULL,address TEXT NOT NULL,snapshot TEXT,error TEXT,UNIQUE(network,address));`);
 if(path!==':memory:')for(const file of [path+'-wal',path+'-shm'])if(existsSync(file))chmodSync(file,0o600);
 const read=(id:number):State=>{const row=db.prepare('SELECT state FROM crypto_accounts WHERE id=?').get(id) as {state:string}|undefined;if(!row)throw Error('Account not found');return JSON.parse(row.state);};
 const write=(s:State)=>{db.prepare('UPDATE crypto_accounts SET state=? WHERE id=?').run(JSON.stringify(s),s.account.id);};
 const mutate=db.transaction((accountId:number,command:z.infer<typeof commandSchema>,body:unknown,fn:(s:State)=>unknown)=>{
  const hash=createHash('sha256').update(JSON.stringify({accountId,body})).digest('hex');
  const prior=db.prepare('SELECT hash,result FROM crypto_requests WHERE id=?').get(command.requestId) as {hash:string;result:string}|undefined;
  if(prior){if(prior.hash!==hash)throw Error('Request identifier was reused');return JSON.parse(prior.result);}
  const s=read(accountId);if(s.account.revision!==command.revision)throw Error('Account changed; refresh and try again');
  const result=fn(s)??{ok:true};s.account.revision++;write(s);
  db.prepare('INSERT INTO crypto_requests VALUES(?,?,?)').run(command.requestId,hash,JSON.stringify(result));return result;
 });
 function event(s:State,v:Omit<CryptoEvent,'id'|'accountId'>){s.events.push({id:randomUUID(),accountId:s.account.id,...v});s.account.cash[v.currency]=new D(s.account.cash[v.currency]).plus(v.cashDelta).toFixed();if(new D(s.account.cash[v.currency]).lt(0))throw Error('Insufficient cash balance');}
 const addAccount=db.transaction((input:unknown)=>{
  const value=accountSchema.parse(input),id=Number(db.prepare("INSERT INTO crypto_accounts(state) VALUES('{}')").run().lastInsertRowid);
  write({account:{id,...value,revision:0,since:new Date().toISOString()},positions:[],events:[]});return {id};
 });
 function addPosition(input:unknown){
  const value=positionSchema.and(commandSchema).parse(input);
  return mutate(value.accountId,value,value,s=>{
   const {requestId,revision,at,...position}=value;
   const p:CryptoPosition={...position,id:randomUUID(),openedAt:at,quoteAt:position.markPrice===null?null:at,priceSource:position.markPrice===null?'':'MANUAL'};
   const capital=p.kind==='SPOT'?new D(p.quantity).mul(p.entryPrice):new D(p.margin);
   // Existing holdings are a snapshot; account cash is the currently unreserved balance.
   const delta=value.mode==='TRADE'?capital.plus(p.fee).neg():new D(0);
   s.positions.push(p);event(s,{kind:value.mode==='TRADE'?'OPEN':'EXISTING',at,currency:p.currency,cashDelta:delta.toFixed(),realized:value.mode==='TRADE'?new D(p.fee).neg().toFixed():'0',notes:p.notes,symbol:p.symbol,quantity:p.quantity,price:p.entryPrice,fee:p.fee});return {id:p.id};
  });
 }
 function close(accountId:number,id:string,input:unknown){
  const v=closeSchema.parse(input);
  return mutate(accountId,v,{id,...v},s=>{
   const p=s.positions.find(p=>p.id===id);if(!p)throw Error('Position not found');
   if(v.at<p.openedAt)throw Error('Close date precedes the position');
   const quantity=new D(v.quantity),original=new D(p.quantity);if(quantity.gt(original))throw Error('Close quantity exceeds position');
   const released=quantity.eq(original)?new D(p.margin):new D(p.margin).mul(quantity).div(original);
   const profit=new D(v.price).minus(p.entryPrice).mul(quantity).mul(p.side==='LONG'?1:-1);
   const delta=p.kind==='SPOT'?quantity.mul(v.price).minus(v.fee):released.plus(profit).minus(v.fee);
   event(s,{kind:'CLOSE',at:v.at,currency:p.currency,cashDelta:delta.toFixed(),realized:profit.minus(v.fee).toFixed(),notes:v.notes,symbol:p.symbol,quantity:v.quantity,price:v.price,fee:v.fee});
   p.quantity=original.minus(quantity).toFixed();p.margin=new D(p.margin).minus(released).toFixed();s.positions=s.positions.filter(p=>new D(p.quantity).gt(0));return {ok:true};
  });
 }
 function flow(accountId:number,input:unknown){const v=flowSchema.parse(input);return mutate(accountId,v,v,s=>{
  const amount=new D(v.amount);if(['DEPOSIT','WITHDRAWAL','FEE'].includes(v.kind)&&amount.lte(0))throw Error('Amount must be positive');
  if(v.kind==='CASH_CORRECTION'&&amount.lt(0))throw Error('Cash cannot be negative');
  const delta=v.kind==='PROFIT_CORRECTION'?new D(0):v.kind==='CASH_CORRECTION'?amount.minus(s.account.cash[v.currency]):['WITHDRAWAL','FEE'].includes(v.kind)?amount.neg():amount;
  const realized=v.kind==='PROFIT_CORRECTION'||v.kind==='FUNDING'?amount:v.kind==='FEE'?amount.neg():new D(0);
  event(s,{kind:v.kind,at:v.at,currency:v.currency,cashDelta:delta.toFixed(),realized:realized.toFixed(),notes:v.notes});return {ok:true};
 });}
 function removePosition(accountId:number,id:string,input:unknown){const v=commandSchema.parse(input);return mutate(accountId,v,{id,...v},s=>{
  const p=s.positions.find(p=>p.id===id);if(!p)throw Error('Position not found');
  if(p.kind!=='SPOT')throw Error('Close derivatives before removing collateral');
  s.positions=s.positions.filter(p=>p.id!==id);event(s,{kind:'REMOVE',at:v.at,currency:p.currency,cashDelta:'0',realized:'0',notes:v.notes,symbol:p.symbol});return {ok:true};
 });}
 const applyPrices=db.transaction((quotes:{id:string;accountId:number;price:string;source:string;at:string;revision:number;quoteAt:string|null}[])=>{
  let updated=0;
  for(const quote of quotes){if(!new D(quote.price).isFinite()||new D(quote.price).lte(0))continue;const s=read(quote.accountId),p=s.positions.find(p=>p.id===quote.id);if(!p||s.account.revision!==quote.revision||p.quoteAt!==quote.quoteAt)continue;p.markPrice=new D(quote.price).toFixed();p.quoteAt=quote.at;p.priceSource=quote.source;write(s);updated++;}
  return updated;
 });
 function mark(accountId:number,id:string,input:unknown){const v=commandSchema.extend({price:amount.refine(v=>new D(v).gte(0))}).parse(input);return mutate(accountId,v,{id,...v},s=>{const p=s.positions.find(p=>p.id===id);if(!p)throw Error('Position not found');p.markPrice=new D(v.price).toFixed();p.quoteAt=v.at;p.priceSource='MANUAL';p.notes=v.notes;return {ok:true};});}
 const list=()=>{const states=(db.prepare('SELECT state FROM crypto_accounts ORDER BY id').all() as {state:string}[]).map(r=>JSON.parse(r.state) as State),accounts=states.map(s=>s.account),positions=states.flatMap(s=>s.positions),events=states.flatMap(s=>s.events).sort((a,b)=>b.at.localeCompare(a.at));return {accounts,positions,events,summaries:summarize(accounts,positions,events)};};
 const wallets=():Wallet[] =>(db.prepare('SELECT * FROM crypto_wallets ORDER BY id').all() as any[]).map(w=>({...w,snapshot:w.snapshot?JSON.parse(w.snapshot):null}));
 const addWallet=(input:unknown)=>{const v=walletSchema.parse(input),address=['solana','bitcoin'].includes(v.network)?v.address:v.address.toLowerCase();const id=Number(db.prepare('INSERT INTO crypto_wallets(name,network,address) VALUES(?,?,?)').run(v.name,v.network,address).lastInsertRowid);return {id};};
 const saveWallet=(id:number,snapshot:WalletSnapshot)=>db.prepare('UPDATE crypto_wallets SET snapshot=?,error=NULL WHERE id=?').run(JSON.stringify(snapshot),id);
 const walletError=(id:number,error:string)=>db.prepare('UPDATE crypto_wallets SET error=? WHERE id=?').run(error,id);
 const removeWallet=(id:number)=>{if(!db.prepare('DELETE FROM crypto_wallets WHERE id=?').run(id).changes)throw Error('Wallet not found');};
 return {db,list,addAccount,addPosition,close,flow,removePosition,mark,applyPrices,wallets,addWallet,saveWallet,walletError,removeWallet};
}
