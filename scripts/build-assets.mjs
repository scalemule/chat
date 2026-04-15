#!/usr/bin/env node
// Build-time asset bundler for @scalemule/chat.
//
// Responsibilities:
// 1. Theme CSS: concatenate src/themes/rich-content.css into tailwind.css and
//    shadcn.css so `@scalemule/chat/themes/{tailwind,shadcn}.css` includes
//    rich-message styling without requiring a second import.
// 2. Editor CSS: prepend Quill Snow CSS to src/editor/editor.css so customers
//    that import `@scalemule/chat/editor.css` get the base editor styles plus
//    our SDK overrides in a single file.
//
// Runs as part of `npm run build`.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

async function bundleThemeCss() {
  const richPath = resolve(root, 'src/themes/rich-content.css');
  const rich = await readFile(richPath, 'utf8');

  const polishPath = resolve(root, 'src/themes/message-polish.css');
  const polish = await readFile(polishPath, 'utf8');

  const outDir = resolve(root, 'dist/themes');
  await mkdir(outDir, { recursive: true });

  for (const name of ['tailwind', 'shadcn']) {
    const srcPath = resolve(root, `src/themes/${name}.css`);
    const src = await readFile(srcPath, 'utf8');
    const out =
      `${src}\n/* ---- rich-content.css (concatenated) ---- */\n${rich}` +
      `\n/* ---- message-polish.css (concatenated) ---- */\n${polish}`;
    const dst = resolve(outDir, `${name}.css`);
    await writeFile(dst, out, 'utf8');
    console.log(`wrote ${dst} (${out.length} bytes)`);
  }
}

async function bundleEditorCss() {
  const editorSrcPath = resolve(root, 'src/editor/editor.css');
  let editorSrc = '';
  try {
    editorSrc = await readFile(editorSrcPath, 'utf8');
  } catch {
    // No editor source yet (Phase B not yet integrated) — skip.
    console.log('skip: no src/editor/editor.css (editor entry not built)');
    return;
  }

  const quillSnowPath = resolve(root, 'node_modules/quill/dist/quill.snow.css');
  const quillSnow = await readFile(quillSnowPath, 'utf8');

  const outDir = resolve(root, 'dist/editor');
  await mkdir(outDir, { recursive: true });
  const out = `/* ---- quill snow (vendored from quill/dist/quill.snow.css) ---- */\n${quillSnow}\n/* ---- @scalemule/chat editor.css ---- */\n${editorSrc}`;
  const dst = resolve(outDir, 'editor.css');
  await writeFile(dst, out, 'utf8');
  console.log(`wrote ${dst} (${out.length} bytes)`);
}

await bundleThemeCss();
await bundleEditorCss();
