/**
 * ControlFlow — Drift Detection Helpers (Phase 9)
 *
 * Pure functions used by both evals/validate.mjs (Passes 8–11) and
 * evals/tests/drift-detection.test.mjs (negative-path coverage).
 *
 * Non-duplication rationale:
 *   Existing drift coverage is inventoried in
 *   plans/artifacts/controlflow-revision/phase-1-existing-drift-checks.yaml.
 *   This module adds only the four checks marked `missing_checks_target_phase_9`
 *   (Check #1 `model_role` remains gated off pending Phase 4 spike re-enable).
 */

import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';

// Module-level path constants used by computeStructuralFingerprint
const __cfFilename = fileURLToPath(import.meta.url);
const __cfDir = dirname(__cfFilename);
const CF_REPO_ROOT = resolve(__cfDir, '..');
const CF_SCHEMAS_DIR = join(CF_REPO_ROOT, 'schemas');
const CF_SCENARIOS_DIR = join(__cfDir, 'scenarios');

// ── Check #1: model_role validation ───────────────────────────────────────────
// Enabled after Phase 2 spike confirmed VS Code tolerates model_role: frontmatter.
export const MODEL_ROLE_CHECK_ENABLED = true;

/**
 * Validate that an agent's frontmatter declares a valid model_role.
 * Scoped to the first YAML frontmatter block (delimited by `---`) only;
 * matches in the markdown body are ignored.
 * @param {string} agentFrontmatter - Full agent file content (includes frontmatter)
 * @param {object} routingJson - Parsed governance/model-routing.json
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validateModelRole(agentFrontmatter, routingJson) {
  const errors = [];
  // Extract the first frontmatter block: must start with `---` on the first
  // non-empty line and end at the next `---` line. If no block, treat as missing.
  const fmMatch = agentFrontmatter.match(/^---\r?\n([\s\S]*?)\r?\n---\s*$/m);
  const scope = fmMatch ? fmMatch[1] : '';
  const m = scope.match(/^model_role:\s*(\S+)\s*$/m);
  if (!m) {
    errors.push('model_role key missing from frontmatter');
    return { ok: false, errors };
  }
  const role = m[1];
  const validRoles = Object.keys(routingJson.roles || {});
  if (!validRoles.includes(role)) {
    errors.push(`model_role value "${role}" is not a key in governance/model-routing.json roles (valid: ${validRoles.join(', ')})`);
    return { ok: false, errors };
  }
  return { ok: true, errors };
}

// ── Check #2: Roster ↔ enum bidirectional alignment ──────────────────────────
export function parseRosterFromProjectContext(content) {
  const lines = content.split('\n');
  const startIdx = lines.findIndex(l => l.trim() === '## Phase Executor Agents');
  if (startIdx === -1) return [];
  const agents = [];
  for (let i = startIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (/^##\s/.test(line)) break;
    // Only consume real table data rows: leading '|', first cell is an agent name,
    // skip the header row ("Agent") and the separator row ("---").
    const m = line.match(/^\|\s*([A-Za-z][\w-]+)\s*\|/);
    if (!m) continue;
    const name = m[1];
    if (name === 'Agent') continue;
    if (/^\|\s*-+\s*\|/.test(line)) continue;
    agents.push(name);
  }
  return agents;
}

export function compareRosterEnum(rosterAgents, enumValues) {
  const rosterSet = new Set(rosterAgents);
  const enumSet = new Set(enumValues);
  const extraInRoster = [...rosterSet].filter(a => !enumSet.has(a));
  const extraInEnum = [...enumSet].filter(a => !rosterSet.has(a));
  return {
    equal: extraInRoster.length === 0 && extraInEnum.length === 0,
    extraInRoster,
    extraInEnum,
  };
}

// ── Check #3: Agent Resources ↔ schemas existence ────────────────────────────
export function parseResourcesSchemaPaths(agentContent) {
  const lines = agentContent.split('\n');
  const startIdx = lines.findIndex(l => l.trim() === '## Resources');
  if (startIdx === -1) return [];
  const paths = [];
  for (let i = startIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (/^##\s/.test(line)) break;
    for (const m of line.matchAll(/`(schemas\/[^`]+\.json)`/g)) {
      paths.push(m[1]);
    }
  }
  return paths;
}

// ── Check #4: Cross-plan file-overlap ────────────────────────────────────────
const ANNOTATION_RX = /\s*\([^)]*\)\s*$/;

export function stripAnnotations(path) {
  return path.replace(ANNOTATION_RX, '').trim();
}

// Parse the `Files:` section of a plan document.
// Parser contract (see Phase 9 of controlflow-comprehensive-revision-plan.md):
//   - Only bullet lines starting with "- **Files:**" (or following indented
//     sub-bullets) contribute.
//   - Extract backtick-quoted tokens that look like file paths (contain a slash
//     or dot, no whitespace).
//   - Strip trailing parenthetical annotations ("(new)", "(spike)", etc.).
//   - Ignore lines without a backtick-quoted path.
export function parsePlanFilesSection(content) {
  const lines = content.split('\n');
  const files = [];
  const collectFrom = (ln) => {
    for (const m of ln.matchAll(/`([^`]+)`/g)) {
      const raw = m[1].trim();
      if (!raw) continue;
      if (/\s/.test(raw)) continue;
      if (!/[./]/.test(raw)) continue;
      files.push(stripAnnotations(raw));
    }
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!/^\s*-\s*\*\*Files:\*\*/.test(line)) continue;
    collectFrom(line);
    for (let j = i + 1; j < lines.length; j++) {
      const sub = lines[j];
      if (/^\s{2,}-\s+/.test(sub)) {
        collectFrom(sub);
      } else if (sub.trim() === '') {
        continue;
      } else {
        break;
      }
    }
  }
  return files;
}

