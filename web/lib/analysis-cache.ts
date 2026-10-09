import type {QueryClient} from '@tanstack/react-query';
const key='terminal-analysis-snapshot-v1';
const allowed=new Set(['holdings','analysis-workspace','analysis-contract-market','option-overview','analysis-research']);
export function restoreAnalysisCache(client:QueryClient){
 try{const rows=JSON.parse(localStorage.getItem(key)??'[]');if(Array.isArray(rows))for(const row of rows)if(Array.isArray(row.key)&&allowed.has(row.key[0])&&typeof row.at==='number'&&row.at>Date.now()-86400000)client.setQueryData(row.key,row.data,{updatedAt:row.at});}catch{}
}
export function persistAnalysisCache(client:QueryClient){
 let timer:ReturnType<typeof setTimeout>|undefined;
 const save=()=>{try{const rows=client.getQueryCache().getAll().filter(q=>allowed.has(String(q.queryKey[0]))&&q.state.data!==undefined).map(q=>({key:q.queryKey,data:q.state.data,at:q.state.dataUpdatedAt}));localStorage.setItem(key,JSON.stringify(rows));}catch{}};
 const unsubscribe=client.getQueryCache().subscribe(event=>{if(event.type!=='updated'||!allowed.has(String(event.query.queryKey[0])))return;if(timer)clearTimeout(timer);timer=setTimeout(save,300);});
 window.addEventListener('pagehide',save);
 return()=>{unsubscribe();if(timer)clearTimeout(timer);save();window.removeEventListener('pagehide',save);};
}
