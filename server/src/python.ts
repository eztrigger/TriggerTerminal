import { join } from 'node:path';

/** Installed apps supply their private runtime; source checkouts use a local venv. */
export function pythonExecutable(root: string): string {
  return process.env.PYTHON_EXECUTABLE || join(root, 'bridge', '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
}
