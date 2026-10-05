import {afterEach,expect,it,vi} from 'vitest';
import {dedupe,topNews} from './news.js';
afterEach(()=>vi.unstubAllGlobals());
it('requests native Chinese RSS and safely parses malformed dates',async()=>{
 const fetcher=vi.fn(async()=>new Response('<rss><channel><item><title>苹果发布财报</title><link>https://example.com/1</link><pubDate>bad date</pubDate><source>财经媒体</source></item></channel></rss>'));
 vi.stubGlobal('fetch',fetcher);const rows=await topNews('AAPL 股票','zh');
 expect(fetcher.mock.calls[0][0]).toContain('ceid=CN:zh-Hans');
 expect(rows[0]).toMatchObject({title:'苹果发布财报',language:'zh',publishedAt:null,publisher:'财经媒体'});
});
it('does not collapse distinct Chinese headlines into one empty ASCII key',()=>{
 const row={link:'https://example.com',publisher:'Test',publishedAt:null,symbol:null};
 expect(dedupe([[{...row,title:'苹果发布财报'},{...row,title:'特斯拉公布交付量'},{...row,title:'苹果发布财报'}]]).map(x=>x.title)).toEqual(['苹果发布财报','特斯拉公布交付量']);
});
it('retains English titles without translating original content',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>new Response('<rss><channel><item><title>Apple earnings</title><link>https://example.com</link></item></channel></rss>')));
 expect((await topNews())[0]).toMatchObject({title:'Apple earnings',language:'en'});
});
