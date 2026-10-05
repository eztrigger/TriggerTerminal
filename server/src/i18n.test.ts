import {afterEach,expect,it,vi} from 'vitest';
import {readFileSync,readdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
import ts from 'typescript';
import {english} from '../../web/lib/translations/en';
import {tr,setLanguage,initializeLanguage,uiLocale} from '../../web/lib/i18n';
afterEach(()=>{setLanguage('zh-CN');vi.unstubAllGlobals();});
it('translates static and dynamic system text without changing non-string values',()=>{
 setLanguage('en');
 expect(tr('仓位与持仓')).toBe('Positions & Holdings');
 expect(tr('3 条备注')).toBe('3 notes');
 expect(tr('TSLA 暂无报价')).toBe('No quote for TSLA');
 expect(tr('IBKR 同步完成：3 个持仓；手动仓位保持不变。')).not.toMatch(/[\p{Script=Han}]/u);
 expect(tr({notes:'用户记录'})).toEqual({notes:'用户记录'});
 expect(tr('MCD 20261016 P 240')).toBe('MCD 20261016 P 240');
 expect(uiLocale()).toBe('en-US');
 setLanguage('zh-CN');expect(tr('仓位与持仓')).toBe('仓位与持仓');
});
it('defaults to Chinese if preferences cannot be read',()=>{
 vi.stubGlobal('localStorage',{getItem(){throw Error('unavailable');}});
 expect(initializeLanguage()).toBe('zh-CN');
});
it('requires English entries for all Chinese UI and server message literals',()=>{
 const missing=new Set<string>();
 function visitDir(dir:string){
  for(const item of readdirSync(dir,{withFileTypes:true})){
   if(['.next','node_modules','translations'].includes(item.name))continue;
   const file=join(dir,item.name);
   if(item.isDirectory()){visitDir(file);continue;}
   if(!/\.tsx?$/.test(file)||file.includes('.test.')||file.endsWith('.d.ts'))continue;
   const ast=ts.createSourceFile(file,readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true);
   function visit(node:ts.Node){
    let text='';
    if(ts.isStringLiteral(node)||ts.isNoSubstitutionTemplateLiteral(node)||ts.isJsxText(node))text=node.text;
    if(ts.isTemplateExpression(node))text=node.head.text+node.templateSpans.map((span,i)=>'{'+i+'}'+span.literal.text).join('');
    text=text.trim().replace(/\s+/g,' ');
    if(/[\p{Script=Han}]/u.test(text)&&!english[text])missing.add(text);
    ts.forEachChild(node,visit);
   }
   visit(ast);
  }
 }
 visitDir(resolve('../web'));visitDir(resolve('src'));
 expect([...missing]).toEqual([]);
});
