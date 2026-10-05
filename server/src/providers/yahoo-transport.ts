// All Yahoo traffic shares one process-local queue, including session and RSS requests.
const cooldowns=new Map<string,{until:number;count:number}>();
let tail:Promise<unknown>=Promise.resolve();
let queued=0,nextStart=0;
const pause=(ms:number)=>new Promise<void>(resolve=>setTimeout(resolve,ms));
export async function yahooRequest(url:string,init:RequestInit={},bucket='session'):Promise<Response> {
 const check=()=>{if(Date.now()<(cooldowns.get(bucket)?.until??0))throw new Error('yahoo rate-limited (cooling down)');};
 check();
 if(queued>=40)throw new Error('yahoo request queue full');
 queued++;
 let cancelled=false;
 const job=tail.then(async()=>{
  if(cancelled)throw new Error('yahoo queue timeout');
  check();
  await pause(Math.max(0,nextStart-Date.now()));
  if(cancelled)throw new Error('yahoo queue timeout');
  check();
  nextStart=Date.now()+500;
  const response=await fetch(url,{...init,signal:AbortSignal.timeout(10000)});
  if(response.status===429){
   const old=cooldowns.get(bucket);
   const count=(old?.count??0)+1;
   const retry=response.headers.get('retry-after');
   const seconds=retry!==null&&retry.trim()!==''?Number(retry):NaN;
   const retryMs=Number.isFinite(seconds)?seconds*1000:retry?Date.parse(retry)-Date.now():0;
   const delay=Math.max(Number.isFinite(retryMs)?retryMs:0,Math.min(60000*2**Math.min(count-1,5),1800000));
   cooldowns.set(bucket,{until:Date.now()+delay,count});
  }else if(response.ok)cooldowns.delete(bucket);
  return response;
 }).finally(()=>{queued--;});
 tail=job.catch(()=>{});
 let timer:ReturnType<typeof setTimeout>;
 const timeout=new Promise<never>((_resolve,reject)=>{timer=setTimeout(()=>{cancelled=true;reject(new Error('yahoo queue timeout'));},20000);});
 try{return await Promise.race([job,timeout]);}finally{clearTimeout(timer!);}
}
