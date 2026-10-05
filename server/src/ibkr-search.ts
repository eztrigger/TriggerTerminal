import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createInterface } from 'node:readline';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { dataDir } from './db.js';
const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
let child: ChildProcessWithoutNullStreams | undefined;
let id = 0;

let pending: { id: number; resolve: (v: unknown) => void; reject: (e: Error) => void; timer: NodeJS.Timeout } | undefined;
function stop() {
  const proc = child; child = undefined; proc?.kill();
  if (pending) { clearTimeout(pending.timer); pending.reject(new Error('IBKR 搜索连接已中断，请重试')); pending = undefined; }
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

let queue: Promise<unknown> = Promise.resolve();
let queued = 0;
const inflight = new Map<string, Promise<unknown>>();
const cache = new Map<string, { value: unknown; until: number }>();
export function searchIbkr(query: string, fund = false, currency = 'USD'): Promise<unknown> {
  const cfg = JSON.parse(readFileSync(join(dataDir,'ibkr.json'),'utf8'));
  const key = `${cfg.port}:${cfg.clientId}:${query.toUpperCase()}:${fund}:${currency}`;
  const cached = cache.get(key);
  if (cached && cached.until > Date.now()) return Promise.resolve(cached.value);
  const existing = inflight.get(key); if (existing) return existing;
  if (queued >= 4) return Promise.reject(new Error('搜索请求较多，请稍后重试'));
  queued++;
  const run = () => new Promise<unknown>((resolve,reject) => {
    const proc = start(); const seq = ++id;
    pending = {id:seq,resolve,reject,timer:setTimeout(stop,fund?22000:12000)};
    const clientId = cfg.clientId > 999997 ? cfg.clientId - 2 : cfg.clientId + 2;
    proc.stdin.write(JSON.stringify({id:seq,action:'search',query,fund,currency,port:cfg.port,clientId})+'\n');
  });
  const job = queue.then(run).then(value => {
    if (cache.size >= 100) cache.clear();
    cache.set(key,{value,until:Date.now()+60000});return value;
  }).finally(() => { queued--; inflight.delete(key); });
  queue = job.catch(() => {}); inflight.set(key,job); return job;
}
