"use client";
import {tr,uiLocale} from "../../lib/i18n";
import SortableTable, { SortRow } from "../SortableTable";
import { economicValue } from "../../lib/table-sort";

import { useQuery } from "@tanstack/react-query";
import { Fragment, useMemo, useState } from "react";
import { apiGet, fmt, pctClass } from "../../lib/api";
import { useTerminal } from "../../store/terminal";

type EconEvent = {
  title: string;
  country: string;
  date: string;
  impact: "Low" | "Medium" | "High" | "Holiday";
  forecast: string | null;
  previous: string | null;
  actual: string | null;
};

type EarningsEntry = {
  symbol: string;
  nextEarningsDate: number | null;
  lastEarningsDate: number | null;
  epsForecast: number | null;
};

const IMPACT_CLASS: Record<EconEvent["impact"], string> = {
  High: "down",
  Medium: "amber",
  Low: "dim",
  Holiday: "dim",
};

const TIMEZONES: Array<{ label: string; zone: string | undefined }> = [
  { label: "本地", zone: undefined },
  { label: "UTC", zone: "UTC" },
  { label: "纽约", zone: "America/New_York" },
  { label: "芝加哥", zone: "America/Chicago" },
  { label: "伦敦", zone: "Europe/London" },
  { label: "法兰克福", zone: "Europe/Berlin" },
  { label: "东京", zone: "Asia/Tokyo" },
  { label: "悉尼", zone: "Australia/Sydney" },
];

function EconomicTab() {
  const [minImpact, setMinImpact] = useState<"all" | "medium">("medium");
  const [tz, setTz] = useState<string>("本地");

  const { data = [], isLoading, error } = useQuery({
    queryKey: ["econ-calendar"],
    queryFn: () => apiGet<EconEvent[]>("/api/econ-calendar"),
    refetchInterval: 300_000,
  });

  const events = useMemo(
    () => (minImpact === "all" ? data : data.filter((e) => e.impact === "High" || e.impact === "Medium")),
    [data, minImpact]
  );

  if (error) return <div className="p-2 down">{tr("加载失败： ")}{tr((error as Error).message)}</div>;
  if (isLoading) return <div className="p-2 dim">{tr("正在加载日历…")}</div>;

  const zone = TIMEZONES.find((t) => t.label === tz)?.zone;

  return (
    <div>
      <div className="flex gap-1 p-1 items-center flex-wrap">
        <button className={`term-btn ${minImpact === "medium" ? "active" : ""}`} onClick={() => setMinImpact("medium")}>{tr(" 中高影响 ")}</button>
        <button className={`term-btn ${minImpact === "all" ? "active" : ""}`} onClick={() => setMinImpact("all")}>{tr(" 全部 ")}</button>
        <span className="w-2" />
        <select
          value={tz}
          onChange={(e) => setTz(e.target.value)}
          className="term-btn !py-0.5 bg-[var(--panel)] cursor-pointer"
        >
          {tr(TIMEZONES.map((t) => (
            <option key={t.label} value={t.label}>
              {tr(t.label)}
            </option>
          )))}
        </select>
      </div>
      <SortableTable className="data-table">
        <thead>
          <tr>
            <th>{tr("日期")}</th>
            <th>{tr("币种")}</th>
            <th>{tr("事件")}</th>
            <th>{tr("预期")}</th>
            <th>{tr("前值")}</th>
            <th>{tr("实际")}</th>
          </tr>
        </thead>
        <tbody>
          {tr(events.map((e, i) => (
            <SortRow values={[Date.parse(e.date), e.country, e.title, economicValue(e.forecast), economicValue(e.previous), economicValue(e.actual)]} key={`${e.title}-${e.date}-${i}`}>
              <td className="!text-left dim whitespace-nowrap">
                {tr(new Date(e.date).toLocaleString(undefined, {
                  timeZone: zone,
                  month: "short",
                  day: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                  timeZoneName: "short",
                }))}
              </td>
              <td>{tr(e.country)}</td>
              <td className={`!text-left ${IMPACT_CLASS[e.impact]}`}>{tr(e.title)}</td>
              <td>{tr(e.forecast ?? "—")}</td>
              <td className="dim">{tr(e.previous ?? "—")}</td>
              <td className={e.actual ? "text-[var(--text)]" : "dim"}>{tr(e.actual ?? "—")}</td>
            </SortRow>
          )))}
        </tbody>
      </SortableTable>
      {tr(events.length === 0 && <div className="p-3 dim">{tr("当前时间范围内暂无事件。")}</div>)}
    </div>
  );
}

const fmtDate = (ts: number | null) => (ts ? new Date(ts * 1000).toLocaleDateString(uiLocale()) : "—");

type EarningsHistoryRow = {
  fiscalQtrEnd: string;
  dateReported: number;
  eps: number | null;
  consensusForecast: number | null;
  surprisePercent: number | null;
  dayAfterChangePercent: number | null;
};

/** Actual vs forecast: beat = green, miss = red, in-line = white. */
function surpriseClass(row: EarningsHistoryRow): string {
  if (row.eps === null || row.consensusForecast === null) return "dim";
  if (row.eps > row.consensusForecast) return "up";
  if (row.eps < row.consensusForecast) return "down";
  return "text-[var(--text)]";
}

