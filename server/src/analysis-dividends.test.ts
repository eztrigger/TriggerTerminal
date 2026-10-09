import {afterEach,expect,it,vi} from 'vitest';
vi.mock('./providers/yahoo.js',()=>({quotes:vi.fn()}));
import {quotes} from './providers/yahoo.js';
import {issuerDividendPolicy,readDividendEstimate} from './analysis-dividends.js';
afterEach(()=>{vi.useRealTimers();vi.clearAllMocks();});
it('uses dated issuer evidence only for the verified symbol, currency and validity window',()=>{
 const now=Date.parse('2026-10-07T12:00:00Z');
 expect(issuerDividendPolicy('CLS','USD',now)).toMatchObject({value:0,source:'Celestica',asOf:'2026-08-05'});
 expect(issuerDividendPolicy('MCD','USD',now)).toBeNull();expect(issuerDividendPolicy('CLS','CAD',now)).toBeNull();
 expect(issuerDividendPolicy('CLS','USD',Date.parse('2026-12-01'))).toBeNull();
});
it('does not reinterpret missing or mismatched dividend data as zero',async()=>{
 vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-07T12:00:00Z'));
 for(const patch of [{dividendYield:null},{currency:'CAD'},{time:1}]){
  vi.mocked(quotes).mockResolvedValue([{symbol:'MCD',currency:'USD',dividendYield:.02,time:Date.now()/1000,...patch}] as any);
  expect(await readDividendEstimate('MCD','USD')).toBeNull();
 }
 vi.mocked(quotes).mockResolvedValue([{symbol:'MCD',currency:'USD',dividendYield:.02,time:Date.now()/1000}] as any);
 expect((await readDividendEstimate('MCD','USD'))?.value).toBeCloseTo(Math.log1p(.02));
 expect((await readDividendEstimate('CLS','USD'))?.value).toBe(0);
});
