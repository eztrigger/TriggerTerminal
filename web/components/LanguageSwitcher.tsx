"use client";
import {Languages} from 'lucide-react';
import {getLanguage,setLanguage,tr,type Language} from '../lib/i18n';

export default function LanguageSwitcher(){
 return <label className="language-switcher" title={tr('语言')}><Languages size={14} aria-hidden="true"/><select aria-label={tr('语言')} value={getLanguage()} onChange={e=>{
  setLanguage(e.target.value as Language);
  window.location.reload();
 }}><option value="zh-CN">中文</option><option value="en">English</option></select></label>;
}
