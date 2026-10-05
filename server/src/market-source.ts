import {readFileSync,writeFileSync,renameSync} from 'node:fs';
import {join} from 'node:path';
import {Router} from 'express';
import {dataDir} from './db.js';
export type MarketSource='api'|'yahoo';
export function sourceSettings(path:string){
  const read=():MarketSource=>{try{return JSON.parse(readFileSync(path,'utf8')).source==='yahoo'?'yahoo':'api';}catch{return 'api';}};
  const active=read();
  return {active,state:()=>({active,selected:read(),restartRequired:read()!==active}),save(source:MarketSource){
    if(source!=='api'&&source!=='yahoo')throw new Error('无效行情源');
    writeFileSync(path+'.tmp',JSON.stringify({source}),{mode:0o600});renameSync(path+'.tmp',path);
    return this.state();
  }};
}
export const marketSource=sourceSettings(join(dataDir,'market-source.json'));
export const marketSourceRouter=Router();
marketSourceRouter.get('/',(_q,r)=>r.set('Cache-Control','no-store').json(marketSource.state()));
marketSourceRouter.post('/',(q,r)=>{
  if(!['api','yahoo'].includes(q.body?.source)){r.status(400).json({error:'无效行情源'});return;}
  try{r.json(marketSource.save(q.body.source));}catch{r.status(500).json({error:'行情源保存失败'});}
});
