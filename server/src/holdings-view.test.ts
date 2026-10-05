import {describe,it,expect} from 'vitest';
import {amounts,structure,displayGroups,dte,type Position,type PositionLeg} from '../../web/lib/holdings-view';
const leg:PositionLeg={symbol:'SPX',assetType:'OPT',quantity:-1,multiplier:100,currency:'USD',expiry:'20261016',right:'P',strike:7000,avgCost:4,marketPrice:2};
const pos=(id:number,legs:PositionLeg[],source='MANUAL'):Position=>({id,legs,source,accountId:1,name:'test',notes:'',active:1,updatedAt:'2026-09-24T00:00:00Z'});
describe('strategy display accounting',()=>{
 it('retains signed short market value and profit, never combines currencies',()=>{const a=amounts([pos(1,[leg,{...leg,currency:'CAD',quantity:1}])]);expect(a.USD.value).toBe(-200);expect(a.USD.pnl).toBe(200);expect(a.CAD.pnl).toBe(-200);});
 it('tracks unknown PnL independently of known valuation and respects IBKR values',()=>{const a=amounts([pos(1,[{...leg,avgCost:null}]),pos(2,[{...leg,marketValue:-180,unrealizedPnl:220}],'IBKR')]);expect(a.USD.missingPnl).toBe(1);expect(a.USD.missingValue).toBe(0);expect(a.USD.value).toBe(-380);expect(a.USD.pnl).toBe(220);});
 it('does not classify ratio or mixed-expiry positions as a vertical spread',()=>{expect(structure([leg,{...leg,quantity:1,strike:6900}])).toContain('垂直');expect(structure([leg,{...leg,quantity:2,strike:6900}])).toBe('自定义组合');expect(structure([leg,{...leg,quantity:1,strike:6900,expiry:'20261120'}])).toContain('Diagonal');});
 it('marks incomplete strategy groups and never double-counts legs',()=>{const rows=[pos(1,[leg]),pos(2,[leg])];const result=displayGroups(rows,[{id:1,name:'Group',positionIds:[1,3]}]);expect(result).toHaveLength(2);expect(result[0].incomplete).toBe(true);expect(result.flatMap(g=>g.rows)).toHaveLength(2);});
 it('uses New York calendar dates rather than browser timezone for DTE',()=>{expect(dte('20260924',new Date('2026-09-24T02:00:00Z'))).toBe(1);expect(dte('20260924',new Date('2026-09-24T12:00:00Z'))).toBe(0);});
});
