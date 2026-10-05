import {afterEach,expect,it,vi} from 'vitest';

const storage=()=>{
 const data=new Map<string,string>();
 return {getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>{data.set(key,value);},removeItem:(key:string)=>{data.delete(key);}};
};
afterEach(()=>{vi.unstubAllGlobals();vi.resetModules();});
it('starts each blank window empty, preserves refreshes, and never overwrites the main layout',async()=>{
 const local=storage(),session=storage();
 const saved=JSON.stringify({state:{widgets:[{id:'saved',type:'chart',linked:true}],layout:[{i:'saved',x:0,y:0,w:7,h:12}]},version:0});
 local.setItem('openterminal-workspace',saved);
 vi.stubGlobal('localStorage',local);vi.stubGlobal('sessionStorage',session);
 vi.stubGlobal('window',{location:{pathname:'/',search:'?workspace=first'}});
 let {useTerminal}=await import('../../web/store/terminal');
 expect(useTerminal.getState().widgets).toEqual([]);
 useTerminal.getState().addWidget('quote');
 expect(local.getItem('openterminal-workspace')).toBe(saved);
 vi.resetModules();
 ({useTerminal}=await import('../../web/store/terminal'));
 expect(useTerminal.getState().widgets.map(w=>w.type)).toEqual(['quote']);
 vi.resetModules();vi.stubGlobal('window',{location:{pathname:'/',search:'?workspace=second'}});
 ({useTerminal}=await import('../../web/store/terminal'));
 expect(useTerminal.getState().widgets).toEqual([]);
 useTerminal.getState().resetWorkspace();
 expect(useTerminal.getState().widgets[0].id).toBe('saved');
 vi.resetModules();vi.stubGlobal('window',{location:{pathname:'/',search:''}});
 ({useTerminal}=await import('../../web/store/terminal'));
 expect(useTerminal.getState().widgets[0].id).toBe('saved');
});
