import { statSync } from 'node:fs';
import { resolve } from 'node:path';

const DIST_DIR = resolve(process.cwd(), 'dist');

const budgets = [
  {
    file: 'support-widget.global.js',
    limit: 75_000,
    label: 'Widget IIFE',
  },
  {
    file: 'chat.embed.global.js',
    limit: 25_000,
    label: 'Embed IIFE',
  },
  {
    file: 'chat.umd.global.js',
    limit: 50_000,
    label: 'UMD bundle',
  },
  {
    file: 'element.js',
    limit: 25_000,
    label: 'Element ESM',
  },
  {
    file: 'react.js',
    limit: 100_000,
    label: 'React ESM',
  },
];

let hasFailure = false;

console.log('Checking chat SDK bundle budgets...');

for (const budget of budgets) {
  const fullPath = resolve(DIST_DIR, budget.file);
  let size;

  try {
    size = statSync(fullPath).size;
  } catch (error) {
    hasFailure = true;
    const message = error instanceof Error ? error.message : 'unknown error';
    console.error(`FAIL ${budget.label}: missing ${budget.file} (${message})`);
    continue;
  }

  const withinBudget = size <= budget.limit;
  const sizeLabel = `${(size / 1024).toFixed(2)} KB`;
  const budgetLabel = `${(budget.limit / 1024).toFixed(2)} KB`;

  if (!withinBudget) {
    hasFailure = true;
  }

  console.log(
    `${withinBudget ? 'PASS' : 'FAIL'} ${budget.label}: ${budget.file} ${sizeLabel} / ${budgetLabel}`,
  );
}

if (hasFailure) {
  console.error('Bundle budget check failed.');
  process.exit(1);
}

console.log('Bundle budgets look good.');
