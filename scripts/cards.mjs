#!/usr/bin/env node
/**
 * Renders three statistic cards, each in a light and a dark variant:
 *   assets/card-stats-{light,dark}.svg
 *   assets/card-langs-{light,dark}.svg
 *   assets/card-streak-{light,dark}.svg
 *
 * With METRICS_TOKEN the numbers come from GraphQL, which is the only source
 * that exposes contributions from private repositories. Without the token the
 * workflow skips rendering, so committed cards are never replaced by partial
 * data.
 *
 * Usage:
 *   METRICS_TOKEN=... node scripts/cards.mjs
 *   node scripts/cards.mjs --snapshot metrics.json
 */

import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const LOGIN = process.env.GITHUB_REPOSITORY?.split('/')[0] || 'joynard';
const TOKEN = (process.env.METRICS_TOKEN || '').trim();

const SANS = "'Segoe UI','Helvetica Neue',Helvetica,Arial,sans-serif";

const THEMES = {
  light: { title: '#8A5623', text: '#5B4A38', muted: '#8A7159', icon: '#A0522D', rule: '#C68642' },
  dark: { title: '#C68642', text: '#C9B79F', muted: '#A8917A', icon: '#C68642', rule: '#C68642' },
};

const ICONS = {
  star: 'M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.751.751 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Zm0 2.445L6.615 5.5a.75.75 0 0 1-.564.41l-3.097.45 2.24 2.184a.75.75 0 0 1 .216.664l-.528 3.084 2.769-1.456a.75.75 0 0 1 .698 0l2.77 1.456-.53-3.084a.75.75 0 0 1 .216-.664l2.24-2.183-3.096-.45a.75.75 0 0 1-.564-.41L8 2.694Z',
  commit: 'M11.93 8.5a4.002 4.002 0 0 1-7.86 0H.75a.75.75 0 0 1 0-1.5h3.32a4.002 4.002 0 0 1 7.86 0h3.32a.75.75 0 0 1 0 1.5Zm-1.43-.75a2.5 2.5 0 1 0-5 0 2.5 2.5 0 0 0 5 0Z',
  pull: 'M1.5 3.25a2.25 2.25 0 1 1 3 2.122v5.256a2.251 2.251 0 1 1-1.5 0V5.372A2.25 2.25 0 0 1 1.5 3.25Zm5.677-.177L9.573.677A.25.25 0 0 1 10 .854V2.5h1A2.5 2.5 0 0 1 13.5 5v5.628a2.251 2.251 0 1 1-1.5 0V5a1 1 0 0 0-1-1h-1v1.646a.25.25 0 0 1-.427.177L7.177 3.427a.25.25 0 0 1 0-.354ZM3.75 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm0 9.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm8.25.75a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0Z',
  issue: 'M8 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Z',
  repo: 'M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 0 1 0-1.5h1.75v-2h-8a1 1 0 0 0-.714 1.7.75.75 0 1 1-1.072 1.05A2.495 2.495 0 0 1 2 11.5Zm10.5-1h-8a1 1 0 0 0-1 1v6.708A2.486 2.486 0 0 1 4.5 9h8ZM5 12.25a.25.25 0 0 1 .25-.25h3.5a.25.25 0 0 1 .25.25v3.25a.25.25 0 0 1-.4.2l-1.45-1.087a.249.249 0 0 0-.3 0L5.4 15.7a.25.25 0 0 1-.4-.2Z',
  flame: 'M9.533.753V.752c.217 2.385 1.463 3.626 2.653 4.81C13.37 6.74 14.498 7.863 14.498 10c0 3.5-3 6-6.5 6S1.5 13.512 1.5 10c0-1.298.536-2.56 1.425-3.286.376-.308.862 0 1.035.454C4.46 8.487 5.581 8.419 6 8c.282-.282.341-.811-.003-1.5C4.34 3.187 7.035.75 8.77.146c.39-.137.726.194.763.607ZM7.998 14.5c2.832 0 5-1.98 5-4.5 0-1.463-.68-2.19-1.879-3.383l-.036-.037c-1.013-1.008-2.3-2.29-2.834-4.434-.322.256-.63.579-.864.953-.432.696-.621 1.58-.046 2.73.473.947.67 2.284-.278 3.232-.61.61-1.545.84-2.403.633a2.79 2.79 0 0 1-1.436-.874A3.198 3.198 0 0 0 3 10c0 2.53 2.164 4.5 4.998 4.5Z',
};

