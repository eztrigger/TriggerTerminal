import {afterAll,describe,expect,it,vi} from 'vitest';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
vi.mock('./db.js',()=>({dataDir:process.env.TMPDIR??'/tmp'}));
import {sourceSettings} from './market-source.js';
const dir=mkdtempSync(join(tmpdir(),'market-source-test-'));
afterAll(()=>rmSync(dir,{recursive:true,force:true}));
describe('restart-only market source',()=>{
 it('defaults to API and activates a selection only on a new instance',()=>{
  const path=join(dir,'source.json');const first=sourceSettings(path);
  expect(first.state()).toEqual({active:'api',selected:'api',restartRequired:false});
  expect(first.save('yahoo')).toEqual({active:'api',selected:'yahoo',restartRequired:true});
  const restarted=sourceSettings(path);
  expect(restarted.state()).toEqual({active:'yahoo',selected:'yahoo',restartRequired:false});
  expect(restarted.save('api').active).toBe('yahoo');
  expect(sourceSettings(path).active).toBe('api');
 });
 it('rejects unknown sources without changing the saved value',()=>{
  const settings=sourceSettings(join(dir,'invalid.json'));
  expect(()=>settings.save('other' as any)).toThrow();
  expect(settings.state().selected).toBe('api');
 });
 it('allows cancelling a pending switch',()=>{
  const settings=sourceSettings(join(dir,'cancel.json'));
  settings.save('yahoo');expect(settings.save('api').restartRequired).toBe(false);
 });
});
