import type { Bar, Pattern, Pool, Technical } from './schema.js';

const mean = (v:number[]) => v.reduce((a,b)=>a+b,0)/v.length;
const sma = (v:number[], n:number, i:number) => i >= n-1 ? mean(v.slice(i-n+1,i+1)) : null;
function wilder(values:number[], period:number): (number|null)[] {
  const out:(number|null)[]=values.map(()=>null);
  if(values.length<period)return out;
  out[period-1]=mean(values.slice(0,period));
  for(let i=period;i<values.length;i++)out[i]=(out[i-1]!*(period-1)+values[i])/period;
  return out;
}
export function validBars(input:Bar[]):Bar[] {
  const unique=new Map<string,Bar>();
  for(const b of input)if(/^\d{4}-\d{2}-\d{2}$/.test(b.date)&&[b.open,b.high,b.low,b.close,b.volume].every(Number.isFinite)&&b.low>0&&b.volume>=0&&b.high>=Math.max(b.open,b.close,b.low)&&b.low<=Math.min(b.open,b.close))unique.set(b.date,b);
  return [...unique.values()].sort((a,b)=>a.date.localeCompare(b.date));
}
export type Pivot={index:number;available:number;price:number;date:string};
export function pivots(bars:Bar[], high=false):Pivot[]{
  const out:Pivot[]=[];const v=(i:number)=>high?bars[i].high:-bars[i].low;
  for(let i=2;i<bars.length-2;i++)if(v(i)>v(i-1)&&v(i)>v(i-2)&&v(i)>=v(i+1)&&v(i)>=v(i+2))out.push({index:i,available:i+2,price:high?bars[i].high:bars[i].low,date:bars[i].date});
  return out;
}
function level(points:Pivot[],before:number,a:number,price:number,high:boolean,bars:Bar[]):number|null{
  const available=points.filter(p=>p.available<before&&p.index>=before-120);const found:number[]=[];
  for(let j=1;j<available.length;j++)for(let i=0;i<j;i++){
    const x=available[i],y=available[j],s=(x.price+y.price)/2;
    if(y.index-x.index<5||Math.abs(x.price-y.price)>.5*a||(high?s<price:s>price))continue;
    if(bars.slice(y.available+1,before).some(b=>high?b.close>s+.5*a:b.close<s-.5*a))continue;
    found.push(s);
  }
  return found.length?(high?Math.min(...found):Math.max(...found)):null;
}
function volatility(closes:number[],n:number):number|null{
  if(closes.length<n+1)return null;
  const values=closes.slice(-n).map((c,i)=>Math.log(c/closes[closes.length-n-1+i]));const m=mean(values);
  return Math.sqrt(values.reduce((s,v)=>s+(v-m)**2,0)/(n-1)*252)*100;
}
function completedWeeks(bars:Bar[],asOf:string):Bar[]{
  // Both date-only bars and ISO scan timestamps use the same calendar-day key.
  const monday=(date:string)=>{const d=new Date(date.slice(0,10)+'T00:00:00Z');d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7));return d.toISOString().slice(0,10);};
  const current=monday(asOf),weeks=new Map<string,Bar>();
  for(const b of bars){const key=monday(b.date);if(key>=current)continue;const old=weeks.get(key);weeks.set(key,old?{...old,high:Math.max(old.high,b.high),low:Math.min(old.low,b.low),close:b.close,volume:old.volume+b.volume}: {...b});}
  return [...weeks.values()];
}
function lowerStructure(bars:Bar[]):boolean|null{
  const lo=pivots(bars).slice(-2),hi=pivots(bars,true).slice(-2);
  return lo.length===2&&hi.length===2?lo[1].price<lo[0].price&&hi[1].price<hi[0].price:null;
}
export function technical(input:Bar[],eventDate='',asOf=new Date().toISOString().slice(0,10)):Technical{
  const bars=validBars(input),n=bars.length,last=n-1,c=bars.map(b=>b.close);
  const tr=bars.map((b,i)=>i?Math.max(b.high-b.low,Math.abs(b.high-c[i-1]),Math.abs(b.low-c[i-1])):b.high-b.low);
  const atr=wilder(tr,14),g=wilder(c.slice(1).map((x,i)=>Math.max(0,x-c[i])),14),l=wilder(c.slice(1).map((x,i)=>Math.max(0,c[i]-x)),14);
  const plus=wilder(bars.map((b,i)=>i&&b.high-bars[i-1].high>bars[i-1].low-b.low?Math.max(0,b.high-bars[i-1].high):0),14);
  const minus=wilder(bars.map((b,i)=>i&&bars[i-1].low-b.low>b.high-bars[i-1].high?Math.max(0,bars[i-1].low-b.low):0),14);
  const pdi=plus.map((v,i)=>v!=null&&atr[i]?100*v/atr[i]!:null),mdi=minus.map((v,i)=>v!=null&&atr[i]?100*v/atr[i]!:null);
  const dx=pdi.slice(13).map((p,i)=>p!=null&&mdi[i+13]!=null?(p+mdi[i+13]!?100*Math.abs(p-mdi[i+13]!)/(p+mdi[i+13]!):0):0);
  const adx=wilder(dx,14),lo=pivots(bars),hi=pivots(bars,true);const patterns:Pattern[]=[];const risks:string[]=[];
  const rsiAt=(i:number)=>g[i-1]!=null&&l[i-1]!=null?(l[i-1]===0?(g[i-1]===0?50:100):100-100/(1+g[i-1]!/l[i-1]!)):null;
  const trend=(i:number)=>sma(c,200,i)!=null&&c[i]>sma(c,200,i)!&&sma(c,50,i)!>sma(c,50,i-10)!;
  const near=(low:number,s:number|null,a:number)=>s!=null&&Math.abs(low-s)<=.5*a;
  const add=(name:string,pools:Pool[],start:number,trigger:number,s:number|null,z:number|null,invalidation:number,confirm:(i:number,a:number)=>boolean,maxWait=3,long=false,weakAllowed=true)=>{
    const a=atr[start-1];if(!a||trigger<start)return;
    let state:Pattern['state']='candidate',confirmed=-1,invalid=-1;
    for(let j=trigger+1;j<n;j++){
      if(bars[j].close<invalidation){invalid=j;state='invalid';break;}
      if(confirmed<0&&j<=trigger+maxWait&&confirm(j,a)){
        const v20=sma(bars.map(b=>b.volume),20,start-1);
        if(v20!=null&&bars[j].volume>=1.2*v20){confirmed=j;state='confirmed';}
        else if(weakAllowed)state='weak';
      }
      if(confirmed>=0&&j-confirmed>(long?10:5)){state='expired';break;}
    }
    if(confirmed<0&&invalid<0&&last-trigger>maxWait)state='expired';
    if(last-trigger>35)return;
    const end=(confirmed>=0?confirmed+(long?10:5):trigger+maxWait);
    patterns.push({name,pools,state,scale:'daily',pivotDates:bars.slice(start,trigger+1).map(b=>b.date),availableAt:bars[trigger].date,confirmedAt:confirmed>=0?bars[confirmed].date:null,expiresAt:bars[end]?.date??`余 ${Math.max(0,end-last)} 个交易日`,support:s,resistance:z,atr:a,invalidation,strikeCap:s==null?null:s-.5*a});
  };
  let lost:{s:number;a:number;index:number}|null=null;
  for(let i=Math.max(21,n-150);i<n;i++){
    const b=bars[i],prev=bars[i-1],a=atr[i-1];if(!a||a<=0)continue;
    const s=level(lo,i,a,prev.close,false,bars),z=level(hi,i,a,prev.close,true,bars),v20=sma(bars.map(b=>b.volume),20,i-1)!;
    const body=Math.abs(b.close-b.open),range=b.high-b.low,lower=Math.min(b.open,b.close)-b.low,upper=b.high-Math.max(b.open,b.close),fall=c[i-1]<c[i-6];
    if(range<=0)continue;
    if(fall&&near(b.low,s,a)&&range>=.8*a&&body/range>=.1&&body/range<=.35&&lower>=2*body&&upper<=.15*range&&b.close>=b.low+.65*range)
      add('支撑锤头',['A','B','D','F'],i,i,s,null,b.low-.1*a,j=>c[j]>b.high+.1*a);
    if(fall&&prev.close<prev.open&&b.close>b.open&&b.open<=prev.close&&b.close>=prev.open&&body>=1.1*Math.abs(prev.close-prev.open)&&body>=.5*a&&near(b.low,s,a))
      add('看涨吞没',['A','B','D','F'],i-1,i,s,null,Math.min(prev.low,b.low)-.1*atr[i-2]!,j=>c[j]>Math.max(prev.high,b.high)+.1*atr[i-2]!);
    if(i>=3){const first=bars[i-2],middle=bars[i-1],frozen=atr[i-3],support=frozen?level(lo,i-2,frozen,bars[i-3].close,false,bars):null;
      if(frozen&&first.close<first.open&&first.open-first.close>=.6*frozen&&Math.abs(middle.close-middle.open)<=(first.open-first.close)*.35&&b.close>b.open&&b.close>(first.open+first.close)/2&&near(Math.min(first.low,middle.low,b.low),support,frozen)&&b.volume>=1.2*sma(bars.map(x=>x.volume),20,i-3)!)
        add('早晨之星近似',['A','D','F'],i-2,i,support,null,Math.min(first.low,middle.low,b.low)-.1*frozen,j=>c[j]>b.high+.1*frozen);
    }
    if(s!=null&&b.low<s-.1*a&&b.low>=s-a&&b.close>s+.1*a&&b.close>=b.low+.7*range&&b.volume>=1.2*v20)
      add('假跌破收回',['B','D','F'],i,i,s,null,b.low-.1*a,j=>j===i+1&&c[j]>s&&c[j]>b.close,1);
    const second=lo.find(p=>p.available===i);
    if(second){for(const first of lo.filter(p=>second.index-p.index>=10&&second.index-p.index<=60).slice(-5)){
      const frozen=atr[first.index-1];if(!frozen||Math.abs(first.price-second.price)>.75*frozen)continue;
      const neck=Math.max(...bars.slice(first.index+1,second.index).map(x=>x.high));if(neck-Math.max(first.price,second.price)<2*frozen)continue;
      add('双底突破',['D','E'],first.index,i,Math.min(first.price,second.price),neck,Math.min(first.price,second.price)-.1*frozen,j=>c[j]>neck+.1*frozen,20,true);
      const p=patterns.at(-1);if(p?.name==='双底突破'&&p.confirmedAt&&bars.some(x=>x.date>p.confirmedAt!&&x.close<neck-.5*frozen))p.state='invalid';
      break;
    }}
    if(z!=null&&b.close>z+.1*a&&b.volume>=1.2*v20){
      for(let j=i+3;j<=Math.min(i+15,last);j++){
        if(bars.slice(i+1,j+1).some(x=>x.close<z-.5*a))break;
        if(near(bars[j].low,z,a)&&c[j]>=z){add('突破后回踩',['A','C','E'],i,j,z,z,z-.5*a,k=>c[k]>bars[j].high+.1*a,3,true);break;}
      }
    }
    if(trend(i)&&s!=null){const from=Math.max(0,i-19);let peak=from;for(let j=from;j<=i;j++)if(c[j]>c[peak])peak=j;
      const len=i-peak,pullback=c[peak]-c[i],beforeVol=sma(bars.map(x=>x.volume),20,peak-1);
      if(len>=3&&len<=10&&pullback>=a&&pullback<=3*a&&beforeVol!=null&&mean(bars.slice(peak+1,i+1).map(x=>x.volume))<=.8*beforeVol&&!bars.slice(peak+1,i+1).some(x=>x.close<s-.5*a))
        add('缩量回调',['A','C'],peak+1,i,s,null,Math.min(...bars.slice(peak+1,i+1).map(x=>x.low))-.1*atr[peak]!,j=>c[j]>Math.max(...bars.slice(j-3,j).map(x=>x.high))+.1*atr[peak]!,3,true);
    }
    if(s!=null&&b.close<s-.5*a&&b.volume>=1.5*v20)lost={s,a,index:i};
    if(lost&&b.close>lost.s+.1*lost.a&&b.volume>=1.2*v20)lost=null;
    if(lost&&i-lost.index>=1&&i-lost.index<=10&&b.high>=lost.s-.5*lost.a&&b.high<=lost.s+.5*lost.a&&c[i]<lost.s&&bars[i+1]&&c[i+1]<b.low-.1*lost.a&&i>=n-12)risks.push('失守支撑后反弹失败');
    if(i>=n-5&&b.open<prev.low-.5*a&&b.close<b.open&&range>=1.5*a&&b.volume>=1.5*v20)risks.push('跳空大阴线：公司行为/事件待核查');
    if(i>=n-6&&z!=null&&prev.close>prev.open&&b.close<b.open&&b.open>=prev.close&&b.close<=prev.open&&body>=1.1*Math.abs(prev.close-prev.open)&&Math.abs(b.high-z)<=.5*a&&bars[i+1]&&c[i+1]<Math.min(b.low,prev.low)-.1*a&&bars[i+1].volume>=1.2*v20)risks.push('阻力附近看跌吞没已确认');
  }
  if(lost)risks.push('放量支撑失守，尚未价量收复');
  if(lowerStructure(bars)&&mdi[last]!=null&&pdi[last]!=null&&mdi[last]!>pdi[last]!&&(adx.at(-1)??0)>25)risks.push('连续更低高低点且 ADX > 25');
  const lower=n>=61?Math.min(...bars.slice(-61,-1).map(b=>b.low)):null,upper=n>=61?Math.max(...bars.slice(-61,-1).map(b=>b.high)):null;
  const m50=sma(c,50,last),m200=sma(c,200,last),m20=sma(c,20,last),weeks=completedWeeks(bars,asOf);
  const rangePool=lower!=null&&upper!=null&&c[last]>=lower&&c[last]<=lower+.25*(upper-lower)&&(adx.at(-1)??100)<20&&m50!=null&&sma(c,50,last-20)!=null&&Math.abs(m50/sma(c,50,last-20)!-1)<=.02;
  if(rangePool){const candle=patterns.find(p=>p.state==='confirmed'&&['支撑锤头','看涨吞没','假跌破收回'].includes(p.name));if(candle)patterns.push({...candle,name:'箱体下沿企稳',pools:['B'],support:lower,strikeCap:lower!-.5*candle.atr,invalidation:lower!-.5*candle.atr});}
  const eventIndex=eventDate?bars.findIndex(b=>b.date>=eventDate):-1;
  const eventStable=eventIndex>=0&&last-eventIndex>=5?bars.slice(-5).every((b,k)=>b.close>=Math.min(...c.slice(eventIndex,n-5+k)))&&c.slice(-3).every((v,k)=>v>sma(c,10,n-3+k)!):null;
  return {bars:n,asOf:bars.at(-1)?.date??null,close:c.at(-1)??null,ma10:sma(c,10,last),ma20:m20,ma50:m50,ma200:m200,
    ma200Up:n>=220?m200!>sma(c,200,last-20)!:null,ma50Up10:n>=60?m50!>sma(c,50,last-10)!:null,ma20Up5:n>=25?m20!>sma(c,20,last-5)!:null,ma50Change20:n>=70?(m50!/sma(c,50,last-20)!-1)*100:null,
    rsi:rsiAt(last),atr:atr.at(-1)??null,adx:adx.at(-1)??null,plusDi:pdi.at(-1)??null,minusDi:mdi.at(-1)??null,dollarVolume20:n>=20?mean(bars.slice(-20).map(b=>b.close*b.volume)):null,
    drawdown60:n>=60?(1-c[last]/Math.max(...c.slice(-60)))*100:null,rangeLow:lower,rangeHigh:upper,return20:n>=21?(c[last]/c[last-20]-1)*100:null,rv20:volatility(c,20),rv60:volatility(c,60),
    noNewLow3:n>=23?c.slice(-3).every((v,k)=>v>=Math.min(...c.slice(n-23+k,n-3+k))):null,
    noNewLow20:n>=40?c.slice(-20).every((v,k)=>v>=Math.min(...c.slice(n-40+k,n-20+k))):null,
    eventStable,weeklyConflict:weeks.length>=104?lowerStructure(weeks):null,patterns:patterns.filter(p=>p.state!=='expired').slice(-30),risks:[...new Set(risks)],support:atr[last]?level(lo,n,atr[last]!,c[last],false,bars):null,resistance:atr[last]?level(hi,n,atr[last]!,c[last],true,bars):null};
}
