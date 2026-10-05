"use client";
import {tr,uiLocale} from "../lib/i18n";
import {openTradingWindow} from '../lib/windows';
import LanguageSwitcher from './LanguageSwitcher';
import {PanelsTopLeft,ArrowUpRight,ChevronDown} from 'lucide-react';
import {primaryPages} from './PrimaryNavigation';
export default function WindowLinks(){return <div className="window-controls"><LanguageSwitcher/><details className="relative window-menu"><summary className="term-btn cursor-pointer"><PanelsTopLeft size={14}/>{tr("多窗口")}<ChevronDown size={12}/></summary><div className="absolute right-0 top-full z-50 p-2 shadow-lg border bg-[var(--panel)] min-w-44 flex flex-col gap-2">{primaryPages.map(([path,label])=>{const title=path==='/'?'空白交易台':label;return <button className="term-btn" key={path} onClick={e=>{openTradingWindow(path==='/'?'/?workspace='+crypto.randomUUID():path);e.currentTarget.closest('details')?.removeAttribute('open');}}>{tr('打开 {0}').replace('{0}',tr(title))}<ArrowUpRight size={14}/></button>;})}</div></details></div>;}
