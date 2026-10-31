import { build } from 'vite';
import { cp, readdir } from 'node:fs/promises';
import path from 'node:path';

await build();
for (const entry of await readdir('public')) {
  if (entry === 'cards') continue;
  await cp(path.join('public', entry), path.join('dist/client', entry), { recursive: true });
}
