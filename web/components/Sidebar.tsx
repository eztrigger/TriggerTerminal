"use client";
import {tr,uiLocale} from "../lib/i18n";
import LayoutMenu from './LayoutMenu';
import {ChartCandlestick,Activity,Star,Newspaper,SlidersHorizontal,ListFilter,Globe,CalendarDays,Users,Wallet,Bitcoin,Rows3,Tv,FileText,Ellipsis,RotateCcw,ArrowUpRight,type LucideIcon} from 'lucide-react';
import {useTerminal,type WidgetType} from '../store/terminal';
import {openTradingWindow} from '../lib/windows';
type Item={label:string;icon:LucideIcon;type?:WidgetType;path?:string;shortcut?:string};
const groups:Array<{label:string;items:Item[]}>= [
 {label:'市场',items:[
  {label:'图表',icon:ChartCandlestick,type:'chart',shortcut:'⌥1'},
  {label:'行情',icon:Activity,type:'quote',shortcut:'⌥2'},
  {label:'自选',icon:Star,type:'watchlist'},
  {label:'新闻',icon:Newspaper,type:'news',shortcut:'⌥3'},
  {label:'期权链',icon:Rows3,type:'options',shortcut:'⌥7'},
  {label:'加密资产',icon:Bitcoin,type:'crypto',shortcut:'⌥6'}]},
 {label:'研究',items:[
  {label:'宏观指数',icon:Globe,type:'macro'},
  {label:'财经日历',icon:CalendarDays,type:'calendar'},
  {label:'内部人交易',icon:Users,type:'insider'}]},
 {label:'资产',items:[{label:'仓位与分析',icon:Wallet,path:'/holdings',shortcut:'⌥8'},{label:'虚拟货币的持仓',icon:Bitcoin,path:'/crypto-holdings'}]},
 {label:'更多',items:[{label:'财经直播',icon:Tv,type:'tv'},{label:'市场综述',icon:FileText,type:'recap'}]}
];
export default function Sidebar(){
 const addWidget=useTerminal(s=>s.addWidget);
 return <nav className="terminal-navigation" aria-label={tr("交易工具")}>
  <div className="terminal-navigation-groups">{tr(groups.map(group=><section key={group.label} aria-label={tr(group.label)}>
   <h2>{tr(group.label)}</h2>
   {tr(group.items.map(({label,icon:Icon,type,path,shortcut})=><button key={label} type="button" title={tr((path?'打开':'添加')+label+(shortcut?' · '+shortcut:''))} onClick={()=>path?openTradingWindow(path):type&&addWidget(type)}>
    <Icon size={15} strokeWidth={1.6} aria-hidden="true"/><span>{tr(label)}</span>{tr(path&&<ArrowUpRight className="terminal-navigation-external" size={11} aria-hidden="true"/>)}
   </button>))}
  </section>))}</div>
  <LayoutMenu/>
 </nav>;
}
