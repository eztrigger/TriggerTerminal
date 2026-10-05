"use client";
import {tr,uiLocale} from "../lib/i18n";
export default function QuoteStatus({type, at, detail}: {type?:number|null;at?:string|null;detail?:string|null}) {
  const date = at ? new Date(at) : null;
  const stale = type===1 && date && Number.isFinite(date.getTime()) && Date.now()-date.getTime()>300000;
  const label = stale ? '旧报价' : ({2:'冻结',3:'延迟',4:'延迟冻结'} as Record<number,string>)[type??0] ?? (type===1?'':'时效未知');
  if (!label) return null;
  const title = [detail, date && Number.isFinite(date.getTime()) ? date.toLocaleString(uiLocale()) : null].filter(Boolean).join(' · ');
  return <small className="dim" title={tr(title || undefined)}>{tr(label)}</small>;
}
