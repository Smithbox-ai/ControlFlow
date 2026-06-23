/**
 * ControlFlow — Skill Discoverability Regression Tests
 *
 * Verifies that representative operator task descriptions containing
 * traceability / coverage / requirements / orphan-RTM keywords resolve to
 * `skills/patterns/completeness-traceability.md` via the
 * `skills/index.md` Domain Mapping table.
 *
 * Phase 3 re-anchor: the original anchor skill
 * `skills/patterns/orchestration-audit-playbook.md` was retired with the
 * heavy 13-agent orchestration core (audit/orchestration/governance
 * discipline now ships as the .github/skills/controlflow-review skill, not a
 * skill pattern). Re-anchored to `completeness-traceability.md`, the surviving
 * pattern whose keyword set (requirements/coverage/traceability/orphan/RTM/
 * scope) is closest to the retired audit/traceability theme — equivalent-or-
 * stronger per the Phase 2 re-anchoring clause (b), not silently dropped.
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

const ANCHOR_SKILL = 'skills/patterns/completeness-traceability.md';

// ── Suite: index parsing ──────────────────────────────────────────────────────

console.log('\n=== skill-discoverability: index parsing ===');
{
  assert(skillIndex.length > 0, 'parsed at least one skill row from skills/index.md');

  const anchorRow = skillIndex.find((r) => r.skillFile === ANCHOR_SKILL);
  assert(anchorRow !== undefined, 'completeness-traceability row is present in index');

  if (anchorRow) {
    assert(
      anchorRow.keywords.includes('traceability'),
      'completeness-traceability row contains "traceability" keyword'
    );
    assert(
      anchorRow.keywords.includes('coverage'),
      'completeness-traceability row contains "coverage" keyword'
    );
    assert(
      anchorRow.keywords.includes('requirements'),
      'completeness-traceability row contains "requirements" keyword'
    );
    assert(
      anchorRow.keywords.includes('orphan'),
      'completeness-traceability row contains "orphan" keyword'
    );
    assert(
      anchorRow.keywords.includes('rtm'),
      'completeness-traceability row contains "rtm" keyword'
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
  'review traceability gaps across phases',
  'check requirements coverage for the plan',
  'find orphan requirements in the RTM',
  'audit traceability and coverage',
];

for (const fixture of POSITIVE_FIXTURES) {
  const resolved = resolveSkills(fixture, skillIndex);
  assert(
    resolved.includes(ANCHOR_SKILL),
    `"${fixture}" resolves to completeness-traceability.md`
  );
}

// ── Suite: negative-control fixture ──────────────────────────────────────────

console.log('\n=== skill-discoverability: negative-control fixture ===');
{
  const fixture = 'refactor a UI button';
  const resolved = resolveSkills(fixture, skillIndex);
  assert(
    !resolved.includes(ANCHOR_SKILL),
    `"${fixture}" does NOT resolve to completeness-traceability.md`
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

// ── Suite: ControlFlow-Codex plugin workflow contract ────────────────────────

console.log('\n=== skill-discoverability: ControlFlow-Codex plugin contract ===');
{
  const codexPlanningSkill = readFileSync(
    join(ROOT, 'plugins', 'controlflow-shared-source', 'skills', 'controlflow-planning', 'SKILL.md'),
    'utf8'
  );
  const codexOrchestrationSkill = readFileSync(
    join(ROOT, 'plugins', 'controlflow-shared-source', 'skills', 'controlflow-orchestration', 'SKILL.md'),
    'utf8'
  );
  const codexReadme = readFileSync(
    join(ROOT, 'plugins', 'controlflow-codex', 'README.md'),
    'utf8'
  );

  assert(
    /Save to `plans\/<task-slug>-plan\.md`/i.test(codexPlanningSkill) &&
    /references\/plan-template\.md/i.test(codexPlanningSkill),
    'Codex planning skill saves strict Markdown plans under plans/'
  );

  assert(
    /multi_agent_v1\.spawn_agent/i.test(codexOrchestrationSkill) &&
    /explicitly asks|explicitly authorizes/i.test(codexOrchestrationSkill),
    'Codex orchestration skill documents optional multi_agent_v1.spawn_agent delegation'
  );

  assert(
    /subagent outputs/i.test(codexOrchestrationSkill) &&
    /plans\/artifacts\/<task-slug>\//i.test(codexOrchestrationSkill),
    'Codex orchestration skill stores subagent outputs in plans/artifacts/'
  );

  assert(
    /Subagent/i.test(codexReadme) &&
    /multi_agent_v1\.spawn_agent/i.test(codexReadme),
    'Codex README exposes the subagent delegation contract'
  );
}

// ── Suite: slim Copilot-first .github/skills/ contract ────────────────────────
// Phase 2: assert the three canonical skills at .github/skills/controlflow-{plan,
// verify, review}/ are present on disk with valid YAML frontmatter (name + description)
// and a non-empty References section. This is the slim Copilot-first surface that
// replaces the heavy 13-agent model; the contract-drift + behavior tests rely on it.
console.log('\n=== skill-discoverability: slim .github/skills/ contract ===');
{
  const skillRoot = join(ROOT, '.github', 'skills');
  const expected = [
    { dir: 'controlflow-plan', name: 'controlflow-plan' },
    { dir: 'controlflow-verify', name: 'controlflow-verify' },
    { dir: 'controlflow-review', name: 'controlflow-review' },
  ];
  for (const { dir, name } of expected) {
    const skillPath = join(skillRoot, dir, 'SKILL.md');
    let content = '';
    try {
      content = readFileSync(skillPath, 'utf8');
    } catch {
      assert(false, `slim skill present: .github/skills/${dir}/SKILL.md`);
      continue;
    }
    assert(true, `slim skill present: .github/skills/${dir}/SKILL.md`);

    // Frontmatter present with name + description
    const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    assert(fmMatch != null, `slim skill ${name}: YAML frontmatter block present`);
    const fm = fmMatch ? fmMatch[1] : '';
    assert(
      new RegExp(`^name:\\s*${name}$`, 'm').test(fm),
      `slim skill ${name}: frontmatter name matches "${name}"`
    );
    assert(
      /^description:\s*.+/m.test(fm),
      `slim skill ${name}: frontmatter has non-empty description`
    );
    assert(
      /^## References$/m.test(content),
      `slim skill ${name}: References section present`
    );
  }
}

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n=== skill-discoverability: ${passed} passed, ${failed} failed ===`);

if (failed > 0) {
  process.exit(1);
}
