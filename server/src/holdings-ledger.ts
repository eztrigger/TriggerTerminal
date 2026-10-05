import type Database from 'better-sqlite3';
import { z } from 'zod';

const currency = z.string().trim().regex(/^[A-Za-z]{3}$/).transform(v => v.toUpperCase());
export const cashSchema = z.array(z.object({ currency, amount: z.number().finite() })).min(1).max(20)
  .refine(rows => new Set(rows.map(r => r.currency)).size === rows.length);
const when = z.string().datetime().refine(v => Date.parse(v) <= Date.now() + 60000);
export const actionSchema = z.object({
  requestId: z.string().uuid(), expectedLegs: z.string(), index: z.number().int().min(0),
  quantity: z.number().finite().positive(), price: z.number().finite().nonnegative(),
  fee: z.number().finite().nonnegative(), at: when,
  kind: z.enum(['CLOSE','EXERCISE']), physicalDelivery: z.boolean().optional(),
});
export const flowSchema = z.object({ requestId:z.string().uuid(),currency,amount:z.number().finite().refine(v=>v!==0),at:when,kind:z.enum(['DEPOSIT','WITHDRAWAL','INCOME','EXPENSE']),note:z.string().max(500).default('') });
export const closeCorrectionSchema=z.object({revision:z.number().int().nonnegative(),quantity:z.number().finite().positive(),price:z.number().finite().nonnegative(),fee:z.number().finite().nonnegative(),at:when,note:z.string().max(2000).default('')});
export const profitCorrectionSchema=z.object({revision:z.number().int().nonnegative(),currency,amount:z.number().finite(),note:z.string().max(2000).default('')});
const stamp = () => new Date().toISOString();
const economic = (s:string) => JSON.stringify(JSON.parse(s).map((l:any)=>[l.symbol,l.assetType,l.quantity,l.multiplier,l.currency,l.expiry,l.right,l.strike,l.avgCost,l.conId??null]));
const money = (n:number) => { if (!Number.isFinite(n) || Math.abs(n)>1e15) throw new Error('金额超出有效范围'); return Math.round(n*1e8)/1e8; };