const RAMP = ['#704214', '#8A5623', '#A0522D', '#C68642', '#D9A566', '#E8C79A', '#C9B79F', '#B9A78F'];

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
      'User-Agent': 'joynard-cards',
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
  query Cards($login: String!) {
    user(login: $login) {
      login
      name
      followers { totalCount }
      contributionsCollection {
        totalCommitContributions
        totalPullRequestContributions
        totalIssueContributions
        totalPullRequestReviewContributions
        restrictedContributionsCount
        contributionCalendar {
          totalContributions
          weeks { contributionDays { date contributionCount } }
        }
      }
      repositoriesContributedTo(
        first: 100
        includeUserRepositories: true
        contributionTypes: [COMMIT, ISSUE, PULL_REQUEST, REPOSITORY]
      ) {
        totalCount
        nodes {
          nameWithOwner
          languages(first: 10, orderBy: { field: SIZE, direction: DESC }) {
            edges { size node { name } }
          }
        }
      }
      repositories(first: 100, ownerAffiliations: [OWNER], isFork: false) {
        nodes { stargazerCount }
      }
    }
  }
`;

function streakFrom(days) {
  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date));
  let longest = 0;
  let run = 0;
  for (const day of sorted) {
    run = day.contributionCount > 0 ? run + 1 : 0;
    if (run > longest) longest = run;
  }
  let current = 0;
  let index = sorted.length - 1;
  if (index >= 0 && sorted[index].contributionCount === 0) index -= 1;
  while (index >= 0 && sorted[index].contributionCount > 0) {
    current += 1;
    index -= 1;
  }
  return { current, longest };
}

async function collect() {
  const data = await graphql(QUERY, { login: LOGIN });
  const user = data.user;
  if (!user) throw new Error(`No GitHub user named ${LOGIN}`);

  const collection = user.contributionsCollection;
  const stars = user.repositories.nodes.reduce((sum, repo) => sum + repo.stargazerCount, 0);

  const byLanguage = new Map();
  for (const repo of user.repositoriesContributedTo.nodes) {
    for (const edge of repo.languages.edges) {
      const name = edge.node.name;
      byLanguage.set(name, (byLanguage.get(name) ?? 0) + edge.size);
    }
  }
  const totalBytes = [...byLanguage.values()].reduce((sum, value) => sum + value, 0) || 1;
  const languages = [...byLanguage.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, bytes]) => ({ name, share: (bytes / totalBytes) * 100 }));

  const days = collection.contributionCalendar.weeks.flatMap((week) => week.contributionDays);

  return {
    login: user.login,
    name: user.name ?? user.login,
    asOf: new Date().toISOString(),
    contributions: collection.contributionCalendar.totalContributions,
    commits: collection.totalCommitContributions,
    pullRequests: collection.totalPullRequestContributions,
    issues: collection.totalIssueContributions,
    privateContributions: collection.restrictedContributionsCount,
    reviews: collection.totalPullRequestReviewContributions,
    followers: user.followers.totalCount,
    stars,
    reposContributed: user.repositoriesContributedTo.totalCount,
    languages,
    streak: streakFrom(days),
  };
}

const escapeXml = (value) =>
  String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[char]));
const count = (value) => new Intl.NumberFormat('en-US').format(value);
const icon = (name, colors, x, y, size = 16) =>
  `<path transform="translate(${x} ${y}) scale(${size / 16})" d="${ICONS[name]}" fill="${colors.icon}"/>`;

function exponentialCdf(value, median) {
  return 1 - Math.pow(2, -value / median);
}

// Mirrors the scoring github-readme-stats publishes, so the grade stays
// comparable with the badge this profile used to embed.
function calculateRank(model) {
  const weights = { commits: 2, pullRequests: 3, issues: 1, reviews: 1, stars: 4, followers: 1 };
  const medians = { commits: 250, pullRequests: 50, issues: 25, reviews: 2, stars: 50, followers: 10 };
  const total = 12;
  const score =
    (weights.commits * exponentialCdf(model.commits, medians.commits) +
      weights.pullRequests * exponentialCdf(model.pullRequests, medians.pullRequests) +
      weights.issues * exponentialCdf(model.issues, medians.issues) +
      weights.reviews * exponentialCdf(model.reviews, medians.reviews) +
      weights.stars * exponentialCdf(model.stars, medians.stars) +
      weights.followers * exponentialCdf(model.followers, medians.followers)) /
    total;
  const level = Math.round((1 - score) * 100);
  const thresholds = [1, 12.5, 25, 37.5, 50, 62.5, 75, 87.5, 100];
  const levels = ['S', 'A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C'];
  const index = thresholds.findIndex((threshold) => level <= threshold);
  return { grade: levels[index === -1 ? levels.length - 1 : index], level };
}

function ringMarkup(rank, colors, cx, cy, radius) {
  const circumference = 2 * Math.PI * radius;
  const filled = (rank.level / 100) * circumference;
  return [
    `<circle cx="${cx}" cy="${cy}" r="${radius}" fill="none" stroke="${colors.muted}" stroke-opacity="0.25" stroke-width="4"/>`,
    `<circle cx="${cx}" cy="${cy}" r="${radius}" fill="none" stroke="${colors.icon}" stroke-width="4" stroke-linecap="round" stroke-dasharray="${filled.toFixed(2)} ${circumference.toFixed(2)}" transform="rotate(-90 ${cx} ${cy})"/>`,
    `<text x="${cx}" y="${cy + 7}" text-anchor="middle" font-family="${SANS}" font-size="20" font-weight="600" fill="${colors.text}">${escapeXml(rank.grade)}</text>`,
  ].join('\n  ');
}
function title(text, colors, width) {
  return `<text x="25" y="35" font-family="${SANS}" font-size="18" font-weight="600" fill="${colors.title}">${escapeXml(text)}</text>`;
}

function renderStats(model, theme) {
  const c = THEMES[theme];
  const rows = [
    { key: 'star', label: 'Total Stars Earned', value: model.stars },
    { key: 'commit', label: 'Commits, last 12 months', value: model.commits },
    { key: 'pull', label: 'Total Pull Requests', value: model.pullRequests },
    { key: 'issue', label: 'Total Issues', value: model.issues },
    { key: 'repo', label: 'Repositories Contributed To', value: model.reposContributed },
  ];
  const body = rows
    .map((row, index) => {
      const y = 68 + index * 25;
      return [
        icon(row.key, c, 25, y - 12),
        `<text x="49" y="${y}" font-family="${SANS}" font-size="14" font-weight="600" fill="${c.text}">${escapeXml(row.label)}</text>`,
        `<text x="300" y="${y}" text-anchor="end" font-family="${SANS}" font-size="14" font-weight="700" fill="${c.text}">${count(row.value)}</text>`,
      ].join('\n  ');
    })
    .join('\n  ');
  const scope = model.privateContributions
    ? `${count(model.privateContributions)} contributions from private repositories`
    : 'Public repositories only';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 440 200" width="440" height="200" role="img" aria-label="GitHub statistics for ${escapeXml(model.login)}, rank ${escapeXml(model.rank.grade)}">
  <title>GitHub statistics: ${escapeXml(model.login)}</title>
  ${title(`${model.name}'s GitHub Stats`, c)}
  ${body}
  ${ringMarkup(model.rank, c, 396, 108, 30)}
  <text x="25" y="190" font-family="${SANS}" font-size="9" letter-spacing="0.3" fill="${c.muted}">${escapeXml(scope)}</text>
