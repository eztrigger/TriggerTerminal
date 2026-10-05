"use client";

import {tr,uiLocale} from "../lib/i18n";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {ArrowUpRight,Link2,Unlink2,X} from 'lucide-react';
import GridLayout from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import { useTerminal, type WidgetInstance } from "../store/terminal";
import QuoteWidget from "./widgets/QuoteWidget";
import ChartWidget from "./widgets/ChartWidget";
import WatchlistWidget from "./widgets/WatchlistWidget";
import NewsWidget from "./widgets/NewsWidget";
import ScreenerWidget from "./widgets/ScreenerWidget";
import MacroWidget from "./widgets/MacroWidget";
import OptionsWidget from "./widgets/OptionsWidget";
import PortfolioWidget from "./widgets/PortfolioWidget";
import CalendarWidget from "./widgets/CalendarWidget";
import InsiderWidget from "./widgets/InsiderWidget";
import TvWidget from "./widgets/TvWidget";
import RecapWidget from "./widgets/RecapWidget";

import {openTradingWindow} from '../lib/windows';

export function WidgetBody({ widget }: { widget: WidgetInstance }) {
  switch (widget.type) {
    case "quote": return <QuoteWidget widget={widget} />;
    case "chart": return <ChartWidget widget={widget} />;
    case "watchlist": return <WatchlistWidget />;
    case "news": return <NewsWidget widget={widget} />;
    case "screener": return <ScreenerWidget />;
    case "macro": return <MacroWidget />;
    case "options": return <OptionsWidget widget={widget} />;
    case "portfolio": return <PortfolioWidget />;
    case "calendar": return <CalendarWidget />;
    case "insider": return <InsiderWidget widget={widget} />;
    case "tv": return <TvWidget />;
    case "recap": return <RecapWidget />;
  }
}

function SymbolTag({ widget, activeSymbol }: { widget: WidgetInstance; activeSymbol: string }) {
  const setWidgetSymbol = useTerminal((s) => s.setWidgetSymbol);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const shown = widget.linked ? activeSymbol : widget.symbol ?? activeSymbol;

  useEffect(() => {
    if (!editing) return;
    setDraft(shown);
    requestAnimationFrame(() => inputRef.current?.select());
  }, [editing]); // eslint-disable-line react-hooks/exhaustive-deps

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value.toUpperCase())}
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            const v = draft.trim();
            if (v) setWidgetSymbol(widget.id, v);
            setEditing(false);
          }
          if (e.key === "Escape") setEditing(false);
        }}
        onBlur={() => setEditing(false)}
        className="ml-2 w-16 !border-0 !border-b !border-[var(--amber-dim)] bg-transparent text-[var(--text)] px-0 py-0 text-[13px] leading-none"
      />
    );
  }

  return (
    <span
      className="ml-2 text-[var(--text)] cursor-pointer hover:text-[var(--amber)]"
      title={tr("点击设置此面板的代码")}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={() => setEditing(true)}
    >
      {tr(shown)}
    </span>
  );
}

export const TITLES: Record<string, string> = {
  quote: "行情报价", chart: "价格图表", watchlist: "自选列表", news: "新闻资讯",
  screener: "股票筛选",
  macro: "宏观与指数", options: "期权链", portfolio: "账户与持仓",
  calendar: "财经日历", insider: "内部人交易", tv: "财经直播", recap: "市场综述",
};

export default function Workspace() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    // Measure before paint; never mount panels against a guessed or zero width.
    const measure = () => {
      const next = node.clientWidth;
      if (next > 0) setWidth(next);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const widgets = useTerminal((s) => s.widgets);
  const layout = useTerminal((s) => s.layout);
  const setLayout = useTerminal((s) => s.setLayout);
  const removeWidget = useTerminal((s) => s.removeWidget);
  const toggleLinked = useTerminal((s) => s.toggleLinked);
  const activeSymbol = useTerminal((s) => s.activeSymbol);

  const symbolAware = new Set(["quote", "chart", "news", "options", "insider"]);

  return (
    <div ref={containerRef} className="workspace-grid-container">
    {width > 0 && <GridLayout
      className="layout"
      width={width}
      layout={layout}
      cols={12}
      rowHeight={30}
      margin={[8, 8]}
      draggableHandle=".panel-title"
      onLayoutChange={(l) => setLayout(l.map(({ i, x, y, w, h }) => ({ i, x, y, w, h })))}
    >
      {tr(widgets.map((w) => (
        <div key={w.id}>
          <div className="terminal-panel">
            <div className="panel-title">
              <span>
                {tr(TITLES[w.type])}
                {tr(symbolAware.has(w.type) && <SymbolTag widget={w} activeSymbol={activeSymbol} />)}
              </span>
              <span className="panel-actions"><button title={tr("在独立窗口打开，可拖到其他屏幕")} aria-label={tr('独立窗口打开'+TITLES[w.type])} onMouseDown={e=>e.stopPropagation()} onClick={()=>openTradingWindow('/window?'+new URLSearchParams({type:w.type,symbol:w.linked?activeSymbol:w.symbol??activeSymbol}))}><ArrowUpRight size={14}/></button>
                {tr(symbolAware.has(w.type) && (
                  <button
                    title={tr(w.linked ? "跟随当前代码（点击取消联动）" : "独立代码（点击开启联动）")}
                    aria-label={tr(w.linked ? "跟随当前代码（点击取消联动）" : "独立代码（点击开启联动）")}
                    aria-pressed={w.linked}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={() => toggleLinked(w.id)}
                    className={w.linked ? "text-[var(--amber)]" : "dim"}
                  >
                    {w.linked?<Link2 size={14}/>:<Unlink2 size={14}/>}
                  </button>
                ))}
                <button
                  aria-label={tr("关闭")}
                  title={tr("关闭")}
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={() => removeWidget(w.id)}
                  className="dim hover:text-[var(--down)]"
                >
                  <X size={14}/>
                </button>
              </span>
            </div>
            <div className="flex-1 overflow-auto min-h-0">
              <WidgetBody widget={w} />
            </div>
          </div>
        </div>
      )))}
    </GridLayout>}
    </div>
  );
}
