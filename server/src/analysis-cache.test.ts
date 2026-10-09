import {it,expect,vi} from 'vitest';
import {QueryClient} from '@tanstack/react-query';
import {restoreAnalysisCache} from '../../web/lib/analysis-cache';
it('restores dated analysis data without persisting arbitrary query state',()=>{
 const storage={getItem:()=>JSON.stringify([{key:['holdings'],data:{holdings:[{id:1}]},at:Date.now()-10000},{key:['secret'],data:'ignored',at:Date.now()},{key:['analysis-workspace'],data:{},at:Date.now()-86400001}])};
 vi.stubGlobal('localStorage',storage);const qc=new QueryClient();restoreAnalysisCache(qc);
 expect(qc.getQueryData(['holdings'])).toEqual({holdings:[{id:1}]});expect(qc.getQueryData(['secret'])).toBeUndefined();expect(qc.getQueryData(['analysis-workspace'])).toBeUndefined();qc.clear();vi.unstubAllGlobals();
});
it('ignores a corrupt local snapshot',()=>{vi.stubGlobal('localStorage',{getItem:()=>'{broken'});const qc=new QueryClient();expect(()=>restoreAnalysisCache(qc)).not.toThrow();qc.clear();vi.unstubAllGlobals();});
