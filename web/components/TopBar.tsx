"use client";

import {tr,uiLocale} from "../lib/i18n";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import WindowLinks from './WindowLinks';
import {RotateCw,Search,ChartNoAxesCombined} from 'lucide-react';
import {useMarketSource,type SourceState} from "../lib/use-market-source";
import {useMutation,useQueryClient} from "@tanstack/react-query";
import { apiPost, apiGet } from "../lib/api";
import { useTerminal } from "../store/terminal";
import PrimaryNavigation from './PrimaryNavigation';
import {usePathname,useRouter} from 'next/navigation';

type Status = {
  ok: boolean;
  providers: Array<{ name: string; ok: number; failed: number; lastLatencyMs: number | null }>;
  ai: boolean;
};

function Clock({ tz, label }: { tz: string; label: string }) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!now) return null;
  return (
    <span className="dim">
      {tr(label)}{" "}
      <span className="text-[var(--text)]">
        {tr(now.toLocaleTimeString("en-GB", { timeZone: tz, hour12: false }))}
      </span>
    </span>
  );
}

function marketStateNY(): { label: string; open: boolean } {
  const ny = new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }));
  const day = ny.getDay();
  const mins = ny.getHours() * 60 + ny.getMinutes();
  const open = day >= 1 && day <= 5 && mins >= 570 && mins < 960; // 09:30–16:00
  return { label: open ? "NYSE 交易中" : "NYSE 已休市", open };
}

export default function TopBar() {
  const pathname=usePathname(),router=useRouter();
  const setCommandOpen = useTerminal((s) => s.setCommandOpen);
  const activeSymbol = useTerminal((s) => s.activeSymbol);
  const { data: status } = useQuery({
    queryKey: ["status"],
    queryFn: () => apiGet<Status>("/api/status"),
    refetchInterval: 30_000,
  });

  const market = marketStateNY();
  const source=useMarketSource();const qc=useQueryClient();
  const saveSource=useMutation({mutationFn:(value:string)=>apiPost<SourceState>('/api/market-source',{source:value}),onSuccess:data=>qc.setQueryData(['market-source'],data)});

  return (
    <header className="terminal-topbar">
      <span className="terminal-brand"><img src="/trigger-icon.png" alt="" width={28} height={28} style={{borderRadius:7,objectFit:"cover"}}/>{tr("TriggerTerminal")}</span>
      <PrimaryNavigation/>
      <div className="terminal-market-clock">
      <span className={market.open ? "up" : "down"}>● {tr(market.label)}</span>
      <Clock tz="America/New_York" label={tr("纽约")} />
      <Clock tz="Europe/London" label={tr("伦敦")} />
      <Clock tz="Asia/Tokyo" label={tr("东京")} />
      </div>
      <button
        className="term-btn terminal-search"
        onClick={() => {if(pathname!=='/')router.push('/');setCommandOpen(true);}}
      >
        <Search size={14}/><strong>{activeSymbol}</strong><span className="terminal-search-hint">{tr(" — 搜索代码… ")}</span><kbd>⌘K</kbd>
      </button>
      <div className="terminal-source dim"><span>{tr("行情源")}</span>
        <select aria-label={tr("行情源")} disabled={!source.data||saveSource.isPending} value={source.data?.selected??'api'} onChange={e=>saveSource.mutate(e.target.value)} title={tr(source.data?.active==='yahoo'?'当前：Yahoo Finance':'当前：API')}>
          <option value="api">API</option><option value="yahoo">Yahoo Finance</option>
        </select>
        {tr(source.data?.restartRequired&&<span role="status">{tr("重启后生效")}</span>)}
        <button type="button" className="term-btn inline-flex items-center gap-1" title={tr("重启交易台")} disabled={saveSource.isPending} onClick={()=>{
          const bridge=(window as Window & {webkit?:{messageHandlers?:{restartTerminal?:{postMessage:(message:string)=>void}}}}).webkit?.messageHandlers?.restartTerminal;
          if(bridge)bridge.postMessage('restart');else window.alert(tr('请在桌面版交易台中重启；浏览器刷新不会重启行情服务。'));
        }}><RotateCw size={12}/>{tr("重启")}</button>
        {tr((saveSource.error||source.error)&&<span className="down" role="alert">{tr("配置读取或保存失败")}</span>)}
      </div>
      <WindowLinks />
    </header>
  );
}
