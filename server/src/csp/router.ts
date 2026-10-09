import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { db } from '../db.js';
import { readIbkrSnapshot } from '../ibkr.js';
import { VERSION, configSchema, reviewSchema, accountSchema, parameterFields, metricFields, checkFields, poolNames, type Config, type Review, type Run, type Account, type Snapshot } from './schema.js';
import { evaluateStock } from './rules.js';
import { technical } from './technical.js';
import { ibkrSnapshot, secData } from './sources.js';

db.exec(`CREATE TABLE IF NOT EXISTS csp_settings (id TEXT PRIMARY KEY, body TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS csp_reviews (symbol TEXT PRIMARY KEY, body TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS csp_runs (id TEXT PRIMARY KEY, created_at TEXT NOT NULL, body TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS csp_audit (id INTEGER PRIMARY KEY AUTOINCREMENT, saved_at TEXT NOT NULL, kind TEXT NOT NULL, body TEXT NOT NULL);`);
const get=<T>(id:string,fallback:T):T=>{const row=db.prepare('SELECT body FROM csp_settings WHERE id=?').get(id) as {body:string}|undefined;return row?JSON.parse(row.body):fallback;};
const save=(id:string,value:unknown)=>{db.prepare('INSERT OR REPLACE INTO csp_settings VALUES (?,?)').run(id,JSON.stringify(value));};
const audit=(kind:string,value:unknown)=>db.prepare('INSERT INTO csp_audit(saved_at,kind,body) VALUES (?,?,?)').run(new Date().toISOString(),kind,JSON.stringify(value));
const config=()=>configSchema.parse(get('config',configSchema.parse({})));
const reviews=()=>Object.fromEntries((db.prepare('SELECT symbol,body FROM csp_reviews').all() as {symbol:string;body:string}[]).map(x=>[x.symbol,JSON.parse(x.body) as Review]));
const persist=(run:Run)=>db.prepare('INSERT OR REPLACE INTO csp_runs VALUES (?,?,?)').run(run.id,run.createdAt,JSON.stringify(run));
let active:{run:Run;controller:AbortController}|null=null;
const unfinished=db.prepare("SELECT id,body FROM csp_runs").all() as {id:string;body:string}[];
for(const saved of unfinished){const run=JSON.parse(saved.body) as Run;if(run.status==='running'){run.status='failed';run.finishedAt=new Date().toISOString();run.errors.push('服务重启中断了扫描，请重新启动');persist(run);}}

