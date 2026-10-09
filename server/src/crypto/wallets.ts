import {z} from 'zod';
import {D} from './schema.js';

export const networks=['ethereum','base','arbitrum','optimism','polygon','solana','bitcoin','hyperliquid'] as const;
export const walletSchema=z.object({name:z.string().trim().min(1).max(100),network:z.enum(networks),address:z.string().trim().max(100)}).superRefine((v,c)=>{
 const valid=v.network==='bitcoin'?/^(bc1[ac-hj-np-z02-9]{11,87}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})$/.test(v.address):v.network==='solana'?/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(v.address):/^0x[\da-fA-F]{40}$/.test(v.address);
 if(!valid)c.addIssue({code:'custom',message:'Invalid public wallet address'});
});
export type WalletAsset={key:string;symbol:string;name:string;quantity:string;usdPrice:string|null;kind:'SPOT'|'PERPETUAL';currency:'USD'|'USDC';entryPrice:string|null;unrealized:string|null;liquidationPrice:string|null;leverage:string|null;contract:string};
export type WalletSnapshot={assets:WalletAsset[];equityUsd:string|null;pricedEquityUsd?:string;unpricedAssets?:number;partial?:boolean;derivativeEquityUsdc:string|null;withdrawableUsdc:string|null;at:string;scope:string};
export type Wallet=z.infer<typeof walletSchema> & {id:number;snapshot:WalletSnapshot|null;error:string|null};
const explorers:Record<string,string>={ethereum:'https://eth.blockscout.com',base:'https://base.blockscout.com',arbitrum:'https://arbitrum.blockscout.com',optimism:'https://optimism.blockscout.com',polygon:'https://polygon.blockscout.com'};
const rpcFallback:Record<string,{url:string;usdc:string}>={
 ethereum:{url:'https://ethereum-rpc.publicnode.com',usdc:'0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'},
 base:{url:'https://mainnet.base.org',usdc:'0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'},
 arbitrum:{url:'https://arb1.arbitrum.io/rpc',usdc:'0xaf88d065e77c8cC2239327C5EDb3A432268e5831'},
 optimism:{url:'https://mainnet.optimism.io',usdc:'0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85'},
 polygon:{url:'https://polygon-bor-rpc.publicnode.com',usdc:'0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359'},
};
const pending=new Map<string,Promise<any>>(),cache=new Map<string,{value:any;until:number}>(),cooldown=new Map<string,number>();
let queue=Promise.resolve(),nextStart=0;
// One bounded queue for keyless public endpoints; a failed refresh never becomes an empty wallet.
export async function publicJson(url:string,body?:unknown):Promise<any>{
 const key=url+JSON.stringify(body??null),hit=cache.get(key);if(hit&&hit.until>Date.now())return hit.value;
 if(pending.has(key))return pending.get(key)!;
 if(pending.size>=40)throw Error('Public data queue is busy');
 const host=new URL(url).host;
 const run=queue.then(async()=>{
  if((cooldown.get(host)??0)>Date.now())throw Error('Public source is cooling down; previous data retained');
  const delay=Math.max(0,nextStart-Date.now());if(delay)await new Promise(r=>setTimeout(r,delay));nextStart=Date.now()+500;
  const response=await fetch(url,{signal:AbortSignal.timeout(12000),...(body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});
  if(response.status===429){const retry=response.headers.get('retry-after'),seconds=Number(retry);const until=retry&&Number.isFinite(seconds)?Date.now()+seconds*1000:retry?Date.parse(retry):NaN;cooldown.set(host,Math.max(Date.now()+60000,Number.isFinite(until)?until:0));}
  if(!response.ok)throw Error('Public source unavailable (HTTP '+response.status+')');
  const value=await response.json();if(value.error)throw Error('Public RPC rejected the request');
  if(cache.size>=500)cache.delete(cache.keys().next().value!);cache.set(key,{value,until:Date.now()+60000});return value;
 });
 queue=run.then(()=>undefined,()=>undefined);pending.set(key,run);
 try{return await run;}finally{pending.delete(key);}
}
function numeric(value:unknown):string|null{try{const d=new D(String(value));return d.isFinite()?d.toFixed():null;}catch{return null;}}
const native=(symbol:string,quantity:string,key:string):WalletAsset=>({key,symbol,name:symbol,quantity,usdPrice:null,kind:'SPOT',currency:'USD',entryPrice:null,unrealized:null,liquidationPrice:null,leverage:null,contract:'native'});
export async function prices(ids:string[]):Promise<Record<string,{price:number;timestamp:number;confidence?:number;symbol?:string}>>{
 const result:Record<string,any>={};for(let i=0;i<ids.length;i+=50){const d=await publicJson('https://coins.llama.fi/prices/current/'+ids.slice(i,i+50).map(encodeURIComponent).join(','));for(const [key,p] of Object.entries(d.coins??{}) as [string,any][]){if(typeof p.price==='number'&&p.price>0&&typeof p.timestamp==='number'&&Math.abs(Date.now()/1000-p.timestamp)<3600&&(p.confidence??0)>=.5)result[key]=p;}}
 return result;
}
export async function readWallet(wallet:Pick<Wallet,'network'|'address'>):Promise<WalletSnapshot>{
 const assets:WalletAsset[]=[],address=wallet.address,network=wallet.network;
 let derivativeEquityUsdc:string|null=null,withdrawableUsdc:string|null=null,partial=false;
 if(explorers[network]){
  try{
  const root=explorers[network],info=await publicJson(root+'/api/v2/addresses/'+address);
  const raw=numeric(info.coin_balance);if(raw===null)throw Error('Wallet balance is unavailable');
  assets.push(native(network==='polygon'?'POL':'ETH',new D(raw).div(new D(10).pow(18)).toFixed(),network==='polygon'?'coingecko:polygon-ecosystem-token':'coingecko:ethereum'));
  let cursor:Record<string,string>|null=null,page=0;const seen=new Set<string>();
  do{
   const query=new URLSearchParams({type:'ERC-20',...cursor});const rows=await publicJson(root+'/api/v2/addresses/'+address+'/tokens?'+query);
   if(!Array.isArray(rows.items))throw Error('Token balances are unavailable');
   for(const item of rows.items){const token=item.token;if(!token||token.type!=='ERC-20'||!/^0x[\da-f]{40}$/i.test(token.address_hash))continue;const decimals=Number(token.decimals);if(!Number.isInteger(decimals)||decimals<0||decimals>36||numeric(item.value)===null)throw Error('Token precision is unavailable');
    const key=network+':'+token.address_hash.toLowerCase();if(seen.has(key))continue;seen.add(key);const quantity=new D(item.value).div(new D(10).pow(decimals)).toFixed();if(new D(quantity).lte(0))continue;
    assets.push({...native(String(token.symbol??token.address_hash).slice(0,40),quantity,key),name:String(token.name??token.symbol??'').slice(0,120),contract:token.address_hash});
   }
   cursor=rows.next_page_params;page++;if(cursor&&page>=10)throw Error('Wallet exceeds the public token pagination limit; previous data retained');
  }while(cursor);
  }catch{
   assets.length=0;partial=true;
   const config=rpcFallback[network],rpc=async(method:string,params:unknown[])=>{const d=await publicJson(config.url,{jsonrpc:'2.0',id:1,method,params});if(typeof d.result!=='string'||!/^0x[\da-f]+$/i.test(d.result))throw Error('Public RPC balance is unavailable');return BigInt(d.result).toString();};
   const balance=await rpc('eth_getBalance',[address,'latest']);
   assets.push(native(network==='polygon'?'POL':'ETH',new D(balance).div(new D(10).pow(18)).toFixed(),network==='polygon'?'coingecko:polygon-ecosystem-token':'coingecko:ethereum'));
   // ERC20 balanceOf(address), with canonical Circle USDC contracts only. This is not token discovery.
   const usdc=await rpc('eth_call',[{to:config.usdc,data:'0x70a08231'+address.slice(2).toLowerCase().padStart(64,'0')},'latest']);
   assets.push({...native('USDC',new D(usdc).div(1e6).toFixed(),'coingecko:usd-coin'),contract:config.usdc});
  }
 }else if(network==='solana'){
  const rpc='https://api.mainnet-beta.solana.com',request=(method:string,params:unknown[])=>publicJson(rpc,{jsonrpc:'2.0',id:1,method,params});
  const balance=await request('getBalance',[address,{commitment:'finalized'}]);if(!Number.isSafeInteger(balance.result?.value))throw Error('SOL balance exceeds safe RPC precision');assets.push(native('SOL',new D(balance.result.value).div(1e9).toFixed(),'coingecko:solana'));
  const amounts=new Map<string,string>();
  for(const programId of ['TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA','TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb']){
   const response=await request('getTokenAccountsByOwner',[address,{programId},{encoding:'jsonParsed',commitment:'finalized'}]);if(!Array.isArray(response.result?.value))throw Error('SPL balances are unavailable');
   for(const row of response.result.value){const info=row.account?.data?.parsed?.info,token=info?.tokenAmount;if(!token||info.isNative)continue;const decimals=token.decimals;if(!Number.isInteger(decimals)||decimals<0||decimals>36||numeric(token.amount)===null)throw Error('SPL token precision is unavailable');const quantity=new D(token.amount).div(new D(10).pow(decimals));amounts.set(info.mint,new D(amounts.get(info.mint)??0).plus(quantity).toFixed());}
  }
  for(const [mint,quantity] of amounts)if(new D(quantity).gt(0))assets.push({...native(mint.slice(0,6)+'…',quantity,'solana:'+mint),contract:mint});
 }else if(network==='bitcoin'){
  const info=await publicJson('https://mempool.space/api/address/'+address),stats=info.chain_stats;
  if(!Number.isSafeInteger(stats?.funded_txo_sum)||!Number.isSafeInteger(stats?.spent_txo_sum))throw Error('Bitcoin balance is unavailable');
  assets.push(native('BTC',new D(stats.funded_txo_sum).minus(stats.spent_txo_sum).div(1e8).toFixed(),'coingecko:bitcoin'));
 }else if(network==='hyperliquid'){
  const root='https://api.hyperliquid.xyz/info',state=await publicJson(root,{type:'clearinghouseState',user:address}),mids=await publicJson(root,{type:'allMids'});
  derivativeEquityUsdc=numeric(state.marginSummary?.accountValue);withdrawableUsdc=numeric(state.withdrawable);if(derivativeEquityUsdc===null||!Array.isArray(state.assetPositions))throw Error('Hyperliquid margin data unavailable');
  for(const row of state.assetPositions){const p=row.position,quantity=numeric(p?.szi);if(quantity===null)throw Error('Hyperliquid position data unavailable');if(new D(quantity).isZero())continue;
   assets.push({key:'hyperliquid:'+p.coin,symbol:p.coin,name:p.coin,quantity,usdPrice:numeric(mids[p.coin]),kind:'PERPETUAL',currency:'USDC',entryPrice:numeric(p.entryPx),unrealized:numeric(p.unrealizedPnl),liquidationPrice:numeric(p.liquidationPx),leverage:numeric(p.leverage?.value),contract:p.coin});
  }
 }
 const nonzero=assets.filter(a=>!new D(a.quantity).isZero());
 let quotes:Awaited<ReturnType<typeof prices>>={};try{quotes=await prices([...new Set(['coingecko:usd-coin',...nonzero.filter(a=>a.kind==='SPOT').map(a=>a.key)])].slice(0,500));}catch{/* Quantities remain useful when the public price service is down. */}
 for(const asset of nonzero){if(asset.kind==='SPOT'){asset.usdPrice=quotes[asset.key]?.price.toString()??null;if(quotes[asset.key]?.symbol&&network==='solana')asset.symbol=quotes[asset.key].symbol!;}else asset.usdPrice=asset.usdPrice&&quotes['coingecko:usd-coin']?new D(asset.usdPrice).mul(quotes['coingecko:usd-coin'].price).toFixed():null;}
 const missing=nonzero.some(a=>a.kind==='SPOT'&&a.usdPrice===null)||(derivativeEquityUsdc!==null&&!quotes['coingecko:usd-coin']);
 const equity=nonzero.filter(a=>a.kind==='SPOT').reduce((sum,a)=>sum.plus(new D(a.quantity).mul(a.usdPrice??0)),new D(0)).plus(new D(derivativeEquityUsdc??0).mul(quotes['coingecko:usd-coin']?.price??0));
 return {assets:nonzero,equityUsd:missing||partial?null:equity.toFixed(),pricedEquityUsd:equity.toFixed(),unpricedAssets:nonzero.filter(a=>a.kind==='SPOT'&&a.usdPrice===null).length+(derivativeEquityUsdc!==null&&!quotes['coingecko:usd-coin']?1:0),partial,derivativeEquityUsdc,withdrawableUsdc,at:new Date().toISOString(),scope:partial?'Indexer unavailable: native coin and canonical USDC only':network==='hyperliquid'?'Hyperliquid native perpetuals only':network==='bitcoin'?'Confirmed address balance only':'Native coin and fungible tokens only'};
}
