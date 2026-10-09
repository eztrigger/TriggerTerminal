import { z } from 'zod';

export const VERSION = 'CSP V1.1 / mapping-2026-09-28';
export const pools = ['A', 'B', 'C', 'D', 'E', 'F'] as const;
export type Pool = typeof pools[number];
export const poolNames = { A: '优质回调', B: '稳定区间', C: '稳健成长', D: '事件修复', E: '周期转型', F: '行业普跌' };
export const parameterFields = [
  ['minMarketCapB', '最低市值 / 十亿美元', 0, 1000, .5], ['minDollarVolumeM', '20日均成交额 / 百万美元', 0, 10000, 5],
  ['dteMin', '最短 DTE', 7, 90, 1], ['dteMax', '最长 DTE', 7, 90, 1], ['deltaMin', '最小 |Delta|', .01, .5, .01], ['deltaMax', '最大 |Delta|', .01, .5, .01],
  ['minOi', '最低 OI', 1, 100000, 100], ['maxSpreadPct', '最大相对价差 / %', .1, 100, 1], ['minPremium30Pct', '最低30日权利金 / %', 0, 10, .1],
  ['feesPerContract', '每张预计费用 / USD', 0, 100, .1], ['contracts', '计划张数', 1, 100, 1], ['earningsBufferDays', '财报前缓冲 / 天', 0, 30, 1],
  ['maxContracts', '每股合约扫描上限', 20, 600, 20], ['maxExpiries', '每股到期日上限', 1, 8, 1],
  ['maxCspPct', 'CSP 总义务上限 / NAV %', 1, 100, 1], ['singleNormalPct', '普通股票上限 / NAV %', 1, 25, 1], ['singleRiskPct', '高风险股票上限 / NAV %', 1, 15, 1],
  ['sectorPct', '行业上限 / NAV %', 1, 100, 1], ['eventPct', 'D/E 合计上限 / NAV %', 1, 50, 1], ['expiryWeekPct', '同到期周 / CSP预算 %', 1, 100, 1],
] as const;
export const paramsSchema = z.object({
  minMarketCapB: z.number().min(0).max(1000).default(3), minDollarVolumeM: z.number().min(0).max(10000).default(25),
  dteMin: z.number().int().min(7).max(90).default(21), dteMax: z.number().int().min(7).max(90).default(45),
  deltaMin: z.number().min(.01).max(.5).default(.1), deltaMax: z.number().min(.01).max(.5).default(.25),
  minOi: z.number().int().min(1).max(100000).default(500), maxSpreadPct: z.number().min(.1).max(100).default(10), minPremium30Pct: z.number().min(0).max(10).default(.5),
  feesPerContract: z.number().min(0).max(100).default(1), contracts: z.number().int().min(1).max(100).default(1), earningsBufferDays: z.number().int().min(0).max(30).default(7),
  maxContracts: z.number().int().min(20).max(600).default(120), maxExpiries: z.number().int().min(1).max(8).default(3),
  maxCspPct: z.number().min(1).max(100).default(50), singleNormalPct: z.number().min(1).max(25).default(10), singleRiskPct: z.number().min(1).max(15).default(5),
  sectorPct: z.number().min(1).max(100).default(25), eventPct: z.number().min(1).max(50).default(15), expiryWeekPct: z.number().min(1).max(100).default(35),
  patternRequired: z.boolean().default(true), pools: z.array(z.enum(pools)).min(1).default(['A','B','C','D','E','F']),
  ranking: z.enum(['balanced','value','premium']).default('balanced'),
}).refine(p => p.dteMin <= p.dteMax && p.deltaMin <= p.deltaMax, '最小值不能超过最大值');
export type Params = z.infer<typeof paramsSchema>;

