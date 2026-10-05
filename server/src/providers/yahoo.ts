import {cacheGet,cacheSet} from '../cache.js';
import {yahooRequest} from './yahoo-transport.js';
const UA = "Mozilla/5.0";

export type Quote = {
  symbol: string;
  name: string | null;
  price: number | null;
  change: number | null;
  changePercent: number | null;
  open: number | null;
  high: number | null;
  low: number | null;
  previousClose: number | null;
  bid: number | null;
  ask: number | null;
  volume: number | null;
  avgVolume: number | null;
  marketCap: number | null;
  pe: number | null;
  eps: number | null;
  dividendYield: number | null;
  week52High: number | null;
  week52Low: number | null;
  beta: number | null;
  sharesOutstanding: number | null;
  currency: string | null;
  exchange: string | null;
  marketState: string | null;
  time: number | null;
  source: string;
};

export type Candle = { time: number; open: number; high: number; low: number; close: number; volume: number };

// ---- crumb/cookie session (needed for the v7 quote and options endpoints) ----

let session: { cookie: string; crumb: string; fetched: number } | null = null;
let sessionFailedUntil = 0;
let sessionPending:Promise<{cookie:string;crumb:string}>|null=null;

async function getSession(): Promise<{ cookie: string; crumb: string }> {
  if (session && Date.now() - session.fetched < 30 * 60 * 1000) return session;
  if (Date.now() < sessionFailedUntil) throw new Error("yahoo: crumb fetch failed (cached failure)");
  if(sessionPending)return sessionPending;
  sessionPending=loadSession().finally(()=>{sessionPending=null;});
  return sessionPending;
}

async function loadSession():Promise<{cookie:string;crumb:string}> {
  try {
    const res = await yahooRequest("https://fc.yahoo.com/", { headers: { "User-Agent": UA }, redirect: "manual" });
    if(res.status===429)throw new Error('yahoo 429 fetching session');
    const cookie = (res.headers.get("set-cookie") ?? "").split(";")[0];
    if (!cookie) throw new Error("yahoo: no session cookie");
    const crumbRes = await yahooRequest("https://query2.finance.yahoo.com/v1/test/getcrumb", {
      headers: { "User-Agent": UA, Cookie: cookie },
    });
    const crumb = (await crumbRes.text()).trim();
    if (!crumbRes.ok || !crumb || /[\s<>]/.test(crumb)) throw new Error("yahoo: crumb fetch failed");
    session = { cookie, crumb, fetched: Date.now() };
    return session;
  } catch (err) {
    sessionFailedUntil = Date.now() + 60_000;
    throw err;
  }
}

