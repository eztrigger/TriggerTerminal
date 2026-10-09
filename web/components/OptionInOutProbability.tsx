"use client";
import {fmt} from '../lib/api';
import {tr} from '../lib/i18n';

export default function OptionInOutProbability({probability,sold}:{probability:number|null;sold:boolean}){
 const p=probability!==null&&Number.isFinite(probability)&&probability>=0&&probability<=1?probability:null;
 const values=[p,p===null?null:1-p];
 return <span className="oa-inout" role="img" aria-label={tr('到期位置概率')+' · IN '+(p===null?'—':fmt(p*100,1)+'%')+' · OUT '+(p===null?'—':fmt((1-p)*100,1)+'%')} title={tr('到期价内概率，不是提前触及或实际指派概率')}>
  {values.map((v,i)=><span key={i} className={'oa-inout-zone '+(v===null?'is-missing':(i===0?sold:!sold)?'down':'up')} style={{flexGrow:v??.5}}><small>{i===0?'IN':'OUT'} · {tr(i===0?'价内':'价外')}</small><b>{v===null?'—':fmt(v*100,1)+'%'}</b></span>)}
 </span>;
}
