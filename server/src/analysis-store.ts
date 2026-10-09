import type Database from 'better-sqlite3';
import {contractKey,type AssetLeg,type Allocation,type AnalysisStrategy} from './analysis-engine.js';
export function createAnalysisStore(db:Database.Database){
 db.exec(`CREATE TABLE IF NOT EXISTS analysis_strategies(id INTEGER PRIMARY KEY,name TEXT NOT NULL,strategy_id TEXT NOT NULL,allocations TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS analysis_asset_classes(position_id INTEGER NOT NULL,leg_key TEXT NOT NULL,category TEXT NOT NULL,PRIMARY KEY(position_id,leg_key));`);
 const list=()=>({strategies:(db.prepare('SELECT id,name,strategy_id AS strategyId,allocations FROM analysis_strategies ORDER BY id').all() as any[]).map(s=>({...s,allocations:JSON.parse(s.allocations)})) as AnalysisStrategy[],classes:db.prepare('SELECT position_id AS positionId,leg_key AS legKey,category FROM analysis_asset_classes').all()});
 const save=db.transaction((name:string,strategyId:string,allocations:Allocation[],id?:number)=>{
  if(id&&!db.prepare('SELECT id FROM analysis_strategies WHERE id=?').get(id))throw new Error('Strategy not found');
  const seen=new Set<string>();let symbol:string|undefined;
  const existing=list().strategies.filter(s=>s.id!==id).flatMap(s=>s.allocations);
  for(const a of allocations){
   const ref=a.positionId+':'+a.legKey;if(seen.has(ref))throw new Error('Duplicate contract allocation');seen.add(ref);
   const p=db.prepare('SELECT active,account_id,legs FROM holding_positions WHERE id=?').get(a.positionId) as any;
   if(!p?.active)throw new Error('Position is no longer active');
   const matches=(JSON.parse(p.legs) as AssetLeg[]).filter(l=>contractKey(l)===a.legKey);
   if(matches.length!==1)throw new Error('Contract identity is missing or ambiguous');const l=matches[0];
   if(!['STK','ETF','OPT','FOP'].includes(l.assetType))throw new Error('Only stocks and options can form an option strategy');
   if(!Number.isFinite(a.quantity)||a.quantity===0||Math.sign(a.quantity)!==Math.sign(l.quantity)||(['OPT','FOP'].includes(l.assetType)&&!Number.isInteger(a.quantity)))throw new Error('Invalid allocation quantity');
   const used=existing.filter(x=>x.positionId===a.positionId&&x.legKey===a.legKey).reduce((n,x)=>n+Math.abs(x.quantity),0);
   if(used+Math.abs(a.quantity)>Math.abs(l.quantity)+1e-9)throw new Error('Allocated quantity exceeds the current position');
   if(symbol!==undefined&&symbol!==l.symbol.trim().toUpperCase())throw new Error('A strategy must use the same underlying');
   symbol=l.symbol.trim().toUpperCase();
  }
  if(!allocations.some(a=>{const p=db.prepare('SELECT legs FROM holding_positions WHERE id=?').get(a.positionId) as any;return (JSON.parse(p.legs) as AssetLeg[]).some(l=>contractKey(l)===a.legKey&&['OPT','FOP'].includes(l.assetType));}))throw new Error('Select at least one option contract');
  if(id){db.prepare('UPDATE analysis_strategies SET name=?,strategy_id=?,allocations=? WHERE id=?').run(name,strategyId,JSON.stringify(allocations),id);return id;}
  return Number(db.prepare('INSERT INTO analysis_strategies(name,strategy_id,allocations) VALUES(?,?,?)').run(name,strategyId,JSON.stringify(allocations)).lastInsertRowid);
 });
 const classify=(positionId:number,legKey:string,category:string)=>{
  const p=db.prepare('SELECT legs FROM holding_positions WHERE id=?').get(positionId) as any;
  if(!p||(JSON.parse(p.legs) as AssetLeg[]).filter(l=>contractKey(l)===legKey).length!==1)throw new Error('Contract not found');
  db.prepare('INSERT INTO analysis_asset_classes VALUES(?,?,?) ON CONFLICT(position_id,leg_key) DO UPDATE SET category=excluded.category').run(positionId,legKey,category);
 };
 return {list,save,classify,remove:(id:number)=>db.prepare('DELETE FROM analysis_strategies WHERE id=?').run(id)};
}
