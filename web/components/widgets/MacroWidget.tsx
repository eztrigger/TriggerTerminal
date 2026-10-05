"use client";
import {tr,uiLocale} from "../../lib/i18n";
import SortableTable, { SortRow } from "../SortableTable";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { apiGet, fmt, pctClass } from "../../lib/api";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip } from "recharts";
import { useTerminal } from "../../store/terminal";
import Flash from "../Flash";

type MacroData = {
  yields: Array<{ tenor: string; value: number | null }>;
  vix: number | null;
  indexes: Array<{ symbol: string; label: string; price: number | null; changePercent: number | null }>;
  policyRate: number | null;
  inflation: number | null;
};

export default function MacroWidget() {
  const setActiveSymbol = useTerminal((s) => s.setActiveSymbol);
  const [region, setRegion] = useState<"us" | "eu">("us");
  const { data, error } = useQuery({
    queryKey: ["macro", region],
    queryFn: () => apiGet<MacroData>(`/api/macro?region=${region}`),
    refetchInterval: 1_000,
  });

  return (
    <div>
      <div className="flex gap-1 p-1">
        {tr((["us", "eu"] as const).map((r) => (
          <button key={r} className={`term-btn ${region === r ? "active" : ""}`} onClick={() => setRegion(r)}>
            {tr(r.toUpperCase())}
          </button>
        )))}
      </div>
      {tr(error ? (
        <div className="p-2 down">{tr("加载失败： ")}{tr((error as Error).message)}</div>
      ) : !data ? (
        <div className="p-2 dim">{tr("正在加载宏观数据…")}</div>
      ) : (
        <MacroBody data={data} region={region} setActiveSymbol={setActiveSymbol} />
      ))}
    </div>
  );
}

function MacroBody({
  data,
  region,
  setActiveSymbol,
}: {
  data: MacroData;
  region: "us" | "eu";
  setActiveSymbol: (s: string) => void;
}) {
  return (
    <div>
      <div className="px-2 py-1 dim text-[10px] uppercase flex justify-between">
        <span>{tr(region === "eu" ? "欧元区 AAA 收益率曲线" : "美国国债收益率曲线")}</span>
        {tr(region === "us" && data.vix !== null && (
          <span className="cursor-pointer" onClick={() => setActiveSymbol("^VIX")}>
            VIX <Flash value={data.vix} className="amber">{tr(fmt(data.vix, 2))}</Flash>
          </span>
        ))}
        {tr(region === "eu" && (data.policyRate !== null || data.inflation !== null) && (
          <span>
            {tr(data.policyRate !== null && (
              <>{tr("ECB 存款利率 ")}<Flash value={data.policyRate} className="amber">{tr(fmt(data.policyRate, 2))}%</Flash></>
            ))}
            {tr(data.inflation !== null && (
              <>
                {" "}HICP <Flash value={data.inflation} className="amber">{tr(fmt(data.inflation, 1))}%</Flash>
              </>
            ))}
          </span>
        ))}
      </div>
      <div className="h-24 px-1">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data.yields} margin={{ top: 4, right: 12, bottom: 0, left: -22 }}>
            <XAxis dataKey="tenor" stroke="#64748b" fontSize={9} />
            <YAxis stroke="#64748b" fontSize={9} domain={["auto", "auto"]} />
            <Tooltip
              contentStyle={{ background: "#ffffff", border: "1px solid #dce3ed", fontSize: 10 }}
              labelStyle={{ color: "#64748b" }}
            />
            <Line type="monotone" dataKey="value" stroke="#2563eb" strokeWidth={1.5} dot={{ r: 2 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <SortableTable className="data-table">
        <thead>
          <tr><th>{tr("指数 / 商品")}</th><th>{tr("最新价")}</th><th>{tr("涨跌幅")}</th></tr>
        </thead>
        <tbody>
          {tr(data.indexes.map((q) => (
            <SortRow values={[q.label, q.price, q.changePercent]} key={q.symbol} onClick={() => setActiveSymbol(q.symbol)}>
              <td>{tr(q.label)}</td>
              <td><Flash value={q.price}>{tr(fmt(q.price))}</Flash></td>
              <td className={pctClass(q.changePercent)}>
                <Flash value={q.changePercent}>{tr(fmt(q.changePercent))}%</Flash>
              </td>
            </SortRow>
          )))}
        </tbody>
      </SortableTable>
    </div>
  );
}
