"use client";
import {tr,uiLocale} from "../../lib/i18n";
import SortableTable, { SortRow } from "../SortableTable";

import { useQuery } from "@tanstack/react-query";
import { apiGet, fmt, pctClass } from "../../lib/api";
import { isSafeHttpUrl } from "../../lib/links";
import { useTerminal } from "../../store/terminal";
import Flash from "../Flash";

type RecapRow = { symbol: string; name: string; changePercent: number | null };
type RecapIndex = { symbol: string; label: string; price: number | null; changePercent: number | null };
type RecapSector = { sector: string; avgChangePercent: number };
type RecapNews = { title: string; link: string; publisher: string; publishedAt: string | null };

type Recap = {
  summary: string;
  updatedAt: string;
  indexes: RecapIndex[];
  vix: number | null;
  gainers: RecapRow[];
  losers: RecapRow[];
  sectors: RecapSector[];
  news: RecapNews[];
};

export default function RecapWidget() {
  const setActiveSymbol = useTerminal((s) => s.setActiveSymbol);
  const { data, error } = useQuery({
    queryKey: ["recap"],
    queryFn: () => apiGet<Recap>("/api/recap"),
    refetchInterval: 15_000,
  });

  if (error) return <div className="p-2 down">{tr("加载失败： ")}{tr((error as Error).message)}</div>;
  if (!data) return <div className="p-2 dim">{tr("正在加载市场综述…")}</div>;

  return (
    <div>
      <div className="px-2 py-1 flex justify-between items-baseline">
        <span className="dim text-[10px] uppercase">{tr("市场综述")}</span>
        <span className="dim text-[9px]">{tr(" 更新于 ")}{tr(new Date(data.updatedAt).toLocaleTimeString(uiLocale()))}
        </span>
      </div>

      <div className="px-2 pb-2 text-[12px] leading-relaxed border-b border-[#edf1f7]">{tr(data.summary)}</div>

      <SortableTable className="data-table">
        <thead>
          <tr>
            <th>{tr("指数")}</th>
            <th>{tr("最新价")}</th>
            <th>{tr("涨跌幅")}</th>
          </tr>
        </thead>
        <tbody>
          {tr(data.indexes.map((q) => (
            <SortRow values={[q.label, q.price, q.changePercent]} key={q.symbol} onClick={() => setActiveSymbol(q.symbol)}>
              <td>{tr(q.label)}</td>
              <td>
                <Flash value={q.price}>{tr(fmt(q.price))}</Flash>
              </td>
              <td className={pctClass(q.changePercent)}>
                <Flash value={q.changePercent}>{tr(fmt(q.changePercent))}%</Flash>
              </td>
            </SortRow>
          )))}
          {tr(data.vix !== null && (
            <SortRow values={["VIX", data.vix, null]} className="cursor-pointer" onClick={() => setActiveSymbol("^VIX")}>
              <td>VIX</td>
              <td>
                <Flash value={data.vix} className="amber">
                  {tr(fmt(data.vix, 2))}
                </Flash>
              </td>
              <td>—</td>
            </SortRow>
          ))}
        </tbody>
      </SortableTable>

      <div className="grid grid-cols-2 gap-x-2 px-2 py-1">
        <div>
          <div className="dim text-[10px] uppercase mb-1">{tr("领涨榜")}</div>
          <SortableTable className="data-table"><thead><tr><th>{tr("代码")}</th><th>{tr("涨跌幅")}</th></tr></thead><tbody>
          {tr(data.gainers.map((r) => (
            <SortRow values={[r.symbol, r.changePercent]} key={r.symbol} onClick={() => setActiveSymbol(r.symbol)}>
              <td>{tr(r.symbol)}</td>
              <td className={pctClass(r.changePercent)}>
                <Flash value={r.changePercent}>{tr(fmt(r.changePercent))}%</Flash>
              </td>
            </SortRow>
          )))}
          </tbody></SortableTable>
        </div>
        <div>
          <div className="dim text-[10px] uppercase mb-1">{tr("领跌榜")}</div>
          <SortableTable className="data-table"><thead><tr><th>{tr("代码")}</th><th>{tr("涨跌幅")}</th></tr></thead><tbody>
          {tr(data.losers.map((r) => (
            <SortRow values={[r.symbol, r.changePercent]} key={r.symbol} onClick={() => setActiveSymbol(r.symbol)}>
              <td>{tr(r.symbol)}</td>
              <td className={pctClass(r.changePercent)}>
                <Flash value={r.changePercent}>{tr(fmt(r.changePercent))}%</Flash>
              </td>
            </SortRow>
          )))}
          </tbody></SortableTable>
        </div>
      </div>

      <div className="px-2 py-1 border-t border-[#edf1f7]">
        <div className="dim text-[10px] uppercase mb-1">{tr("板块表现")}</div>
        <SortableTable className="data-table"><thead><tr><th>{tr("板块")}</th><th>{tr("涨跌幅")}</th></tr></thead><tbody>
        {tr(data.sectors.map((s) => (
          <SortRow key={s.sector} values={[s.sector, s.avgChangePercent]}>
            <td>{tr(s.sector)}</td>
            <td className={pctClass(s.avgChangePercent)}>{tr(fmt(s.avgChangePercent))}%</td>
          </SortRow>
        )))}
        </tbody></SortableTable>
      </div>

      <div className="border-t border-[#edf1f7]">
        <div className="dim text-[10px] uppercase px-2 pt-1">{tr("新闻头条")}</div>
        {tr(data.news.map((n, i) => {
          const body = (
            <>
              <div className="truncate">{n.title}</div>
              <div className="dim text-[10px]">{tr(n.publisher)}</div>
            </>
          );
          const className = "block px-2 py-1 border-b border-[#edf1f7] hover:bg-[#edf1f7]";
          return isSafeHttpUrl(n.link) ? (
            <a key={i} href={n.link} target="_blank" rel="noreferrer" className={className}>
              {tr(body)}
            </a>
          ) : (
            <div key={i} className={className}>
              {tr(body)}
            </div>
          );
        }))}
      </div>
    </div>
  );
}