export function createLedger(db: Database.Database) {
  db.exec(`CREATE TABLE IF NOT EXISTS holding_balances(account_id INTEGER NOT NULL REFERENCES holding_accounts(id),currency TEXT NOT NULL,cash REAL NOT NULL,baseline REAL NOT NULL,flows REAL NOT NULL DEFAULT 0,started_at TEXT NOT NULL,PRIMARY KEY(account_id,currency));
    CREATE TABLE IF NOT EXISTS holding_baseline_lots(position_id INTEGER PRIMARY KEY REFERENCES holding_positions(id),amounts TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS holding_events(id INTEGER PRIMARY KEY,request_id TEXT NOT NULL UNIQUE,account_id INTEGER NOT NULL REFERENCES holding_accounts(id),kind TEXT NOT NULL,at TEXT NOT NULL,created_at TEXT NOT NULL,payload TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS holding_broker_cash(account_id INTEGER NOT NULL REFERENCES holding_accounts(id),currency TEXT NOT NULL,cash REAL NOT NULL,at TEXT NOT NULL,PRIMARY KEY(account_id,currency));`);
  db.transaction(()=>{
    const columns=db.prepare('PRAGMA table_info(holding_balances)').all() as {name:string}[];
    if(!columns.some(c=>c.name==='initial_cash')) {
      db.exec('ALTER TABLE holding_balances ADD COLUMN initial_cash REAL');
      for(const b of db.prepare('SELECT * FROM holding_balances').all() as any[]) {
        const events=db.prepare('SELECT payload FROM holding_events WHERE account_id=?').all(b.account_id) as {payload:string}[];
        const movements=events.reduce((n,e)=>n+Number(JSON.parse(e.payload).cash?.[b.currency]??0),0);
        db.prepare('UPDATE holding_balances SET initial_cash=? WHERE account_id=? AND currency=?').run(money(b.cash-movements),b.account_id,b.currency);
      }
    }
    db.exec('CREATE TABLE IF NOT EXISTS holding_cash_corrections(id INTEGER PRIMARY KEY,account_id INTEGER NOT NULL REFERENCES holding_accounts(id),currency TEXT NOT NULL,previous REAL NOT NULL,amount REAL NOT NULL,at TEXT NOT NULL)');
    if(!(db.prepare('PRAGMA table_info(holding_cash_corrections)').all() as {name:string}[]).some(c=>c.name==='kind'))db.exec("ALTER TABLE holding_cash_corrections ADD COLUMN kind TEXT NOT NULL DEFAULT 'OPENING'");
    if(!columns.some(c=>c.name==='local_cash'))db.exec('ALTER TABLE holding_balances ADD COLUMN local_cash REAL NOT NULL DEFAULT 0');
    const eventColumns=db.prepare('PRAGMA table_info(holding_events)').all() as {name:string}[];
    if(!eventColumns.some(c=>c.name==='revision'))db.exec('ALTER TABLE holding_events ADD COLUMN revision INTEGER NOT NULL DEFAULT 0');
    if(!eventColumns.some(c=>c.name==='closed_deleted'))db.exec('ALTER TABLE holding_events ADD COLUMN closed_deleted INTEGER NOT NULL DEFAULT 0');
    db.exec('CREATE TABLE IF NOT EXISTS holding_event_corrections(id INTEGER PRIMARY KEY,event_id INTEGER NOT NULL,operation TEXT NOT NULL,previous TEXT NOT NULL,at TEXT NOT NULL)');
  })();
  const account = (id:number) => {
    const a:any=db.prepare('SELECT * FROM holding_accounts WHERE id=?').get(id);
    if(!a) throw new Error('账户不存在');
    return a;
  };
  const rows = (id:number):any[] => db.prepare('SELECT * FROM holding_positions WHERE account_id=? ORDER BY id').all(id);
  const tracked = (id:number) => !!db.prepare('SELECT 1 FROM holding_balances WHERE account_id=?').get(id);
  const hasEvents = (id:number) => !!db.prepare('SELECT 1 FROM holding_events WHERE account_id=?').get(id);
  const balance = (id:number,c:string) => {
    if (!db.prepare('SELECT 1 FROM holding_balances WHERE account_id=? AND currency=?').get(id,c)) throw new Error('请先为该币种设置现金和初始资产');
  };
  function values(row:any) {
    const result:Record<string,number>={};
    if(!row.active)return result;
    for(const l of JSON.parse(row.legs)) {
      if(l.quantity===0)continue;
      const v=row.source==='IBKR'?l.marketValue:l.marketPrice===null||l.multiplier===null?null:l.quantity*l.multiplier*l.marketPrice;
      if(typeof v!=='number'||!Number.isFinite(v)) throw new Error('初始持仓缺少估值，请先补充价格和乘数');
      result[l.currency]=money((result[l.currency]??0)+v);
    }
    return result;
  }
  const initialize = db.transaction((id:number,cash:z.infer<typeof cashSchema>)=>{
    const a=account(id);
    if(tracked(id)) throw new Error('账户已开始追踪，现金变动请记录入出金');
    const totals:Record<string,number>={};
    for(const row of rows(id)) {
      const v=values(row);
      for(const [c,n] of Object.entries(v)) totals[c]=money((totals[c]??0)+n);
      if(row.active&&row.source==='MANUAL') db.prepare('INSERT OR REPLACE INTO holding_baseline_lots VALUES(?,?)').run(row.id,JSON.stringify(v));
    }
    if(Object.keys(totals).some(c=>!cash.some(v=>v.currency===c))) throw new Error('请填写所有持仓币种的剩余现金');
    const at=stamp();
    for(const c of cash) db.prepare('INSERT INTO holding_balances(account_id,currency,cash,baseline,started_at,initial_cash) VALUES(?,?,?,?,?,?)').run(id,c.currency,c.amount,money(c.amount+(totals[c.currency]??0)),at,c.amount);
    return {broker:!!a.ibkr_account};
  });
  function baselineLot(id:number) {
    const row:any=db.prepare('SELECT * FROM holding_positions WHERE id=?').get(id);
    if(!tracked(row.account_id))return;
    if(hasEvents(row.account_id))throw new Error('追踪开始后请通过成交记录改变数量和成本');
    const old:any=db.prepare('SELECT amounts FROM holding_baseline_lots WHERE position_id=?').get(id);
    const previous=old?JSON.parse(old.amounts):{};
    const next=values(row);
    for(const c of new Set([...Object.keys(previous),...Object.keys(next)])) {
      balance(row.account_id,c);
      db.prepare('UPDATE holding_balances SET baseline=baseline+? WHERE account_id=? AND currency=?').run(money((next[c]??0)-(previous[c]??0)),row.account_id,c);
    }
    db.prepare('INSERT OR REPLACE INTO holding_baseline_lots VALUES(?,?)').run(id,JSON.stringify(next));
  }
  const eventRows = (id:number):any[] => db.prepare('SELECT * FROM holding_events WHERE account_id=? ORDER BY id DESC').all(id);
  function checkDate(id:number,at:string) {
    const starts:any[]=db.prepare('SELECT started_at FROM holding_balances WHERE account_id=?').all(id);
    if(!starts.length)throw new Error('请先设置账户剩余现金并开始追踪');
    const latest=eventRows(id)[0];
    if(!Number.isFinite(Date.parse(at))||Date.parse(at)>Date.now()+60000||Date.parse(at)<Math.max(...starts.map(x=>Math.floor(Date.parse(x.started_at)/1000)*1000),latest?Date.parse(latest.at):0)) throw new Error('成交时间不能早于追踪起点或最近一笔记录');
  }
  function addEvent(id:number,kind:string,at:string,requestId:string,payload:any) {
    db.prepare('INSERT INTO holding_events(request_id,account_id,kind,at,created_at,payload) VALUES(?,?,?,?,?,?)').run(requestId,id,kind,at,stamp(),JSON.stringify(payload));
  }
  function changeCash(id:number,changes:Record<string,number>,flow=false,manualTrade=false) {
    const overlay=manualTrade&&!!account(id).ibkr_account;
    for(const [c,n] of Object.entries(changes)) { balance(id,c); db.prepare('UPDATE holding_balances SET cash=cash+?,flows=flows+?,local_cash=local_cash+? WHERE account_id=? AND currency=?').run(money(n),flow?money(n):0,overlay?money(n):0,id,c); }
  }
  const duplicate = (requestId:string,id:number) => {
    const row:any=db.prepare('SELECT account_id FROM holding_events WHERE request_id=?').get(requestId);
    if(row&&row.account_id!==id)throw new Error('重复请求无效');
    return !!row;
  };
  const flow=db.transaction((id:number,input:z.infer<typeof flowSchema>)=>{
    const a=account(id); if(duplicate(input.requestId,id))return;
    if(a.ibkr_account&&!['DEPOSIT','WITHDRAWAL'].includes(input.kind))throw new Error('IBKR 收支以券商记录为准');
    checkDate(id,input.at);
    const amount=money(Math.abs(input.amount)*(['WITHDRAWAL','EXPENSE'].includes(input.kind)?-1:1));
    const cash={[input.currency]:amount};
    const external=['DEPOSIT','WITHDRAWAL'].includes(input.kind);
    changeCash(id,cash,external);
    addEvent(id,input.kind,input.at,input.requestId,{cash,external,realized:external?{}:cash,note:input.note,before:[],after:[],created:[]});
  });
  function updateLegs(row:any,legs:any[]) {
    db.prepare('UPDATE holding_positions SET legs=?,active=?,updated_at=? WHERE id=?').run(JSON.stringify(legs),legs.some(l=>l.quantity!==0)?1:0,stamp(),row.id);
  }
  function fresh(l:any,quantity:number,price:number|null=l.marketPrice) {
    return {...l,quantity,marketPrice:price,marketValue:price===null?null:quantity*l.multiplier*price,unrealizedPnl:price===null||l.avgCost===null?null:quantity*l.multiplier*(price-l.avgCost)};
  }
  const act=db.transaction((positionId:number,input:z.infer<typeof actionSchema>)=>{
    const row:any=db.prepare('SELECT * FROM holding_positions WHERE id=?').get(positionId);
    if(!row||row.source!=='MANUAL')throw new Error('券商持仓请以实际成交同步为准，不能本地平仓或行权');
    if(duplicate(input.requestId,row.account_id))return;
    checkDate(row.account_id,input.at);
    if(!row.active||economic(row.legs)!==economic(input.expectedLegs))throw new Error('持仓已更新，请刷新后重新确认');
    const legs=JSON.parse(row.legs); const l=legs[input.index];
    if(!l||!l.quantity||input.quantity>Math.abs(l.quantity)||l.avgCost===null||l.multiplier===null)throw new Error('平仓数量、成本或乘数无效');
    if(!['STK','ETF','FUND','OPT'].includes(l.assetType))throw new Error('该资产暂不支持自动现金记账');
    if(l.assetType==='OPT'&&!Number.isInteger(input.quantity))throw new Error('期权数量必须为整数');
    const signed=Math.sign(l.quantity)*input.quantity;
    const scale=signed*l.multiplier;
    const before=[row]; const created:number[]=[];
    const cash:Record<string,number>={}; const realized:Record<string,number>={};
    let delivery:any=null;
    if(input.kind==='CLOSE') {
      cash[l.currency]=money(scale*input.price-input.fee);
      realized[l.currency]=money(scale*(input.price-l.avgCost)-input.fee);
    } else {
      if(l.assetType!=='OPT'||!['C','P'].includes(l.right)||l.strike===null||!input.physicalDelivery||['SPX','SPXW','XSP','NDX','RUT','MRUT','VIX','NANOS'].includes(l.symbol.toUpperCase()))throw new Error('仅支持已确认交割股数等于合约乘数的实物交割股票期权');
      const direction=l.right==='C'?1:-1;
      const shares=money(scale*direction);
      const effective=money(l.strike+direction*l.avgCost);
      cash[l.currency]=money(-shares*l.strike-input.fee);
      realized[l.currency]=-input.fee;
      let remaining=shares;
      // FIFO matching uses separate tax lots and only compatible manual stock positions.
      for(const stock of rows(row.account_id)) {
        if(!remaining||!stock.active||stock.source!=='MANUAL')continue;
        const stockLegs=stock.id===row.id?legs:JSON.parse(stock.legs);let touched=false;
        for(let i=0;i<stockLegs.length&&remaining;i++) {
          const s=stockLegs[i];
          if(!['STK','ETF'].includes(s.assetType)||s.symbol!==l.symbol||s.currency!==l.currency||s.multiplier!==1||s.quantity*remaining>=0)continue;
          if(s.avgCost===null)throw new Error('被交割股票缺少成本，不能计算盈亏');
          const n=Math.min(Math.abs(remaining),Math.abs(s.quantity));
          realized[l.currency]=money(realized[l.currency]+Math.sign(s.quantity)*n*(effective-s.avgCost));
          stockLegs[i]=fresh(s,money(s.quantity+Math.sign(remaining)*n),input.price);
          remaining=money(remaining-Math.sign(remaining)*n);touched=true;
        }
        if(touched&&stock.id!==row.id){before.push(stock);updateLegs(stock,stockLegs);}
      }
      if(remaining) {
        const stock={symbol:l.symbol,assetType:'STK',quantity:remaining,multiplier:1,currency:l.currency,expiry:'',right:'',strike:null,avgCost:effective,marketPrice:input.price,notes:l.notes??''};
        const id=Number(db.prepare("INSERT INTO holding_positions(account_id,name,notes,source,legs,updated_at) VALUES(?,?,'','MANUAL',?,?)").run(row.account_id,l.symbol,JSON.stringify([stock]),stamp()).lastInsertRowid);
        created.push(id);
      }
      delivery={symbol:l.symbol,shares,strike:l.strike,effectivePrice:effective,remaining};
    }
    legs[input.index]=fresh(l,money(l.quantity-signed));
    updateLegs(row,legs);
    changeCash(row.account_id,cash,false,true);
    const ids=[...before.map(r=>r.id),...created];
    const after=ids.map(id=>db.prepare('SELECT * FROM holding_positions WHERE id=?').get(id));
    addEvent(row.account_id,input.kind,input.at,input.requestId,{positionId,index:input.index,asset:l,quantity:input.quantity,price:input.kind==='EXERCISE'?l.strike:input.price,stockMark:input.kind==='EXERCISE'?input.price:null,fee:input.fee,cash,realized,before,after,created,delivery});
  });
  function opened(id:number,requestId:string,at:string,fee:number) {
    const row:any=db.prepare('SELECT * FROM holding_positions WHERE id=?').get(id);
    checkDate(row.account_id,at);
    const legs=JSON.parse(row.legs);
    if(new Set(legs.map((l:any)=>l.currency)).size!==1)throw new Error('新增成交请按币种分别录入');
    const cash:Record<string,number>={};
    for(const l of legs) {
      if(l.avgCost===null||l.multiplier===null||!['STK','ETF','FUND','OPT'].includes(l.assetType))throw new Error('新增成交需要有效成本、乘数和支持的资产类型');
      cash[l.currency]=money((cash[l.currency]??0)-l.quantity*l.multiplier*l.avgCost);
    }
    const c=legs[0].currency;cash[c]=money(cash[c]-fee);
    changeCash(row.account_id,cash,false,true);
    addEvent(row.account_id,'OPEN',at,requestId,{positionId:id,asset:legs.length===1?legs[0]:{symbol:legs.map((l:any)=>l.symbol).join(' / ')},quantity:legs.length===1?legs[0].quantity:null,price:legs.length===1?legs[0].avgCost:null,cash,realized:{[c]:-fee},before:[],after:[row],created:[id],fee});
  }
  const undo=db.transaction((id:number,eventId:number)=>{
    const latest=eventRows(id)[0];
    if(!latest||latest.id!==eventId)throw new Error('只能撤销账户最近一笔记录');
    if(latest.closed_deleted)throw new Error('该平仓记录已删除，恢复持仓请手动添加');
    const p=JSON.parse(latest.payload);
    for(const expected of p.after) {
      const current:any=db.prepare('SELECT * FROM holding_positions WHERE id=?').get(expected.id);
      if(!current||economic(current.legs)!==economic(expected.legs))throw new Error('关联持仓已改变，无法撤销');
    }
    changeCash(id,Object.fromEntries(Object.entries(p.cash).map(([c,n])=>[c,-Number(n)])),!!p.external,['OPEN','CLOSE','EXERCISE'].includes(latest.kind));
    for(const row of p.before) {
      const current:any=db.prepare('SELECT legs FROM holding_positions WHERE id=?').get(row.id);
      const notes=JSON.parse(current.legs);
      // Restore economics, but keep current quotes and asset notes.
      const restored=JSON.parse(row.legs).map((l:any,i:number)=>{
        const current=notes[i];if(!current)return l;
        const result={...l,notes:current.notes??l.notes};
        for(const key of ['marketPrice','bid','ask','quoteAt','quoteBasis','marketDataType','bidAskAt','bidAskType'])if(Object.hasOwn(current,key))result[key]=current[key];
        return fresh(result,l.quantity);
      });
      db.prepare('UPDATE holding_positions SET legs=?,active=?,updated_at=? WHERE id=?').run(JSON.stringify(restored),row.active,stamp(),row.id);
    }
    for(const position of p.created) {db.prepare('DELETE FROM holding_group_members WHERE position_id=?').run(position);db.prepare('DELETE FROM holding_positions WHERE id=?').run(position);}
    db.prepare('DELETE FROM holding_event_corrections WHERE event_id=?').run(eventId);
    db.prepare('DELETE FROM holding_events WHERE id=?').run(eventId);
    db.prepare('DELETE FROM holding_groups WHERE id NOT IN (SELECT group_id FROM holding_group_members)').run();
  });
  function closeEvent(id:number,revision:number) {
    const event:any=db.prepare("SELECT * FROM holding_events WHERE id=? AND kind='CLOSE'").get(id);
    if(!event||event.closed_deleted)throw new Error('平仓记录不存在或已删除');
    if(event.revision!==revision)throw new Error('平仓记录已变更，请刷新后重试');
    return event;
  }
  const correctClose=db.transaction((id:number,input:z.infer<typeof closeCorrectionSchema>)=>{
    const event=closeEvent(id,input.revision),p=JSON.parse(event.payload);
    if(p.asset.assetType==='OPT'&&!Number.isInteger(input.quantity))throw new Error('期权数量必须为整数');
    db.prepare('INSERT INTO holding_event_corrections(event_id,operation,previous,at) VALUES(?,?,?,?)').run(id,'UPDATE_RECORD',JSON.stringify(event),stamp());
    const history=eventRows(event.account_id);
    const prior=history.filter(e=>e.id<id),later=history.filter(e=>e.id>id);
    const start=db.prepare('SELECT MAX(started_at) AS at FROM holding_balances WHERE account_id=?').get(event.account_id) as any;
    if(Date.parse(input.at)<Math.floor(Date.parse(start.at)/1000)*1000||prior.some(e=>Date.parse(e.at)>Date.parse(input.at))||later.some(e=>Date.parse(e.at)<Date.parse(input.at)))throw new Error('更正时间不能改变账户成交顺序或早于追踪起点');
    if(input.quantity!==p.quantity) {
      const current:any=db.prepare('SELECT * FROM holding_positions WHERE id=?').get(p.positionId);
      const expected=p.after.find((r:any)=>r.id===p.positionId);
      if(!current||!expected||economic(current.legs)!==economic(expected.legs)||later.some(e=>JSON.parse(e.payload).after.some((r:any)=>r.id===p.positionId)))throw new Error('关联持仓已有后续变动，不能修改此笔平仓数量');
      if(input.quantity>Math.abs(p.asset.quantity))throw new Error('平仓数量不能超过当时持仓数量');
      const legs=JSON.parse(current.legs);
      legs[p.index]=fresh(legs[p.index],money(p.asset.quantity-Math.sign(p.asset.quantity)*input.quantity));
      updateLegs(current,legs);
      p.after=p.after.map((r:any)=>r.id===p.positionId?db.prepare('SELECT * FROM holding_positions WHERE id=?').get(p.positionId):r);
    }
    const c=p.asset.currency,scale=Math.sign(p.asset.quantity)*input.quantity*p.asset.multiplier;
    const cash=money(scale*input.price-input.fee),realized=money(scale*(input.price-p.asset.avgCost)-input.fee);
    changeCash(event.account_id,{[c]:money(cash-p.cash[c])},false,true);
    const economicsChanged=input.quantity!==p.quantity||input.price!==p.price||input.fee!==p.fee;
    if(economicsChanged){delete p.realizedOverride;delete p.profitNotes;}
    delete p.record;
    const {revision,...record}=input;
    db.prepare('UPDATE holding_events SET at=?,payload=?,revision=revision+1 WHERE id=?').run(input.at,JSON.stringify({...p,...record,cash:{[c]:cash},realized:{[c]:realized}}),id);
  });
  const correctProfit=db.transaction((id:number,input:z.infer<typeof profitCorrectionSchema>)=>{
    const event:any=db.prepare('SELECT * FROM holding_events WHERE id=?').get(id);
    if(!event)throw new Error('盈利记录不存在');
    if(event.closed_deleted)throw new Error('平仓记录已删除，其盈亏已剔除');
    if(event.revision!==input.revision)throw new Error('盈利记录已变更，请刷新后重试');
    const p=JSON.parse(event.payload);
    if(!Object.hasOwn(p.realized,input.currency))throw new Error('盈利记录币种无效');
    const realizedOverride={...(p.realizedOverride??p.realized),[input.currency]:money(input.amount)};
    const profitNotes={...p.profitNotes,[input.currency]:input.note};
    db.prepare('INSERT INTO holding_event_corrections(event_id,operation,previous,at) VALUES(?,?,?,?)').run(id,'UPDATE_PROFIT',JSON.stringify(event),stamp());
    db.prepare('UPDATE holding_events SET payload=?,revision=revision+1 WHERE id=?').run(JSON.stringify({...p,realizedOverride,profitNotes}),id);
  });
  const deleteClose=db.transaction((id:number,revision:number)=>{
    const event=closeEvent(id,revision);
    const payload=JSON.parse(event.payload);
    // Cash settlement is immutable here; only reported realized P&L is removed.
    const realizedOverride=Object.fromEntries(Object.keys(payload.realized).map(c=>[c,0]));
    db.prepare('INSERT INTO holding_event_corrections(event_id,operation,previous,at) VALUES(?,?,?,?)').run(id,'DELETE',JSON.stringify(event),stamp());
    db.prepare('UPDATE holding_events SET payload=?,closed_deleted=1,revision=revision+1 WHERE id=?').run(JSON.stringify({...payload,realizedOverride}),id);
  });
  function beforeEdit(id:number) {
    const row:any=db.prepare('SELECT account_id FROM holding_positions WHERE id=?').get(id);
    if(row&&tracked(row.account_id)&&hasEvents(row.account_id))throw new Error('已有成交记录，数量和成本不能直接编辑；请先撤销相关记录');
  }
  function beforeRemove(id:number) {
    const row:any=db.prepare('SELECT account_id FROM holding_positions WHERE id=?').get(id);
    if(!row)return;
    if(eventRows(row.account_id).some(e=>JSON.parse(e.payload).after.some((r:any)=>r.id===id)))throw new Error('此仓位有关联成交，请先撤销相关记录再删除');
    const lot:any=db.prepare('SELECT amounts FROM holding_baseline_lots WHERE position_id=?').get(id);
    if(lot)for(const [c,v] of Object.entries(JSON.parse(lot.amounts)))db.prepare('UPDATE holding_balances SET baseline=baseline-? WHERE account_id=? AND currency=?').run(v,row.account_id,c);
    db.prepare('DELETE FROM holding_baseline_lots WHERE position_id=?').run(id);
  }
  function syncCash(id:number,fields:Array<{tag:string;currency:string;value:string}>,at:string) {
    const cash=fields.filter(v=>v.tag==='CashBalance'&&/^[A-Z]{3}$/.test(v.currency)&&v.currency!=='BASE'&&v.value.trim()!==''&&Number.isFinite(Number(v.value)));
    db.prepare('DELETE FROM holding_broker_cash WHERE account_id=?').run(id);
    for(const c of cash)db.prepare('INSERT OR REPLACE INTO holding_broker_cash VALUES(?,?,?,?)').run(id,c.currency,Number(c.value),at);
  }
  const correctOpeningCash=db.transaction((id:number,c:string,amount:number,expected:number)=>{
    account(id);
    const b:any=db.prepare('SELECT * FROM holding_balances WHERE account_id=? AND currency=?').get(id,c);
    if(!b)throw new Error('请先为该币种设置现金和初始资产');
    if(b.initial_cash!==expected)throw new Error('初始现金已变更，请刷新后重试');
    const next=money(amount),delta=money(next-b.initial_cash);
    if(!delta)return;
    db.prepare('UPDATE holding_balances SET initial_cash=?,cash=?,baseline=? WHERE account_id=? AND currency=?').run(next,money(b.cash+delta),money(b.baseline+delta),id,c);
    db.prepare('INSERT INTO holding_cash_corrections(account_id,currency,previous,amount,at) VALUES(?,?,?,?,?)').run(id,c,b.initial_cash,next,stamp());
  });
  const correctCurrentCash=db.transaction((id:number,c:string,amount:number,expected:number)=>{
    if(account(id).ibkr_account)throw new Error('券商现金以同步为准，不能直接更正');
    const b:any=db.prepare('SELECT * FROM holding_balances WHERE account_id=? AND currency=?').get(id,c);
    if(!b)throw new Error('请先为该币种设置现金和初始资产');
    if(b.cash!==expected)throw new Error('当前现金已变更，请刷新后重试');
    const next=money(amount),delta=money(next-b.cash);
    if(!delta)return;
    // A balance correction is neither investment income nor an external transfer.
    db.prepare('UPDATE holding_balances SET cash=?,baseline=baseline+? WHERE account_id=? AND currency=?').run(next,delta,id,c);
    db.prepare('INSERT INTO holding_cash_corrections(account_id,currency,previous,amount,at,kind) VALUES(?,?,?,?,?,?)').run(id,c,b.cash,next,stamp(),'CURRENT');
  });
  function list() {
    const events=(db.prepare('SELECT * FROM holding_events ORDER BY id DESC').all() as any[]).map(e=>{
      const p=JSON.parse(e.payload),{before,after,...details}=p;
      return {id:e.id,accountId:e.account_id,kind:e.kind,at:e.at,...details,realized:p.realizedOverride??p.realized,revision:e.revision,closedDeleted:!!e.closed_deleted,positionName:before?.find((r:any)=>r.id===p.positionId)?.name??after?.find((r:any)=>r.id===p.positionId)?.name??''};
    });
    return {
      balances:db.prepare('SELECT account_id AS accountId,currency,cash,local_cash AS localCash,initial_cash AS initialCash,baseline,flows,started_at AS startedAt FROM holding_balances').all(),
      brokerCash:db.prepare('SELECT account_id AS accountId,currency,cash,at FROM holding_broker_cash').all(),
      events,
    };
  }
  return {initialize,tracked,baselineLot,beforeEdit,beforeRemove,opened,act,flow,undo,list,syncCash,duplicate,correctOpeningCash,correctCurrentCash,correctClose,correctProfit,deleteClose};
}
