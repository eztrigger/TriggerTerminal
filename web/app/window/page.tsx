"use client";
import {tr,uiLocale} from "../../lib/i18n";
import {useEffect,useState} from 'react';
import {WidgetBody,TITLES} from '../../components/Workspace';
import type {WidgetInstance,WidgetType} from '../../store/terminal';
export default function DetachedPanel(){
 const [widget,setWidget]=useState<WidgetInstance|null>(null);const [symbol,setSymbol]=useState('');
 useEffect(()=>{const q=new URLSearchParams(window.location.search);const type=q.get('type')??'';if(!(type in TITLES))return;const value=q.get('symbol')||'AAPL';setSymbol(value);setWidget({id:'detached',type:type as WidgetType,symbol:value,linked:false});document.title=tr(TITLES[type]||'面板')+' · '+tr('TriggerTerminal');},[]);
 if(!widget)return <div className="p-4">{tr("正在打开面板…")}</div>;
 return <main className="detached-page h-screen flex flex-col"><header className="flex items-center gap-3 p-3 border-b shrink-0"><strong>{tr(TITLES[widget.type])}</strong>{tr(['chart','quote','options','news','insider'].includes(widget.type)&&<form className="flex gap-2" onSubmit={e=>{e.preventDefault();if(symbol.trim())setWidget({...widget,symbol:symbol.trim().toUpperCase()});}}><input aria-label={tr("窗口标的代码")} value={symbol} onChange={e=>setSymbol(e.target.value.toUpperCase())} className="w-24"/><button className="term-btn">{tr("切换标的")}</button></form>)}<span className="dim ml-auto">{tr("独立窗口 · 可拖到其他屏幕")}</span></header><div className="flex-1 min-h-0 overflow-auto"><WidgetBody widget={widget}/></div></main>;
}
