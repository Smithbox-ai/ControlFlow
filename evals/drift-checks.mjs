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
import { join } from 'path';

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
