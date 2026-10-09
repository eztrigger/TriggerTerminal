import {afterEach,expect,it,vi} from 'vitest';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {LedgerOverview,LedgerManager,ledgerCash,type LedgerData} from '../../web/components/HoldingsLedger';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {setLanguage} from '../../web/lib/i18n';
import ProfitRecords from '../../web/components/ProfitRecords';

afterEach(()=>{vi.unstubAllGlobals();setLanguage('zh-CN');});
const balance=(currency:string,cash:number,baseline:number,flows:number,startedAt:string)=>({accountId:1,currency,cash,initialCash:baseline,baseline,flows,startedAt});
function render(data:LedgerData){
 vi.stubGlobal('React',React);setLanguage('en');
 return renderToStaticMarkup(React.createElement(LedgerOverview,{data,rows:[],filter:'1',unavailable:false,compact:true}));
}
const base:LedgerData={accounts:[{id:1,broker:'Test',name:'Test',ibkrAccount:null}],balances:[],brokerCash:[],events:[]};
it('includes broker close reports in cumulative P&L and exposes read-only profit records',()=>{
 vi.stubGlobal('React',React);setLanguage('en');
 const events=[['CLS',-1792.0833],['HUT',-371.8337]].map(([symbol,pnl],i)=>({id:-i-1,accountId:1,kind:'IBKR_TRADE',source:'IBKR',at:'2026-10-08T16:55:13Z',asset:{symbol:String(symbol)},cash:{},realized:{USD:Number(pnl)}}));
 const data={...base,accounts:[{...base.accounts[0],ibkrAccount:'TEST'}],events};
 const position={id:1,accountId:1,name:'Test',notes:'',source:'IBKR',active:1,updatedAt:'',legs:[{symbol:'TEST',assetType:'STK',quantity:1,multiplier:1,currency:'USD',expiry:'',right:'',strike:null,avgCost:100,marketPrice:200,marketValue:200,unrealizedPnl:100}]};
 const summary=renderToStaticMarkup(React.createElement(LedgerOverview,{data,rows:[position],filter:'1',unavailable:false,docked:true}));
 expect(summary).toContain('2,163.92');expect(summary).toContain('2,063.92');
 const client=new QueryClient();
 const records=renderToStaticMarkup(React.createElement(QueryClientProvider,{client},React.createElement(ProfitRecords,{data,filter:'1'})));
 expect(records).toContain('CLS');expect(records).toContain('HUT');expect(records).toContain('1,792.08');expect(records).toContain('371.83');
 expect(records).not.toContain('aria-label="Edit realized P&amp;L"');expect(records).toContain('Broker report');client.clear();
});
it('keeps deleted close settlement visible in cash history without offering undo',()=>{
 vi.stubGlobal('React',React);setLanguage('en');const client=new QueryClient();
 const data={...base,events:[{id:1,accountId:1,kind:'CLOSE',at:'2026-10-01T12:00:00Z',cash:{USD:1099},realized:{USD:0},closedDeleted:true}]};
 const html=renderToStaticMarkup(React.createElement(QueryClientProvider,{client},React.createElement(LedgerManager,{data,rows:[],accountId:1})));
 expect(html).toContain('1,099.00');expect(html).toContain('cash settlement retained, P&amp;L excluded');expect(html).not.toContain('Undo latest');client.clear();
});
it('adds recorded realized profit to TD cost-based unrealized profit and removes deleted contributions',()=>{
 vi.stubGlobal('React',React);setLanguage('en');
 const position={id:1,accountId:1,name:'TD',notes:'',source:'MANUAL',active:1,updatedAt:'',legs:[{symbol:'TD',assetType:'STK',quantity:308,multiplier:1,currency:'CAD',expiry:'',right:'',strike:null,avgCost:94.04,marketPrice:167.665}]};
 const event={id:1,accountId:1,kind:'CLOSE',at:'',cash:{CAD:1000},realized:{CAD:100},closedDeleted:false};
 const view=(rows:typeof position[],events:typeof event[])=>renderToStaticMarkup(React.createElement(LedgerOverview,{data:{...base,events},rows,filter:'1',unavailable:false,compact:true}));
 expect(view([position],[event])).toContain('22,776.50');
 expect(view([],[event])).toContain('100.00');
 expect(view([position],[{...event,closedDeleted:true}])).toContain('22,676.50');
 expect(view([position],[{...event,realized:{CAD:-100}}])).toContain('22,576.50');
 expect(view([position],[{...event,accountId:2}])).toContain('22,676.50');
 expect(view([{...position,legs:[{...position.legs[0],avgCost:null}]}] as any,[])).toContain('Insufficient data');
});
it('shows per-currency total P&L and independent tracking dates, excluding deposits',()=>{
 const html=render({...base,balances:[balance('USD',12500,10000,500,'2026-09-01T12:00:00Z'),balance('CAD',4800,5000,0,'2026-09-15T12:00:00Z')]});
 expect(html).toContain('0.00');expect(html).not.toContain('2,000');
 expect(html).not.toContain('Since');
});
it('does not invent zero P&L or a start date for an uninitialized account',()=>{
 expect(render(base)).toContain('No positions or profit records');
});
it('does not estimate broker P&L when broker cash is missing',()=>{
 const html=render({...base,accounts:[{...base.accounts[0],ibkrAccount:'TEST'}],balances:[balance('USD',12000,10000,0,'2026-09-01T12:00:00Z')]});
 expect(html).toContain('broker history is incomplete');expect(html).not.toContain('2,000');
});
it('handles invalid historical tracking dates without displaying Invalid Date',()=>{
 const html=render({...base,balances:[balance('USD',12000,10000,0,'invalid')]});
 expect(html).toContain('0.00');expect(html).not.toContain('Invalid Date');
});
it('keeps balance details accessible while docking the three primary metrics',()=>{
 vi.stubGlobal('React',React);setLanguage('en');
 const html=renderToStaticMarkup(React.createElement(LedgerOverview,{data:{...base,balances:[balance('USD',12500,10000,500,'2026-09-01T12:00:00Z')]},rows:[],filter:'1',unavailable:false,docked:true}));
 expect(html).toContain('holdings-summary-dock');
 expect(html).toContain('<summary');expect(html).not.toContain(' open=""');
 expect(html).toContain('Net position value');expect(html).toContain('Unrealized P&amp;L');
 expect(html).toContain('Cash balance');expect(html).toContain('0.00');
});
it('adds manual cash adjustments to broker cash, without assuming missing broker cash is zero',()=>{
 const b={...balance('USD',12000,10000,0,'2026-09-01T12:00:00Z'),localCash:500};
 const data={...base,accounts:[{...base.accounts[0],ibkrAccount:'TEST'}],balances:[b],brokerCash:[{accountId:1,currency:'USD',cash:15000,at:'2026-09-01T12:00:00Z'}]};
 expect(ledgerCash(data,b)).toBe(15500);
 expect(render(data)).toContain('0.00');
 expect(ledgerCash({...data,brokerCash:[]},b)).toBeUndefined();
});
it('shows current cash rather than opening cash with a separate aligned action column',()=>{
 vi.stubGlobal('React',React);setLanguage('en');const client=new QueryClient();
 const data={...base,balances:[{...balance('USD',4321.25,10000,0,'2026-10-01T12:00:00Z'),initialCash:9876.54}]};
 const html=renderToStaticMarkup(React.createElement(QueryClientProvider,{client},React.createElement(LedgerManager,{data,rows:[],accountId:1})));
 expect(html).toContain('Current cash');expect(html).toContain('4,321.25');
 expect(html).not.toContain('9,876.54');expect(html).not.toContain('Opening cash');
 expect(html).toContain('account-cash-table');expect(html).toContain('Correct balance');client.clear();
});
