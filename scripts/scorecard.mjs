#!/usr/bin/env node
/**
 * Renders the Statistics block as two theme variants:
 *   assets/scorecard-light.svg, assets/scorecard-dark.svg
 *
 * With METRICS_TOKEN the numbers come from GraphQL, which is the only source
 * that exposes contributions from private repositories. Without the token the
 * workflow skips rendering, so the committed files are never replaced by
 * partial data.
 *
 * Usage:
 *   METRICS_TOKEN=... node scripts/scorecard.mjs
 *   node scripts/scorecard.mjs --snapshot metrics.json
 */

import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const LOGIN = process.env.GITHUB_REPOSITORY?.split('/')[0] || 'joynard';
const TOKEN = (process.env.METRICS_TOKEN || '').trim();

const SERIF = "'Iowan Old Style','Palatino Linotype',Palatino,Georgia,'Times New Roman',serif";
const SANS = "'Segoe UI','Helvetica Neue',Helvetica,Arial,sans-serif";

const THEMES = {
  light: { ink: '#14100C', muted: '#6B5B48', accent: '#8A5623', rule: '#C68642' },
  dark: { ink: '#F5EDE0', muted: '#B9A78F', accent: '#C68642', rule: '#C68642' },
};

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--snapshot') out.snapshot = argv[++i];
  }
  return out;
}

async function graphql(query, variables) {
  const response = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      Authorization: `bearer ${TOKEN}`,
      'Content-Type': 'application/json',
      'User-Agent': 'joynard-scorecard',
    },
    body: JSON.stringify({ query, variables }),
  });
  const payload = await response.json();
  if (!response.ok || payload.errors) {
    throw new Error(`GraphQL failed: ${JSON.stringify(payload.errors ?? payload)}`);
  }
  return payload.data;
}

const QUERY = `
  query Scorecard($login: String!) {
    user(login: $login) {
      login
      followers { totalCount }
      contributionsCollection {
        totalCommitContributions
        totalPullRequestContributions
        totalIssueContributions
        restrictedContributionsCount
        contributionCalendar { totalContributions }
      }
      repositoriesContributedTo(
        first: 1
        includeUserRepositories: true
        contributionTypes: [COMMIT, ISSUE, PULL_REQUEST, REPOSITORY]
      ) { totalCount }
      repositories(first: 100, ownerAffiliations: [OWNER], isFork: false) {
        nodes { stargazerCount }
      }
    }
    viewer { login }
  }
`;

async function collect() {
  const data = await graphql(QUERY, { login: LOGIN });
  const user = data.user;
  if (!user) throw new Error(`No GitHub user named ${LOGIN}`);

  const contributions = user.contributionsCollection;
  const stars = user.repositories.nodes.reduce((sum, repo) => sum + repo.stargazerCount, 0);

  return {
    login: user.login,
    asOf: new Date().toISOString(),
    contributions: contributions.contributionCalendar.totalContributions,
    commits: contributions.totalCommitContributions,
    pullRequests: contributions.totalPullRequestContributions,
    issues: contributions.totalIssueContributions,
    privateContributions: contributions.restrictedContributionsCount,
    stars,
    reposContributed: user.repositoriesContributedTo.totalCount,
  };
}

const escapeXml = (value) =>
  String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[char]));

const count = (value) => new Intl.NumberFormat('en-US').format(value);

function formatDate(iso) {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Jakarta',
  })
    .format(new Date(iso))
    .toUpperCase();
}

function metricsOf(model) {
  const privateNote = model.privateContributions
    ? `INCLUDING ${count(model.privateContributions)} PRIVATE`
    : 'PUBLIC ACTIVITY';
  return [
    { label: 'CONTRIBUTIONS', value: count(model.contributions), note: privateNote },
    { label: 'COMMITS', value: count(model.commits), note: 'LAST 12 MONTHS' },
    { label: 'PULL REQUESTS', value: count(model.pullRequests), note: 'OPENED' },
    { label: 'ISSUES', value: count(model.issues), note: 'OPENED' },
    { label: 'STARS', value: count(model.stars), note: 'RECEIVED' },
    { label: 'REPOSITORIES', value: count(model.reposContributed), note: 'CONTRIBUTED TO' },
  ];
}

function render(model, theme) {
  const colors = THEMES[theme];
  const metrics = metricsOf(model);
  const step = 200;
  const asOf = formatDate(model.asOf);
  const privateCount = model.privateContributions ? count(model.privateContributions) : null;
  const footerLeft = privateCount
    ? `${privateCount} CONTRIBUTIONS FROM PRIVATE REPOSITORIES`
    : 'PUBLIC REPOSITORIES ONLY';

  const metricMarkup = metrics
    .map((metric, index) => {
      const x = index * step;
      return [
        `<text x="${x}" y="96" font-family="${SERIF}" font-size="40" fill="${colors.ink}">${escapeXml(metric.value)}</text>`,
        `<text x="${x}" y="118" font-family="${SANS}" font-size="9.5" font-weight="600" letter-spacing="1.5" fill="${colors.muted}">${escapeXml(metric.label)}</text>`,
        `<text x="${x}" y="134" font-family="${SANS}" font-size="8.5" letter-spacing="1.1" fill="${colors.accent}" fill-opacity="0.85">${escapeXml(metric.note)}</text>`,
      ].join('\n  ');
    })
    .join('\n  ');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 200" width="100%" role="img" aria-label="GitHub statistics for ${escapeXml(model.login)}: ${metrics.map((m) => `${m.label.toLowerCase()} ${m.value}`).join(', ')}">
  <title>GitHub statistics: ${escapeXml(model.login)}</title>
  <text x="0" y="22" font-family="${SANS}" font-size="9.5" font-weight="600" letter-spacing="3.2" fill="${colors.accent}">GITHUB IN NUMBERS</text>
  <text x="1200" y="22" text-anchor="end" font-family="${SANS}" font-size="9" letter-spacing="1.6" fill="${colors.muted}">AS OF ${escapeXml(asOf)}</text>
  <line x1="0" y1="34" x2="1200" y2="34" stroke="${colors.rule}" stroke-opacity="0.4" vector-effect="non-scaling-stroke"/>
  ${metricMarkup}
  <line x1="0" y1="156" x2="1200" y2="156" stroke="${colors.rule}" stroke-opacity="0.25" vector-effect="non-scaling-stroke"/>
  <text x="0" y="180" font-family="${SANS}" font-size="8.5" letter-spacing="1.2" fill="${colors.muted}">${escapeXml(footerLeft)}</text>
  <text x="1200" y="180" text-anchor="end" font-family="${SANS}" font-size="8.5" letter-spacing="1.2" fill="${colors.muted}">RENDERED FROM THE GITHUB API</text>
</svg>
`;
}

const args = parseArgs(process.argv.slice(2));

let model;
if (args.snapshot) {
  model = JSON.parse(await readFile(resolve(ROOT, args.snapshot), 'utf8'));
} else if (TOKEN) {
  model = await collect();
} else {
  console.error('METRICS_TOKEN is not set. Pass --snapshot for an offline render.');
  process.exit(1);
}

for (const theme of Object.keys(THEMES)) {
  const target = resolve(ROOT, `assets/scorecard-${theme}.svg`);
  await writeFile(target, render(model, theme), 'utf8');
  console.log(`wrote ${target}`);
}