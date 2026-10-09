import {pythonExecutable} from '../python.js';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dataDir } from '../db.js';
import type { Params, Snapshot, PublicData } from './schema.js';

const root=join(dirname(fileURLToPath(import.meta.url)),'..','..','..');
export function ibkrSnapshot(symbol:string,mode:'stocks'|'options',params:Params,signal:AbortSignal):Promise<Snapshot>{
  return new Promise((resolve,reject)=>{
    if(signal.aborted){reject(new Error('已取消'));return;}
    const cfg=JSON.parse(readFileSync(join(dataDir,'ibkr.json'),'utf8'));
    const proc=spawn(pythonExecutable(root),['-u',join(root,'bridge/csp_worker.py')],{stdio:['pipe','pipe','pipe']});
    let output='',settled=false;
    const finish=(error?:Error,value?:Snapshot)=>{if(settled)return;settled=true;clearTimeout(timer);signal.removeEventListener('abort',abort);proc.kill();error?reject(error):resolve(value!);};
    const abort=()=>finish(new Error('已取消'));
    const timer=setTimeout(()=>finish(new Error('IBKR 扫描超时')),430000);
    signal.addEventListener('abort',abort,{once:true});
    proc.stdout.on('data',chunk=>{output+=chunk.toString();if(output.length>16000000)finish(new Error('IBKR 响应过大'));});
    proc.stderr.on('data',()=>{});proc.on('error',error=>finish(error));proc.stdin.on('error',error=>finish(error));
    proc.on('close',()=>{if(settled)return;try{const data=JSON.parse(output.trim());if(data.error)finish(new Error(data.error));else if(!data.result?.symbol||!Array.isArray(data.result.bars))finish(new Error('IBKR 返回格式无效'));else finish(undefined,data.result);}catch{finish(new Error('IBKR 未返回有效数据'));}});
    proc.stdin.end(JSON.stringify({symbol,mode,params,port:cfg.port,clientId:((cfg.clientId+8)%999999)||999998})+'\n');
  });
}

type Fact={val:number;start?:string;end:string;filed:string;accn:string;form:string;fp?:string};
let tickerCache:{at:number;rows:Record<string,{cik_str:number;ticker:string}>}|null=null;
const cache=new Map<string,{at:number;value:PublicData}>();
export async function secData(symbol:string,contact:string,signal:AbortSignal):Promise<PublicData>{
  const output:PublicData={fetchedAt:new Date().toISOString(),cik:null,filings:[],facts:[],errors:[]};
  if(!contact){output.errors.push('SEC 自动读取未启用：在数据设置填写真实联系邮箱，或手动添加 SEC/IR 原文证据。');return output;}
  const old=cache.get(symbol);if(old&&Date.now()-old.at<3600000)return old.value;
  const read=async(url:string)=>{await new Promise(r=>setTimeout(r,180));const response=await fetch(url,{headers:{'User-Agent':`OpenTerminal CSP ${contact}`,Accept:'application/json'},signal:AbortSignal.any([signal,AbortSignal.timeout(15000)])});if(!response.ok)throw new Error(`SEC ${response.status}`);return response.json();};
  try{
    if(!tickerCache||Date.now()-tickerCache.at>86400000)tickerCache={at:Date.now(),rows:await read('https://www.sec.gov/files/company_tickers.json')};
    const company=Object.values(tickerCache.rows).find(r=>r.ticker.toUpperCase().replace('-','.')===symbol);
    if(!company)throw new Error('SEC 未找到该股票的 CIK');
    const cik=String(company.cik_str).padStart(10,'0');output.cik=cik;
    const submissions=await read(`https://data.sec.gov/submissions/CIK${cik}.json`);const recent=submissions.filings?.recent;
    const filingUrl=(accession:string,file?:string)=>`https://www.sec.gov/Archives/edgar/data/${company.cik_str}/${accession.replaceAll('-','')}/${file||accession+'-index.html'}`;
    if(recent)for(let i=0;i<recent.form.length&&output.filings.length<12;i++)if(['10-K','10-K/A','10-Q','10-Q/A','8-K','20-F','6-K'].includes(recent.form[i]))output.filings.push({title:recent.form[i],date:recent.filingDate[i],url:filingUrl(recent.accessionNumber[i],recent.primaryDocument[i])});
    const facts=await read(`https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`);
    const tags:Record<string,string>={NetCashProvidedByUsedInOperatingActivities:'经营现金流',PaymentsToAcquirePropertyPlantAndEquipment:'资本支出',NetIncomeLoss:'净利润',Revenues:'收入',RevenueFromContractWithCustomerExcludingAssessedTax:'合同收入',OperatingIncomeLoss:'营业利润',InterestExpense:'利息费用',StockBasedCompensation:'SBC',CommonStockSharesOutstanding:'普通股股数'};
    for(const [tag,label] of Object.entries(tags)){
      const unit=tag==='CommonStockSharesOutstanding'?'shares':'USD';
      const values=(facts.facts?.['us-gaap']?.[tag]?.units?.[unit]??[]) as Fact[];
      const annual=values.filter(f=>['10-K','10-K/A','20-F'].includes(f.form)&&f.filed<=output.fetchedAt.slice(0,10)&&Number.isFinite(f.val)&&(!f.start||(Date.parse(f.end)-Date.parse(f.start))/86400000>=330&&(Date.parse(f.end)-Date.parse(f.start))/86400000<=380));
      const byEnd=new Map<string,Fact>();for(const f of annual.sort((a,b)=>a.filed.localeCompare(b.filed)))byEnd.set(f.end,f);
      for(const f of [...byEnd.values()].sort((a,b)=>b.end.localeCompare(a.end)).slice(0,4))output.facts.push({name:label,value:f.val,unit,start:f.start??'',end:f.end,filed:f.filed,accession:f.accn,url:filingUrl(f.accn)});
    }
    cache.set(symbol,{at:Date.now(),value:output});
  }catch(error){output.errors.push(error instanceof Error?error.message:'SEC读取失败');}
  return output;
}
