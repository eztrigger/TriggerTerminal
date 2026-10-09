import {afterAll, describe, expect, it, vi} from 'vitest';
import {mkdtempSync, readFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const state=vi.hoisted(()=>({folder:''}));
vi.mock('./db.js',()=>({get dataDir(){return state.folder;}}));
describe('first launch IBKR configuration',()=>{
 it('persists defaults for quote and streaming workers before any settings are saved',async()=>{
  state.folder=mkdtempSync(join(tmpdir(),'ibkr-defaults-'));
  await import('./ibkr.js');
  expect(JSON.parse(readFileSync(join(state.folder,'ibkr.json'),'utf8'))).toEqual({port:4001,clientId:71});
 });
});
afterAll(()=>{if(state.folder)rmSync(state.folder,{recursive:true,force:true});});
