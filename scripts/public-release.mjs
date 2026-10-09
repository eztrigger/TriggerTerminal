import {readFileSync, writeFileSync, mkdirSync, lstatSync, existsSync} from 'node:fs';
import {resolve, dirname, join, relative, isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(readFileSync(join(root, 'scripts/public-release-files.json'), 'utf8'));
const forbidden = /(^|\/)(data|\.git|node_modules|runtime|\.venv|__pycache__|\.next|\.claude|\.codex)(\/|$)|\.(db|sqlite|log|pyc|png|jpg|zip|tsbuildinfo|icloud-backup)$|(^|\/)\.env($|\.)/i;

const approvedImages = new Set(['desktop/icon.png','web/public/trigger-icon.png','docs/images/options-overview.jpg','docs/images/option-analysis.jpg','docs/images/market-workspace.jpg']);

export function checkPath(path) {
  if (approvedImages.has(path)) return;
  if (isAbsolute(path) || path.split('/').includes('..') || forbidden.test(path)) throw Error('Disallowed release path: '+path);
}
export function scanText(path, text, privateValues = []) {
  const checks = [
    ['private key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
    ['access token', /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{30,}|sk-(?:ant-)?[A-Za-z0-9_-]{24,}|AKIA[A-Z0-9]{16})\b/],
    ['personal home path', /\/(?:Users|home)\/[A-Za-z0-9_.-]+\//],
    ['broker account', /\b(?:DU|U)\d{6,}\b/],
    ['URL credentials', /https?:\/\/[^\s/@]+:[^\s/@]+@/],
  ];
  for (const [category, pattern] of checks) if (pattern.test(text)) throw Error(category+' found in '+path);
  for (const value of privateValues) if (value.length >= 4 && text.includes(value)) throw Error('Local private value found in '+path);
}

function loadPrivateValues() {
  const values = new Set();
  const key = join(root, 'data/.api-key');
  if (existsSync(key)) values.add(readFileSync(key, 'utf8').trim());
  return values;
}

export async function createRelease(destination) {
  const output = resolve(destination);
  if (existsSync(output) || existsSync(output+'.zip')) throw Error('Destination already exists; refusing to overwrite.');
  if (output === root || !relative(root, output).startsWith('..')) throw Error('Choose a new destination outside the source directory.');
  const privateValues = loadPrivateValues();
  // Compare local identifiers and free text in memory without exporting them.
  if (existsSync(join(root, 'data/holdings.db'))) {
    const {default: Database} = await import('better-sqlite3');
    const db = new Database(join(root, 'data/holdings.db'), {readonly:true, fileMustExist:true});
    try {
      for (const row of db.prepare('SELECT name,account_number,ibkr_account FROM holding_accounts').all()) {
        for (const value of Object.values(row)) if (typeof value === 'string' && value.length >= 4) privateValues.add(value);
      }
      for (const row of db.prepare('SELECT name,notes,legs FROM holding_positions').all()) {
        const legs = JSON.parse(row.legs);
        // Asset tickers are public identifiers, not private user-written position names.
        const assetName = legs.some(leg => row.name === leg.symbol || row.name === leg.localSymbol);
        const values = [assetName ? null : row.name,row.notes,...legs.map(leg=>leg.notes)];
        for (const value of values) if (typeof value === 'string' && value.length >= 4) privateValues.add(value);
      }
    } finally { db.close(); }
  }
  const layout = readFileSync(join(root, 'web/app/layout.tsx'), 'utf8');
  const label = layout.match(/title:\s*"([^"]+)"/)?.[1];
  if (!label) throw Error('Cannot identify application title for public branding.');
  const dictionary = readFileSync(join(root, 'web/lib/translations/en.ts'), 'utf8');
  const englishLabel = dictionary.split('\n').find(line=>line.startsWith(label+'\t'))?.split('\t')[1];
  const replacements = [label, englishLabel].filter(value=>value && value !== 'OpenTerminal' && value !== 'TriggerTerminal');
  const files = new Map();
  for (const path of manifest) {
    checkPath(path);
    let cursor = root;
    for (const segment of path.split('/')) {
      cursor = join(cursor, segment);
      if (lstatSync(cursor).isSymbolicLink()) throw Error('Symbolic link rejected: '+path);
    }
    if (!lstatSync(cursor).isFile()) throw Error('Not a regular file: '+path);
    if (approvedImages.has(path)) { files.set(path, readFileSync(cursor)); continue; }
    let text = readFileSync(cursor, 'utf8');
    if (text.includes('\0')) throw Error('Binary file rejected: '+path);
    for (const value of replacements) text = text.replaceAll(value, 'triggerterminal');
    if (path === 'desktop/main.swift') text = text.replaceAll('OpenTerminal', 'TriggerTerminal');
    if (path === 'package.json' || path === 'package-lock.json') {
      const json = JSON.parse(text);
      json.name = 'triggerterminal';
      if (json.packages?.['']) json.packages[''].name = 'triggerterminal';
      text = JSON.stringify(json,null,2)+'\n';
    }
    scanText(path, text, [...privateValues]);
    files.set(path, text);
  }
  for (const [target, template] of [['README.md','README.public.md'],['desktop/README.md','DESKTOP.public.md']]) {
    const text = readFileSync(join(root, 'scripts/release', template), 'utf8');
    scanText(target, text, [...privateValues]);
    files.set(target, text);
  }
  mkdirSync(output, {recursive:true});
  const hashes = [];
  for (const [path, text] of files) {
    const destination = join(output,path);
    mkdirSync(dirname(destination),{recursive:true});
    writeFileSync(destination,text,{flag:'wx',mode:0o644});
    hashes.push(createHash('sha256').update(text).digest('hex')+'  '+path);
  }
  writeFileSync(join(output,'SOURCE-SHA256SUMS.txt'),hashes.sort().join('\n')+'\n');
  // Archive explicitly, without Finder resource forks, build output or Git history.
  execFileSync('/usr/bin/zip',['-q','-X','-r',output+'.zip','.'],{cwd:output,env:{...process.env,COPYFILE_DISABLE:'1'}});
  console.log(JSON.stringify({directory:output,archive:output+'.zip',files:files.size,privateDataIncluded:false}));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!process.argv[2]) throw Error('Usage: node scripts/public-release.mjs /absolute/path/to/new-directory');
  await createRelease(process.argv[2]);
}