</svg>
`;
}
function renderLangs(model, theme) {
  const c = THEMES[theme];
  const width = 440;
  const barX = 25;
  const barWidth = width - 50;
  const total = model.languages.reduce((sum, item) => sum + item.share, 0);
  const segments = model.languages.map((item) => ({ ...item, width: (item.share / 100) * barWidth }));
  if (total < 99.5) segments.push({ name: 'Other', share: 100 - total, width: ((100 - total) / 100) * barWidth });

  let offset = barX;
  const bars = segments
    .map((segment, index) => {
      const rect = `<rect x="${offset.toFixed(2)}" y="52" width="${Math.max(segment.width - 1.5, 0.5).toFixed(2)}" height="8" fill="${RAMP[index % RAMP.length]}"/>`;
      offset += segment.width;
      return rect;
    })
    .join('\n  ');

  const legend = segments
    .map((segment, index) => {
      // Fill down the first column first, matching the order of the bar.
      const column = index < 4 ? 0 : 1;
      const row = index % 4;
      const x = column === 0 ? barX : 240;
      const y = 88 + row * 24;
      const share = segment.name === 'Other' ? `${Math.round(segment.share)}%` : `${Math.round(segment.share)}%`;
      return [
        `<circle cx="${x + 5}" cy="${y - 4}" r="5" fill="${RAMP[index % RAMP.length]}"/>`,
        `<text x="${x + 16}" y="${y}" font-family="${SANS}" font-size="12" fill="${c.text}">${escapeXml(segment.name)} ${escapeXml(share)}</text>`,
      ].join('\n  ');
    })
    .join('\n  ');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} 190" width="${width}" height="190" role="img" aria-label="Most used languages for ${escapeXml(model.login)}">
  <title>Most used languages: ${escapeXml(model.login)}</title>
  ${title('Most Used Languages', c)}
  ${bars}
  ${legend}
</svg>
`;
}