function EarningsHistoryRows({ symbol }: { symbol: string }) {
  const { data = [], isLoading, error } = useQuery({
    queryKey: ["earnings-history", symbol],
    queryFn: () => apiGet<EarningsHistoryRow[]>(`/api/earnings-history/${symbol}`),
    staleTime: 3_600_000,
  });

  if (error) return <div className="p-2 down">{tr("加载失败： ")}{tr((error as Error).message)}</div>;
  if (isLoading) return <div className="p-2 dim">{tr("正在加载历史： ")}{tr(symbol)}…</div>;
  if (data.length === 0) return <div className="p-2 dim">{tr("暂无财报历史： ")}{tr(symbol)}.</div>;

  return (
    <SortableTable className="data-table">
      <thead>
        <tr>
          <th>{tr("季度")}</th>
          <th>{tr("公布日期")}</th>
          <th>{tr("预期")}</th>
          <th>{tr("实际")}</th>
          <th>{tr("超预期幅度")}</th>
          <th>{tr("次日涨跌")}</th>
        </tr>
      </thead>
      <tbody>
        {tr(data.map((row) => (
          <SortRow values={[row.fiscalQtrEnd, row.dateReported, row.consensusForecast, row.eps, row.surprisePercent, row.dayAfterChangePercent]} key={row.dateReported}>
            <td className="!text-left dim">{tr(row.fiscalQtrEnd)}</td>
            <td className="!text-left dim">{tr(fmtDate(row.dateReported))}</td>
            <td className="dim">{tr(row.consensusForecast != null ? `$${row.consensusForecast.toFixed(2)}` : "—")}</td>
            <td className={surpriseClass(row)}>{tr(row.eps != null ? `$${row.eps.toFixed(2)}` : "—")}</td>
            <td className={surpriseClass(row)}>{tr(row.surprisePercent != null ? `${fmt(row.surprisePercent, 1)}%` : "—")}</td>
            <td className={pctClass(row.dayAfterChangePercent)}>
              {tr(row.dayAfterChangePercent != null ? `${fmt(row.dayAfterChangePercent, 1)}%` : "—")}
            </td>
          </SortRow>
        )))}
      </tbody>
    </SortableTable>
  );
}

function EarningsTab() {
  const watchlist = useTerminal((s) => s.watchlist);
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data = [], isLoading, error } = useQuery({
    queryKey: ["calendar", watchlist],
    queryFn: () => apiGet<EarningsEntry[]>(`/api/calendar?symbols=${watchlist.join(",")}`),
    enabled: watchlist.length > 0,
    staleTime: 3_600_000,
  });

  const sorted = useMemo(
    () =>
      [...data].sort((a, b) => {
        if (a.nextEarningsDate === null && b.nextEarningsDate === null) return 0;
        if (a.nextEarningsDate === null) return 1;
        if (b.nextEarningsDate === null) return -1;
        return a.nextEarningsDate - b.nextEarningsDate;
      }),
    [data]
  );

  if (error) return <div className="p-2 down">{tr("加载失败： ")}{tr((error as Error).message)}</div>;
  if (isLoading) return <div className="p-2 dim">{tr("正在加载财报…")}</div>;

  return (
    <SortableTable className="data-table">
      <thead>
        <tr>
          <th>{tr("代码")}</th>
          <th>{tr("上次财报")}</th>
          <th>{tr("下次财报")}</th>
          <th>{tr("预期 EPS")}</th>
        </tr>
      </thead>
      <tbody>
        {tr(sorted.map((e) => (
          <Fragment key={e.symbol}>
            <SortRow values={[e.symbol, e.lastEarningsDate, e.nextEarningsDate, e.epsForecast]}
              onClick={() => setExpanded(expanded === e.symbol ? null : e.symbol)}
              className="cursor-pointer"
              title={tr("点击查看历史财报")}
            >
              <td className="!text-left text-[var(--text)] font-bold underline decoration-1">{tr(e.symbol)}</td>
              <td className="dim">{tr(fmtDate(e.lastEarningsDate))}</td>
              <td className="amber">{tr(fmtDate(e.nextEarningsDate))}</td>
              <td>{tr(e.epsForecast != null ? `$${e.epsForecast.toFixed(2)}` : "—")}</td>
            </SortRow>
            {tr(expanded === e.symbol && (
              <tr>
                <td colSpan={4} className="!text-left p-0">
                  <EarningsHistoryRows symbol={e.symbol} />
                </td>
              </tr>
            ))}
          </Fragment>
        )))}
        {tr(sorted.length === 0 && (
          <tr>
            <td colSpan={4} className="dim p-3">{tr(" 自选列表暂无即将公布的财报。 ")}</td>
          </tr>
        ))}
      </tbody>
    </SortableTable>
  );
}

export default function CalendarWidget() {
  const [tab, setTab] = useState<"econ" | "earnings">("econ");

  return (
    <div>
      <div className="flex gap-1 p-1">
        <button className={`term-btn ${tab === "econ" ? "active" : ""}`} onClick={() => setTab("econ")}>{tr(" 经济日历 ")}</button>
        <button className={`term-btn ${tab === "earnings" ? "active" : ""}`} onClick={() => setTab("earnings")}>{tr(" 财报日历 ")}</button>
      </div>
      {tr(tab === "econ" ? <EconomicTab /> : <EarningsTab />)}
    </div>
  );
}
