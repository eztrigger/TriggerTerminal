"use client";
import {strategies,strategyFamilies} from '../../server/src/strategy-catalog';
import {getLanguage,tr} from '../lib/i18n';
export const strategyLabel=(id:string)=>{const s=strategies.find(s=>s.id===id);return s?(getLanguage()==='en'?s.en:s.zh):tr('自定义 / 未分类');};
export default function StrategyPicker({value,onChange,disabled=false}:{value:string;onChange:(id:string)=>void;disabled?:boolean}){
 const families:Record<string,string>={'Equity':'股票与单腿','Income & protection':'收息与保护','Vertical':'垂直价差','Volatility':'波动率策略','Butterfly & condor':'蝶式与秃鹰','Calendar & diagonal':'日历与对角','Ratio':'比例策略','Synthetic & arbitrage':'合成与套利','Custom':'自定义'};
 return <label className="strategy-picker">{tr('策略分类')}<select aria-label={tr('策略分类')} disabled={disabled} value={value} onChange={e=>onChange(e.target.value)}>{strategyFamilies.map(f=><optgroup key={f} label={tr(families[f])}>{strategies.filter(s=>s.family===f).map(s=><option key={s.id} value={s.id}>{strategyLabel(s.id)}</option>)}</optgroup>)}</select></label>;
}
