import {expect,it} from 'vitest';
import {underlyingGroups,amounts,type Position} from '../../web/lib/holdings-view';
const leg=(symbol:string,assetType='STK',quantity=10,currency='CAD')=>({symbol,assetType,quantity,currency,multiplier:assetType==='OPT'?100:1,expiry:assetType==='OPT'?'20261218':'',right:assetType==='OPT'?'P':'',strike:100,avgCost:2,marketPrice:3});
const row=(id:number,legs:ReturnType<typeof leg>[],accountId=1):Position=>({id,accountId,name:'Strategy '+id,notes:'',source:'MANUAL',active:1,updatedAt:'',legs});
it('combines stock, puts, calls, long and short across accounts while splitting mixed strategies',()=>{
 const rows=[row(1,[leg('TD'),leg('AAPL')]),row(2,[leg(' td ','OPT',-2)],2),row(3,[{...leg('TD','OPT',1),right:'C'}]),row(4,[leg('TD','STK',-5,'USD')])];
 const before=JSON.stringify(rows),groups=underlyingGroups(rows),td=groups.find(g=>g.name==='TD')!;
 expect(groups.map(g=>g.name)).toEqual(['TD','AAPL']);expect(td.rows).toHaveLength(4);
 expect(td.rows.flatMap(r=>r.legs).every(l=>l.symbol.trim().toUpperCase()==='TD')).toBe(true);
 expect(td.rows[0].legs[0]).toBe(rows[0].legs[0]);expect(groups[1].rows[0].legs[0]).toBe(rows[0].legs[1]);
 expect(amounts(td.rows).CAD.value).toBe(-270);expect(amounts(td.rows).USD.value).toBe(-15);
 expect(JSON.stringify(rows)).toBe(before);
});
it('does not group by symbol prefix or invent active holdings from zero-quantity legs',()=>{
 const groups=underlyingGroups([row(1,[leg('TD'),leg('TDG'),leg('AAPL','OPT',0)])]);
 expect(groups.map(g=>g.name)).toEqual(['TD','TDG']);
});
