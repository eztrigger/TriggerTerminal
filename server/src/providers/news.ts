import { XMLParser } from "fast-xml-parser";
import {yahooRequest} from './yahoo-transport.js';

export type NewsItem = {
  title: string;
  link: string;
  publisher: string;
  publishedAt: string | null;
  symbol: string | null;
  language?: 'en'|'zh';
};

const parser = new XMLParser({ ignoreAttributes: false });
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36";

async function fetchRss(url: string, publisher: string, symbol: string | null,language:'en'|'zh'='en'): Promise<NewsItem[]> {
  const init={headers:{"User-Agent":UA},signal:AbortSignal.timeout(10000)};
  const res = new URL(url).hostname.endsWith('.yahoo.com')?await yahooRequest(url,init,'news'):await fetch(url,init);
  if (!res.ok) throw new Error(`rss ${res.status} ${url}`);
  const xml = await res.text();
  const doc = parser.parse(xml);
  const items = doc?.rss?.channel?.item ?? [];
  const list = Array.isArray(items) ? items : [items];
  return list
    .filter((i: any) => i?.title && i?.link)
    .map((i: any) => ({
      title: String(i.title),
      link: String(i.link),
      publisher: typeof i.source==='string'?i.source:i.source?.["#text"] ?? publisher,
      publishedAt: i.pubDate&&Number.isFinite(Date.parse(i.pubDate)) ? new Date(i.pubDate).toISOString() : null,
      symbol,
      language: /\p{Script=Han}/u.test(String(i.title))?'zh':language==='zh'?'en':language,
    }));
}

export async function symbolNews(symbol: string): Promise<NewsItem[]> {
  const url = `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${encodeURIComponent(symbol)}&region=US&lang=en-US`;
  return fetchRss(url, "Yahoo Finance", symbol);
}

export async function topNews(query = "stock market",language:'en'|'zh'='en'): Promise<NewsItem[]> {
  const locale=language==='zh'?'hl=zh-CN&gl=CN&ceid=CN:zh-Hans':'hl=en-US&gl=US&ceid=US:en';
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&${locale}`;
  return fetchRss(url, "Google News", null,language);
}

/** Merge, de-duplicate by normalized title, newest first. */
export function dedupe(lists: NewsItem[][]): NewsItem[] {
  const seen = new Set<string>();
  const out: NewsItem[] = [];
  for (const item of lists.flat()) {
    const key = item.title.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim()||item.link;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out.sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""));
}
