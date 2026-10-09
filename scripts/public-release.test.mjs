import {test} from 'node:test';
import assert from 'node:assert/strict';
import {checkPath, scanText} from './public-release.mjs';

test('private paths and traversal are rejected',()=>{
  for (const path of ['data/holdings.db','.git/config','web/.env.local','web/.next/build.js','bridge/.venv/bin/python','../private.txt','/tmp/private.txt','docs/account.png']) {
    assert.throws(()=>checkPath(path));
  }
  checkPath('server/src/holdings.ts');
});
test('secret and private account markers fail without echoing their values',()=>{
  const secret = ['ghp', 'x'.repeat(30)].join('_');
  assert.throws(()=>scanText('fixture',secret),error=>!error.message.includes(secret));
  assert.throws(()=>scanText('fixture','prefix '+['U','12345678'].join('')));
  assert.throws(()=>scanText('fixture','private-demo-value',['private-demo-value']));
  scanText('fixture','process.env.API_KEY');
});
