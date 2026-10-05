"use client";

import {tr,uiLocale} from "../../lib/i18n";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { apiGet } from "../../lib/api";
import { isSafeHttpUrl } from "../../lib/links";
import { useWidgetSymbol, type WidgetInstance } from "../../store/terminal";
import { sortRows } from "../../lib/table-sort";

type NewsItem = { title: string; link: string; publisher: string; publishedAt: string | null };

export default function NewsWidget({ widget }: { widget: WidgetInstance }) {
  const symbol = useWidgetSymbol(widget);
  const [mode, setMode] = useState<"symbol" | "global">("symbol");
  const [order, setOrder] = useState("default");
  const [language,setLanguage]=useState('both');

  const { data = [], isLoading,error } = useQuery({
    queryKey: ["news", mode, symbol,language],
    queryFn: () => apiGet<NewsItem[]>(`/api/news?language=${language}${mode==='symbol'?'&symbol='+encodeURIComponent(symbol):''}`),
    refetchInterval: 60_000,
  });

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1 p-1">
        <button className={`term-btn ${mode === "symbol" ? "active" : ""}`} onClick={() => setMode("symbol")}>
          {tr(symbol)}
        </button>
        <button className={`term-btn ${mode === "global" ? "active" : ""}`} onClick={() => setMode("global")}>{tr(" 全球 ")}</button>
        <select aria-label={tr('新闻语言')} className="ml-auto" value={language} onChange={e=>setLanguage(e.target.value)}><option value="both">{tr('中英')}</option><option value="zh">{tr('中文新闻')}</option><option value="en">{tr('英文新闻')}</option></select>
        <select aria-label={tr("新闻排序")} value={order} onChange={e => setOrder(e.target.value)}>
          <option value="default">{tr("默认顺序")}</option><option value="asc">{tr("时间升序")}</option><option value="desc">{tr("时间降序")}</option>
        </select>
      </div>
      {tr(isLoading && <div className="p-2 dim">{tr("正在加载新闻…")}</div>)}
      {error&&<div className="p-2 dim">{tr('新闻暂不可用')}</div>}
      {!isLoading&&!error&&!data.length&&<div className="p-2 dim">{tr('暂无相关新闻')}</div>}
      {tr(sortRows(data, order === "default" ? null : { column: 0, direction: order === "asc" ? "asc" : "desc" }, n => n.publishedAt ? Date.parse(n.publishedAt) : null).map((n, i) => {
        const body = (
          <>
            <div className="truncate">{n.title}</div>
            <div className="dim text-[10px]">
              {tr(n.publisher)}
              {tr(n.publishedAt ? " · " + new Date(n.publishedAt).toLocaleString(uiLocale()) : "")}
            </div>
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
  );
}
