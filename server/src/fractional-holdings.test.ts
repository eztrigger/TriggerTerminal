import {expect,it} from 'vitest';
import {parseHoldingQuantity,amounts,type Position} from '../../web/lib/holdings-view';
it('accepts precise fractional shares and grouped quantities without truncation',()=>{
 for(const [text,n] of [['12.345678',12.345678],['1,234.5678',1234.5678],['.125',.125],['-0.125',-.125],['1e-6',.000001]] as const)expect(parseHoldingQuantity(text)).toBe(n);
 for(const text of ['', '0','NaN','Infinity','1,23','1.2.3'])expect(parseHoldingQuantity(text)).toBeNull();
 expect(parseHoldingQuantity('1.5',true)).toBeNull();expect(parseHoldingQuantity('-2',true)).toBe(-2);
});
it('calculates fractional CAD market value and unrealized profit without treating the account as missing',()=>{
 const row:Position={id:1,accountId:1,name:'Fractional CAD',notes:'',source:'MANUAL',active:1,updatedAt:'',legs:[{symbol:'TEST',assetType:'STK',quantity:12.345678,multiplier:1,currency:'CAD',expiry:'',right:'',strike:null,avgCost:40,marketPrice:50}]};
 const result=amounts([row]).CAD;
 expect(result.value).toBeCloseTo(617.2839,8);expect(result.pnl).toBeCloseTo(123.45678,8);
 expect(result.missingValue).toBe(0);expect(result.missingPnl).toBe(0);
});
