import {expect,it} from 'vitest';
import Database from 'better-sqlite3';
import {createBrokerExecutions,type BrokerExecution} from './ibkr-executions';
const row:BrokerExecution={execId:'abc.01',account:'U1',at:'2026-10-08T16:55:13Z',conId:12,symbol:'CLS',localSymbol:'CLS P380',assetType:'OPT',currency:'USD',side:'BOT',quantity:1,price:26,expiry:'20261009',right:'P',strike:380,multiplier:100,commission:.0333,reportCurrency:'USD',realizedPnl:-1792.0833};
function setup(){const db=new Database(':memory:');db.exec("PRAGMA foreign_keys=ON;CREATE TABLE holding_accounts(id INTEGER PRIMARY KEY,ibkr_account TEXT);INSERT INTO holding_accounts VALUES(1,'U1'),(2,'U2');");return {db,store:createBrokerExecutions(db)};}
it('persists broker net P&L once without subtracting fees or changing cash',()=>{
 const {db,store}=setup();store.sync(1,[row,{...row,execId:'def.01',symbol:'HUT',realizedPnl:-371.8337,commission:.7833}],row.at);
 store.sync(1,[row],row.at);store.sync(1,[],row.at);
 expect(store.list()).toHaveLength(2);expect(store.list().reduce((s,e)=>s+(e.realized.USD??0),0)).toBeCloseTo(-2163.917,6);
 expect(store.list().every(e=>e.id<0&&e.source==='IBKR'&&Object.keys(e.cash).length===0)).toBe(true);db.close();
});
it('does not fabricate P&L before commission report arrives and fills it on the next sync',()=>{
 const {db,store}=setup();store.sync(1,[{...row,commission:null,reportCurrency:null,realizedPnl:null}],row.at);
 expect(store.list()[0]).toMatchObject({realized:{},pnlPending:true});store.sync(1,[row],row.at);
 store.sync(1,[{...row,commission:null,reportCurrency:null,realizedPnl:null}],row.at);
 expect(store.list()[0].realized.USD).toBe(row.realizedPnl);db.close();
});
it('replaces corrected execution rather than double counting; ignores older revisions',()=>{
 const {db,store}=setup();store.sync(1,[row,{...row,execId:'abc.02',realizedPnl:0}],row.at);store.sync(1,[row],row.at);
 expect(store.list()).toHaveLength(1);expect(store.list()[0].realized.USD).toBe(0);db.close();
});
it('separates accounts and currencies, rolls back wrong-account input and ignores combination aggregate fills',()=>{
 const {db,store}=setup();store.sync(1,[row,{...row,execId:'bag.01',assetType:'BAG'}],row.at);
 store.sync(2,[{...row,account:'U2',currency:'CAD',reportCurrency:'CAD',realizedPnl:5}],row.at);
 expect(store.list()).toHaveLength(2);expect(store.list().find(e=>e.accountId===2)?.realized).toEqual({CAD:5});
 expect(()=>store.sync(1,[{...row,execId:'new.01'},{...row,account:'U2'}],row.at)).toThrow('mismatch');expect(store.list()).toHaveLength(2);
 db.prepare('DELETE FROM holding_accounts WHERE id=1').run();expect(store.list()).toHaveLength(1);db.close();
});
