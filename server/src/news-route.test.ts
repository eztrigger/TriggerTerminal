import {expect,it,vi} from 'vitest';
import {marketRouter} from './routes/market.js';
import * as news from './providers/news.js';
const handler=(marketRouter as any).stack.find((l:any)=>l.route?.path==='/news').route.stack[0].handle;
const response=()=>({status:vi.fn().mockReturnThis(),json:vi.fn().mockReturnThis()});
it('balances native Chinese and English headlines and reuses the language caches',async()=>{
 const row=(title:string,language:'zh'|'en')=>({title,language,link:'https://example.com',publisher:'Test',publishedAt:null,symbol:null});
 const top=vi.spyOn(news,'topNews').mockImplementation(async(_q,lang='en')=>Array.from({length:30},(_,i)=>row(`${lang==='zh'?'中文新闻':'English headline'} ${i}`,lang)));
 const symbol=vi.spyOn(news,'symbolNews').mockResolvedValue([]);
 try{
  const mixed=response();await handler({query:{symbol:'NEWS_TEST',language:'both'}},mixed);
  const rows=mixed.json.mock.calls[0][0];expect(rows).toHaveLength(40);
  expect(rows.filter((n:any)=>n.language==='zh')).toHaveLength(20);expect(rows.filter((n:any)=>n.language==='en')).toHaveLength(20);
  const zh=response();await handler({query:{symbol:'NEWS_TEST',language:'zh'}},zh);
  expect(zh.json.mock.calls[0][0]).toHaveLength(30);expect(top).toHaveBeenCalledTimes(2);expect(symbol).toHaveBeenCalledTimes(1);
 }finally{vi.restoreAllMocks();}
});
it('rejects an invalid language before requesting upstream data',async()=>{
 const res=response();await handler({query:{language:'invalid'}},res);expect(res.status).toHaveBeenCalledWith(400);
});
it('keeps the working language when another language source is offline',async()=>{
 vi.spyOn(news,'symbolNews').mockRejectedValue(new Error('offline'));
 vi.spyOn(news,'topNews').mockImplementation(async(_q,lang)=>{if(lang==='zh')throw new Error('offline');return [{title:'English available',language:'en',link:'https://example.com',publisher:'Test',publishedAt:null,symbol:null}];});
 try{const res=response();await handler({query:{symbol:'NEWS_PARTIAL',language:'both'}},res);expect(res.json.mock.calls[0][0][0].title).toBe('English available');}finally{vi.restoreAllMocks();}
});