function renderStreak(model, theme) {
  const c = THEMES[theme];
  const columns = [
    { x: 66, label: 'TOTAL CONTRIBUTIONS', value: model.contributions },
    { x: 200, label: 'CURRENT STREAK', value: model.streak.current },
    { x: 334, label: 'LONGEST STREAK', value: model.streak.longest },
  ];
  const body = columns
    .map(
      (column) => [
        `<text x="${column.x}" y="118" text-anchor="middle" font-family="${SANS}" font-size="30" font-weight="600" fill="${c.text}">${count(column.value)}</text>`,
        `<text x="${column.x}" y="142" text-anchor="middle" font-family="${SANS}" font-size="10" letter-spacing="1.2" fill="${c.muted}">${column.label}</text>`,
      ].join('\n  '),
    )
    .join('\n  ');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 195" width="400" height="195" role="img" aria-label="Contribution streak for ${escapeXml(model.login)}">
  <title>Contribution streak: ${escapeXml(model.login)}</title>
  ${icon('flame', c, 200, 44, 20)}
  <text x="200" y="34" text-anchor="middle" font-family="${SANS}" font-size="10" letter-spacing="1.6" fill="${c.title}">STREAK</text>
  <line x1="133" y1="55" x2="133" y2="155" stroke="${c.rule}" stroke-opacity="0.35"/>
  <line x1="267" y1="55" x2="267" y2="155" stroke="${c.rule}" stroke-opacity="0.35"/>
  ${body}
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

model.rank = calculateRank(model);

const cards = { stats: renderStats, langs: renderLangs, streak: renderStreak };
for (const [name, render] of Object.entries(cards)) {
  for (const theme of Object.keys(THEMES)) {
    const target = resolve(ROOT, `assets/card-${name}-${theme}.svg`);
    await writeFile(target, render(model, theme), 'utf8');
    console.log(`wrote ${target}`);
  }
}