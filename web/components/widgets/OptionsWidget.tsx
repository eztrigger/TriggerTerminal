"use client";

import {tr,uiLocale} from "../../lib/i18n";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { apiGet, fmt, fmtBig } from "../../lib/api";
import { useWidgetSymbol, type WidgetInstance } from "../../store/terminal";
import { useMarketSource } from "../../lib/use-market-source";

type OptionRow = { strike: number; last: number | null; bid: number | null; ask: number | null;
  volume: number | null; openInterest: number | null; iv: number | null; right: "C" | "P"; marketDataType: number | null };
type Chain = { source: string; tradingClass: string; tradingClasses: string[]; symbol: string; spot: number | null; spotSource: string; expiries: string[]; expiry: string;
  options: OptionRow[]; fetchedAt: string; partial: boolean; availableStrikes: number[] };
const typeLabel = (t: number | null | undefined) => (({1:"实时",2:"冻结",3:"延迟",4:"延迟冻结"} as Record<number, string>)[t ?? 0] ?? "未确认");
const dateLabel = (d: string) => `${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}`;

export default function OptionsWidget({ widget }: { widget: WidgetInstance }) {
  const symbol = useWidgetSymbol(widget);
  const source = useMarketSource();
  if (!source.data) return <div className="p-2 dim">{tr(source.error ? (source.error as Error).message : "读取中…")}</div>;
  return <OptionChain key={`${symbol}:${source.data.active}`} symbol={symbol} source={source.data.active} />;
}

