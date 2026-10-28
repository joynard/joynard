#!/usr/bin/env node
/**
 * Renders assets/scorecard.svg from the GitHub API.
 *
 * With METRICS_TOKEN the numbers come from GraphQL, which is the only source
 * that exposes restricted (private) contribution counts. Without the token the
 * workflow skips rendering, so the committed card is never replaced by partial
 * data.
 *
 * Usage:
 *   METRICS_TOKEN=... node scripts/scorecard.mjs
 *   node scripts/scorecard.mjs --snapshot metrics.json --out assets/scorecard.svg
 */

import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const LOGIN = process.env.GITHUB_REPOSITORY?.split('/')[0] || 'joynard';
const TOKEN = (process.env.METRICS_TOKEN || '').trim();

const PALETTE = {
  panel: '#F5EDE0',
  border: '#C68642',
  ink: '#14100C',
  muted: '#7A6A57',
  brass: '#8A5623',
};

// Warm ramp: the bar encodes rank, the legend carries the identity.
const RAMP = ['#704214', '#8A5623', '#A0522D', '#C68642', '#D9A566', '#E8C79A', '#D9CDBD'];
const SERIF = "'Iowan Old Style','Palatino Linotype',Palatino,Georgia,'Times New Roman',serif";
const SANS = "'Segoe UI','Helvetica Neue',Helvetica,Arial,sans-serif";

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--snapshot') out.snapshot = argv[++i];
    else if (argv[i] === '--out') out.out = argv[++i];
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
      name
      login
      followers { totalCount }
      contributionsCollection {
        totalCommitContributions
        totalPullRequestContributions
        totalIssueContributions
        restrictedContributionsCount
        contributionCalendar { totalContributions }
      }
      repositories(first: 100, ownerAffiliations: [OWNER], isFork: false) {
        totalCount
        nodes {
          stargazerCount
          languages(first: 10, orderBy: { field: SIZE, direction: DESC }) {
            edges { size node { name } }
          }
        }
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
  const byLanguage = new Map();
  let stars = 0;

  for (const repo of user.repositories.nodes) {
    stars += repo.stargazerCount;
    for (const edge of repo.languages.edges) {
      const name = edge.node.name;
      byLanguage.set(name, (byLanguage.get(name) ?? 0) + edge.size);
    }
  }

  const totalBytes = [...byLanguage.values()].reduce((sum, value) => sum + value, 0) || 1;
  const languages = [...byLanguage.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, bytes]) => ({ name, share: (bytes / totalBytes) * 100 }));

  return {
    login: user.login,
    name: user.name ?? user.login,
    asOf: new Date().toISOString(),
    viewer: data.viewer.login,
    contributions: contributions.contributionCalendar.totalContributions,
    commits: contributions.totalCommitContributions,
    pullRequests: contributions.totalPullRequestContributions,
    issues: contributions.totalIssueContributions,
    privateContributions: contributions.restrictedContributionsCount,
    stars,
    repositories: user.repositories.totalCount,
    followers: user.followers.totalCount,
    languages,
  };
}

const escapeXml = (value) =>
  String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[char]));

const count = (value) => new Intl.NumberFormat('en-US').format(value);

function formatDate(iso) {
  const date = new Date(iso);
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Jakarta',
  }).format(date);
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
    { label: 'REPOSITORIES', value: count(model.repositories), note: 'OWNED, NON FORK' },
  ];
}

function barSegments(languages) {
  const width = 1072;
  const shown = languages.reduce((sum, entry) => sum + entry.share, 0);
  const segments = languages.map((entry) => ({ ...entry, share: (entry.share / 100) * width }));
  if (shown < 99.5) {
    segments.push({ name: 'Other', share: ((100 - shown) / 100) * width });
  }
  return { segments, width };
}

