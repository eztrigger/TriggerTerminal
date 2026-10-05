"use client";
import {tr,uiLocale} from "../../lib/i18n";
import SortableTable, { SortRow } from "../SortableTable";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { apiGet, apiPost, apiDelete, fmt, pctClass, type Quote } from "../../lib/api";

type Portfolio = { id: number; name: string };
type Position = { symbol: string; quantity: number; avgCost: number; realizedPnl: number };
type Tx = { id: number; symbol: string; side: string; quantity: number; price: number; executed_at: string };

export default function PortfolioWidget() {
  const qc = useQueryClient();
  const [portfolioId, setPortfolioId] = useState<number | null>(null);
  const [showTx, setShowTx] = useState(false);
  const [form, setForm] = useState({ symbol: "", side: "BUY", quantity: "", price: "" });

  const { data: portfolios = [] } = useQuery({
    queryKey: ["portfolios"],
    queryFn: () => apiGet<Portfolio[]>("/api/portfolios"),
  });
  const pid = portfolioId ?? portfolios[0]?.id;

  const { data: positions = [] } = useQuery({
    queryKey: ["positions", pid],
    queryFn: () => apiGet<Position[]>(`/api/portfolios/${pid}/positions`),
    enabled: !!pid,
  });

  const { data: txs = [] } = useQuery({
    queryKey: ["transactions", pid],
    queryFn: () => apiGet<Tx[]>(`/api/portfolios/${pid}/transactions`),
    enabled: !!pid && showTx,
  });

  const symbols = positions.map((p) => p.symbol);
  const { data: quotes = [] } = useQuery({
    queryKey: ["pf-quotes", symbols.join(",")],
    queryFn: () => apiGet<Quote[]>(`/api/quotes?symbols=${symbols.join(",")}`),
    enabled: symbols.length > 0,
    refetchInterval: 30_000,
  });

  const addTx = useMutation({
    mutationFn: () =>
      apiPost(`/api/portfolios/${pid}/transactions`, {
        symbol: form.symbol,
        side: form.side,
        quantity: Number(form.quantity),
        price: Number(form.price),
        executed_at: new Date().toISOString(),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["positions", pid] });
      qc.invalidateQueries({ queryKey: ["transactions", pid] });
      setForm({ symbol: "", side: "BUY", quantity: "", price: "" });
    },
  });

  const totals = positions.reduce(
    (acc, p) => {
      const q = quotes.find((x) => x.symbol === p.symbol);
      const mv = (q?.price ?? p.avgCost) * p.quantity;
      acc.marketValue += mv;
      acc.cost += p.avgCost * p.quantity;
      acc.realized += p.realizedPnl;
      return acc;
    },
    { marketValue: 0, cost: 0, realized: 0 }
  );
  const unrealized = totals.marketValue - totals.cost;

  return (
    <div>
      <div className="flex gap-2 p-1 items-center flex-wrap">
        <select value={pid ?? ""} onChange={(e) => setPortfolioId(Number(e.target.value))}>
          {tr(portfolios.map((p) => (
            <option key={p.id} value={p.id}>{tr(p.name)}</option>
          )))}
        </select>
        <button className={`term-btn ${showTx ? "active" : ""}`} onClick={() => setShowTx(!showTx)}>{tr(" 交易记录 ")}</button>
        <span className="ml-auto">{tr(" 市值 ")}<span className="amber">{tr(fmt(totals.marketValue))}</span>{" "}
          <span className="dim">{tr("未实现")}</span> <span className={pctClass(unrealized)}>{tr(fmt(unrealized))}</span>{" "}
          <span className="dim">{tr("已实现")}</span> <span className={pctClass(totals.realized)}>{tr(fmt(totals.realized))}</span>
        </span>
      </div>

      <form
        className="flex gap-1 p-1 border-b border-[var(--border)]"
        onSubmit={(e) => {
          e.preventDefault();
          if (form.symbol && form.quantity && form.price) addTx.mutate();
        }}
      >
        <input className="w-20" placeholder={tr("代码")} value={form.symbol} onChange={(e) => setForm({ ...form, symbol: e.target.value.toUpperCase() })} />
        <select value={form.side} onChange={(e) => setForm({ ...form, side: e.target.value })}>
          <option value="BUY">{tr("买入")}</option><option value="SELL">{tr("卖出")}</option>
        </select>
        <input className="w-20" placeholder={tr("数量")} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
        <input className="w-24" placeholder={tr("价格")} value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
        <button className="term-btn" type="submit">{tr("添加")}</button>
        {tr(addTx.error && <span className="down">{tr((addTx.error as Error).message)}</span>)}
      </form>

      {tr(!showTx ? (
        <SortableTable className="data-table">
          <thead>
            <tr><th>{tr("代码")}</th><th>{tr("数量")}</th><th>{tr("平均成本")}</th><th>{tr("最新价")}</th><th>{tr("市值")}</th><th>{tr("未实现盈亏")}</th><th>{tr("已实现盈亏")}</th></tr>
          </thead>
          <tbody>
            {tr(positions.map((p) => {
              const q = quotes.find((x) => x.symbol === p.symbol);
              const last = q?.price ?? null;
              const mv = last !== null ? last * p.quantity : null;
              const upnl = last !== null ? (last - p.avgCost) * p.quantity : null;
              return (
                <SortRow values={[p.symbol, p.quantity, p.avgCost, last, mv, upnl, p.realizedPnl]} key={p.symbol}>
                  <td className="font-bold">{tr(p.symbol)}</td>
                  <td>{tr(fmt(p.quantity, 4))}</td>
                  <td>{tr(fmt(p.avgCost))}</td>
                  <td>{tr(fmt(last))}</td>
                  <td>{tr(fmt(mv))}</td>
                  <td className={pctClass(upnl)}>{tr(fmt(upnl))}</td>
                  <td className={pctClass(p.realizedPnl)}>{tr(fmt(p.realizedPnl))}</td>
                </SortRow>
              );
            }))}
          </tbody>
        </SortableTable>
      ) : (
        <SortableTable className="data-table">
          <thead>
            <tr><th>{tr("日期")}</th><th>{tr("代码")}</th><th>{tr("方向")}</th><th>{tr("数量")}</th><th>{tr("价格")}</th><th></th></tr>
          </thead>
          <tbody>
            {tr(txs.map((t) => (
              <SortRow values={[Date.parse(t.executed_at), t.symbol, t.side, t.quantity, t.price]} key={t.id}>
                <td className="!text-left dim">{tr(new Date(t.executed_at).toLocaleDateString())}</td>
                <td className="font-bold">{tr(t.symbol)}</td>
                <td className={t.side === "BUY" ? "up" : "down"}>{tr(t.side === "BUY" ? "买入" : "卖出")}</td>
                <td>{tr(fmt(t.quantity, 4))}</td>
                <td>{tr(fmt(t.price))}</td>
                <td>
                  <button
                    className="dim hover:text-[var(--down)]"
                    onClick={async () => {
                      await apiDelete(`/api/portfolios/${pid}/transactions/${t.id}`);
                      qc.invalidateQueries({ queryKey: ["positions", pid] });
                      qc.invalidateQueries({ queryKey: ["transactions", pid] });
                    }}
                  >
                    ✕
                  </button>
                </td>
              </SortRow>
            )))}
          </tbody>
        </SortableTable>
      ))}
    </div>
  );
}
