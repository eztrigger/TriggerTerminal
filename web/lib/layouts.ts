import type { WidgetInstance, LayoutItem } from '../store/terminal';

export type LayoutSnapshot = { widgets: WidgetInstance[]; layout: LayoutItem[]; activeSymbol: string };
export type SavedLayout = { id: string; name: string; snapshot: LayoutSnapshot };
export type LayoutLibrary = { defaultLayout: LayoutSnapshot; saved: SavedLayout[] };
export const LAYOUT_LIBRARY_KEY = 'openterminal-layout-library-v1';
const types = new Set(['quote','chart','watchlist','news','screener','crypto','macro','options','portfolio','calendar','insider','tv','recap']);

export function snapshot(value: unknown): LayoutSnapshot {
  const v = value as LayoutSnapshot;
  if (!v || !Array.isArray(v.widgets) || !Array.isArray(v.layout)) throw new Error('Invalid layout');
  const widgets = v.widgets.map(w => {
    if (!w || typeof w.id !== 'string' || !types.has(w.type) || typeof w.linked !== 'boolean' || (w.symbol !== undefined && typeof w.symbol !== 'string')) throw new Error('Invalid widget');
    return { id: w.id, type: w.type, linked: w.linked, ...(w.symbol === undefined ? {} : { symbol: w.symbol }) };
  });
  const ids = new Set(widgets.map(w => w.id));
  if (ids.size !== widgets.length || v.layout.length !== widgets.length) throw new Error('Invalid layout IDs');
  const layout = v.layout.map(l => {
    if (!l || !ids.delete(l.i) || ![l.x,l.y,l.w,l.h].every(Number.isFinite) || l.x < 0 || l.y < 0 || l.w <= 0 || l.h <= 0 || l.x + l.w > 12) throw new Error('Invalid geometry');
    return { i: l.i, x: l.x, y: l.y, w: l.w, h: l.h };
  });
  return { widgets, layout, activeSymbol: typeof v.activeSymbol === 'string' ? v.activeSymbol : 'AAPL' };
}

export function readLayouts(): LayoutLibrary | null {
  const raw = localStorage.getItem(LAYOUT_LIBRARY_KEY);
  if (!raw) return null;
  const value = JSON.parse(raw) as LayoutLibrary;
  if (!Array.isArray(value.saved)) throw new Error('Invalid layout library');
  return { defaultLayout: snapshot(value.defaultLayout), saved: value.saved.map(item => {
    if (typeof item.id !== 'string' || typeof item.name !== 'string') throw new Error('Invalid saved layout');
    return { id: item.id, name: item.name, snapshot: snapshot(item.snapshot) };
  }) };
}

export function writeLayouts(library: LayoutLibrary): LayoutLibrary {
  localStorage.setItem(LAYOUT_LIBRARY_KEY, JSON.stringify(library));
  return library;
}

export function initializeLayouts(fallback: LayoutSnapshot): LayoutLibrary {
  const existing = readLayouts();
  if (existing) return existing;
  // Always capture the main workspace, even when a blank window opens first.
  const main = localStorage.getItem('openterminal-workspace');
  const current = main ? snapshot(JSON.parse(main).state) : snapshot(fallback);
  return writeLayouts({ defaultLayout: current, saved: [] });
}
