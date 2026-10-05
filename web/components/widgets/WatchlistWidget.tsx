"use client";
import {tr,uiLocale} from "../../lib/i18n";
import SortableTable, { SortRow } from "../SortableTable";

import {useWatchlistStream} from "../../lib/use-watchlist-stream";
import { useState } from "react";
import { fmt, fmtBig, pctClass } from "../../lib/api";
import { useTerminal } from "../../store/terminal";
import Flash from "../Flash";
import QuoteStatus from "../QuoteStatus";

export default function WatchlistWidget() {
  const watchlist = useTerminal((s) => s.watchlist);
  const addToWatchlist = useTerminal((s) => s.addToWatchlist);
  const removeFromWatchlist = useTerminal((s) => s.removeFromWatchlist);
  const setActiveSymbol = useTerminal((s) => s.setActiveSymbol);
  const [input, setInput] = useState("");

  const {quotes,status,connected,errors}=useWatchlistStream(watchlist);

  return (
    <div className="watchlist-widget">
      <form
        className="flex gap-1 p-1"
        onSubmit={(e) => {
          e.preventDefault();
          if (input.trim()) {
            addToWatchlist(input.trim());
            setInput("");
          }
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={tr("添加代码…")}
          className="flex-1 min-w-0"
        />
        <button className="term-btn" type="submit">+</button>
      </form>
      <p className="watchlist-connection px-2 py-1 text-xs down" role="status" title={!connected?tr(status):undefined}>{!connected?tr("行情未连接"):null}</p>
      <SortableTable className="data-table watchlist-table">
        <thead>
          <tr><th>{tr("代码")}</th><th>{tr("最新价")}</th><th>{tr("涨跌幅")}</th><th>{tr("成交量")}</th><th></th></tr>
        </thead>
        <tbody>
          {tr(watchlist.map((sym) => {
            const q = quotes[sym];
            return (
              <SortRow values={[sym, q?.price, q?.changePercent, q?.volume]} key={sym} onClick={() => setActiveSymbol(sym)}>
                <td className="font-bold">{tr(sym)}</td>
                <td title={tr(errors[sym]||[q?.basis,q?.receivedAt].filter(Boolean).join(' · '))}><Flash value={q?.price}>{tr(fmt(q?.price))}</Flash><div>{tr(errors[sym]?<small className="down">{tr("报价受限")}</small>:q?<QuoteStatus type={q.marketDataType} at={q.receivedAt}/>:<small className="dim">{tr("加载中")}</small>)}</div></td>
                <td className={pctClass(q?.changePercent)}>
                  <Flash value={q?.changePercent}>{tr(fmt(q?.changePercent))}%</Flash>
                </td>
                <td>{tr(fmtBig(q?.volume))}</td>
                <td>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFromWatchlist(sym);
                    }}
                    className="dim hover:text-[var(--down)]"
                  >
                    ✕
                  </button>
                </td>
              </SortRow>
            );
          }))}
        </tbody>
      </SortableTable>
    </div>
  );
}
