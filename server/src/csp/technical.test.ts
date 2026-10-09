import { describe, expect, it } from 'vitest';
import { technical } from './technical.js';
import { evaluateStock } from './rules.js';
import { paramsSchema, reviewSchema, type Bar, type Snapshot } from './schema.js';

const bars: Bar[] = [];
for (let day = 0; day < 800; day++) {
  const date = new Date(Date.UTC(2024, 6, 1 + day));
  if (date.getUTCDay() === 0 || date.getUTCDay() === 6) continue;
  const close = 100 + Math.sin(day / 20) * 10;
  bars.push({ date: date.toISOString().slice(0, 10), open: close, high: close + 1, low: close - 1, close, volume: 1000000 });
}

describe('CSP scan timestamp handling', () => {
  it.each(['2026-09-28T20:33:15.803Z', '2026-09-28T00:00:00.000Z', '2026-09-28T23:59:59.999Z'])(
    'accepts the full ISO timestamp supplied by a scan: %s', asOf => {
      const result = technical(bars, '', asOf);
      expect(result).toEqual(technical(bars, '', '2026-09-28'));
      expect(result.bars).toBeGreaterThan(520);
      expect(result.weeklyConflict).not.toBeNull();
    },
  );

  it('handles missing IBKR data without masking the data gap with a date exception', () => {
    expect(technical([], '', '2026-09-28T20:33:15.803Z')).toEqual(technical([], '', '2026-09-28'));
  });

  it.each([true, false])('evaluates the scan with a timestamp when snapshot is available=%s', available => {
    const snapshot: Snapshot = {
      symbol: 'TSLA', name: 'Test', stockType: 'COMMON', exchange: 'NASDAQ', industry: '', bars,
      spot: 100, spotAt: '2026-09-28T20:33:15.803Z', marketDataType: 1, options: [],
      fetchedAt: '2026-09-28T20:33:15.803Z', errors: [],
      coverage: { available: 0, requested: 0, qualified: 0, expiries: [], availableExpiries: 0, truncated: false },
    };
    const result = evaluateStock(available ? snapshot : null, reviewSchema.parse({ symbol: 'TSLA' }),
      paramsSchema.parse({}), { spy: null, vix: null, vix3m: null }, null, null, '2026-09-28T20:33:15.803Z');
    expect(result.symbol).toBe('TSLA');
    expect(result.technical.bars).toBe(available ? bars.length : 0);
    expect(result.status).not.toBe('可研究交易');
  });
});
