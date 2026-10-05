import {test} from 'node:test';
import assert from 'node:assert/strict';
import {checkPath, scanText} from './public-release.mjs';
import {readFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';

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
test('excluded features cannot be added to the public file manifest',()=>{
  for(const path of ['server/src/csp/router.ts','server/src/crypto/store.ts','web/app/analysis/page.tsx','web/components/widgets/CryptoWidget.tsx','bridge/csp_worker.py'])assert.throws(()=>checkPath(path));
  const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
  const manifest=JSON.parse(readFileSync(resolve(root,'scripts/public-release-files.json'),'utf8'));
  for(const path of manifest){checkPath(path);assert.ok(existsSync(resolve(root,path)),path);}
  for(const path of ['server/src/yahoo-options.ts','web/components/DeleteHoldingAccount.tsx','web/app/design-system.css','server/vitest.config.ts','server/test/storage.ts'])assert.ok(manifest.includes(path),path);
});
test('public navigation and API registration do not expose removed features',()=>{
  const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
  for(const path of ['web/components/PrimaryNavigation.tsx','web/components/Sidebar.tsx','server/src/index.ts']){
    assert.doesNotMatch(readFileSync(resolve(root,path),'utf8'),/\/crypto-holdings|\/csp|\/analysis|cryptoRouter|cspRouter/);
  }
});
