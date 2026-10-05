import * as yahoo from './providers/yahoo.js';

type ChainRequest = { symbol: string; expiry?: string; center?: number; count: '10' | '20' | 'all' };
const expiryLabel = (seconds: number) => new Date(seconds * 1000).toISOString().slice(0, 10).replaceAll('-', '');
const number = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;

export async function yahooOptionChain(request: ChainRequest) {
  const { symbol, expiry, center, count } = request;
  const date = expiry ? Date.parse(`${expiry.slice(0, 4)}-${expiry.slice(4, 6)}-${expiry.slice(6, 8)}T00:00:00Z`) / 1000 : undefined;
  if (date !== undefined && (!Number.isFinite(date) || expiryLabel(date) !== expiry)) throw new Error('所选到期日不属于当前期权链');
  const chain = await yahoo.options(symbol, date);
  if (!chain.selectedDate || (date !== undefined && chain.selectedDate !== date)) throw new Error('Yahoo 未返回指定到期日');
  const rows = (['C', 'P'] as const).flatMap(right => (right === 'C' ? chain.calls : chain.puts)
    .filter((row: any) => !row.nonStandard && number(row.strike) !== null && row.strike > 0)
    .map((row: any) => ({
      right, strike: row.strike as number, last: number(row.lastPrice), bid: number(row.bid), ask: number(row.ask),
      volume: number(row.volume), openInterest: number(row.openInterest), iv: number(row.impliedVolatility),
      marketDataType: null,
    })));
  if (!rows.length) throw new Error('Yahoo 暂无标准期权合约');
  const availableStrikes = [...new Set<number>(rows.map(row => row.strike))].sort((a, b) => a - b);
  const spot = number(chain.underlyingPrice);
  const anchor = center ?? (spot && spot > 0 ? spot : undefined);
  if (count !== 'all' && anchor === undefined) throw new Error('Yahoo 暂无标的参考价，请选择全部行权价');
  const strikes = new Set(count === 'all' ? availableStrikes : [...availableStrikes].sort((a, b) => Math.abs(a - anchor!) - Math.abs(b - anchor!) || a - b).slice(0, Number(count)));
  const options = rows.filter(row => strikes.has(row.strike));
  return {
    source: 'Yahoo Finance', symbol, tradingClass: symbol, tradingClasses: [symbol], spot,
    spotSource: 'Yahoo Finance', expiry: expiryLabel(chain.selectedDate),
    expiries: [...new Set<string>([...chain.expirationDates, chain.selectedDate].map(expiryLabel))].sort(),
    availableStrikes, options, fetchedAt: chain.fetchedAt,
    partial: options.some(row => row.bid === null || row.ask === null),
  };
}
