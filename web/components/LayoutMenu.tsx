"use client";
import { useEffect, useRef, useState } from 'react';
import { Ellipsis, RotateCcw, Save, Star, Trash2, LayoutGrid } from 'lucide-react';
import { tr } from '../lib/i18n';
import { initializeLayouts, readLayouts, writeLayouts, snapshot, LAYOUT_LIBRARY_KEY, type LayoutLibrary } from '../lib/layouts';
import { useTerminal } from '../store/terminal';

export default function LayoutMenu() {
  const menu = useRef<HTMLDetailsElement>(null);
  const [library, setLibrary] = useState<LayoutLibrary | null>(null);
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);
  function refresh() {
    try { setLibrary(initializeLayouts(useTerminal.getState())); }
    catch { setMessage('布局读取失败，请检查浏览器存储'); }
  }
  useEffect(() => {
    refresh();
    const sync = (e: StorageEvent) => { if (e.key === LAYOUT_LIBRARY_KEY) refresh(); };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);
  function update(change: (current: LayoutLibrary) => LayoutLibrary, success: string) {
    try {
      const current = readLayouts();
      if (!current) throw new Error('Missing layout library');
      setLibrary(writeLayouts(change(current)));
      setMessage(success);
    } catch { setMessage('布局保存失败，请检查浏览器存储'); }
  }
  function apply(id?: string) {
    try {
      const current = readLayouts();
      const selected = id ? current?.saved.find(item => item.id === id)?.snapshot : current?.defaultLayout;
      if (!selected) throw new Error('Missing layout');
      useTerminal.getState().applyLayout(selected);
      if (menu.current) menu.current.open = false;
    } catch { setMessage('布局读取失败，请检查浏览器存储'); }
  }
  return <div className="terminal-navigation-footer"><details ref={menu} onToggle={() => { if (menu.current?.open) { setMessage(''); setDeleting(null); refresh(); } }} onKeyDown={e => { if (e.key === 'Escape' && menu.current) { menu.current.open = false; menu.current.querySelector('summary')?.focus(); } }}>
    <summary title={tr('布局设置')}><Ellipsis size={17}/><span>{tr('布局设置')}</span></summary>
    <div className="terminal-layout-menu layout-library">
      <button type="button" disabled={!library} onClick={() => apply()}><RotateCcw size={14}/>{tr('恢复默认布局')}</button>
      <button type="button" disabled={!library} onClick={() => update(current => ({ ...current, defaultLayout: snapshot(useTerminal.getState()) }), '已设为默认布局')}><Star size={14}/>{tr('将当前布局设为默认')}</button>
      <form onSubmit={e => { e.preventDefault(); const label = name.trim(); if (!label) return; update(current => ({ ...current, saved: [...current.saved, { id: crypto.randomUUID(), name: label, snapshot: snapshot(useTerminal.getState()) }] }), '布局已保存'); }}>
        <label htmlFor="layout-name">{tr('保存当前布局')}</label>
        <div className="layout-save-row"><input id="layout-name" value={name} maxLength={60} onChange={e => setName(e.target.value)} placeholder={tr('布局名称')} autoComplete="off"/><button type="submit" disabled={!library || !name.trim()} title={tr('保存布局')} aria-label={tr('保存布局')}><Save size={16}/></button></div>
      </form>
      <h3>{tr('已保存的布局')}</h3>
      <div className="layout-saved-list">{library?.saved.length ? library.saved.map(item => <div key={item.id} className="layout-saved-row">
        <button type="button" className="layout-load" onClick={() => apply(item.id)} title={item.name}><LayoutGrid size={14}/><span>{item.name}</span></button>
        <button type="button" title={tr(deleting === item.id ? '确认删除' : '删除布局')} aria-label={tr(deleting === item.id ? '确认删除' : '删除布局')} className={deleting === item.id ? 'down' : ''} onClick={() => { if (deleting !== item.id) { setDeleting(item.id); return; } update(current => ({ ...current, saved: current.saved.filter(x => x.id !== item.id) }), '布局已删除'); setDeleting(null); }}>{deleting === item.id ? tr('确认删除') : <Trash2 size={14}/>}</button>
      </div>) : <p>{tr('暂无保存的布局')}</p>}</div>
      {message && <p role="status">{tr(message)}</p>}
    </div>
  </details></div>;
}
