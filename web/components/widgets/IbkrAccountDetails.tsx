"use client";
import {tr,uiLocale} from "../../lib/i18n";
import SortableTable, { SortRow } from "../SortableTable";
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, fmt, pctClass } from '../../lib/api';

type Field = { tag: string; value: string; currency: string };
type Position = { conId: number; symbol: string; localSymbol: string; secType: string; currency: string; expiry: string; strike: number | null; right: string; multiplier: number | null; quantity: number | null; avgCost: number | null; unitCost: number | null; marketPrice: number | null; marketValue: number | null; unrealizedPnl: number | null; realizedPnl: number | null };
type Snapshot = { connected: boolean; accounts: string[]; account: string; baseCurrency: string | null; port: number; syncedAt: string; accountUpdatedAt: string | null; portfolioUpdatedAt: string | null; positionsComplete: boolean; fields: Field[]; positions: Position[] };
type Config = { port: number; clientId: number };

function number(value: string | undefined) { if (value === undefined || value === '') return null; const n = Number(value); return Number.isFinite(n) && Math.abs(n) < 1e100 ? n : null; }
function clock(value: string | null | undefined) { return value ? new Date(value).toLocaleTimeString(uiLocale()) : '等待更新'; }

export default function IbkrAccountDetails({account, onAccountChange}: {account: string; onAccountChange: (account: string) => void}) {
  const qc = useQueryClient();
  const [settings, setSettings] = useState(false);
  const [draft, setDraft] = useState<Config | null>(null);
  const [filter, setFilter] = useState('');
  const [reveal, setReveal] = useState(false);
  const config = useQuery({ queryKey: ['ibkr-config'], queryFn: () => apiGet<Config>('/api/ibkr/config') });
  const query = useQuery({ queryKey: ['ibkr-snapshot', account], queryFn: () => apiGet<Snapshot>(`/api/ibkr/snapshot?account=${encodeURIComponent(account)}`), refetchInterval: 5000, retry: false, staleTime: 3000 });
  const save = useMutation({ mutationFn: (value: Config) => apiPost('/api/ibkr/config', value), onSuccess: () => {
    onAccountChange(''); qc.removeQueries({ queryKey: ['ibkr-snapshot'] }); qc.invalidateQueries({ queryKey: ['ibkr-snapshot'] }); qc.invalidateQueries({ queryKey: ['ibkr-config'] }); setSettings(false);
  } });
  const data = query.data;
  const connected = !!data?.connected && !query.isError;
  const fields = data?.fields ?? [];
  const base = data?.baseCurrency;
  const metric = (tag: string) => {
    const candidates = fields.filter(f => f.tag === tag);
    const f = candidates.find(f => f.currency === base) ?? candidates.find(f => f.currency === 'BASE') ?? candidates.find(f => f.currency === '');
    return number(f?.value);
  };
  const balances = Array.from(new Set(fields.filter(f => ['CashBalance', 'SettledCash'].includes(f.tag) && f.currency && f.currency !== 'BASE').map(f => f.currency))).sort();
  const currencyValue = (tag: string, currency: string) => number(fields.find(f => f.tag === tag && f.currency === currency)?.value);
  const positions = (data?.positions ?? []).filter(p => !filter || p.secType === filter);
  const conf = draft ?? config.data ?? { port: 4001, clientId: 71 };
  const accountLabel = (id: string) => reveal ? id : `${id.slice(0, 1)}••••${id.slice(-3)}`;
  const metrics = [['净资产', 'NetLiquidation'], ['总现金', 'TotalCashValue'], ['可用资金', 'AvailableFunds'], ['剩余流动性', 'ExcessLiquidity'], ['购买力', 'BuyingPower'], ['初始保证金', 'InitMarginReq'], ['维持保证金', 'MaintMarginReq'], ['未实现盈亏', 'UnrealizedPnL']];
  return <section className="py-4 space-y-3" aria-label={tr("IBKR 资金与账户明细")}>
    <div className="flex items-center gap-2 flex-wrap">
      <span className={connected ? 'up' : 'down'}>● {tr(connected ? 'Gateway 已连接' : query.isFetching ? '连接 / 同步中…' : '未连接')}</span>
      <span className="dim">127.0.0.1:{tr(data?.port ?? config.data?.port ?? 4001)}</span>
      {tr(data && <select aria-label={tr("IBKR 账户")} value={data.account} onChange={e => onAccountChange(e.target.value)}>{tr(data.accounts.map(a => <option key={a} value={a}>{tr(accountLabel(a))}</option>))}</select>)}
      <button className="term-btn" onClick={() => setReveal(!reveal)}>{tr(reveal ? '隐藏账户号' : '显示账户号')}</button>
      <button className="term-btn" disabled={query.isFetching} onClick={() => query.refetch()}>{tr(query.isFetching ? '同步中…' : '刷新')}</button>
      <button className="term-btn" onClick={() => { setDraft(config.data ?? null); setSettings(!settings); }}>{tr("连接设置")}</button>
    </div>
    {tr(settings && <form className="p-3 border border-[var(--border)] space-y-2" onSubmit={e => { e.preventDefault(); save.mutate(conf); }}>
      <div className="flex gap-3 flex-wrap items-center"><label>{tr("API 端口 ")}<input aria-label={tr("API 端口")} type="number" min="1" max="65535" className="w-24" value={conf.port} onChange={e => setDraft({ ...conf, port: Number(e.target.value) })} /></label>
      <label>Client ID <input aria-label="Client ID" type="number" min="1" max="999999" className="w-24" value={conf.clientId} onChange={e => setDraft({ ...conf, clientId: Number(e.target.value) })} /></label>
      <button className="term-btn" disabled={save.isPending}>{tr("保存并重连")}</button></div>
      <p className="dim">{tr("Gateway 常用端口：实盘 4001 / 模拟 4002；TWS：实盘 7496 / 模拟 7497。以 Gateway 设置为准。")}</p>
      <p className="dim">{tr("在 Gateway 中完成登录，允许本机 Socket API 连接；可以保持 Read-Only API 开启。无需提供账户密码。")}</p>
      {tr(save.error && <p className="down">{tr(save.error.message)}</p>)}
    </form>)}
    {tr(query.error && <div role="alert" className="p-3 border border-[var(--down)] down">{tr("同步失败：")}{tr(query.error.message)}<br />{tr(data ? '下方保留上次数据，已过期，不代表当前账户状态。' : '请检查 Gateway 登录和 API 设置，然后点击刷新。')}</div>)}
    {tr(!data && !query.error && <p className="dim py-6">{tr("正在从 IB Gateway 读取账户资金和持仓…")}</p>)}
    {tr(data && <div className={connected ? 'space-y-3' : 'space-y-3 opacity-50'}>
      <div className="dim flex justify-between flex-wrap gap-2"><span>{tr("账户汇总币种：")}{tr(base ?? 'BASE（Gateway 未提供币种代码）')}</span><span>{tr("最近读取 ")}{tr(clock(data.syncedAt))}{tr(" · 资金更新 ")}{tr(clock(data.accountUpdatedAt))}</span></div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">{tr(metrics.map(([label, tag]) => <div key={tag} className="p-3 rounded border border-[var(--border)] bg-[var(--panel-2)]"><div className="dim mb-1">{tr(label)}</div><div className={`text-base font-semibold ${tag === 'UnrealizedPnL' ? pctClass(metric(tag)) : 'amber'}`}>{tr(fmt(metric(tag)))}</div></div>))}</div>
      <div><h3 className="font-bold mb-2">{tr("分币种现金")}</h3><SortableTable className="data-table"><thead><tr><th>{tr("币种")}</th><th>{tr("现金余额")}</th><th>{tr("已结算现金")}</th></tr></thead><tbody>{tr(balances.map(c => <SortRow values={[c, currencyValue("CashBalance", c), currencyValue("SettledCash", c)]} key={c}><td>{tr(c)}</td><td>{tr(fmt(currencyValue('CashBalance', c)))}</td><td>{tr(fmt(currencyValue('SettledCash', c)))}</td></SortRow>))}</tbody></SortableTable>{tr(!balances.length && <p className="dim">{tr("Gateway 未提供分币种现金明细。")}</p>)}</div>
      <div className="flex gap-3 items-center"><h3 className="font-bold">{tr("账户持仓 · ")}{tr(data.positions.length)}</h3><select aria-label={tr("持仓类型")} value={filter} onChange={e => setFilter(e.target.value)}><option value="">{tr("全部资产")}</option><option value="STK">{tr("股票 / ETF")}</option><option value="OPT">{tr("期权")}</option><option value="FUT">{tr("期货")}</option><option value="FOP">{tr("期货期权")}</option><option value="CASH">{tr("外汇")}</option></select></div>
      <div className="overflow-x-auto"><SortableTable className="data-table whitespace-nowrap"><thead><tr><th>{tr("合约")}</th><th>{tr("类型")}</th><th>{tr("到期 / 方向 / 行权价")}</th><th>{tr("数量")}</th><th>{tr("乘数")}</th><th>{tr("单位成本")}</th><th>{tr("IB 估值价")}</th><th>{tr("市值")}</th><th>{tr("未实现盈亏")}</th><th>{tr("币种")}</th></tr></thead><tbody>{tr(positions.map(p => <SortRow values={[p.localSymbol || p.symbol, p.secType, [p.expiry, p.right, p.strike], p.quantity, p.multiplier, p.unitCost, p.marketPrice, p.marketValue, p.unrealizedPnl, p.currency]} key={p.conId}><td className="!text-left font-bold" title={tr(`IB conId: ${p.conId}`)}>{tr(p.localSymbol || p.symbol)}</td><td>{tr(p.secType)}</td><td>{tr(p.expiry || '—')} {tr(p.right)} {tr(p.right ? fmt(p.strike) : '')}</td><td className={pctClass(p.quantity)}>{tr(fmt(p.quantity, Number.isInteger(p.quantity) ? 0 : 4))}</td><td>{tr(fmt(p.multiplier, 0))}</td><td title={tr(`IB 原始每合约成本：${fmt(p.avgCost)}`)}>{tr(fmt(p.unitCost, 4))}</td><td>{tr(fmt(p.marketPrice, 4))}</td><td>{tr(fmt(p.marketValue))}</td><td className={pctClass(p.unrealizedPnl)}>{tr(fmt(p.unrealizedPnl))}</td><td>{tr(p.currency)}</td></SortRow>))}</tbody></SortableTable></div>
      {tr(!positions.length && <p className="dim p-4 text-center">{tr(data.positions.length ? '此分类下没有持仓。' : data.positionsComplete ? '已完成持仓同步：此账户当前没有未平仓合约。可切换上方账户查看。' : '持仓同步中…')}</p>)}
      <p className="dim text-[11px]">{tr("金额按原币种显示 · 估值仅供参考")}</p>
    </div>)}
  </section>;
}