const pending=new Map<string,Promise<any>>();
const failures=new Map<string,{until:number;error:Error}>();
function responseTtl(url:string){
 const path=new URL(url).pathname;
 if(path.includes('/options/'))return 300000;
 if(path.includes('/chart/'))return /interval=(1d|1wk|1mo)(?:&|$)/.test(url)&&!url.includes('range=1d&')?300000:60000;
 if(path.includes('/search'))return 300000;
 return 30000;
}
async function yfetch(url: string, withCrumb = false): Promise<any> {
  const hit=cacheGet<any>('yahoo-response:'+url);
  if(hit!==undefined)return hit;
  const failure=failures.get(url);
  if(failure&&failure.until>Date.now())throw failure.error;
  const existing=pending.get(url);if(existing)return existing;
  const job=loadResponse(url,withCrumb).then(json=>{
    cacheSet('yahoo-response:'+url,json,responseTtl(url));
    cacheSet('yahoo-received:'+url,new Date().toISOString(),responseTtl(url));
    failures.delete(url);return json;
  }).catch(error=>{
    failures.set(url,{until:Date.now()+15000,error});
    if(failures.size>1000)failures.delete(failures.keys().next().value!);
    throw error;
  }).finally(()=>pending.delete(url));
  pending.set(url,job);return job;
}
async function loadResponse(url:string,withCrumb:boolean):Promise<any>{
 const bucket = new URL(url).pathname.includes('/finance/chart/') ? 'chart' : 'session';
 for(let attempt=0;attempt<2;attempt++){
  const headers: Record<string, string> = { "User-Agent": UA, Accept: "application/json" };
  let full = url;
    if (withCrumb) {
      const s = await getSession();
      headers.Cookie = s.cookie;
      full += (url.includes("?") ? "&" : "?") + "crumb=" + encodeURIComponent(s.crumb);
    }
    let res:Response;
    try{res=await yahooRequest(full,{headers},bucket);}catch(error){
      if(attempt===0&&(error instanceof TypeError||(error as Error).name==='TimeoutError')){
        await new Promise(resolve=>setTimeout(resolve,1000));continue;
      }
      throw error;
    }
    if (!res.ok) {
      if(res.status>=500&&attempt===0){await new Promise(resolve=>setTimeout(resolve,1000));continue;}
      if (withCrumb && (res.status === 401 || res.status === 403)) {session = null;if(attempt===0)continue;}
      throw new Error(`yahoo ${res.status} for ${url}`);
    }
    const json=await res.json();
    if(json?.chart?.error||json?.quoteResponse?.error||json?.optionChain?.error)throw new Error('yahoo: invalid market response');
    if(json?.chart&&!json.chart.result?.length||json?.optionChain&&!json.optionChain.result?.length)throw new Error('yahoo: empty market response');
    return json;
 }
}

const n = (v: unknown): number | null => (typeof v === "number" && isFinite(v) ? v : null);

// ---- quotes ----

export async function quotes(symbols: string[]): Promise<Quote[]> {
  symbols=[...new Set(symbols.map(s=>s.trim().toUpperCase()).filter(Boolean))].sort();
  const url =
    "https://query1.finance.yahoo.com/v7/finance/quote?symbols=" + encodeURIComponent(symbols.join(","));
  const json = await yfetch(url, true);
  const rows: any[] = json?.quoteResponse?.result ?? [];
  return rows.map((r) => ({
    symbol: r.symbol,
    name: r.longName ?? r.shortName ?? null,
    price: n(r.regularMarketPrice),
    change: n(r.regularMarketChange),
    changePercent: n(r.regularMarketChangePercent),
    open: n(r.regularMarketOpen),
    high: n(r.regularMarketDayHigh),
    low: n(r.regularMarketDayLow),
    previousClose: n(r.regularMarketPreviousClose),
    bid: n(r.bid),
    ask: n(r.ask),
    volume: n(r.regularMarketVolume),
    avgVolume: n(r.averageDailyVolume3Month),
    marketCap: n(r.marketCap),
    pe: n(r.trailingPE),
    eps: n(r.epsTrailingTwelveMonths),
    dividendYield: n(r.trailingAnnualDividendYield),
    week52High: n(r.fiftyTwoWeekHigh),
    week52Low: n(r.fiftyTwoWeekLow),
    beta: n(r.beta),
    sharesOutstanding: n(r.sharesOutstanding),
    currency: r.currency ?? null,
    exchange: r.fullExchangeName ?? r.exchange ?? null,
    marketState: r.marketState ?? null,
    time: n(r.regularMarketTime),
    source: "yahoo",
  }));
}

