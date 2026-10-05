"use client";
import {useEffect,useRef,useState} from 'react';
import {tr} from '../lib/i18n';
import {parseHoldingQuantity} from '../lib/holdings-view';

export default function HoldingQuantityInput({value,whole,label,onChange}:{value:number;whole:boolean;label:string;onChange:(value:number)=>void}) {
 const [draft,setDraft]=useState(String(value));const input=useRef<HTMLInputElement>(null);
 const parsed=parseHoldingQuantity(draft,whole);
 useEffect(()=>{setDraft(current=>parseHoldingQuantity(current,whole)===value?current:String(value));},[value,whole]);
 useEffect(()=>{input.current?.setCustomValidity(parsed===null?tr(whole?'期权数量必须为非零整数':'请输入有效的非零股数，支持小数'): '');},[parsed,whole]);
 return <input ref={input} className="w-28" aria-label={label} type="text" inputMode="decimal" required value={draft} onChange={e=>{
  const next=e.target.value;setDraft(next);const quantity=parseHoldingQuantity(next,whole);
  e.target.setCustomValidity(quantity===null?tr(whole?'期权数量必须为非零整数':'请输入有效的非零股数，支持小数'):'');
  if(quantity!==null)onChange(quantity);
 }}/>;
}