export function isGlob(p) { return p.includes('*'); }

export function expandGlob(pattern, rootDir) {
  if (!isGlob(pattern)) return [pattern];
  const idx = pattern.lastIndexOf('/');
  const dir = idx >= 0 ? pattern.slice(0, idx) : '.';
  const base = idx >= 0 ? pattern.slice(idx + 1) : pattern;
  if (!base.includes('*') || base.includes('**')) return [];
  const rx = new RegExp('^' + base.replace(/\./g, '\\.').replace(/\*/g, '[^/]*') + '$');
  let entries = [];
  try {
    entries = readdirSync(join(rootDir, dir));
  } catch { return []; }
  return entries
    .filter(f => rx.test(f))
    .map(f => (dir === '.' ? f : `${dir}/${f}`));
}

export function buildPlanFileMap(planPathsRelative, rootDir, opts = {}) {
  const { readFile = (p) => readFileSync(p, 'utf8') } = opts;
  const map = new Map();
  for (const planPath of planPathsRelative) {
    const absPath = join(rootDir, planPath);
    if (!existsSync(absPath)) continue;
    const content = readFile(absPath);
    const rawFiles = parsePlanFilesSection(content);
    const expanded = new Set();
    for (const f of rawFiles) {
      if (isGlob(f)) {
        for (const e of expandGlob(f, rootDir)) expanded.add(e);
      } else {
        expanded.add(f);
      }
    }
    for (const f of expanded) {
      if (!map.has(f)) map.set(f, new Set());
      map.get(f).add(planPath);
    }
  }
  return map;
}

// Minimal YAML line-parser: extract a top-level list under "consumers:".
export function parseYamlConsumers(text) {
  const lines = text.split('\n');
  const consumers = [];
  let inBlock = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!inBlock && /^consumers:\s*$/.test(line)) { inBlock = true; continue; }
    if (!inBlock) continue;
    if (/^\S/.test(line)) break; // next top-level key
    const m = line.match(/^\s+-\s+["']?([^"'\s#]+)["']?\s*(?:#.*)?$/);
    if (m) consumers.push(m[1]);
  }
  return consumers;
}

export function hasSharedAnchorMapFlag(text) {
  return /^\s*shared_anchor_map:\s*true\s*$/m.test(text);
}

