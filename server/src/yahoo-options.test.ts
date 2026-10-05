import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';

vi.mock('./db.js', () => ({ dataDir: '/nonexistent-options-test-data' }));
vi.mock('./market-source.js', () => ({ marketSource: { active: 'yahoo' } }));
vi.mock('./providers/yahoo.js', () => ({ options: vi.fn() }));
vi.mock('node:child_process', () => ({ spawn: vi.fn(() => { throw new Error('Unexpected IBKR process'); }) }));
import { spawn } from 'node:child_process';
import * as yahoo from './providers/yahoo.js';
import { marketSource } from './market-source.js';
import { optionsRouter } from './ibkr-options.js';

const expiry = Date.UTC(2026, 9, 9) / 1000;
const nextExpiry = Date.UTC(2026, 9, 16) / 1000;
const fetchedAt = '2026-10-05T14:00:00.000Z';
const option = (strike: number) => ({ strike, bid: 0, ask: 2, lastPrice: 1, volume: 0, openInterest: 3, impliedVolatility: .5 });
let server: Server;
let base: string;
beforeAll(async () => {
  const app = express(); app.use('/chain', optionsRouter);
  server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/chain/chain?symbol=COIN`;
});
afterAll(async () => { await new Promise<void>(resolve => server.close(() => resolve())); });
beforeEach(() => {
  vi.clearAllMocks(); marketSource.active = 'yahoo';
  vi.mocked(yahoo.options).mockResolvedValue({
    underlyingPrice: 100, selectedDate: expiry, expirationDates: [expiry, nextExpiry], fetchedAt,
    calls: Array.from({ length: 30 }, (_, i) => option(90 + i)),
    puts: Array.from({ length: 30 }, (_, i) => option(90 + i)),
  });
});
it('serves COIN from Yahoo with no IBKR config or process and preserves quote fields', async () => {
  const res = await fetch(base); const chain = await res.json();
  expect(res.status).toBe(200);
  expect(yahoo.options).toHaveBeenCalledWith('COIN', undefined);
  expect(spawn).not.toHaveBeenCalled();
  expect(chain).toMatchObject({ source: 'Yahoo Finance', symbol: 'COIN', expiry: '20261009', expiries: ['20261009', '20261016'], fetchedAt, spot: 100 });
  expect(chain.options).toHaveLength(20);
  expect(chain.options[0]).toMatchObject({ right: 'C', strike: 95, last: 1, bid: 0, iv: .5, volume: 0, marketDataType: null });
  expect(chain.availableStrikes).toHaveLength(30);
});
it('passes the exact UTC expiry and supports center, 20 strikes, and all strikes', async () => {
  vi.mocked(yahoo.options).mockImplementation(async (_symbol, date) => ({
    underlyingPrice: 100, selectedDate: date ?? expiry, expirationDates: [expiry, nextExpiry], fetchedAt,
    calls: Array.from({ length: 30 }, (_, i) => option(90 + i)), puts: [],
  }));
  const chain = await fetch(base + '&expiry=20261016&center=110&count=20').then(r => r.json());
  expect(yahoo.options).toHaveBeenCalledWith('COIN', nextExpiry);
  expect(chain.expiry).toBe('20261016');
  expect(chain.options.map((row: any) => row.strike)).toEqual(Array.from({ length: 20 }, (_, i) => 100 + i));
  expect((await fetch(base + '&count=all').then(r => r.json())).options).toHaveLength(30);
});
it('excludes adjusted contracts and keeps missing quotes null', async () => {
  vi.mocked(yahoo.options).mockResolvedValue({ underlyingPrice: 100, selectedDate: expiry, expirationDates: [expiry], fetchedAt,
    calls: [{ strike: 100, bid: null, ask: -1 }, { ...option(101), nonStandard: true }, { strike: null }], puts: [] });
  const chain = await fetch(base).then(r => r.json());
  expect(chain.options).toHaveLength(1);
  expect(chain.options[0]).toMatchObject({ bid: null, ask: null, last: null });
  expect(chain.partial).toBe(true);
});
it('rejects invalid and mismatched expiries rather than displaying the wrong contracts', async () => {
  expect((await fetch(base + '&expiry=20260230')).status).toBe(503);
  expect(yahoo.options).not.toHaveBeenCalled();
  expect((await fetch(base + '&expiry=20261016')).status).toBe(503);
  expect(spawn).not.toHaveBeenCalled();
});
it('reports Yahoo failures without falling back to IBKR', async () => {
  vi.mocked(yahoo.options).mockRejectedValue(new Error('yahoo 429'));
  const res = await fetch(base);
  expect(res.status).toBe(503);
  expect(await res.json()).toEqual({ error: 'yahoo 429' });
  expect(spawn).not.toHaveBeenCalled();
});
it('keeps API mode on the IBKR path', async () => {
  marketSource.active = 'api';
  const res = await fetch(base);
  expect(res.status).toBe(503); // The intentionally absent IBKR config is still required in API mode.
  expect((await res.json()).error).toContain('ibkr.json');
  expect(yahoo.options).not.toHaveBeenCalled();
});
