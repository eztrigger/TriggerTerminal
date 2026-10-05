"use client";

import {tr,uiLocale} from "../lib/i18n";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { apiGet } from "../lib/api";
import { useTerminal } from "../store/terminal";

type SearchResult = { conId: number; symbol: string; name: string; exchange: string; currency: string; type: string; hasOptions: boolean; supported: boolean };

export default function CommandPalette() {
  const open = useTerminal((s) => s.commandOpen);
  const setOpen = useTerminal((s) => s.setCommandOpen);
  const setActiveSymbol = useTerminal((s) => s.setActiveSymbol);
  const addToWatchlist = useTerminal((s) => s.addToWatchlist);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => { const timer = setTimeout(() => setDebounced(query.trim()), 350); return () => clearTimeout(timer); }, [query]);
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: matches = [], error, isFetching, refetch } = useQuery({
    queryKey: ["ibkr-search", debounced],
    queryFn: () => apiGet<SearchResult[]>(`/api/ibkr/search?q=${encodeURIComponent(debounced)}`),
    enabled: open && debounced.length > 0 && debounced === query.trim(),
    staleTime: 60_000,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const results = query.trim() === debounced ? matches : [];

  useEffect(() => {
    if (open) {
      setQuery("");
      setDebounced("");
      setSelected(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  useEffect(() => setSelected(0), [results.length]);

  if (!open) return null;

  const pick = (r: SearchResult, watch = false) => {
    if (!r.supported || query.trim() !== debounced) return;
    setActiveSymbol(r.symbol);
    if (watch) addToWatchlist(r.symbol);
    setOpen(false);
  };

  return (
    <div
      className="fixed inset-0 bg-slate-900/25 z-50 flex items-start justify-center pt-24"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-[760px] max-w-[95vw] bg-[var(--panel)] border border-[var(--amber-dim)]"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
            if (e.key === "ArrowDown") setSelected((s) => Math.min(s + 1, results.length - 1));
            if (e.key === "ArrowUp") setSelected((s) => Math.max(s - 1, 0));
            if (e.key === "Enter" && results[selected]) pick(results[selected], e.shiftKey);
          }}
          placeholder={tr("IBKR 搜索代码、公司或指数…（Enter 打开 · Shift+Enter 同时加入自选）")}
          className="w-full !border-0 !border-b !border-[var(--border)] px-3 py-2 text-[13px]"
        />
        <div className="px-3 py-2 dim">{tr("IBKR 合约搜索 · ↑↓ 选择，Enter 打开 · 期权在选中标的后查看期权链")}</div>
        <div className="max-h-80 overflow-auto">
          {tr(results.map((r, i) => (
            <div
              key={`${r.conId}:${r.exchange}:${i}`}
              onClick={() => pick(r)}
              title={tr(r.supported ? r.name : "该市场暂未接入交易台行情面板")}
              className={`px-3 py-2 flex gap-3 ${r.supported ? "cursor-pointer" : "opacity-50 cursor-not-allowed"} ${
                i === selected ? "bg-[#eaf1ff] text-[var(--amber)]" : "hover:bg-[#edf1f7]"
              }`}
            >
              <span className="w-24 font-bold">{tr(r.symbol)}</span>
              <span className="flex-1 truncate">{tr(r.name)}</span>
              <span className="dim">{tr(r.exchange)} · {tr(r.currency)}</span>
              <span className="dim w-16 text-right">{tr(r.type === "IND" ? "指数" : r.type === "STK" ? "股票/ETF" : r.type)}</span>
              <span className="dim w-24 text-right">{tr(!r.supported ? "暂不支持此市场" : r.hasOptions ? "可查期权" : "")}</span>
            </div>
          )))}
          {tr(query && (isFetching || query.trim() !== debounced) && <div className="px-3 py-3 dim">{tr("正在搜索 IBKR…")}</div>)}
          {tr(error && query.trim() === debounced && <div className="px-3 py-3 down">{tr(error.message)} <button onClick={() => void refetch()}>{tr("重试")}</button></div>)}
          {tr(query.trim() && query.trim() === debounced && !isFetching && !error && results.length === 0 && (
            <div className="px-3 py-3 dim">{tr("未找到结果：“")}{tr(query)}”</div>
          ))}
        </div>
      </div>
    </div>
  );
}
