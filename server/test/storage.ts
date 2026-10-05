import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll } from 'vitest';

// Every suite gets fresh storage: never open a developer's data directory, and
// never race another test process while initializing SQLite's journal mode.
const directory = mkdtempSync(join(tmpdir(), 'triggerterminal-test-'));
process.env.DATA_DIR = directory;
afterAll(() => { rmSync(directory, { recursive: true, force: true }); });
