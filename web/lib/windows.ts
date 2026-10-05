import {tr} from './i18n';
export function openTradingWindow(path:string){
 const popup=window.open(path,'_blank','popup=yes,width=1100,height=760,resizable=yes,scrollbars=yes');
 if(!popup) window.alert(tr('窗口未能打开，请允许此网站弹出窗口，或使用桌面版交易台。'));
}