export function findSharedAnchorMaps(rootDir, artifactsDir = 'plans/artifacts') {
  const anchorMaps = [];
  const base = join(rootDir, artifactsDir);
  let subdirs = [];
  try {
    subdirs = readdirSync(base, { withFileTypes: true }).filter(d => d.isDirectory());
  } catch { return anchorMaps; }
  for (const sub of subdirs) {
    const subPath = join(base, sub.name);
    let files = [];
    try {
      files = readdirSync(subPath).filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));
    } catch { continue; }
    for (const f of files) {
      const text = readFileSync(join(subPath, f), 'utf8');
      if (!hasSharedAnchorMapFlag(text)) continue;
      const consumers = parseYamlConsumers(text);
      anchorMaps.push({
        path: `${artifactsDir}/${sub.name}/${f}`.replace(/\\/g, '/'),
        consumers,
      });
    }
  }
  return anchorMaps;
}

export function findUnresolvedOverlaps(planFileMap, anchorMaps) {
  const unresolved = [];
  for (const [file, planSet] of planFileMap.entries()) {
    if (planSet.size < 2) continue;
    const plans = [...planSet].sort();
    for (let i = 0; i < plans.length; i++) {
      for (let j = i + 1; j < plans.length; j++) {
        const a = plans[i], b = plans[j];
        const covered = anchorMaps.some(am =>
          am.consumers.includes(a) && am.consumers.includes(b));
        if (!covered) unresolved.push({ file, planA: a, planB: b });
      }
    }
  }
  return unresolved;
}

// ── Check #6: by_tier matrix shape ───────────────────────────────────────────
const VALID_COMPLEXITY_TIERS = ['TRIVIAL', 'SMALL', 'MEDIUM', 'LARGE'];
const VALID_COST_TIER_VALUES = ['low', 'medium', 'high'];
const VALID_LATENCY_TIER_VALUES = ['fast', 'medium', 'slow'];

/**
 * Validate that every role in governance/model-routing.json carries a by_tier
 * object with all four complexity tiers present. Each tier entry must be either
 * a full override ({ primary, fallbacks, cost_tier, latency_tier }) or a
 * delegation ({ inherit_from: "default" }).
 * @param {object} routingJson - Parsed governance/model-routing.json
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validateByTierShape(routingJson) {
  const errors = [];
  const roles = routingJson.roles || {};
  for (const [roleName, role] of Object.entries(roles)) {
    const byTier = role.by_tier;
    if (!byTier || typeof byTier !== 'object') {
      errors.push(`role "${roleName}": missing by_tier object`);
      continue;
    }
    const unknownKeys = Object.keys(byTier).filter(k => !VALID_COMPLEXITY_TIERS.includes(k));
    if (unknownKeys.length > 0) {
      errors.push(`role "${roleName}": by_tier contains unknown tier(s): ${unknownKeys.join(', ')} (valid: ${VALID_COMPLEXITY_TIERS.join(', ')})`);
    }
    for (const tier of VALID_COMPLEXITY_TIERS) {
      const entry = byTier[tier];
      if (!entry || typeof entry !== 'object') {
        errors.push(`role "${roleName}": by_tier missing tier "${tier}"`);
        continue;
      }
      if ('inherit_from' in entry) {
        if (entry.inherit_from !== 'default') {
          errors.push(`role "${roleName}" tier "${tier}": inherit_from must be "default", got "${entry.inherit_from}"`);
        }
      } else {
        if (!entry.primary) {
          errors.push(`role "${roleName}" tier "${tier}": missing primary`);
        }
        if (!Array.isArray(entry.fallbacks)) {
          errors.push(`role "${roleName}" tier "${tier}": fallbacks must be an array`);
        }
        if (!VALID_COST_TIER_VALUES.includes(entry.cost_tier)) {
          errors.push(`role "${roleName}" tier "${tier}": invalid cost_tier "${entry.cost_tier}" (valid: ${VALID_COST_TIER_VALUES.join(', ')})`);
        }
        if (!VALID_LATENCY_TIER_VALUES.includes(entry.latency_tier)) {
          errors.push(`role "${roleName}" tier "${tier}": invalid latency_tier "${entry.latency_tier}" (valid: ${VALID_LATENCY_TIER_VALUES.join(', ')})`);
        }
      }
    }
  }
  return { ok: errors.length === 0, errors };
}

// ── Check #10: review_scope=final bidirectional coupling ──────────────────────
/**
 * Validates that CodeReviewer-subagent.agent.md references `review_scope=final`
 * if and only if `code-reviewer.verdict.schema.json` review_scope enum contains "final".
 * This is a bidirectional coupling check: if one side drifts the other becomes stale.
 * @param {string} agentContent - Content of CodeReviewer-subagent.agent.md
 * @param {object} schemaJson - Parsed code-reviewer.verdict.schema.json
 * @returns {{ ok: boolean, agentReferencesFinal: boolean, schemaHasFinal: boolean, errors: string[] }}
 */
