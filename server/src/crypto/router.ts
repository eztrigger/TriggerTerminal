import {Router} from 'express';
import {join} from 'node:path';
import {z} from 'zod';
import {dataDir} from '../db.js';
import {createCryptoStore} from './store.js';
import {readWallet,prices} from './wallets.js';
import {D,summarize} from './schema.js';

const symbols:Record<string,string>={BTC:'bitcoin',ETH:'ethereum',SOL:'solana',BNB:'binancecoin',XRP:'ripple',ADA:'cardano',DOGE:'dogecoin',AVAX:'avalanche-2',DOT:'polkadot',LINK:'chainlink',LTC:'litecoin',USDT:'tether',USDC:'usd-coin',HYPE:'hyperliquid'};
export function createCryptoRouter(store:ReturnType<typeof createCryptoStore>){
 const router=Router();
 const id=(value:string)=>z.coerce.number().int().positive().parse(value);
 const action=(fn:(req:any)=>unknown)=>async(req:any,res:any)=>{try{res.json(await fn(req));}catch(e){res.status(e instanceof Error&&e.message.includes('refresh and try again')?409:400).json({error:e instanceof z.ZodError?'Invalid input; check quantities, dates and required fields':e instanceof Error&&e.message.includes('UNIQUE constraint')?'This wallet is already tracked':e instanceof Error?e.message:'Operation failed'});}};
 router.get('/',action(()=>{const data=store.list();return {...data,wallets:store.wallets(),accountSummaries:Object.fromEntries(data.accounts.map(a=>[a.id,summarize([a],data.positions.filter(p=>p.accountId===a.id),data.events.filter(e=>e.accountId===a.id))]))};}));
 router.post('/accounts',action(req=>store.addAccount(req.body)));
 router.post('/positions',action(req=>store.addPosition(req.body)));
 router.post('/accounts/:account/positions/:position/close',action(req=>store.close(id(req.params.account),req.params.position,req.body)));
 router.post('/accounts/:account/positions/:position/mark',action(req=>store.mark(id(req.params.account),req.params.position,req.body)));
 router.post('/accounts/:account/positions/:position/remove',action(req=>store.removePosition(id(req.params.account),req.params.position,req.body)));
 router.post('/accounts/:account/records',action(req=>store.flow(id(req.params.account),req.body)));
 router.post('/wallets',action(req=>store.addWallet(req.body)));
 router.delete('/wallets/:wallet',action(req=>{store.removeWallet(id(req.params.wallet));return {ok:true};}));
 const syncing=new Map<number,Promise<unknown>>(),synced=new Map<number,number>();
 router.post('/wallets/:wallet/sync',action(req=>{
  const walletId=id(req.params.wallet),wallet=store.wallets().find(w=>w.id===walletId);if(!wallet)throw Error('Wallet not found');
  if(syncing.has(walletId))return syncing.get(walletId);
  if((synced.get(walletId)??0)>Date.now()-60000){if(wallet.error)throw Error('Public source is cooling down; previous data retained');return {cached:true};}
  const task=readWallet(wallet).then(snapshot=>{if(snapshot.partial&&wallet.snapshot&&!wallet.snapshot.partial){store.walletError(walletId,'Token index unavailable; previous complete snapshot retained');return {partial:true};}store.saveWallet(walletId,snapshot);return {ok:true};}).catch(e=>{store.walletError(walletId,e.message);throw e;}).finally(()=>{syncing.delete(walletId);synced.set(walletId,Date.now());});syncing.set(walletId,task);return task;
 }));
 router.post('/prices',action(async req=>{
  const positionId=z.string().uuid().optional().parse(req.body?.positionId),data=store.list(),rows=data.positions.filter(p=>!positionId||p.id===positionId),ids=[...new Set([...rows.filter(p=>symbols[p.symbol]).map(p=>'coingecko:'+symbols[p.symbol]),'coingecko:tether','coingecko:usd-coin'])];
  const quotes=await prices(ids),at=new Date().toISOString(),updates=[];
  for(const p of rows){if(p.kind!=='SPOT')continue;const quote=quotes['coingecko:'+symbols[p.symbol]],settlement=quotes['coingecko:'+symbols[p.currency]];if(quote&&settlement)updates.push({id:p.id,accountId:p.accountId,price:new D(quote.price).div(settlement.price).toFixed(),source:'DefiLlama',at,revision:data.accounts.find(a=>a.id===p.accountId)!.revision,quoteAt:p.quoteAt});}
  const updated=store.applyPrices(updates);return {updated,skipped:rows.length-updated};
 }));
 router.get('/rates',action(async()=>{const q=await prices(['coingecko:tether','coingecko:usd-coin']);return {USDT:q['coingecko:tether']?.price??null,USDC:q['coingecko:usd-coin']?.price??null};}));
 return router;
}
export const cryptoRouter=createCryptoRouter(createCryptoStore(join(dataDir,'crypto.db')));
