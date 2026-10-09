import type Database from 'better-sqlite3';
import {z} from 'zod';
export const brokerExecutionSchema=z.object({
 execId:z.string().min(1).max(160),account:z.string().min(1),at:z.string().datetime({offset:true}),
 conId:z.number().int().positive(),symbol:z.string().min(1),localSymbol:z.string(),assetType:z.string(),
 currency:z.string().regex(/^[A-Z]{3}$/),side:z.enum(['BOT','SLD']),quantity:z.number().finite().positive(),price:z.number().finite(),
 expiry:z.string(),right:z.string(),strike:z.number().finite().nullable(),multiplier:z.number().finite().positive().nullable(),
 commission:z.number().finite().nullable(),reportCurrency:z.string().regex(/^[A-Z]{3}$/).nullable(),realizedPnl:z.number().finite().nullable(),
});
export type BrokerExecution=z.infer<typeof brokerExecutionSchema>;
// IB corrections share all execId segments except the final numeric revision.
function identity(id:string){const m=/^(.*\.)(\d+)$/.exec(id);return m?{key:m[1],revision:Number(m[2])}:{key:id,revision:0};}
export function createBrokerExecutions(db:Database.Database){
 db.exec(`CREATE TABLE IF NOT EXISTS holding_broker_executions(id INTEGER PRIMARY KEY,account_id INTEGER NOT NULL REFERENCES holding_accounts(id) ON DELETE CASCADE,execution_key TEXT NOT NULL,revision INTEGER NOT NULL,payload TEXT NOT NULL,synced_at TEXT NOT NULL,UNIQUE(account_id,execution_key));`);
 const sync=db.transaction((accountId:number,rows:BrokerExecution[],at:string)=>{
  const account=db.prepare('SELECT ibkr_account FROM holding_accounts WHERE id=?').get(accountId) as {ibkr_account:string}|undefined;
  if(!account?.ibkr_account)throw new Error('IBKR account required');
  for(const input of rows){
   const row=brokerExecutionSchema.parse(input);
   if(row.account!==account.ibkr_account)throw new Error('Execution account mismatch');
   // BAG totals and their component fills must never both contribute P&L.
   if(row.assetType==='BAG')continue;
   const {key,revision}=identity(row.execId);
   const prior=db.prepare('SELECT revision,payload FROM holding_broker_executions WHERE account_id=? AND execution_key=?').get(accountId,key) as {revision:number;payload:string}|undefined;
   if(prior&&prior.revision>revision)continue;
   if(prior?.revision===revision){const old=JSON.parse(prior.payload) as BrokerExecution;
    if(row.reportCurrency===null&&old.reportCurrency!==null){row.reportCurrency=old.reportCurrency;row.commission=old.commission;row.realizedPnl=old.realizedPnl;}
   }
   db.prepare('INSERT INTO holding_broker_executions(account_id,execution_key,revision,payload,synced_at) VALUES(?,?,?,?,?) ON CONFLICT(account_id,execution_key) DO UPDATE SET revision=excluded.revision,payload=excluded.payload,synced_at=excluded.synced_at').run(accountId,key,revision,JSON.stringify(row),at);
  }
 });
 function list(){return (db.prepare('SELECT id,account_id,payload FROM holding_broker_executions ORDER BY id DESC').all() as {id:number;account_id:number;payload:string}[]).map(r=>{
  const x=JSON.parse(r.payload) as BrokerExecution;
  return {id:-r.id,accountId:r.account_id,kind:'IBKR_TRADE',source:'IBKR',at:x.at,executionId:x.execId,
   asset:{symbol:x.symbol,assetType:x.assetType,currency:x.currency,expiry:x.expiry,right:x.right,strike:x.strike,multiplier:x.multiplier,conId:x.conId,quantity:x.side==='BOT'?x.quantity:-x.quantity},
   positionName:x.localSymbol,quantity:x.side==='BOT'?x.quantity:-x.quantity,price:x.price,fee:x.commission??undefined,
   cash:{},realized:x.realizedPnl!==null&&x.reportCurrency?{[x.reportCurrency]:x.realizedPnl}:{},
   pnlPending:x.realizedPnl===null,revision:0,closedDeleted:false};
 });}
 return {sync,list};
}
