#!/usr/bin/env node
// Build-time asset bundler for @scalemule/chat.
//
// Responsibilities:
// 1. Theme CSS: concatenate src/themes/rich-content.css into tailwind.css and
//    shadcn.css so `@scalemule/chat/themes/{tailwind,shadcn}.css` includes
//    rich-message styling without requiring a second import.
//
// Runs as part of `npm run build`. Destination directory is `dist/themes`.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

async function bundleThemeCss() {
  const richPath = resolve(root, 'src/themes/rich-content.css');
  const rich = await readFile(richPath, 'utf8');

  const outDir = resolve(root, 'dist/themes');
  await mkdir(outDir, { recursive: true });

  for (const name of ['tailwind', 'shadcn']) {
    const srcPath = resolve(root, `src/themes/${name}.css`);
    const src = await readFile(srcPath, 'utf8');
    const out = `${src}\n/* ---- rich-content.css (concatenated) ---- */\n${rich}`;
    const dst = resolve(outDir, `${name}.css`);
    await writeFile(dst, out, 'utf8');
    console.log(`wrote ${dst} (${out.length} bytes)`);
  }
}

await bundleThemeCss();
