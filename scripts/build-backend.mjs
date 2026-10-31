import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const targetOS = process.env.GOOS || (process.platform === 'win32' ? 'windows' : process.platform);
const output = path.resolve('dist/server', targetOS === 'windows' ? 'xtbang.exe' : 'xtbang');
mkdirSync(path.dirname(output), { recursive: true });
execFileSync(process.env.GO_BINARY || 'go', ['build', '-o', output, '.'], { cwd: 'backend', stdio: 'inherit' });
