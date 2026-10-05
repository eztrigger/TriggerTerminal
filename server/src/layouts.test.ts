import { afterEach, expect, it, vi } from 'vitest';
import { initializeLayouts, readLayouts, writeLayouts, snapshot, LAYOUT_LIBRARY_KEY } from '../../web/lib/layouts';
const value = { widgets: [{id:'chart',type:'chart' as const,linked:true}], layout:[{i:'chart',x:0,y:0,w:7,h:12}], activeSymbol:'SRAD' };
afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });
function storage() {
  const data = new Map<string,string>();
  const local = {getItem:(key:string)=>data.get(key)??null,setItem:(key:string,v:string)=>{data.set(key,v);},removeItem:(key:string)=>{data.delete(key);}};
  vi.stubGlobal('localStorage',local);
  return local;
}
it('captures the existing main layout once and clones snapshots', () => {
  const local = storage();
  local.setItem('openterminal-workspace',JSON.stringify({state:value}));
  const library = initializeLayouts({...value,widgets:[],layout:[]});
  expect(library.defaultLayout).toEqual(value);
  library.defaultLayout.layout[0].w = 3;
  expect(readLayouts()?.defaultLayout.layout[0].w).toBe(7);
  local.setItem('openterminal-workspace',JSON.stringify({state:{...value,activeSymbol:'AAPL'}}));
  expect(initializeLayouts(value).defaultLayout.activeSymbol).toBe('SRAD');
});
it('saves and recalls only layout fields, preserving watchlist and window isolation', async () => {
  const local = storage();
  vi.stubGlobal('sessionStorage',{getItem:()=>null,setItem:()=>{}});
  vi.stubGlobal('window',{location:{pathname:'/',search:'?workspace=test'}});
  const library = initializeLayouts(value);
  writeLayouts({...library,saved:[{id:'one',name:'My layout',snapshot:snapshot(value)}]});
  const {useTerminal} = await import('../../web/store/terminal');
  expect(useTerminal.getState().widgets).toEqual([]);
  const watchlist = useTerminal.getState().watchlist;
  useTerminal.getState().applyLayout(readLayouts()!.saved[0].snapshot);
  expect(useTerminal.getState().activeSymbol).toBe('SRAD');
  expect(useTerminal.getState().watchlist).toEqual(watchlist);
  expect(local.getItem('openterminal-workspace')).toBeNull();
  useTerminal.getState().removeWidget('chart');
  expect(readLayouts()!.saved[0].snapshot.widgets).toHaveLength(1);
});
it('rejects corrupt layouts and surfaces failed writes', () => {
  const local = storage();
  expect(()=>snapshot({...value,layout:[{...value.layout[0],w:Infinity}]})).toThrow();
  local.setItem(LAYOUT_LIBRARY_KEY,'broken');
  expect(()=>initializeLayouts(value)).toThrow();
  expect(local.getItem(LAYOUT_LIBRARY_KEY)).toBe('broken');
  local.setItem = () => {throw new Error('Quota exceeded');};
  expect(()=>writeLayouts({defaultLayout:value,saved:[]})).toThrow('Quota exceeded');
});
