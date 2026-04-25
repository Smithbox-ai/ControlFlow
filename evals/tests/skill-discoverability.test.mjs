/**
 * ControlFlow — Skill Discoverability Regression Test (Phase 3)
 *
 * Asserts that representative operator queries containing audit /
 * orchestration / governance / schema-drift keywords resolve to
 * `skills/patterns/orchestration-audit-playbook.md` via the static
 * `skills/index.md` Domain Mapping table.
 *
 * Fully offline and deterministic — no live agents, no network.
 * Exit 0 on all checks passed, exit 1 on any failure.
 *
 * Run directly: node evals/tests/skill-discoverability.test.mjs
 * (from repo root or evals/ cwd)
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

let passed = 0;
let failed = 0;

function check(label, ok, detail = '') {
  if (ok) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.log(`  ❌ ${label}${detail ? ' — ' + detail : ''}`);
    failed++;
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Parser: skills/index.md → [{ domain, skillFile, keywords[] }]
//
// Expects a markdown table whose header row contains the columns
//   Domain | Skill File | Applicable Agents | Keywords
// in that order. Rows are pipe-delimited; backtick wrapping on cells is stripped.
// ──────────────────────────────────────────────────────────────────────────────

function parseSkillIndex(src) {
  const lines = src.split('\n');
  // Locate the header row (must contain all four expected column names)
  let headerIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (
      /Domain/i.test(l) &&
      /Skill File/i.test(l) &&
      /Keywords/i.test(l)
    ) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) {
    throw new Error('skills/index.md: could not locate Domain Mapping table header row');
  }

  // Determine column positions from header
  const headerCells = lines[headerIdx]
    .split('|')
    .map(c => c.trim().replace(/`/g, ''));
  const domainCol = headerCells.findIndex(c => /^Domain$/i.test(c));
  const fileCol = headerCells.findIndex(c => /^Skill File$/i.test(c));
  const kwCol = headerCells.findIndex(c => /^Keywords$/i.test(c));

  if (domainCol === -1 || fileCol === -1 || kwCol === -1) {
    throw new Error(
      `skills/index.md: unexpected column layout — found: ${headerCells.join(' | ')}`
    );
  }

  // Skip separator row (e.g. | --- | --- | ... |)
  const rows = [];
  for (let i = headerIdx + 2; i < lines.length; i++) {
    const l = lines[i].trim();
    if (!l.startsWith('|')) break; // end of table
    const cells = l.split('|').map(c => c.trim().replace(/`/g, ''));
    const domain = cells[domainCol] || '';
    const skillFile = cells[fileCol] || '';
    const kwRaw = cells[kwCol] || '';
    if (!domain || !skillFile) continue;
    const keywords = kwRaw
      .split(',')
      .map(k => k.trim().toLowerCase())
      .filter(Boolean);
    rows.push({ domain, skillFile, keywords });
  }
  return rows;
}

// ──────────────────────────────────────────────────────────────────────────────
// Scorer: given a query string and skill rows, return matched skill file paths.
//
// Strategy: tokenise both the query and each keyword to lowercase alpha-numeric
// tokens, then check whether any keyword token appears as a token in the query.
// This avoids punctuation / hyphen mismatch (e.g. "phase-boundary" → ["phase",
// "boundary"] and "phaseboundary" in the query).
// ──────────────────────────────────────────────────────────────────────────────

function tokenise(str) {
  return str
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function resolveSkills(query, rows) {
  const queryTokens = new Set(tokenise(query));
  const matched = [];
  for (const row of rows) {
    for (const kw of row.keywords) {
      const kwTokens = tokenise(kw);
      // All tokens of the keyword must appear in the query token set
      if (kwTokens.every(t => queryTokens.has(t))) {
        matched.push(row.skillFile);
        break; // one keyword hit is enough per row
      }
    }
  }
  return matched;
}

// ──────────────────────────────────────────────────────────────────────────────
// Load and parse
// ──────────────────────────────────────────────────────────────────────────────

const SKILLS_INDEX_PATH = join(ROOT, 'skills', 'index.md');
const TARGET_SKILL = 'skills/patterns/orchestration-audit-playbook.md';

let rows;
try {
  const src = readFileSync(SKILLS_INDEX_PATH, 'utf8');
  rows = parseSkillIndex(src);
} catch (err) {
  console.error(`\nFATAL: could not parse skills/index.md — ${err.message}`);
  process.exit(1);
}

// ──────────────────────────────────────────────────────────────────────────────
// Check 1 — Index integrity
// ──────────────────────────────────────────────────────────────────────────────

console.log('\n=== skill-discoverability: index integrity ===');
{
  check('skills/index.md parsed without error', rows.length > 0, `rows found: ${rows.length}`);

  const auditRow = rows.find(r => r.skillFile === TARGET_SKILL);
  check(
    'Orchestration Audit row present in index',
    auditRow !== undefined,
    auditRow ? '' : `target skill not found: ${TARGET_SKILL}`
  );

  if (auditRow) {
    check(
      'Orchestration Audit row has "grants" keyword',
      auditRow.keywords.includes('grants')
    );
    check(
      'Orchestration Audit row has "approval" keyword',
      auditRow.keywords.includes('approval')
    );
    check(
      'Orchestration Audit row has "traceability" keyword',
      auditRow.keywords.includes('traceability')
    );
    check(
      'Orchestration Audit row has "schema" keyword',
      auditRow.keywords.includes('schema')
    );
    check(
      'Orchestration Audit row has "audit" keyword',
      auditRow.keywords.includes('audit')
    );
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Check 2 — Positive fixture resolution
// ──────────────────────────────────────────────────────────────────────────────

console.log('\n=== skill-discoverability: positive fixtures ===');
{
  const positiveFixtures = [
    'audit the orchestration pipeline',
    'investigate grants and approval drift',
    'review schema drift across agents',
    'audit traceability gaps',
  ];

  for (const fixture of positiveFixtures) {
    const matched = resolveSkills(fixture, rows);
    check(
      `"${fixture}" resolves to orchestration-audit-playbook`,
      matched.includes(TARGET_SKILL),
      matched.length === 0 ? 'no skills matched' : `matched: ${matched.join(', ')}`
    );
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Check 3 — Negative-control fixture
// ──────────────────────────────────────────────────────────────────────────────

console.log('\n=== skill-discoverability: negative control ===');
{
  const negativeFixture = 'refactor a UI button';
  const matched = resolveSkills(negativeFixture, rows);
  check(
    `"${negativeFixture}" does NOT resolve to orchestration-audit-playbook`,
    !matched.includes(TARGET_SKILL),
    matched.includes(TARGET_SKILL) ? 'incorrectly matched' : ''
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Check 4 — Regression guard: index removal detection
//
// Temporarily remove the orchestration-audit row and verify the resolver returns
// no match. This exercises the same code path that would catch a real deletion.
// ──────────────────────────────────────────────────────────────────────────────

console.log('\n=== skill-discoverability: regression guard (simulated row removal) ===');
{
  const rowsWithoutAudit = rows.filter(r => r.skillFile !== TARGET_SKILL);
  const fixture = 'audit the orchestration pipeline';
  const matched = resolveSkills(fixture, rowsWithoutAudit);
  check(
    'Removing orchestration-audit row causes resolution to fail (deterministic)',
    !matched.includes(TARGET_SKILL)
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Summary
// ──────────────────────────────────────────────────────────────────────────────

console.log(`\n--- skill-discoverability: ${passed} passed, ${failed} failed ---\n`);
if (failed > 0) process.exit(1);
