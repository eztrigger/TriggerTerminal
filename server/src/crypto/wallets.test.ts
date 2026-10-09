import {afterEach,expect,it,vi} from 'vitest';
import {readWallet,walletSchema} from './wallets.js';
const address='0x'+'12'.repeat(20);
afterEach(()=>{vi.unstubAllGlobals();});
it('validates public addresses and rejects secrets or arbitrary endpoints',()=>{
 expect(walletSchema.safeParse({name:'Public',network:'ethereum',address}).success).toBe(true);
 expect(walletSchema.safeParse({name:'Secret',network:'ethereum',address:'12'.repeat(32)}).success).toBe(false);
 expect(walletSchema.safeParse({name:'RPC',network:'http://localhost',address}).success).toBe(false);
});
it('decodes raw ERC20 units, paginates, and prices by contract instead of symbol',async()=>{
 const token='0x'+'34'.repeat(20),now=Math.floor(Date.now()/1000);
 vi.stubGlobal('fetch',vi.fn(async(url:string)=>{if(url.includes('coins.llama.fi'))return Response.json({coins:{'coingecko:ethereum':{price:2000,timestamp:now,confidence:.99},['ethereum:'+token]:{price:2,timestamp:now,confidence:.99},'coingecko:usd-coin':{price:.999,timestamp:now,confidence:.99}}});if(url.includes('/tokens?'))return Response.json({items:[{token:{type:'ERC-20',address_hash:token,decimals:'18',symbol:'USDC',name:'Not real USDC'},value:'1234567890123456789'}],next_page_params:null});return Response.json({coin_balance:'1000000000000000'});}));
 const result=await readWallet({network:'ethereum',address});expect(result.assets.find(a=>a.contract===token)?.quantity).toBe('1.234567890123456789');expect(result.equityUsd).toBe('4.469135780246913578');expect(result.assets.find(a=>a.contract===token)?.usdPrice).toBe('2');
});
it('uses Hyperliquid account equity without adding derivative notional again',async()=>{
 const now=Math.floor(Date.now()/1000);
 vi.stubGlobal('fetch',vi.fn(async(url:string,options:any)=>{if(url.includes('coins.llama.fi'))return Response.json({coins:{'coingecko:usd-coin':{price:.999,timestamp:now,confidence:.99}}});const body=JSON.parse(options.body);return body.type==='allMids'?Response.json({BTC:'100'}):Response.json({marginSummary:{accountValue:'125'},withdrawable:'40',assetPositions:[{position:{coin:'BTC',szi:'-2',entryPx:'110',unrealizedPnl:'20',marginUsed:'60',liquidationPx:'160',leverage:{value:3}}}]});}));
 const result=await readWallet({network:'hyperliquid',address:'0x'+'56'.repeat(20)});expect(result.equityUsd).toBe('124.875');expect(result.assets[0].quantity).toBe('-2');expect(result.assets[0].unrealized).toBe('20');expect(result.withdrawableUsdc).toBe('40');
});
it('labels an RPC-only fallback as partial rather than a complete wallet',async()=>{
 const now=Math.floor(Date.now()/1000);
 vi.stubGlobal('fetch',vi.fn(async(url:string,options:any)=>{if(url.includes('blockscout.com'))return new Response('',{status:503});if(url.includes('coins.llama.fi'))return Response.json({coins:{'coingecko:ethereum':{price:2000,timestamp:now,confidence:.99},'coingecko:usd-coin':{price:.999,timestamp:now,confidence:.99}}});const body=JSON.parse(options.body);return Response.json({result:body.method==='eth_getBalance'?'0xde0b6b3a7640000':'0x989680'});}));
 const result=await readWallet({network:'base',address:'0x'+'89'.repeat(20)});expect(result.partial).toBe(true);expect(result.assets.find(a=>a.symbol==='USDC')?.quantity).toBe('10');expect(result.equityUsd).toBeNull();expect(result.pricedEquityUsd).toBe('2009.99');
});
