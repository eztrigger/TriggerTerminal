import {XMLParser} from 'fast-xml-parser';
import {cacheGet,cacheSet} from './cache.js';
const tenors:Record<string,number>={BC_1MONTH:1/12,BC_2MONTH:2/12,BC_3MONTH:.25,BC_4MONTH:1/3,BC_6MONTH:.5,BC_1YEAR:1,BC_2YEAR:2,BC_3YEAR:3,BC_5YEAR:5,BC_7YEAR:7,BC_10YEAR:10,BC_20YEAR:20,BC_30YEAR:30};
export function treasuryRate(xml:string,years:number,now=Date.now()){
 const doc=new XMLParser({removeNSPrefix:true}).parse(xml),entries=doc?.feed?.entry;
 const rows=(Array.isArray(entries)?entries:entries?[entries]:[]).map((e:any)=>e.content?.properties).filter((r:any)=>r&&Date.parse(r.NEW_DATE)<=now).sort((a:any,b:any)=>String(b.NEW_DATE).localeCompare(String(a.NEW_DATE)));
 const row=rows[0];if(!row||now-Date.parse(row.NEW_DATE)>7*86400000||!(years>0&&years<=30))return null;
 const points=Object.entries(tenors).flatMap(([key,t])=>{const y=row[key];return typeof y==='number'&&Number.isFinite(y)&&y>=0&&y<50?[{t,y}]:[];}).sort((a,b)=>a.t-b.t);
 if(!points.length)return null;
 const low=[...points].reverse().find(p=>p.t<=years)??points[0],high=points.find(p=>p.t>=years)??points.at(-1)!;
 const yieldPct=low.t===high.t?low.y:low.y+(high.y-low.y)*(years-low.t)/(high.t-low.t);
 return {value:2*Math.log1p(yieldPct/200),source:'U.S. Treasury',asOf:String(row.NEW_DATE).slice(0,10),method:'par-yield-proxy',url:'https://home.treasury.gov/resource-center-data-chart-center/interest-rates'};
}
const pendingCurves=new Map<number,Promise<string>>();
export async function readTreasuryRate(years:number,currency:string){
 if(currency!=='USD')return null;
 const now=Date.now(),year=new Date(now).getUTCFullYear();let xml=cacheGet<string>('analysis:treasury:'+year);
 if(!xml){
  let pending=pendingCurves.get(year);
  if(!pending){
   pending=(async()=>{
    const response=await fetch(`https://home.treasury.gov/resource-center/data-chart-center/interest-rates/pages/xml?data=daily_treasury_yield_curve&field_tdr_date_value=${year}`,{signal:AbortSignal.timeout(10000)});
    if(!response.ok)throw new Error(`Treasury HTTP ${response.status}`);
    const text=await response.text();cacheSet('analysis:treasury:'+year,text,3600000);return text;
   })().finally(()=>pendingCurves.delete(year));
   pendingCurves.set(year,pending);
  }
  xml=await pending;
 }
 return treasuryRate(xml,years,now);
}