function render(model) {
  const metrics = metricsOf(model);
  const { segments } = barSegments(model.languages);
  const asOf = formatDate(model.asOf).toUpperCase();
  const columnStep = 178;
  const left = 64;
  const right = 1136;

  const metricMarkup = metrics
    .map((metric, index) => {
      const x = left + index * columnStep;
      return [
        `<text x="${x}" y="122" font-family="${SERIF}" font-size="34" fill="${PALETTE.ink}">${escapeXml(metric.value)}</text>`,
        `<text x="${x}" y="144" font-family="${SANS}" font-size="9.5" font-weight="600" letter-spacing="1.5" fill="${PALETTE.muted}">${escapeXml(metric.label)}</text>`,
        `<text x="${x}" y="160" font-family="${SANS}" font-size="8.5" letter-spacing="1.1" fill="${PALETTE.brass}" fill-opacity="0.85">${escapeXml(metric.note)}</text>`,
      ].join('\n    ');
    })
    .join('\n    ');

  let offset = left;
  const barMarkup = segments
    .map((segment, index) => {
      const width = Math.max(segment.share - 1.5, 0.5);
      const rect = `<rect x="${offset.toFixed(2)}" y="222" width="${width.toFixed(2)}" height="7" fill="${RAMP[index % RAMP.length]}"/>`;
      offset += segment.share;
      return rect;
    })
    .join('\n    ');

  const legendStep = 152;
  const legendMarkup = segments
    .map((segment, index) => {
      const x = left + index * legendStep;
      const share = `${Math.round(segment.share / 10.72)}%`;
      return [
        `<circle cx="${x + 3}" cy="245" r="3" fill="${RAMP[index % RAMP.length]}"/>`,
        `<text x="${x + 12}" y="249" font-family="${SANS}" font-size="9" letter-spacing="0.4" fill="${PALETTE.muted}">${escapeXml(segment.name)} ${escapeXml(share)}</text>`,
      ].join('\n    ');
    })
    .join('\n    ');

  const privacy = model.privateContributions
    ? 'PRIVATE CONTRIBUTIONS INCLUDED'
    : 'PUBLIC DATA ONLY';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 272" width="100%" role="img" aria-label="GitHub scorecard for ${escapeXml(model.login)}: ${metrics.map((m) => `${m.label.toLowerCase()} ${m.value}`).join(', ')}">
  <title>GitHub scorecard: ${escapeXml(model.login)}</title>
  <rect x="0.5" y="0.5" width="1199" height="271" rx="3" fill="${PALETTE.panel}" stroke="${PALETTE.border}" stroke-opacity="0.5"/>
  <text x="${left}" y="46" font-family="${SANS}" font-size="9.5" font-weight="600" letter-spacing="3.2" fill="${PALETTE.brass}">GITHUB SCORECARD</text>
  <text x="${right}" y="46" text-anchor="end" font-family="${SANS}" font-size="9" letter-spacing="1.6" fill="${PALETTE.muted}">AS OF ${escapeXml(asOf)}</text>
  <line x1="${left}" y1="62" x2="${right}" y2="62" stroke="${PALETTE.border}" stroke-opacity="0.35"/>
    ${metricMarkup}
  <line x1="${left}" y1="188" x2="${right}" y2="188" stroke="${PALETTE.border}" stroke-opacity="0.28"/>
  <text x="${left}" y="212" font-family="${SANS}" font-size="9" font-weight="600" letter-spacing="2.6" fill="${PALETTE.muted}">LANGUAGE MIX</text>
  <text x="${right}" y="212" text-anchor="end" font-family="${SANS}" font-size="8.5" letter-spacing="1.3" fill="${PALETTE.brass}" fill-opacity="0.9">${escapeXml(privacy)}</text>
    ${barMarkup}
    ${legendMarkup}
</svg>
`;
}

const args = parseArgs(process.argv.slice(2));
const target = resolve(ROOT, args.out ?? 'assets/scorecard.svg');

let model;
if (args.snapshot) {
  model = JSON.parse(await readFile(resolve(ROOT, args.snapshot), 'utf8'));
} else if (TOKEN) {
  model = await collect();
} else {
  console.error('METRICS_TOKEN is not set. Pass --snapshot for an offline render.');
  process.exit(1);
}

await writeFile(target, render(model), 'utf8');
console.log(`wrote ${target}`);