export const metricFields = [
  ['marketCapB','市值 / 十亿美元','security'], ['valueLow','保守价值下限 / 股 USD','valuation'], ['valueHigh','保守价值上限 / 股 USD','valuation'],
  ['fcf1','最近财年 FCF / 百万美元','financial'], ['fcf2','前一财年 FCF / 百万美元','financial'], ['fcf3','前二财年 FCF / 百万美元','financial'],
  ['profit1','最近财年净利润 / 百万美元','financial'], ['profit2','前一财年净利润 / 百万美元','financial'], ['profit3','前二财年净利润 / 百万美元','financial'],
  ['ttmProfit','TTM 净利润 / 百万美元','financial'], ['ttmFcf','TTM FCF / 百万美元','financial'], ['netDebtEbitda','净负债 / EBITDA','financial'], ['interestCoverage','EBIT / 利息费用','financial'],
  ['marginStd','12季度营业利润率标准差 / 百分点','financial'], ['revenueCagr','3年收入 CAGR / %','financial'], ['epsRevision','90日 F12M EPS 修正 / %','financial'],
  ['capitalCoverage','压力资金覆盖倍数','financial'], ['runwayMonths','压力资金覆盖月数','financial'], ['repairCount','独立修复证据数','event'], ['realizedRepairCount','已兑现修复证据数','event'],
  ['improvementCount','连续2个可比季度改善的独立指标数','financial'], ['eventDrop5','事件后5交易日收益 / %','event'], ['eventDrop20','事件后20交易日收益 / %','event'], ['eventRelative','事件期相对行业收益 / 百分点','event'],
  ['iv30','同口径 ATM IV30 / %','volatility'], ['ivRank','同口径 IV Rank / %','volatility'], ['ivPercentile','同口径 IV Percentile / %','volatility'], ['skew25','同期限25Delta Put IV减ATM / 百分点','volatility'],
  ['worstEarningsGap','最近8次财报最差隔夜收益 / %','volatility'],
] as const;
export const checkFields = [
  ['securityEligible','美国交易所普通股资格（ETF/OTC等不通过）','security'], ['financialReliable','无破产、持续经营或未解决重大重述','financial'],
  ['industryApproved','特殊行业模型已审核通过','financial'], ['businessStable','无商业模式突变','financial'], ['fundingAdequate','无重大融资缺口','financial'],
  ['dilutionIncluded','估值已包含 SBC 和完全摊薄股数','valuation'], ['qualityRelative','行业相对质量指标已复核','financial'],
  ['eventsReviewed','财报及重大节点已完整复核','event'], ['noIndependentDeterioration','无公司独立重大恶化','event'], ['eventDamageBounded','事件损害机制和持续/一次性损失可界定','event'],
  ['operatingEvidenceIndependent','改善指标相互独立且覆盖2个可比季度','financial'], ['corporateActionsReviewed','已核对拆股、除息和其他公司行为','event'],
  ['standardDelivery','本次扫描系列为标准100股交割','security'],
] as const;
const metricKeys = metricFields.map(f => f[0]) as [typeof metricFields[number][0], ...typeof metricFields[number][0][]];
const checkKeys = checkFields.map(f => f[0]) as [typeof checkFields[number][0], ...typeof checkFields[number][0][]];
const date = z.string().refine(s => s === '' || /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(Date.parse(s)), '日期无效');
const httpUrl = z.string().url().refine(s => /^https?:\/\//.test(s), '仅支持 HTTP/HTTPS 来源');
export const evidenceSchema = z.object({
  scope: z.enum(['security','financial','valuation','event','volatility','industry']), url: httpUrl, publishedAt: date.refine(Boolean),
  periodEnd: date.default(''), version: z.string().max(120).default(''), fact: z.string().min(1).max(3000), inference: z.string().max(3000).default(''),
  kind: z.enum(['filing','regulator','management','research']).default('filing'), reviewed: z.boolean().default(false),
});
export const reviewSchema = z.object({
  symbol: z.string().trim().toUpperCase().regex(/^[A-Z][A-Z0-9.-]{0,15}$/), model: z.enum(['ordinary','bank','healthInsurance','insurance','reit','cyclical','commodity']).default('ordinary'),
  sector: z.string().max(100).default(''), industryEtf: z.string().regex(/^$|^[A-Z][A-Z0-9.-]{0,15}$/).default(''), adr: z.boolean().default(false),
  metrics: z.record(z.enum(metricKeys), z.number().finite().nullable()).default({}), checks: z.record(z.enum(checkKeys), z.enum(['pass','fail','unknown'])).default({}),
  earningsDate: date.default(''), earningsConfirmed: z.boolean().default(false), eventDate: date.default(''),
  events: z.array(z.object({ id: z.string().min(1).max(120), date, title: z.string().min(1).max(200), url: httpUrl, binary: z.boolean(), resolved: z.boolean().default(false) })).max(30).default([]),
  evidence: z.array(evidenceSchema).max(40).default([]), notes: z.string().max(4000).default(''), reviewedAt: z.string().default(''),
});
export type Review = z.infer<typeof reviewSchema>;
export const configSchema = z.object({
  symbols: z.array(z.string().trim().toUpperCase().regex(/^[A-Z][A-Z0-9.-]{0,15}$/)).max(30).default(['AAPL','MSFT','GOOGL']),
  params: paramsSchema.default({}), secContact: z.string().max(200).refine(s => !s || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s), 'SEC 联系邮箱无效').default(''),
});
export type Config = z.infer<typeof configSchema>;
export type Bar = { date: string; open: number; high: number; low: number; close: number; volume: number };
export type Option = { conId: number; expiry: string; strike: number; multiplier: number; right: string; tradingClass: string; bid: number|null; ask: number|null; bidSize: number|null; volume: number|null; oi: number|null; iv: number|null; delta: number|null; gamma: number|null; vega: number|null; receivedAt: string|null; marketDataType: number|null; underlyingPrice: number|null };
export type Snapshot = { symbol: string; name: string; stockType: string; exchange: string; industry: string; bars: Bar[]; spot: number|null; spotAt: string|null; marketDataType: number|null; options: Option[]; fetchedAt: string; coverage: { available: number; requested: number; qualified: number; expiries: string[]; availableExpiries: number; truncated: boolean }; errors: string[] };
export type Pattern = { name: string; pools: Pool[]; state: 'candidate'|'weak'|'confirmed'|'invalid'|'expired'; scale: 'daily'; pivotDates: string[]; availableAt: string; confirmedAt: string|null; expiresAt: string|null; support: number|null; resistance: number|null; atr: number; invalidation: number; strikeCap: number|null };
export type Technical = { bars: number; asOf: string|null; close: number|null; ma10: number|null; ma20: number|null; ma50: number|null; ma200: number|null; ma200Up: boolean|null; ma50Up10: boolean|null; ma20Up5: boolean|null; ma50Change20: number|null; rsi: number|null; atr: number|null; adx: number|null; plusDi: number|null; minusDi: number|null; dollarVolume20: number|null; drawdown60: number|null; rangeLow: number|null; rangeHigh: number|null; return20: number|null; rv20: number|null; rv60: number|null; noNewLow3: boolean|null; noNewLow20: boolean|null; eventStable: boolean|null; weeklyConflict: boolean|null; patterns: Pattern[]; risks: string[]; support: number|null; resistance: number|null };
export type Check = { name: string; state: 'pass'|'fail'|'unknown'; detail: string };
export type Account = { nav: number|null; cash: number|null; cashConfirmed: boolean; asOf: string; source: string; positions: { symbol:string; sector:string; marketValue:number; putObligation:number; expiry:string; highRisk:boolean }[]; exposuresConfirmed: boolean };
export type Candidate = { id:string; symbol:string; pool:Pool; tags:Pool[]; status:string; risk:string; option:Option; dte:number; netPremium:number|null; effectiveCost:number|null; discountPct:number|null; premium30Pct:number|null; cash:number; stress:(number|null)[]; checks:Check[]; score:number|null; scores:Record<string,number|null>; evidencePct:number; personalized:boolean; marketBudgetFactor:number; execution:string; nextStep:string };
export type StockResult = { symbol:string; snapshot:Snapshot|null; technical:Technical; review:Review; checks:Check[]; paths:{pool:Pool;checks:Check[]}[]; candidates:Candidate[]; status:string; errors:string[]; publicData:PublicData|null };
export type PublicData = { fetchedAt:string; cik:string|null; filings:{title:string;date:string;url:string}[]; facts:{name:string;value:number;unit:string;start:string;end:string;filed:string;accession:string;url:string}[]; errors:string[] };
export const accountSchema = z.object({nav:z.number().finite().positive().nullable(),cash:z.number().finite().nonnegative().nullable(),cashConfirmed:z.boolean(),exposuresConfirmed:z.boolean(),asOf:z.string().datetime(),source:z.string().max(200),positions:z.array(z.object({symbol:z.string().regex(/^[A-Z][A-Z0-9.-]{0,15}$/),sector:z.string().max(100),marketValue:z.number().finite(),putObligation:z.number().finite().nonnegative(),expiry:date,highRisk:z.boolean()})).max(200)});
export type Run = { id:string; createdAt:string; finishedAt:string|null; status:'running'|'complete'|'cancelled'|'failed'; stage:string; done:number; total:number; mode:'stocks'|'options'; config:Config; account:Account|null; market: {spy:Technical|null;vix:number|null;vix3m:number|null}; results:StockResult[]; errors:string[]; version:string };
