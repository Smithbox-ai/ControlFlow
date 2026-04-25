/**
 * ControlFlow — Skill Discoverability Regression Tests
 *
 * Verifies that representative operator task descriptions containing
 * audit / orchestration / governance / schema-drift keywords resolve to
 * `skills/patterns/orchestration-audit-playbook.md` via the
 * `skills/index.md` Domain Mapping table.
 *
 * Parsing and matching are performed offline using only Node stdlib.
 * No external dependencies, no live agents, no network.
 *
 * Exit 0 on all checks passed, exit 1 on any failure.
 *
 * Run directly:
 *   node evals/tests/skill-discoverability.test.mjs
 * (Phase 4 wires this file into the `npm test` chain.)
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

let passed = 0;
let failed = 0;

function assert(cond, label) {
  if (cond) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.error(`  ❌ ${label}`);
    failed++;
  }
}

// ── Index parser ──────────────────────────────────────────────────────────────

/**
 * Parse the Domain Mapping table in `skills/index.md`.
 *
 * Returns an array of:
 *   { domain: string, skillFile: string, keywords: string[] }
 *
 * Table row format (pipe-delimited markdown):
 *   | Domain | Skill File | Applicable Agents | Keywords |
 *
 * Columns are zero-indexed after splitting on `|`. The skill file cell may
 * contain a backtick-wrapped path; backticks are stripped.
 *
 * Only rows that follow the `## Domain Mapping` heading are parsed. Header
 * and separator rows (containing only `-`, `|`, and spaces) are skipped.
 */
export function parseSkillIndex(content) {
  const lines = content.split('\n');

  // Locate the Domain Mapping section
  const startIdx = lines.findIndex((l) => /^##\s+Domain Mapping/.test(l));
  if (startIdx === -1) return [];

  const rows = [];
  for (let i = startIdx + 1; i < lines.length; i++) {
    const line = lines[i];

    // Stop at the next heading
    if (/^##/.test(line)) break;

    // Skip non-table lines and separator rows
    if (!line.includes('|')) continue;
    if (/^\s*\|[\s|-]+\|\s*$/.test(line)) continue;

    const cells = line.split('|').map((c) => c.trim());
    // Pipe-split produces an empty string at index 0 and last for bordered tables
    // Meaningful cells start at index 1
    if (cells.length < 5) continue;

    const domain = cells[1];
    const rawSkillFile = cells[2];
    const rawKeywords = cells[4];

    // Skip the header row itself
    if (domain === 'Domain' || rawSkillFile === 'Skill File') continue;

    const skillFile = rawSkillFile.replace(/`/g, '').trim();
    const keywords = tokenize(rawKeywords);

    if (skillFile && keywords.length > 0) {
      rows.push({ domain, skillFile, keywords });
    }
  }

  return rows;
}

// ── Token matching helper ─────────────────────────────────────────────────────

/**
 * Tokenize a string by lowercasing and splitting on non-alphanumeric
 * characters. Returns a deduplicated array of non-empty tokens.
 *
 * Applied symmetrically to both query strings and keyword lists so that
 * compound tokens like `phase-boundary` and `hidden-defect` are split into
 * their constituent parts before matching.
 */
export function tokenize(text) {
  return [...new Set(text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean))];
}

/**
 * Resolve a query string to the skill files whose keyword sets share at
 * least one token with the query.
 *
 * @param {string} query - Natural-language task description.
 * @param {Array<{skillFile: string, keywords: string[]}>} index - Parsed skill index rows.
 * @returns {string[]} Skill file paths that match, in index order.
 */
export function resolveSkills(query, index) {
  const queryTokens = new Set(tokenize(query));
  return index
    .filter((row) => row.keywords.some((kw) => queryTokens.has(kw)))
    .map((row) => row.skillFile);
}

// ── Load and parse index ──────────────────────────────────────────────────────

const SKILLS_INDEX_PATH = join(ROOT, 'skills', 'index.md');
const indexContent = readFileSync(SKILLS_INDEX_PATH, 'utf8');
const skillIndex = parseSkillIndex(indexContent);

const ORCHESTRATION_AUDIT_SKILL = 'skills/patterns/orchestration-audit-playbook.md';

// ── Suite: index parsing ──────────────────────────────────────────────────────

console.log('\n=== skill-discoverability: index parsing ===');
{
  assert(skillIndex.length > 0, 'parsed at least one skill row from skills/index.md');

  const auditRow = skillIndex.find((r) => r.skillFile === ORCHESTRATION_AUDIT_SKILL);
  assert(auditRow !== undefined, 'orchestration-audit-playbook row is present in index');

  if (auditRow) {
    assert(
      auditRow.keywords.includes('grants'),
      'orchestration-audit row contains "grants" keyword'
    );
    assert(
      auditRow.keywords.includes('approval'),
      'orchestration-audit row contains "approval" keyword'
    );
    assert(
      auditRow.keywords.includes('traceability'),
      'orchestration-audit row contains "traceability" keyword'
    );
    assert(
      auditRow.keywords.includes('schema'),
      'orchestration-audit row contains "schema" keyword'
    );
    assert(
      auditRow.keywords.includes('audit'),
      'orchestration-audit row contains "audit" keyword'
    );
  }
}

// ── Suite: tokenizer ──────────────────────────────────────────────────────────

console.log('\n=== skill-discoverability: tokenizer ===');
{
  const tokens = tokenize('phase-boundary hidden-defect');
  assert(tokens.includes('phase'), 'tokenize splits "phase-boundary" → "phase"');
  assert(tokens.includes('boundary'), 'tokenize splits "phase-boundary" → "boundary"');
  assert(tokens.includes('hidden'), 'tokenize splits "hidden-defect" → "hidden"');
  assert(tokens.includes('defect'), 'tokenize splits "hidden-defect" → "defect"');

  assert(tokenize('').length === 0, 'tokenize empty string → empty array');

  const deduped = tokenize('audit audit audit');
  assert(deduped.filter((t) => t === 'audit').length === 1, 'tokenize deduplicates tokens');
}

// ── Suite: positive fixture resolution ───────────────────────────────────────

console.log('\n=== skill-discoverability: positive fixtures ===');

const POSITIVE_FIXTURES = [
  'audit the orchestration pipeline',
  'investigate grants and approval drift',
  'review schema drift across agents',
  'audit traceability gaps',
];

for (const fixture of POSITIVE_FIXTURES) {
  const resolved = resolveSkills(fixture, skillIndex);
  assert(
    resolved.includes(ORCHESTRATION_AUDIT_SKILL),
    `"${fixture}" resolves to orchestration-audit-playbook.md`
  );
}

// ── Suite: negative-control fixture ──────────────────────────────────────────

console.log('\n=== skill-discoverability: negative-control fixture ===');
{
  const fixture = 'refactor a UI button';
  const resolved = resolveSkills(fixture, skillIndex);
  assert(
    !resolved.includes(ORCHESTRATION_AUDIT_SKILL),
    `"${fixture}" does NOT resolve to orchestration-audit-playbook.md`
  );
}

// ── Suite: resolver edge cases ────────────────────────────────────────────────

console.log('\n=== skill-discoverability: resolver edge cases ===');
{
  assert(
    resolveSkills('', skillIndex).length === 0,
    'empty query resolves to no skills'
  );

  assert(
    resolveSkills('xyzzy frobble wumbo', skillIndex).length === 0,
    'query with no matching tokens resolves to no skills'
  );
}

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n=== skill-discoverability: ${passed} passed, ${failed} failed ===`);

if (failed > 0) {
  process.exit(1);
}