export function validateReviewScopeFinalCoupling(agentContent, schemaJson) {
  const agentReferencesFinal =
    /review_scope[=:]\s*"?final"?/.test(agentContent) ||
    /review_scope=final/.test(agentContent);
  const schemaHasFinal =
    (schemaJson?.properties?.review_scope?.enum ?? []).includes('final');

  const errors = [];
  if (agentReferencesFinal && !schemaHasFinal) {
    errors.push(
      'CodeReviewer-subagent.agent.md references review_scope=final but code-reviewer.verdict.schema.json review_scope enum lacks "final"'
    );
  }
  if (schemaHasFinal && !agentReferencesFinal) {
    errors.push(
      'code-reviewer.verdict.schema.json review_scope enum contains "final" but CodeReviewer-subagent.agent.md does not reference review_scope=final'
    );
  }
  return { ok: errors.length === 0, agentReferencesFinal, schemaHasFinal, errors };
}

// ── Check #11: NOTES.md style anti-pattern detection ─────────────────────────
/**
 * Validates that NOTES.md does not contain task-history anti-patterns that
 * indicate memory pollution (content that belongs in task-episodic memory, not
 * repo-persistent active-objective state).
 *
 * Anti-patterns detected:
 *   - Lines containing the word "iteration" (task-history leakage)
 *   - Lines containing the word "verdict" (audit-result leakage)
 *   - Lines containing an artifact path fragment matching /phase-\d+-/ (phase reference)
 *   - More than 3 consecutive bullet items under a single heading
 *   - A fenced code block (triple backtick)
 *
 * @param {string} content - Full text content of NOTES.md
 * @returns {{ ok: boolean, violations: string[] }}
 */
