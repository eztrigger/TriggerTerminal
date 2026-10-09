// Share fresh contract snapshots and in-flight work across portfolio views.
export function createQuoteBatcher<T,R>(read:(items:T[])=>Promise<R[]>,key:(item:T)=>string,ttl=30000){
 const cache=new Map<string,{until:number;value:R}>(),pending=new Map<string,Promise<R>>();
 let queued:{item:T;id:string;resolve:(value:R)=>void;reject:(error:unknown)=>void}[]=[];
 let scheduled=false;
 async function flush(){
  // Keep the underlying single IBKR worker queue bounded.
  while(queued.length){
   const batch=queued.splice(0,20);
   try{
    const values=await read(batch.map(j=>j.item));
    batch.forEach((job,i)=>{
     const value=values[i];
     if(value===undefined){job.reject(new Error('Missing quote result'));return;}
     if(!(value as any)?.error)cache.set(job.id,{until:Date.now()+ttl,value});
     job.resolve(value);
    });
   }catch(error){batch.forEach(job=>job.reject(error));}
   finally{batch.forEach(job=>pending.delete(job.id));}
  }
  scheduled=false;
 }
 return (items:T[])=>{
  for(const [id,row] of cache)if(row.until<=Date.now())cache.delete(id);
  return Promise.all(items.map(item=>{
   const id=key(item),hit=cache.get(id);if(hit)return Promise.resolve(hit.value);
   const running=pending.get(id);if(running)return running;
   const promise=new Promise<R>((resolve,reject)=>queued.push({item,id,resolve,reject}));pending.set(id,promise);
   if(!scheduled){scheduled=true;setTimeout(()=>void flush(),0);}
   return promise;
  }));
 };
}
