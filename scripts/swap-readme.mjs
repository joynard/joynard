#!/usr/bin/env node
/**
 * Replaces the hosted metric cards in the Statistics section with the
 * generated scorecard block. Runs once; later runs find the block already
 * present and exit without touching the file.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FILE = resolve(ROOT, 'README.md');
const HEADING = '<h3 align="center">Statistics</h3>';
const DIVIDER = 'assets/divider.svg';

const block = `${HEADING}

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./assets/scorecard-dark.svg?v=0"/>
    <img src="./assets/scorecard-light.svg?v=0" width="100%" alt="GitHub statistics: contributions including private work, commits, pull requests, issues, stars, and repositories contributed to"/>
  </picture>
</p>

`;

const readme = await readFile(FILE, 'utf8');
const start = readme.indexOf(HEADING);
if (start === -1) {
  console.log('Statistics heading not found, nothing to swap.');
  process.exit(0);
}

// The divider paragraph closes the section, so its opening tag is the boundary.
const dividerAt = readme.indexOf(DIVIDER, start);
if (dividerAt === -1) {
  console.log('Divider not found after the Statistics heading, leaving README untouched.');
  process.exit(0);
}
const boundary = readme.lastIndexOf('<p align="center">', dividerAt);
if (boundary <= start) {
  console.log('Section boundary not found, leaving README untouched.');
  process.exit(0);
}

if (readme.slice(start, boundary).includes('scorecard-light.svg')) {
  console.log('Scorecard block already present.');
  process.exit(0);
}

await writeFile(FILE, readme.slice(0, start) + block + readme.slice(boundary), 'utf8');
console.log('Statistics section swapped to the generated scorecard.');