export function validateNotesMdStyle(content) {
  const violations = [];
  const lines = content.split('\n');

  let consecutiveBullets = 0;
  let currentHeading = '(top)';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Track heading boundaries to reset bullet counter
    if (/^#{1,6}\s/.test(line)) {
      consecutiveBullets = 0;
      currentHeading = line.trim();
      continue;
    }

    // Fenced code block
    if (/^```/.test(line.trim())) {
      violations.push(`Line ${lineNum}: fenced code block not allowed in NOTES.md (task-episodic content)`);
    }

    // "iteration" keyword (case-insensitive)
    if (/\biteration\b/i.test(line)) {
      violations.push(`Line ${lineNum}: contains "iteration" — task-history content belongs in plans/artifacts/, not NOTES.md`);
    }

    // "verdict" keyword (case-insensitive)
    if (/\bverdict\b/i.test(line)) {
      violations.push(`Line ${lineNum}: contains "verdict" — audit result belongs in plans/artifacts/, not NOTES.md`);
    }

    // phase-N- artifact path fragment
    if (/phase-\d+-/.test(line)) {
      violations.push(`Line ${lineNum}: contains phase artifact path fragment (phase-N-) — task-episodic content`);
    }

    // Consecutive bullet counting
    if (/^\s*[-*+]\s/.test(line) || /^\s*\d+\.\s/.test(line)) {
      consecutiveBullets++;
      if (consecutiveBullets > 3) {
        violations.push(`Line ${lineNum}: more than 3 consecutive bullet items under heading "${currentHeading}" — NOTES.md must stay concise`);
      }
    } else if (line.trim() !== '') {
      consecutiveBullets = 0;
    }
  }

  return { ok: violations.length === 0, violations };
}

// ── Memory Content Taxonomy drift checks (free-code-memory-features Phase 4) ─

/**
 * Validate that MEMORY-ARCHITECTURE.md contains the ## Memory Content Taxonomy
 * heading and all expected memory_content_types from runtime-policy.json.
 * @param {string} memoryArchitectureContent - Full text of MEMORY-ARCHITECTURE.md
 * @param {object} runtimePolicy - Parsed governance/runtime-policy.json
 * @returns {{ pass: boolean, reason?: string }}
 */
export function validateMemoryContentTaxonomy(memoryArchitectureContent, runtimePolicy) {
  if (!memoryArchitectureContent.includes('## Memory Content Taxonomy')) {
    return { pass: false, reason: 'MEMORY-ARCHITECTURE.md is missing heading "## Memory Content Taxonomy"' };
  }
  const types = runtimePolicy?.memory_hygiene?.memory_content_types ?? [];
  for (const type of types) {
    if (!memoryArchitectureContent.includes(type)) {
      return { pass: false, reason: `MEMORY-ARCHITECTURE.md does not mention memory_content_type "${type}"` };
    }
  }
  return { pass: true };
}

/**
 * Validate that PROMPT-BEHAVIOR-CONTRACT.md contains the § 7 Memory Use
 * Discipline heading and both required invariant strings.
 * @param {string} promptBehaviorContent - Full text of PROMPT-BEHAVIOR-CONTRACT.md
 * @param {object} scenario - Parsed memory-content-taxonomy.json scenario fixture
 * @returns {{ pass: boolean, reason?: string }}
 */
export function validateMemoryUseDiscipline(promptBehaviorContent, scenario) {
  const heading = scenario?.expected?.memory_use_discipline_heading ?? '### 7. Memory Use Discipline';
  if (!promptBehaviorContent.includes(heading)) {
    return { pass: false, reason: `PROMPT-BEHAVIOR-CONTRACT.md is missing heading "${heading}"` };
  }
  if (!promptBehaviorContent.includes('Verify before use')) {
    return { pass: false, reason: 'PROMPT-BEHAVIOR-CONTRACT.md is missing invariant "Verify before use"' };
  }
  if (!promptBehaviorContent.includes('Ignore memory on request')) {
    return { pass: false, reason: 'PROMPT-BEHAVIOR-CONTRACT.md is missing invariant "Ignore memory on request"' };
  }
  return { pass: true };
}

/**
 * Validate that the session-notes template contains all required sections.
 * @param {string} templateContent - Full text of the session-notes template
 * @param {object} scenario - Parsed memory-content-taxonomy.json scenario fixture
 * @returns {{ pass: boolean, reason?: string }}
 */
export function validateSessionNotesTemplate(templateContent, scenario) {
  const sections = scenario?.expected?.session_notes_sections ?? [];
  for (const section of sections) {
    if (!templateContent.includes(section)) {
      return { pass: false, reason: `Session-notes template is missing section "${section}"` };
    }
  }
  return { pass: true };
}

/**
 * Validate that repo-memory-hygiene.md contains the Checklist C heading.
 * @param {string} hygieneContent - Full text of skills/patterns/repo-memory-hygiene.md
 * @param {object} scenario - Parsed memory-content-taxonomy.json scenario fixture
 * @returns {{ pass: boolean, reason?: string }}
 */
export function validateRepoMemoryHygieneChecklistC(hygieneContent, scenario) {
  const heading = scenario?.expected?.repo_memory_hygiene_checklist_c_heading ?? '## Checklist C';
  if (!hygieneContent.includes(heading)) {
    return { pass: false, reason: `skills/patterns/repo-memory-hygiene.md is missing "${heading}"` };
  }
  return { pass: true };
}

/**
 * Validate that repo-memory-hygiene.md contains the Checklist D heading.
 * @param {string} hygieneContent - Full text of skills/patterns/repo-memory-hygiene.md
 * @param {object} scenario - Parsed memory-content-taxonomy.json scenario fixture
 * @returns {{ pass: boolean, reason?: string }}
 */
export function validateRepoMemoryHygieneChecklistD(hygieneContent, scenario) {
  const heading = scenario?.expected?.repo_memory_hygiene_checklist_d_heading ?? '## Checklist D';
  if (!hygieneContent.includes(heading)) {
    return { pass: false, reason: `skills/patterns/repo-memory-hygiene.md is missing "${heading}"` };
  }
  return { pass: true };
}

// ── Subsection Extractor ──────────────────────────────────────────────────────

/**
 * Given a Markdown string and a heading text, return the substring from that
 * heading line up to (but not including) the next heading at the same or
 * shallower depth. Returns an empty string if the heading is not found.
 * @param {string} content - Full markdown document text
 * @param {string} headingText - The heading text to find (e.g. "Context Compaction Policy")
 * @returns {string}
 */
export function extractSubsection(content, headingText) {
  const lines = content.split(/\r?\n/);
  let startIdx = -1;
  let headingDepth = 0;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(#{1,6})\s+(.+)$/);
    if (m && m[2].trim() === headingText.trim()) {
      startIdx = i;
      headingDepth = m[1].length;
      break;
    }
  }
  if (startIdx === -1) return '';
  const resultLines = [lines[startIdx]];
  for (let i = startIdx + 1; i < lines.length; i++) {
    const m = lines[i].match(/^(#{1,6})\s/);
    if (m && m[1].length <= headingDepth) break;
    resultLines.push(lines[i]);
  }
  return resultLines.join('\n');
}

// ── Tutorial Parity Validator ─────────────────────────────────────────────────

/**
 * Validate heading parity between EN and RU tutorial directories.
 * Pairs .md files by basename, extracts level-2 heading sets, and applies
 * an allowlist for known asymmetric headings.
 *
 * If `allowlist._chapters_in_scope` is set (array of basenames), only those
 * files are checked. All other chapter pairs are skipped. This lets Phase 5
 * activate parity checking incrementally without requiring all chapters to
 * be fully translated or aliased up-front.
 *
 * @param {string} enDir - Absolute path to the EN tutorial directory
 * @param {string} ruDir - Absolute path to the RU tutorial directory
 * @param {object} allowlist - Allowlist object with en_only, ru_only, heading_aliases, _chapters_in_scope
 * @returns {{ pass: boolean, reason?: string, missingPairs: string[], headingMismatches: Array<{file: string, en_only: string[], ru_only: string[]}> }}
 */
export function validateTutorialParity(enDir, ruDir, allowlist) {
  const enOnlyAllowed = new Set(allowlist.en_only || []);
  const ruOnlyAllowed = new Set(allowlist.ru_only || []);
  const headingAliases = allowlist.heading_aliases || {};
  const chaptersInScope = allowlist._chapters_in_scope || null;

  let enFiles = [];
  let ruFiles = [];
  try { enFiles = readdirSync(enDir).filter(f => f.endsWith('.md')).sort(); } catch { /* dir missing */ }
  try { ruFiles = readdirSync(ruDir).filter(f => f.endsWith('.md')).sort(); } catch { /* dir missing */ }

  const enSet = new Set(enFiles);
  const ruSet = new Set(ruFiles);
  const allFiles = new Set([...enFiles, ...ruFiles]);

  // When _chapters_in_scope is set, restrict validation to those files only.
  const effectiveFiles = chaptersInScope
    ? new Set([...allFiles].filter(f => chaptersInScope.includes(f)))
    : allFiles;

  const missingPairs = [];
  for (const f of effectiveFiles) {
    if (!enSet.has(f) || !ruSet.has(f)) missingPairs.push(f);
  }

  function extractLevel2Headings(filePath) {
    try {
      const text = readFileSync(filePath, 'utf8');
      const headings = new Set();
      for (const line of text.split('\n')) {
        const m = line.match(/^##\s+(.+)$/);
        if (m) headings.add(m[1].trim());
      }
      return headings;
    } catch {
      return new Set();
    }
  }

  function applyAliases(heading) {
    return headingAliases[heading] ?? heading;
  }

  const headingMismatches = [];
  for (const f of effectiveFiles) {
    if (!enSet.has(f) || !ruSet.has(f)) continue;
    const enHeadings = extractLevel2Headings(join(enDir, f));
    const ruHeadings = extractLevel2Headings(join(ruDir, f));
    const enNorm = new Set([...enHeadings].map(applyAliases));
    const ruNorm = new Set([...ruHeadings].map(applyAliases));
    const enOnlyMismatches = [...enNorm].filter(h => !ruNorm.has(h) && !enOnlyAllowed.has(h));
    const ruOnlyMismatches = [...ruNorm].filter(h => !enNorm.has(h) && !ruOnlyAllowed.has(h));
    if (enOnlyMismatches.length > 0 || ruOnlyMismatches.length > 0) {
      headingMismatches.push({ file: f, en_only: enOnlyMismatches, ru_only: ruOnlyMismatches });
    }
  }

  const ok = missingPairs.length === 0 && headingMismatches.length === 0;
  if (!ok) {
    const reasons = [];
    if (missingPairs.length > 0) reasons.push(`missing pairs: ${missingPairs.join(', ')}`);
    if (headingMismatches.length > 0) reasons.push(`${headingMismatches.length} file(s) with heading mismatches`);
    return { pass: false, reason: reasons.join('; '), missingPairs, headingMismatches };
  }
  return { pass: true, missingPairs: [], headingMismatches: [] };
}

// ── Structural Fingerprint (cache invalidation) ───────────────────────────────

/**
 * Compute a SHA-256 fingerprint over all structural inputs consumed by the
 * eval harness. When this value changes, the warm-cache pass is invalidated.
 *
 * Exported here (rather than kept private in validate.mjs) so fingerprint
 * regression tests can import it without triggering validate.mjs side effects
 * (process.exit calls, pass output, cache writes).
 *
 * Hashes: both harness files, evals package manifests, all schemas, all top-level
 * scenario JSON, all nested scenario JSON under runtime-policy/ and tutorial-parity/
 * (recursive walk — proves the Wave 2 fix), all agent prompt files, key governance
 * and artifact files, and the skills library.
 *
 * @returns {string} hex SHA-256 digest
 */
export function computeStructuralFingerprint() {
  const h = createHash('sha256');
  function hashFile(filePath) {
    try {
      h.update(filePath + '\x00');
      h.update(readFileSync(filePath));
    } catch {
      h.update(filePath + '\x00<missing>');
    }
  }
  // Both harness files (cache invalidates when either changes)
  hashFile(__cfFilename); // drift-checks.mjs
  hashFile(join(__cfDir, 'validate.mjs'));
  // evals package manifests
  hashFile(join(__cfDir, 'package.json'));
  hashFile(join(__cfDir, 'package-lock.json'));
  // schemas
  try {
    for (const f of readdirSync(CF_SCHEMAS_DIR).sort()) {
      if (f.endsWith('.schema.json')) hashFile(join(CF_SCHEMAS_DIR, f));
    }
  } catch { /* cold */ }
  // scenarios — top-level
  try {
    for (const f of readdirSync(CF_SCENARIOS_DIR).sort()) {
      if (f.endsWith('.json')) hashFile(join(CF_SCENARIOS_DIR, f));
    }
  } catch { /* cold */ }
  // nested scenario subdirectories (runtime-policy, tutorial-parity) — full recursive walk
  function walkJson(dir) {
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const ent of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const full = join(dir, ent.name);
      if (ent.isDirectory()) walkJson(full);
      else if (ent.isFile() && ent.name.endsWith('.json')) hashFile(full);
    }
  }
  for (const subdir of ['runtime-policy', 'tutorial-parity']) {
    walkJson(join(CF_SCENARIOS_DIR, subdir));
  }
  // root agent prompt files
  try {
    for (const f of readdirSync(CF_REPO_ROOT).sort()) {
      if (f.endsWith('.agent.md')) hashFile(join(CF_REPO_ROOT, f));
    }
  } catch { /* cold */ }
  // required governance and artifact files consumed by the harness
  for (const rel of [
    '.github/copilot-instructions.md',
    'plans/project-context.md',
    'docs/agent-engineering/PART-SPEC.md',
    'docs/agent-engineering/RELIABILITY-GATES.md',
    'docs/agent-engineering/CLARIFICATION-POLICY.md',
    'docs/agent-engineering/TOOL-ROUTING.md',
    'governance/tool-grants.json',
    'governance/runtime-policy.json',
    'governance/rename-allowlist.json',
    'governance/agent-grants.json',
  ]) hashFile(join(CF_REPO_ROOT, rel));
  // skills index and patterns
  hashFile(join(CF_REPO_ROOT, 'skills', 'index.md'));
  try {
    for (const f of readdirSync(join(CF_REPO_ROOT, 'skills', 'patterns')).sort()) {
      if (f.endsWith('.md')) hashFile(join(CF_REPO_ROOT, 'skills', 'patterns', f));
    }
  } catch { /* cold */ }
  return h.digest('hex');
}

// ── Phase 5: Behavioral Assertions ──────────────────────────────────────────

/**
 * Assert that the Orchestrator's Context Compaction Policy subsection contains
 * both required invariant substrings: `compaction.max_consecutive_failures` and
 * `WAITING_APPROVAL`.
 * @param {string} orchestratorContent - Full content of Orchestrator.agent.md
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validateOrchestratorCompactionInvariant(orchestratorContent) {
  const slice = extractSubsection(orchestratorContent, 'Context Compaction Policy');
  if (!slice) {
    return { ok: false, errors: ['Context Compaction Policy subsection not found in Orchestrator content'] };
  }
  const errors = [];
  if (!slice.includes('compaction.max_consecutive_failures')) {
    errors.push('Context Compaction Policy: missing substring "compaction.max_consecutive_failures"');
  }
  if (!slice.includes('WAITING_APPROVAL')) {
    errors.push('Context Compaction Policy: missing substring "WAITING_APPROVAL"');
  }
  return { ok: errors.length === 0, errors };
}

/**
 * Assert that within the Orchestrator's Agentic Memory Policy subsection,
 * the memory-promotion-candidates.md bullet appears STRICTLY BEFORE the
 * Checklist C bullet (by line index within the extracted slice).
 * @param {string} orchestratorContent - Full content of Orchestrator.agent.md
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validateOrchestratorMemoryPromotionOrder(orchestratorContent) {
  const slice = extractSubsection(orchestratorContent, 'Agentic Memory Policy');
  if (!slice) {
    return { ok: false, errors: ['Agentic Memory Policy subsection not found in Orchestrator content'] };
  }
  const lines = slice.split('\n');
  const promotionIdx = lines.findIndex(l => l.includes('memory-promotion-candidates.md'));
  const checklistCIdx = lines.findIndex((l, i) => i !== promotionIdx && l.includes('Checklist C'));
  const errors = [];
  if (promotionIdx === -1) {
    errors.push('Agentic Memory Policy: memory-promotion-candidates.md bullet not found');
  }
  if (checklistCIdx === -1) {
    errors.push('Agentic Memory Policy: Checklist C bullet not found');
  }
  if (promotionIdx !== -1 && checklistCIdx !== -1 && promotionIdx >= checklistCIdx) {
    errors.push(
      `Agentic Memory Policy: memory-promotion-candidates.md (line ${promotionIdx}) must appear BEFORE Checklist C (line ${checklistCIdx})`
    );
  }
  return { ok: errors.length === 0, errors };
}

/**
 * Assert that at least one line in the CodeReviewer Prompt section contains
 * BOTH `review_mode: "security"` AND `skills/patterns/security-review-discipline.md`
 * on the SAME line.
 * @param {string} codeReviewerContent - Full content of CodeReviewer-subagent.agent.md
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validateCodeReviewerSecurityModeSameLine(codeReviewerContent) {
  const promptSlice = extractSubsection(codeReviewerContent, 'Prompt');
  const searchContent = promptSlice || codeReviewerContent;
  const hasMatchingLine = searchContent.split('\n').some(
    line =>
      line.includes('review_mode: "security"') &&
      line.includes('skills/patterns/security-review-discipline.md')
  );
  if (!hasMatchingLine) {
    return {
      ok: false,
      errors: [
        'No single line in the Prompt section contains both review_mode: "security" and skills/patterns/security-review-discipline.md',
      ],
    };
  }
  return { ok: true, errors: [] };
}

// ── Check #PW-F1: Canonical Source Matrix heading ─────────────────────────────

/**
 * Validate that plans/project-context.md contains the ## Canonical Source Matrix
 * heading (anchor added in Phase 1 of the planner-orchestrator optimization wave).
 * This check fails if the heading is removed or renamed, preventing silent regression.
 * @param {string} projectContextContent - Full text of plans/project-context.md
 * @returns {{ pass: boolean, reason?: string }}
 */
export function validateCanonicalSourceMatrixHeading(projectContextContent) {
  if (!projectContextContent.includes('## Canonical Source Matrix')) {
    return {
      pass: false,
      reason: 'plans/project-context.md is missing heading "## Canonical Source Matrix"',
    };
  }
  return { pass: true };
}
