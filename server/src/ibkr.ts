import {pythonExecutable} from './python.js';
import { searchIbkr } from './ibkr-search.js';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { Router } from 'express';
import { z } from 'zod';
import { dataDir } from './db.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const configPath = join(dataDir, 'ibkr.json');
const schema = z.object({ port: z.number().int().min(1).max(65535), clientId: z.number().int().min(1).max(999999) }).strict();
let config = { port: 4001, clientId: 71 };
if (existsSync(configPath)) config = schema.parse(JSON.parse(readFileSync(configPath, 'utf8')));
else writeFileSync(configPath, JSON.stringify(config), { mode: 0o600, flag: 'wx' });
let child: ChildProcessWithoutNullStreams | undefined;
let sequence = 0;
let queue: Promise<unknown> = Promise.resolve();
const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void; timer: NodeJS.Timeout }>();

function stop() {
  const old = child; child = undefined;
  old?.kill();
  for (const p of pending.values()) { clearTimeout(p.timer); p.reject(new Error('IBKR 连接已重置，请重试')); }
  pending.clear();
}
function start() {
  if (child) return child;
  const proc = spawn(pythonExecutable(root), ['-u', join(root, 'bridge/ibkr.py')], { stdio: ['pipe', 'pipe', 'pipe'] });
  child = proc;
  // Never log private account payloads or Gateway errors to application logs.
  proc.stderr.on('data', () => {});
  createInterface({ input: proc.stdout }).on('line', line => {
    try {
      const msg = JSON.parse(line); const p = pending.get(msg.id);
      if (!p) return;
      clearTimeout(p.timer); pending.delete(msg.id);
      if (msg.error) p.reject(new Error(msg.error)); else p.resolve(msg.result);
    } catch { /* Ignore non-protocol output. */ }
  });
  const ended = () => { if (child === proc) stop(); };
  proc.on('error', ended); proc.on('exit', ended);
  proc.stdin.on('error', ended);
  return proc;
}
function request(payload: Record<string, unknown>) {
  const run = () => new Promise<unknown>((resolve, reject) => {
    const proc = start(); const id = ++sequence;
    const timer = setTimeout(() => stop(), payload.action === "history" ? 45000 : 25000);
    pending.set(id, { resolve, reject, timer });
    proc.stdin.write(JSON.stringify({ id, ...config, ...payload }) + '\n');
  });
  const job = queue.then(run, run); queue = job.catch(() => {}); return job;
}
process.once('exit', stop);
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => { stop(); process.exit(0); });
export const ibkrRouter = Router();
ibkrRouter.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
ibkrRouter.get('/config', (_req, res) => res.json({ ...config, host: '127.0.0.1', readOnly: true }));
ibkrRouter.post('/config', (req, res) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: '请输入有效端口和 Client ID' }); return; }
  config = parsed.data;
  writeFileSync(configPath, JSON.stringify(config), { mode: 0o600 }); stop();
  res.json({ ...config, host: '127.0.0.1', readOnly: true });
});
ibkrRouter.get('/snapshot', async (req, res) => {
  const account = typeof req.query.account === 'string' ? req.query.account : '';
  try { res.json(await request({ account, refresh: true })); }
  catch (e) { res.status(503).json({ error: e instanceof Error ? e.message : '无法读取 IBKR 账户', connected: false }); }
});

const historyPending = new Map<string, Promise<unknown>>();
ibkrRouter.get('/history/:symbol', async (req, res) => {
  const symbol = req.params.symbol.toUpperCase();
  const range = String(req.query.range ?? '6M');
  if (!/^[A-Z0-9^. -]{1,24}$/.test(symbol) || !['1D','5D','1M','6M','YTD','1Y','5Y','MAX'].includes(range)) {
    res.status(400).json({ error: '无效代码或图表周期' }); return;
  }
  const key = `ibkr-history:${config.port}:${config.clientId}:${symbol}:${range}`;
  try {
    let job = historyPending.get(key);
    if (!job) {
      job = request({ action: 'history', symbol, range }).finally(() => historyPending.delete(key));
      historyPending.set(key, job);
    }
    const result = await job;
    res.json(result);
  } catch (e) {
    res.status(503).json({ error: e instanceof Error ? e.message : 'IBKR 历史行情读取失败' });
  }
});

export const readIbkrSnapshot = (account: string) => request({ account, refresh: true });

ibkrRouter.get('/search', async (req,res) => {
  const q = String(req.query.q ?? '').trim();
  if (!q) { res.json([]); return; }
  if (q.length > 80 || /[\x00-\x1f]/.test(q)) {res.status(400).json({error:'搜索内容无效'});return;}
  try { res.json(await searchIbkr(q, req.query.fund === '1', req.query.currency === 'CAD' ? 'CAD' : 'USD')); }
  catch (e) { res.status(503).json({error:e instanceof Error ? e.message : 'IBKR 搜索失败'}); }
});

export const readIbkrResearchHistory = (symbol:string) => request({action:'history',symbol,range:'2Y'});
