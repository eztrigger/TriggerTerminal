'use client';
import type {BasicScore} from '../../server/src/triggerpoints-basic';
import {tr,uiLocale} from '../lib/i18n';
import {fmt} from '../lib/api';
const statuses:Record<string,string>={missing:'缺少数据',undated:'缺少报告日期',stale:'数据已过期或日期异常',invalid:'数据值无效',ready:'可计分'};
function value(v:number|null,unit:string){return v===null?'—':unit==='percent'?fmt(v*100,2)+'%':unit==='checks'?fmt(v,0)+' / 3':fmt(v,3);}
const formulas:Record<string,string>={operatingMargin:'营业利润 ÷ 收入',revenueGrowth:'本期收入 ÷ 上年同期收入 − 1',cfoAssets:'经营现金流 ÷ 期初期末平均总资产',debtCoverage:'流动资产 ÷ 流动负债',earningsYield:'1 ÷ 滚动市盈率；或同币种每股收益 ÷ 股价',trend:'现价高于 MA200、MA50 高于 MA200、MA200 高于 20 个交易日前，各记 1 项',returnOnEquity:'供应商披露的净资产收益率'};
export default function BasicStockScore({score,industry}:{score?:BasicScore;industry?:string}){
 const s=score;
 if(!s)return <p className="pa-note">{tr('尚无分析数据')}</p>;
 if(s.version!=='basic-v1')return <p className="pa-notice">{tr('请重启交易台以加载新版评分服务')}</p>;
 return <>
 <div className="pa-metrics"><div className="pa-metric"><span>triggerpoints · {tr('基础版')}</span><strong>{s?.score!==null&&s?.score!==undefined?s.score+' / 100':tr('仅分项')}</strong><small>{s?.score!==null&&s?.score!==undefined?tr(s.provisional?'暂估总分':'完整基础分'):tr('尚未满足总分条件')}</small></div><div className="pa-metric"><span>{tr('有效数据权重')}</span><strong>{s?s.coverage+' / 100':'—'}</strong></div><div className="pa-metric"><span>{tr('评分模板')}</span><strong>{tr(s?.profile==='bank'?'银行经营基础版':s?.profile==='unsupported'?'暂不支持该行业':'普通公司基础版')}</strong></div><div className="pa-metric"><span>{tr('行业')}</span><strong>{industry||'—'}</strong></div></div>
 <p className="pa-note">{tr('固定规则分，不是同业排名、目标价或收益预测；不同模板不可直接比较。')}</p>
 {s?.profile==='bank'&&<p className="pa-notice">{tr('银行分数仅描述经营、估值与走势，不包含资本充足率、不良贷款和流动性风险，不能作为银行安全评级。')}</p>}
 {s?.profile==='unsupported'&&<p className="pa-notice">{tr('行业未知、非银行金融及房地产暂不生成总分，保留可核对的分项。')}</p>}
 {!!s?.missingCore.length&&<p className="pa-notice">{tr('总分缺少关键项')}：{s.metrics.filter(m=>s.missingCore.includes(m.key)).map(m=>tr(m.label)).join(' · ')}</p>}
 {s&&s.coverage<80&&<p className="pa-notice">{tr('有效数据权重不足 80%，只显示分项。')}</p>}
 {s&&s.score!==null&&<p className="pa-note">{tr('总分计算')}：{fmt(s.earned,2)} ÷ {s.coverage} × 100 ≈ {s.score}。{s.provisional&&<>{tr('缺项按零分至满分计算的原始区间')}：{fmt(s.bounds.low,1)}–{fmt(s.bounds.high,1)} / 100。</>}</p>}
 <div className="pa-score-modules">{s?.metrics.map(m=><details key={m.key}><summary><span>{tr(m.label)}{m.core?' · '+tr('关键项'):''}</span><span>{m.points===null?tr(statuses[m.status]):fmt(m.points,2)+' / '+m.weight}</span></summary>
 <p><b>{tr('抓取值')}：{value(m.value,m.unit)}</b> · {tr('权重')} {m.weight}</p>
 <p>{tr('指标计算')}：{tr(formulas[m.key])}</p>
 <p>{tr('评分锚点')}：≤ {value(m.low,m.unit)} → 0；≥ {value(m.high,m.unit)} → {m.weight}。{tr('区间内线性计分，区间外封顶或保底。')}</p>
 <p>{tr('规则计算')}：clamp((x − {m.low}) / ({m.high} − {m.low}), 0, 1) × {m.weight}{m.points===null?'':' = '+fmt(m.points,4)}</p>
 <p>{tr('数据来源')}：{m.evidence?.url?<a href={m.evidence.url} target="_blank" rel="noreferrer">{m.evidence.source}</a>:m.evidence?.source??'—'} · {m.evidence?.asOf?.slice(0,10)??'—'}{m.evidence?.filed?' · '+tr('披露日期')+' '+m.evidence.filed:''}</p>
 <p>{tr('允许的数据年龄（天）')}：{m.maxAgeDays}{m.key==='earningsYield'?' · '+tr('估值股价须在 7 天以内'):''} · {tr(statuses[m.status])}</p>
 {m.evidence?.priceAsOf&&<p>{tr('估值价格日期')}：{new Date(m.evidence.priceAsOf).toLocaleString(uiLocale())}</p>}
 {m.evidence?.inputs!==undefined&&<details><summary>{tr('核对原始输入')}</summary><pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere',fontSize:11}}>{JSON.stringify(m.evidence.inputs,null,2)}</pre></details>}
 </details>)}</div>
 <details className="pa-details"><summary>{tr('评分方法')} · basic-v1</summary><p>{tr('单项按固定锚点线性计分。有效数据权重至少 80%，且所有关键项有效，才显示总分。缺失值不补零，不补中性分。')}</p><p>{tr('总分等于已得分除以有效权重再乘 100；覆盖不足 100% 时标为暂估。负利润或负现金流是有效低分，不视为缺失。')}</p><p>{tr('SEC 年度数据最长 450 天，其他财务数据最长 180 天，行情最长 7 天。日期不明或过期的指标不计分。')}</p><p>{tr('权重和锚点是可复核的产品规则，尚未回测，不是监管标准。')}</p></details>
 </>;
}
