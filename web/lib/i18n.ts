import {english} from './translations/en';

export type Language = 'zh-CN' | 'en';
export const LANGUAGE_KEY = 'openterminal-language';
let language:Language='zh-CN';
export function initializeLanguage() {
 try {language=localStorage.getItem(LANGUAGE_KEY)==='en'?'en':'zh-CN';}catch{language='zh-CN';}
 return language;
}
export function setLanguage(value:Language) {
 language=value;
 try {localStorage.setItem(LANGUAGE_KEY,value);}catch{}
}
export function syncDesktopLanguage() {
 const bridge=(window as Window & {webkit?:{messageHandlers?:{setLanguage?:{postMessage:(value:string)=>void}}}}).webkit?.messageHandlers?.setLanguage;
 bridge?.postMessage(language);
}
export const uiLocale=()=>language==='en'?'en-US':'zh-CN';
export const getLanguage=()=>language;
const normalize=(value:string)=>value.trim().replace(/\s+/g,' ');
const fragments=Object.entries(english).filter(([key])=>/[\p{Script=Han}]/u.test(key)&&!key.includes('{')).sort(([a],[b])=>b.length-a.length);
const escape=(value:string)=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const templates=Object.entries(english).filter(([key])=>/\{\d+\}/.test(key)).map(([key,value])=>({
 pattern:new RegExp('^'+key.split(/\{\d+\}/).map(escape).join('(.*?)')+'$'),value,
}));
/** Translate presentation only. Never use translated text as an API value or record identity. */
export function tr<T>(value:T):T {
 if(language!=='en'||typeof value!=='string'||!/[\p{Script=Han}]/u.test(value))return value;
 const key=normalize(value);
 let result=english[key];
 if(result===undefined){
  for(const template of templates){const match=key.match(template.pattern);if(match){result=template.value.replace(/\{(\d+)\}/g,(_,i)=>String(tr(match[Number(i)+1])));break;}}
 }
 if(result===undefined){
  result=key;
  // Dynamic server diagnostics may combine a contract identifier with a translated message.
  for(const [source,target] of fragments)if(result.includes(source))result=result.split(source).join(target);
 }
 return (value.match(/^\s*/)?.[0]+result+value.match(/\s*$/)?.[0]) as T;
}
