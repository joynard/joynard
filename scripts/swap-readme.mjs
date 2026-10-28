#!/usr/bin/env node
/**
 * Replaces the hosted metric cards in the Statistics section with the three
 * generated cards. Runs once; later runs find the block already present and
 * exit without touching the file.
 *
 * The section is bounded by the Statistics heading and the divider paragraph
 * that closes it, so any caption added between them is replaced too.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FILE = resolve(ROOT, 'README.md');
const SECTION = /<h3 align="center">Statistics<\/h3>[\s\S]*?(?=<p align="center">\s*<br\s*\/?>\s*<img src="\.\/assets\/divider\.svg)/;

const block = `<h3 align="center">Statistics</h3>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./assets/card-stats-dark.svg?v=0"/>
    <img height="200" src="./assets/card-stats-light.svg?v=0" alt="GitHub statistics: stars, commits, pull requests, issues, and repositories contributed to, private work included"/>
  </picture>
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./assets/card-streak-dark.svg?v=0"/>
    <img height="195" src="./assets/card-streak-light.svg?v=0" alt="Contribution streak: total contributions, current streak, and longest streak, private work included"/>
  </picture>
</p>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./assets/card-langs-dark.svg?v=0"/>
    <img width="440" src="./assets/card-langs-light.svg?v=0" alt="Most used languages across contributed repositories"/>
  </picture>
</p>

`;

const readme = await readFile(FILE, 'utf8');

if (readme.includes('card-stats-light.svg')) {
  console.log('Scorecard block already present.');
  process.exit(0);
}
if (!SECTION.test(readme)) {
  console.log('Statistics section not matched, leaving README untouched.');
  process.exit(0);
}

await writeFile(FILE, readme.replace(SECTION, block), 'utf8');
console.log('Statistics section swapped to the generated cards.');
