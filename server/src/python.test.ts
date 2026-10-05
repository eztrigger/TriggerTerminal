import { afterEach, expect, it, vi } from 'vitest';
import { join } from 'node:path';
import { pythonExecutable } from './python.js';
afterEach(() => vi.unstubAllEnvs());
it('uses the packaged interpreter even when its installation path contains spaces', () => {
  vi.stubEnv('PYTHON_EXECUTABLE', 'C:\\Program Files\\TriggerTerminal\\python\\python.exe');
  expect(pythonExecutable('/source')).toBe('C:\\Program Files\\TriggerTerminal\\python\\python.exe');
});
it('keeps source checkouts using their local virtual environment', () => {
  vi.stubEnv('PYTHON_EXECUTABLE', '');
  expect(pythonExecutable('/source')).toBe(join('/source', 'bridge', '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python'));
});