/** Quote fallback that works without crumb, using the chart endpoint's metadata. */
export async function quoteFromChart(symbol: string): Promise<Quote> {
  const json = await yfetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=1d`
  );
  const meta = json?.chart?.result?.[0]?.meta;
  if (!meta) throw new Error("yahoo chart: no meta for " + symbol);
  const price = n(meta.regularMarketPrice);
  const prev = n(meta.chartPreviousClose ?? meta.previousClose);
  return {
    symbol: meta.symbol ?? symbol,
    name: meta.longName ?? meta.shortName ?? null,
    price,
    change: price !== null && prev !== null ? price - prev : null,
    changePercent: price !== null && prev !== null && prev !== 0 ? ((price - prev) / prev) * 100 : null,
    open: null,
    high: n(meta.regularMarketDayHigh),
    low: n(meta.regularMarketDayLow),
    previousClose: prev,
    bid: null,
    ask: null,
    volume: n(meta.regularMarketVolume),
    avgVolume: null,
    marketCap: null,
    pe: null,
    eps: null,
    dividendYield: null,
    week52High: n(meta.fiftyTwoWeekHigh),
    week52Low: n(meta.fiftyTwoWeekLow),
    beta: null,
    sharesOutstanding: null,
    currency: meta.currency ?? null,
    exchange: meta.fullExchangeName ?? meta.exchangeName ?? null,
    marketState: null,
    time: n(meta.regularMarketTime),
    source: "yahoo-chart",
  };
}

// ---- history ----
export function historyRetrievedAt(symbol:string,range:string,interval:string):string|undefined{
 return cacheGet<string>(`yahoo-received:https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}&includePrePost=false`);
}

export async function history(symbol: string, range: string, interval: string): Promise<Candle[]> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    symbol
  )}?range=${range}&interval=${interval}&includePrePost=false`;
  const json = await yfetch(url);
  const result = json?.chart?.result?.[0];
  if (!result) throw new Error("yahoo: no chart data for " + symbol);
  const ts: number[] = result.timestamp ?? [];
  const q = result.indicators?.quote?.[0] ?? {};
  const candles: Candle[] = [];
  for (let i = 0; i < ts.length; i++) {
    const [o, h, l, c] = [q.open?.[i], q.high?.[i], q.low?.[i], q.close?.[i]];
    if (o == null || h == null || l == null || c == null) continue;
    candles.push({ time: ts[i], open: o, high: h, low: l, close: c, volume: q.volume?.[i] ?? 0 });
  }
  return candles;
}

// ---- search ----

export type SearchResult = { symbol: string; name: string; exchange: string; type: string };

export async function search(query: string): Promise<SearchResult[]> {
  const url = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(
    query
  )}&quotesCount=12&newsCount=0`;
  const json = await yfetch(url);
  return (json?.quotes ?? [])
    .filter((r: any) => r.symbol)
    .map((r: any) => ({
      symbol: r.symbol,
      name: r.longname ?? r.shortname ?? r.symbol,
      exchange: r.exchDisp ?? r.exchange ?? "",
      type: r.quoteType ?? r.typeDisp ?? "",
    }));
}

// ---- options ----

export async function options(symbol: string, date?: number): Promise<any> {
  let url = `https://query2.finance.yahoo.com/v7/finance/options/${encodeURIComponent(symbol)}`;
  if (date) url += `?date=${date}`;
  const json = await yfetch(url, true);
  const result = json?.optionChain?.result?.[0];
  if (!result) throw new Error("yahoo: no option chain for " + symbol);
  const chain = result.options?.[0] ?? { calls: [], puts: [] };
  const pick = (o: any) => ({
    nonStandard: o.nonStandard === true,
    lastTradeDate: n(o.lastTradeDate),
    strike: n(o.strike),
    lastPrice: n(o.lastPrice),
    bid: n(o.bid),
    ask: n(o.ask),
    change: n(o.change),
    percentChange: n(o.percentChange),
    volume: n(o.volume),
    openInterest: n(o.openInterest),
    impliedVolatility: n(o.impliedVolatility),
    inTheMoney: !!o.inTheMoney,
  });
  return {
    symbol,
    underlyingPrice: n(result.quote?.regularMarketPrice),
    expirationDates: result.expirationDates ?? [],
    selectedDate: chain.expirationDate ?? null,
    fetchedAt: cacheGet<string>('yahoo-received:' + url),
    calls: (chain.calls ?? []).map(pick),
    puts: (chain.puts ?? []).map(pick),
  };
}