export const cspRouter=Router();
cspRouter.use((_req,res,next)=>{res.set('Cache-Control','no-store');next();});
cspRouter.get('/state',(_req,res)=>{
  const runs=(db.prepare('SELECT id,body FROM csp_runs ORDER BY created_at DESC LIMIT 20').all() as {id:string;body:string}[]).map(x=>{const r=JSON.parse(x.body) as Run;return {id:r.id,createdAt:r.createdAt,status:r.status,mode:r.mode,total:r.total,done:r.done};});
  res.json({config:config(),reviews:reviews(),account:get<Account|null>('account',null),runs,activeId:active?.run.id??null,version:VERSION,parameterFields,metricFields,checkFields,poolNames});
});
cspRouter.post('/config',(req,res)=>{const parsed=configSchema.safeParse(req.body);if(!parsed.success){res.status(400).json({error:parsed.error.issues.map(x=>x.message).join('；')});return;}parsed.data.symbols=[...new Set(parsed.data.symbols)];save('config',parsed.data);audit('config',parsed.data);res.json(parsed.data);});
cspRouter.post('/reviews/:symbol',(req,res)=>{const parsed=reviewSchema.safeParse({...req.body,symbol:req.params.symbol});if(!parsed.success){res.status(400).json({error:parsed.error.issues.map(x=>`${x.path.join('.')}: ${x.message}`).join('；')});return;}const value={...parsed.data,reviewedAt:new Date().toISOString()};db.prepare('INSERT OR REPLACE INTO csp_reviews VALUES (?,?)').run(value.symbol,JSON.stringify(value));audit('review',value);res.json(value);});
cspRouter.post('/account',(req,res)=>{const parsed=accountSchema.safeParse(req.body);if(!parsed.success){res.status(400).json({error:'请检查账户数字、时间及持仓格式'});return;}save('account',parsed.data);audit('account',parsed.data);res.json(parsed.data);});
cspRouter.post('/account/import',async(_req,res)=>{
  try{
    const data=await readIbkrSnapshot('') as {baseCurrency:string;fields:{tag:string;currency:string;value:string}[];positions:{symbol:string;secType:string;quantity:number;strike:number;multiplier:number;marketValue:number|null;expiry:string;right:string;currency:string}[]};
    const field=(tag:string)=>{const v=data.fields.find(x=>x.tag===tag&&x.currency==='USD');if(!v)return null;const n=Number(v.value);return Number.isFinite(n)?n:null;};
    const r=reviews(),nonUsd=data.positions.some(p=>p.currency!=='USD');
    const account:Account={nav:data.baseCurrency==='USD'?field('NetLiquidation'):null,cash:field('SettledCash'),cashConfirmed:false,exposuresConfirmed:false,asOf:new Date().toISOString(),source:`IBKR；USD研究。${nonUsd?'含非USD持仓，须换算并补齐。':''}`,positions:data.positions.filter(p=>p.currency==='USD').map(p=>({symbol:p.symbol,sector:r[p.symbol]?.sector??'',marketValue:p.secType==='STK'?(p.marketValue??0):0,putObligation:p.secType==='OPT'&&p.right==='P'&&p.quantity<0&&p.strike&&p.multiplier?Math.abs(p.quantity)*p.strike*p.multiplier:0,expiry:p.expiry?`${p.expiry.slice(0,4)}-${p.expiry.slice(4,6)}-${p.expiry.slice(6,8)}`:'',highRisk:false}))};
    save('account',account);res.json(account);
  }catch(e){res.status(503).json({error:e instanceof Error?e.message:'账户读取失败'});}
});
const runSchema=z.object({mode:z.enum(['stocks','options']),symbols:z.array(z.string().regex(/^[A-Z][A-Z0-9.-]{0,15}$/)).min(1).max(30).optional()});
cspRouter.post('/runs',(req,res)=>{
  if(active){res.status(409).json({error:'已有扫描运行中',id:active.run.id});return;}
  const parsed=runSchema.safeParse(req.body);if(!parsed.success){res.status(400).json({error:'扫描参数无效'});return;}
  const cfg=config();if(parsed.data.symbols)cfg.symbols=[...new Set(parsed.data.symbols)];if(!cfg.symbols.length){res.status(400).json({error:'请先设置股票池'});return;}
  const run:Run={id:randomUUID(),createdAt:new Date().toISOString(),finishedAt:null,status:'running',stage:'准备市场数据',done:0,total:cfg.symbols.length,mode:parsed.data.mode,config:cfg,account:get('account',null),market:{spy:null,vix:null,vix3m:null},results:[],errors:[],version:VERSION};
  const controller=new AbortController();active={run,controller};persist(run);res.status(202).json({id:run.id});void execute(run,controller,reviews());
});
cspRouter.get('/runs/:id',(req,res)=>{const row=db.prepare('SELECT body FROM csp_runs WHERE id=?').get(req.params.id) as {body:string}|undefined;if(!row){res.status(404).json({error:'扫描记录不存在'});return;}res.json(JSON.parse(row.body));});
cspRouter.post('/runs/:id/cancel',(req,res)=>{if(active?.run.id!==req.params.id){res.status(409).json({error:'该扫描已结束'});return;}active.controller.abort();res.json({ok:true});});
cspRouter.post('/runs/:id/reevaluate',(req,res)=>{
  if(active){res.status(409).json({error:'扫描中，请完成或取消后重算'});return;}
  const row=db.prepare('SELECT body FROM csp_runs WHERE id=?').get(req.params.id) as {body:string}|undefined;if(!row){res.status(404).json({error:'扫描不存在'});return;}
  const old=JSON.parse(row.body) as Run,cfg=config(),r=reviews(),now=new Date().toISOString(),account=get<Account|null>('account',null);
  const run:Run={...old,id:randomUUID(),createdAt:now,finishedAt:now,status:'complete',stage:'使用原行情快照重新评估',config:cfg,account,version:VERSION,results:old.results.map(item=>({...evaluateStock(item.snapshot,r[item.symbol]??item.review,cfg.params,old.market,account,null,now),publicData:item.publicData,errors:[...item.errors,'仅重算：行情时间未更新；F池行业数据需重新扫描']}))};persist(run);res.json({id:run.id});
});
async function execute(run:Run,controller:AbortController,reviewMap:Record<string,Review>){
  const signal=controller.signal;
  try{
    for(const symbol of ['SPY','^VIX','^VIX3M']){
      if(signal.aborted)break;run.stage=`市场状态 · ${symbol}`;persist(run);
      try{const s=await ibkrSnapshot(symbol,'stocks',run.config.params,signal);if(symbol==='SPY')run.market.spy=technical(s.bars);else run.market[symbol==='^VIX'?'vix':'vix3m']=s.spot;}catch(e){run.errors.push(`${symbol}: ${e instanceof Error?e.message:'读取失败'}`);}
    }
    const industryCache=new Map<string,ReturnType<typeof technical>>();
    for(const symbol of run.config.symbols){
      if(signal.aborted)break;run.stage=`${symbol} · ${run.mode==='options'?'读取真实 Put 合约':'读取日线和公开申报'}`;persist(run);
      const r=reviewMap[symbol]??reviewSchema.parse({symbol});let snapshot:Snapshot|null=null;const errors:string[]=[];
      try{snapshot=await ibkrSnapshot(symbol,run.mode,run.config.params,signal);}catch(e){errors.push(e instanceof Error?e.message:'IBKR读取失败');}
      if(signal.aborted)break;
      const publicData=await secData(symbol,run.config.secContact,signal);
      if(r.industryEtf&&!industryCache.has(r.industryEtf))try{const s=await ibkrSnapshot(r.industryEtf,'stocks',run.config.params,signal);industryCache.set(r.industryEtf,technical(s.bars));}catch(e){errors.push(`行业基准：${e instanceof Error?e.message:'读取失败'}`);}
      const result=evaluateStock(snapshot,r,run.config.params,run.market,run.account,industryCache.get(r.industryEtf)??null,new Date().toISOString());
      result.errors.push(...errors,...publicData.errors);result.publicData=publicData;run.results.push(result);run.done++;persist(run);
    }
    run.status=signal.aborted?'cancelled':run.results.some(r=>r.snapshot)?'complete':'failed';
  }catch(error){run.status=signal.aborted?'cancelled':'failed';run.errors.push(error instanceof Error?error.message:'扫描失败');}
  finally{run.finishedAt=new Date().toISOString();run.stage=run.status==='complete'?'扫描完成':run.status==='cancelled'?'扫描已取消':'扫描失败';persist(run);if(active?.run.id===run.id)active=null;}
}
process.once('exit',()=>active?.controller.abort());
for(const signal of ['SIGINT','SIGTERM'] as const)process.once(signal,()=>active?.controller.abort());