function OptionChain({ symbol, source }: { symbol: string; source: 'api' | 'yahoo' }) {
  const yahooMode = source === 'yahoo';
  const [tradingClass, setTradingClass] = useState<string>();
  const [center, setCenter] = useState<string>("");
  const [expiry, setExpiry] = useState<string | undefined>();
  const [count, setCount] = useState("10");

  const { data, error, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["options-chain", source, symbol, expiry, center, tradingClass, count],
    queryFn: () => apiGet<Chain>(`/api/ibkr/options/chain?refresh=1&mode=chain&count=${count}&symbol=${encodeURIComponent(symbol)}${expiry ? `&expiry=${expiry}` : ""}${center ? `&center=${center}` : ""}${tradingClass ? `&tradingClass=${tradingClass}` : ""}`),
    refetchInterval: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
    retry: 0,
    refetchOnWindowFocus: false,
  });

  const refreshButton = <button className="term-btn active" disabled={isFetching} onClick={() => void refetch()}>{tr(isFetching ? "读取中…" : "↻ 刷新价格")}</button>;

  const countSelector = <label>{tr("显示数量 ")}<select value={count} onChange={e => setCount(e.target.value)}>
    <option value="10">{tr("10 条")}</option><option value="20">{tr("20 条")}</option><option value="all">{tr("全部")}</option>
  </select></label>;

  if (error)
    return (
      <div className="p-2">
        {tr(refreshButton)} {tr(countSelector)}<div className="down">{tr("无法获取期权链： ")}{tr(symbol)}</div>
        <div className="dim">{tr((error as Error).message)}</div>
        <button onClick={() => { if (expiry || center || tradingClass) { setExpiry(undefined); setCenter(""); setTradingClass(undefined); } else { void refetch(); } }}>{tr(yahooMode ? "重新读取 Yahoo Finance" : "重新读取 IBKR")}</button>
      </div>
    );
  if (isLoading || !data) return <div className="p-2 dim">{tr(refreshButton)} {tr(countSelector)}{tr(yahooMode ? "正在读取 Yahoo Finance 期权链" : " 正在读取 IBKR 期权链")}{!yahooMode && tr(count === "all" ? "（全部合约分批读取中）" : "（可能需要约 20 秒）")}…</div>;

  const byStrike = new Map<number, { call?: OptionRow; put?: OptionRow }>();
  for (const c of data.options.filter(o => o.right === "C")) if (c.strike !== null) byStrike.set(c.strike, { ...byStrike.get(c.strike), call: c });
  for (const p of data.options.filter(o => o.right === "P")) if (p.strike !== null) byStrike.set(p.strike, { ...byStrike.get(p.strike), put: p });
  const strikes = [...byStrike.keys()].sort((a, b) => a - b);

  return (
    <div>
      <div className="flex flex-wrap gap-2 items-center p-2 sticky top-0 z-10 bg-[var(--panel)]">
        {tr(refreshButton)}
        {tr(countSelector)}
        <span className="dim">{tr("标的价格")}</span>
        <span className="amber font-bold">{tr(fmt(data.spot))}</span>
        <label>{tr("合约系列 ")}<select value={tradingClass ?? data.tradingClass} onChange={e => { setTradingClass(e.target.value); setExpiry(undefined); }}>
          {tr(data.tradingClasses.map(c => <option key={c} value={c}>{tr(c)}</option>))}
        </select></label>
        <span className="dim ml-2">{tr("到期日")}</span>
        <select
          value={expiry ?? data.expiry ?? ""}
          onChange={(e) => setExpiry(e.target.value)}
        >
          {tr(data.expiries.map((d) => (
            <option key={d} value={d}>{tr(dateLabel(d))}</option>
          )))}
        </select>
      </div>
      <div className="flex flex-wrap gap-2 items-center p-2 dim">
        <span>{data.source} · {tr(yahooMode ? "可能延迟 · 缓存最长 5 分钟" : Array.from(new Set(data.options.map(o => (o.bid === null && o.ask === null && o.last === null ? "暂无报价" : typeLabel(o.marketDataType))))).join(" / "))}</span>
        <span>{tr("读取于 ")}{tr(new Date(data.fetchedAt).toLocaleTimeString(uiLocale()))}{tr(" · 手动刷新")}</span>
        <label>{tr("行权价中心 ")}<select value={center} onChange={e => setCenter(e.target.value)}>
          <option value="">{tr("跟随标的")}</option>{tr(data.availableStrikes.map(s => <option key={s} value={s}>{tr(s)}</option>))}
        </select></label>
      </div>
      <div className="p-2 dim">{tr(count === "all" ? "全部行权价" : `中心附近 ${count} 档行权价`)}{tr(" · 当前 ")}{tr(strikes.length)}{tr(" 条；读取时间不是成交时间。")}{tr(data.spotSource)}
        {tr(data.partial && " · 部分合约无买卖报价，缺失项以 — 显示。")}</div>
      <table className="data-table">
        <thead>
          <tr>
            <th colSpan={6} className="!text-center up">{tr("看涨 Call")}</th>
            <th className="!text-center">{tr("行权价")}</th>
            <th colSpan={6} className="!text-center down">{tr("看跌 Put")}</th>
          </tr>
          <tr>
            <th>{tr("最新价")}</th><th>{tr("买价")}</th><th>{tr("卖价")}</th><th>{tr("成交量")}</th><th>OI · IV</th><th>{tr("行情")}</th>
            <th></th>
            <th>{tr("最新价")}</th><th>{tr("买价")}</th><th>{tr("卖价")}</th><th>{tr("成交量")}</th><th>OI · IV</th><th>{tr("行情")}</th>
          </tr>
        </thead>
        <tbody>
          {tr(strikes.map((strike) => {
            const { call, put } = byStrike.get(strike)!;
            return (
              <tr key={strike}>
                <td className={call && data.spot !== null && strike < data.spot ? "bg-[#e9f7f0]" : ""}>{tr(fmt(call?.last))}</td>
                <td className={call && data.spot !== null && strike < data.spot ? "bg-[#e9f7f0]" : ""}>{tr(fmt(call?.bid))}</td>
                <td className={call && data.spot !== null && strike < data.spot ? "bg-[#e9f7f0]" : ""}>{tr(fmt(call?.ask))}</td>
                <td className={call && data.spot !== null && strike < data.spot ? "bg-[#e9f7f0]" : ""}>{tr(fmtBig(call?.volume))}</td>
                <td className={call && data.spot !== null && strike < data.spot ? "bg-[#e9f7f0]" : ""}>
                  {tr(fmtBig(call?.openInterest))} · {tr(call?.iv ? fmt(call.iv * 100, 0) + "%" : "—")}
                </td>
                <td>{tr(call && (call.bid !== null || call.ask !== null || call.last !== null) ? typeLabel(call.marketDataType) : "暂无报价")}</td>
                <td className="!text-center font-bold amber">{tr(fmt(strike))}</td>
                <td className={put && data.spot !== null && strike > data.spot ? "bg-[#fff0f2]" : ""}>{tr(fmt(put?.last))}</td>
                <td className={put && data.spot !== null && strike > data.spot ? "bg-[#fff0f2]" : ""}>{tr(fmt(put?.bid))}</td>
                <td className={put && data.spot !== null && strike > data.spot ? "bg-[#fff0f2]" : ""}>{tr(fmt(put?.ask))}</td>
                <td className={put && data.spot !== null && strike > data.spot ? "bg-[#fff0f2]" : ""}>{tr(fmtBig(put?.volume))}</td>
                <td className={put && data.spot !== null && strike > data.spot ? "bg-[#fff0f2]" : ""}>
                  {tr(fmtBig(put?.openInterest))} · {tr(put?.iv ? fmt(put.iv * 100, 0) + "%" : "—")}
                </td>
                <td>{tr(put && (put.bid !== null || put.ask !== null || put.last !== null) ? typeLabel(put.marketDataType) : "暂无报价")}</td>
              </tr>
            );
          }))}
        </tbody>
      </table>
    </div>
  );
}
