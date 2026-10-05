import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createInterface } from 'node:readline';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { Router } from 'express';
import { z } from 'zod';
import { dataDir } from './db.js';
import { marketSource } from './market-source.js';
import { yahooOptionChain } from './yahoo-options.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
let child: ChildProcessWithoutNullStreams | undefined;
let id = 0;
let quoteQueue: Promise<unknown> = Promise.resolve();
let queuedQuotes = 0;
const quotePending = new Map<string, Promise<unknown>>();
let pending: { id: number; resolve: (v: unknown) => void; reject: (e: Error) => void; timer: NodeJS.Timeout } | undefined;
function stop() {
  const proc = child; child = undefined; proc?.kill();
  if (pending) { clearTimeout(pending.timer); pending.reject(new Error('IBKR 期权连接已中断，请重新刷新')); pending = undefined; }
}
function start() {
  if (child) return child;
  const proc = spawn(join(root, 'bridge/.venv/bin/python'), ['-u', join(root, 'bridge/ibkr_market_worker.py')], { stdio: ['pipe','pipe','pipe'] });
  child = proc;
  proc.stderr.on('data', () => {});
  createInterface({ input: proc.stdout }).on('line', line => {
    try {
      const msg = JSON.parse(line);
      if (!pending || msg.id !== pending.id) return;
      const p = pending; pending = undefined; clearTimeout(p.timer);
      if (msg.error) p.reject(new Error(msg.error)); else p.resolve(msg.result);
    } catch {}
  });
  const end = () => { if (child === proc) stop(); };
  proc.on('error', end); proc.on('exit', end); proc.stdin.on('error', end);
  return proc;
}
process.once('exit', stop);
for (const signal of ['SIGTERM','SIGINT'] as const) process.once(signal, stop);
const chainSchema = z.object({ symbol: z.string().trim().toUpperCase().regex(/^\^?[A-Z0-9.-]{1,16}$/),
  tradingClass: z.string().regex(/^[A-Z0-9]{1,16}$/).optional(),
  count: z.enum(['10', '20', 'all']).default('10'),
  mode: z.literal('chain').default('chain'), center: z.coerce.number().finite().positive().optional(),
  expiry: z.string().regex(/^\d{8}$/).optional(), otm: z.coerce.number().min(0).max(50).default(5) });
export const optionsRouter = Router();
optionsRouter.use((_req,res,next)=>{res.set('Cache-Control','no-store');next();});
optionsRouter.get('/chain',async(req,res)=>{
  const parsed=chainSchema.safeParse(req.query);
  if(!parsed.success){res.status(400).json({error:'请输入有效代码、到期日和 OTM 百分比'});return;}
  try {
    // Keep the existing URL compatible, but select the provider before touching IBKR.
    if (marketSource.active === 'yahoo') {
      res.json(await yahooOptionChain(parsed.data));
      return;
    }
    const cfg=JSON.parse(readFileSync(join(dataDir,'ibkr.json'),'utf8'));
    // Separate read-only client and process: long option reads never block portfolio/history.
    const clientId=cfg.clientId === 999999 ? 999998 : cfg.clientId+1;
    const key=JSON.stringify([cfg.port,clientId,parsed.data]);
    let job=quotePending.get(key);
    if(!job){
      if(queuedQuotes>=3){res.status(429).json({error:'期权读取繁忙，请稍后刷新'});return;}
      queuedQuotes++;
      const run=()=>new Promise((resolve,reject)=>{
      const proc=start(); const seq=++id;
      pending={id:seq,resolve,reject,timer:setTimeout(stop,parsed.data.count === 'all' ? 905000 : 55000)};
      proc.stdin.write(JSON.stringify({id:seq,...parsed.data,port:cfg.port,clientId})+'\n');
    });
      job=quoteQueue.then(run).finally(()=>{queuedQuotes--;quotePending.delete(key);});
      quotePending.set(key,job);quoteQueue=job.catch(()=>{});
    }
    res.json(await job);
  } catch(e){res.status(503).json({error:e instanceof Error?e.message:'期权读取失败'});}

});
