"use client";
import {tr,uiLocale} from "../../lib/i18n";
import SortableTable, { SortRow } from "../SortableTable";

import { useQuery } from "@tanstack/react-query";
import { apiGet, fmt, fmtBig } from "../../lib/api";
import { useWidgetSymbol, type WidgetInstance } from "../../store/terminal";

type InsiderTransaction = {
  filingDate: string;
  transactionDate: string;
  ownerName: string;
  ownerTitle: string | null;
  isDirector: boolean;
  isOfficer: boolean;
  isTenPercentOwner: boolean;
  transactionCode: string;
  acquiredDisposed: "A" | "D" | null;
  shares: number | null;
  pricePerShare: number | null;
  value: number | null;
  sharesOwnedAfter: number | null;
};

// SEC's single-letter transaction codes, the ones that actually show up in practice.
const CODE_LABEL: Record<string, string> = {
  P: "公开市场买入",
  S: "公开市场卖出",
  A: "授予／奖励",
  M: "期权行权",
  G: "赠与",
  F: "代扣税款",
  C: "转换",
  D: "转让给发行人",
};

export default function InsiderWidget({ widget }: { widget: WidgetInstance }) {
  const symbol = useWidgetSymbol(widget);
  const { data = [], isLoading, error } = useQuery({
    queryKey: ["insider", symbol],
    queryFn: () => apiGet<InsiderTransaction[]>(`/api/insider/${symbol}`),
    staleTime: 3_600_000,
  });

  if (error) return <div className="p-2 down">{tr("加载失败： ")}{tr((error as Error).message)}</div>;
  if (isLoading) return <div className="p-2 dim">{tr("正在加载内部人交易： ")}{tr(symbol)}…</div>;

  return (
    <div>
      <SortableTable className="data-table">
        <thead>
          <tr>
            <th>{tr("日期")}</th>
            <th>{tr("内部人")}</th>
            <th>{tr("职务")}</th>
            <th>{tr("类型")}</th>
            <th>{tr("股数")}</th>
            <th>{tr("价格")}</th>
            <th>{tr("金额")}</th>
            <th>{tr("交易后持股")}</th>
          </tr>
        </thead>
        <tbody>
          {tr(data.map((t, i) => (
            <SortRow values={[t.transactionDate, t.ownerName, t.ownerTitle ?? (t.isDirector ? "Director" : t.isTenPercentOwner ? "10%+ Owner" : null), CODE_LABEL[t.transactionCode] ?? t.transactionCode, t.shares, t.pricePerShare, t.value, t.sharesOwnedAfter]} key={`${t.ownerName}-${t.transactionDate}-${i}`}>
              <td className="!text-left dim whitespace-nowrap">{tr(t.transactionDate)}</td>
              <td className="!text-left">{tr(t.ownerName)}</td>
              <td className="!text-left dim truncate max-w-[140px]" title={tr(t.ownerTitle ?? "")}>
                {tr(t.ownerTitle ?? (t.isDirector ? "Director" : t.isTenPercentOwner ? "10%+ Owner" : "—"))}
              </td>
              <td className={t.acquiredDisposed === "A" ? "up" : t.acquiredDisposed === "D" ? "down" : "dim"}>
                {tr(CODE_LABEL[t.transactionCode] ?? t.transactionCode)}
              </td>
              <td>{tr(fmtBig(t.shares))}</td>
              <td>{tr(fmt(t.pricePerShare))}</td>
              <td>{tr(fmtBig(t.value))}</td>
              <td className="dim">{tr(fmtBig(t.sharesOwnedAfter))}</td>
            </SortRow>
          )))}
          {tr(data.length === 0 && (
            <tr>
              <td colSpan={8} className="dim p-3">{tr(" 暂无近期公开市场内部人交易： ")}{tr(symbol)}.
              </td>
            </tr>
          ))}
        </tbody>
      </SortableTable>
    </div>
  );
}
