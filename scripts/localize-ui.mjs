// One-time mechanical migration of existing JSX presentation boundaries.
import ts from 'typescript';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
const files=execFileSync('rg',['--files','web'],{encoding:'utf8'}).trim().split('\n').filter(p=>p.endsWith('.tsx')&&!['web/app/layout.tsx','web/app/providers.tsx','web/components/LanguageSwitcher.tsx'].includes(p));
for(const file of files){
 const source=fs.readFileSync(file,'utf8');
 const ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 const edits=[];
 const add=(start,end,text)=>edits.push({start,end,text});
 const displayAttrs=new Set(['title','aria-label','placeholder','label']);
 function walk(node){
  if(ts.isJsxText(node)&&/[\p{Script=Han}]/u.test(node.text)){
   const text=node.text.replace(/\s+/g,' ');
   add(node.pos,node.end,'{tr('+JSON.stringify(text)+')}');return;
  }
  if(ts.isJsxAttribute(node)&&displayAttrs.has(node.name.getText(ast))&&node.initializer&&ts.isStringLiteral(node.initializer)&&/[\p{Script=Han}]/u.test(node.initializer.text)){
   add(node.initializer.getStart(ast),node.initializer.end,'{tr('+JSON.stringify(node.initializer.text)+')}');return;
  }
  if(ts.isJsxExpression(node)&&node.expression){
   const e=node.expression,raw=e.getText(ast);
   const attribute=ts.isJsxAttribute(node.parent)?node.parent.name.getText(ast):null;
   const userContent=/(?:\.notes\b|\.fact\b|\.inference\b|\.accountNumber\b|\bnotes\b|\bg\.name\b|\bh\.name\b|\bposition\.name\b|\blabel\(a\))/u.test(raw);
   const onlyString=ts.isStringLiteral(e)||ts.isNoSubstitutionTemplateLiteral(e);
   // Data values, events and React elements retain their original semantics.
   if((!attribute||displayAttrs.has(attribute))&&!userContent&&!ts.isJsxElement(e)&&!ts.isJsxSelfClosingElement(e)&&!ts.isJsxFragment(e)&&!raw.startsWith('tr(')&&(!onlyString||/[\p{Script=Han}]/u.test(e.text))){
    add(e.getStart(ast),e.getStart(ast),'tr(');add(e.end,e.end,')');
   }
  }
  if(ts.isCallExpression(node)&&/^(window\.)?(alert|confirm)$/.test(node.expression.getText(ast))&&node.arguments[0]){
   const arg=node.arguments[0];add(arg.getStart(ast),arg.getStart(ast),'tr(');add(arg.end,arg.end,')');
  }
  if(ts.isStringLiteral(node)&&node.text==='zh-CN')add(node.getStart(ast),node.end,'uiLocale()');
  ts.forEachChild(node,walk);
 }
 walk(ast);
 if(!edits.length)continue;
 // Inserts at a shared endpoint must close an inner expression before opening the next.
 edits.sort((a,b)=>b.start-a.start||b.end-a.end);
 let next=source;
 for(const edit of edits)next=next.slice(0,edit.start)+edit.text+next.slice(edit.end);
 const modulePath=path.relative(path.dirname(file),'web/lib/i18n').replaceAll('\\','/');
 const imp='import {tr,uiLocale} from '+JSON.stringify(modulePath.startsWith('.')?modulePath:'./'+modulePath)+';\n';
 const directive=next.match(/^["']use client["'];\s*/);
 next=directive?next.slice(0,directive[0].length)+imp+next.slice(directive[0].length):'"use client";\n'+imp+next;
 fs.writeFileSync(file,next);
}
