"use client";
import {tr,uiLocale} from "../../lib/i18n";
import SortableTable, { SortRow } from "../SortableTable";
import type { TableSort } from "../../lib/table-sort";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { apiGet, fmt, fmtBig, pctClass } from "../../lib/api";
import { useTerminal } from "../../store/terminal";
import Flash from "../Flash";

type Row = {
  symbol: string; name: string; price: number | null;
  changePercent: number | null; volume: number | null; marketCap: number | null;
  sector: string;
};

export default function ScreenerWidget() {
  const setActiveSymbol = useTerminal((s) => s.setActiveSymbol);
  const [market, setMarket] = useState<"us" | "eu">("us");
  const [sector, setSector] = useState("");
  const [changeMin, setChangeMin] = useState("");
  const [marketCapMinB, setMarketCapMinB] = useState("");
  const [volumeMinM, setVolumeMinM] = useState("");
  const [sort, setSort] = useState<TableSort>(null);

  const { data: sectors = [] } = useQuery({
    queryKey: ["sectors", market],
    queryFn: () => apiGet<string[]>(`/api/sectors?market=${market}`),
    staleTime: 600_000,
  });

  const params = new URLSearchParams();
  params.set("market", market);
  if (sector) params.set("sector", sector);
  if (changeMin) params.set("changeMin", changeMin);
  if (marketCapMinB) params.set("marketCapMin", String(Number(marketCapMinB) * 1e9));
  if (volumeMinM) params.set("volumeMin", String(Number(volumeMinM) * 1e6));
  params.set("sort", sort ? ["symbol", "name", "sector", "price", "changePercent", "volume", "marketCap"][sort.column] : "marketCap");
  params.set("dir", sort?.direction ?? "desc");

  const { data = [], isLoading, error } = useQuery({
    queryKey: ["screener", params.toString()],
    queryFn: () => apiGet<Row[]>(`/api/screener?${params}`),
    refetchInterval: 20_000,
    placeholderData: previous => previous,
  });

  return (
    <div>
      <div className="flex gap-2 p-1 flex-wrap items-center">
        <div className="flex gap-1">
          {tr((["us", "eu"] as const).map((m) => (
            <button key={m} className={`term-btn ${market === m ? "active" : ""}`} onClick={() => setMarket(m)}>
              {tr(m === "us" ? "美股" : "欧股")}
            </button>
          )))}
        </div>
        <select value={sector} onChange={(e) => setSector(e.target.value)}>
          <option value="">{tr("全部板块")}</option>
          {tr(sectors.map((s) => (
            <option key={s} value={s}>{tr(s)}</option>
          )))}
        </select>
        <input className="w-20" placeholder={tr("最低涨跌幅%")} value={changeMin} onChange={(e) => setChangeMin(e.target.value)} />
        <input className="w-24" placeholder={tr("最低市值（十亿美元）")} value={marketCapMinB} onChange={(e) => setMarketCapMinB(e.target.value)} />
        <input className="w-24" placeholder={tr("最低成交量（百万）")} value={volumeMinM} onChange={(e) => setVolumeMinM(e.target.value)} />
        <span className="dim ml-auto">{tr(isLoading ? "…" : `${data.length} 条结果`)}</span>
      </div>
      {tr(error && <div className="p-2 down">{tr("加载失败： ")}{tr((error as Error).message)}</div>)}
      <SortableTable className="data-table" sort={sort} onSortChange={setSort}>
        <thead>
          <tr>
            <th>{tr("代码")}</th>
            <th>{tr("名称")}</th>
            <th>{tr("板块")}</th>
            <th>{tr("最新价")}</th>
            <th>{tr("涨跌幅")}</th>
            <th>{tr("成交量")}</th>
            <th>{tr("市值")}</th>
          </tr>
        </thead>
        <tbody>
          {tr(data.map((q) => (
            <SortRow values={[q.symbol, q.name, q.sector, q.price, q.changePercent, q.volume, q.marketCap]} key={q.symbol} onClick={() => setActiveSymbol(q.symbol)}>
              <td className="font-bold">{tr(q.symbol)}</td>
              <td className="!text-left max-w-40 truncate">{tr(q.name)}</td>
              <td className="!text-left dim">{tr(q.sector)}</td>
              <td><Flash value={q.price}>{tr(fmt(q.price))}</Flash></td>
              <td className={pctClass(q.changePercent)}>
                <Flash value={q.changePercent}>{tr(fmt(q.changePercent))}%</Flash>
              </td>
              <td>{tr(fmtBig(q.volume))}</td>
              <td>{tr(fmtBig(q.marketCap))}</td>
            </SortRow>
          )))}
        </tbody>
      </SortableTable>
    </div>
  );
}
