// Explicit series identities: never infer a fund's currency or NAV from its name.
const funds:Record<string,{id:number;currency:string}>={TDB2915:{id:7217,currency:'USD'}};
export function hasTdFund(symbol:string){return !!funds[symbol.trim().toUpperCase()];}
export function parseTdFundNav(html:string,symbol:string,currency:string){
 const identity=funds[symbol.trim().toUpperCase()];
 const code=html.match(/<meta\s+name="fundCode"\s+content="([^"]+)"/i)?.[1];
 const unitCurrency=html.match(/class="singleCurrency"[^>]*>[\s\S]*?<span[^>]*>\s*([A-Z]{3})\s*<\/span>/)?.[1];
 if(!identity||code!==symbol.trim().toUpperCase()||unitCurrency!==currency||identity.currency!==currency)throw new Error('基金代码或币种与官方资料不符，请核对后重试');
 const priceText=html.match(/class="mb-fund-nav-price"[^>]*>\s*\$?([\d,.]+)\s*</)?.[1];
 const dateText=html.match(/class="mb-fund-nav-date"[^>]*>\s*([A-Za-z]+ \d{1,2}, \d{4})\s*</)?.[1];
 const price=Number(priceText?.replaceAll(',',''));
 const time=dateText?Date.parse(dateText+' 00:00:00 GMT'):NaN;
 if(!priceText||!Number.isFinite(price)||price<=0||!Number.isFinite(time)||time>Date.now()+86400000||Date.now()-time>14*86400000)throw new Error('官方基金净值缺失或已过期，请手动填写并核对估值日期');
 return {price,bid:null,ask:null,basis:'TD Asset Management NAV',marketDataType:null,fetchedAt:new Date(time).toISOString()};
}
const cache=new Map<string,{until:number;promise:ReturnType<typeof load>}>();
async function load(symbol:string,currency:string){
 const fund=funds[symbol];
 if(!fund||fund.currency!==currency)throw new Error('基金代码或币种与官方资料不符，请核对后重试');
 const response=await fetch('https://www.td.com/ca/en/asset-management/funds/solutions/mutual-funds/fundcard?fundId='+fund.id,{signal:AbortSignal.timeout(12000),headers:{'User-Agent':'Mozilla/5.0'}});
 if(!response.ok)throw new Error('官方基金净值暂时不可用，请稍后重试或手动填写');
 return parseTdFundNav(await response.text(),symbol,currency);
}
export function quoteTdFund(symbol:string,currency:string){
 symbol=symbol.trim().toUpperCase();
 const key=symbol+':'+currency;const old=cache.get(key);
 if(old&&old.until>Date.now())return old.promise;
 const promise=load(symbol,currency).catch(e=>{cache.delete(key);throw e;});
 cache.set(key,{until:Date.now()+300000,promise});return promise;
}
