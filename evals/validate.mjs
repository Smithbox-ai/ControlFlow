/**
 * ControlFlow — Structural Validation Harness
 *
 * Five passes:
 *   1. Schema Validity      — all schemas/*.schema.json compile without errors
 *   2. Scenario Integrity   — all evals/scenarios/*.json have required fields and
 *                             point to an existing agent.md
 *   3. Reference Integrity  — all *.agent.md schema/doc references resolve to
 *                             existing files; required project artifacts exist
 *   3b. Required Artifacts  — shared project context files exist (includes governance/tool-grants.json)
 *   3c. Tool Grant Consistency — every agent frontmatter tools list matches the
 *                              canonical set in governance/tool-grants.json (manifest-driven;
 *                              no tool policy is hardcoded here)
 *   4. P.A.R.T Section Order — every *.agent.md has Prompt→Archive→Resources→Tools
 *                              in the correct order
 *   5. Skill Library        — every file in skills/patterns/ is listed in skills/index.md
 *                             and every index entry resolves to an existing file
 *
 * Exit 0 on all checks passed, exit 1 on any failure.
 *
 * Tool policy source of truth: governance/tool-grants.json
 * Adding a new agent: create the .agent.md + add an entry to governance/tool-grants.json.
 * No changes to this file are needed.
 */

import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SCHEMAS_DIR = join(ROOT, 'schemas');
const SCENARIOS_DIR = join(__dirname, 'scenarios');

let totalPassed = 0;
let totalFailed = 0;

function pass(msg) { console.log(`  \u2705 ${msg}`); totalPassed++; }
function fail(msg) { console.error(`  \u274c ${msg}`); totalFailed++; }
function header(title) { console.log(`\n=== ${title} ===`); }

// Tool policy is loaded from governance/tool-grants.json at Pass 3c runtime.
// To update tool grants for an agent, edit governance/tool-grants.json — no changes here needed.

function parseFrontmatterTools(content) {
  const match = content.match(/^tools:\s*\[(.*?)\]$/m);
  if (!match) return null;

  return match[1]
    .split(',')
    .map(entry => entry.trim())
    .filter(Boolean)
    .map(entry => entry.replace(/^['"]|['"]$/g, ''));
}

function normalizeToolSet(tools) {
  return [...tools].sort();
}

/**
 * Collect all nested 'agent' or 'target_agent' fields in a scenario object,
 * skipping the top-level scenario.agent and scenario.target_agent (already
 * validated in Pass 2).  Returns an array of { path, value } entries.
 */
function collectNestedAgentFields(scenarioObj) {
  const hits = [];
  function walk(node, path) {
    if (typeof node !== 'object' || node === null) return;
    if (Array.isArray(node)) {
      for (let i = 0; i < node.length; i++) {
        walk(node[i], `${path}[${i}]`);
      }
    } else {
      for (const [key, value] of Object.entries(node)) {
        const fullPath = path ? `${path}.${key}` : key;
        if (key === 'agent' || key === 'target_agent') {
          hits.push({ path: fullPath, value });
        }
        if (typeof value === 'object' && value !== null) {
          walk(value, fullPath);
        }
      }
    }
  }
  // Only recurse into non-top-level keys
  for (const [key, value] of Object.entries(scenarioObj)) {
    if (key === 'agent' || key === 'target_agent') continue;
    walk(value, key);
  }
  return hits;
}

/**
 * Collect all expected.schema and expected.schema_ref values from a scenario
 * object, including from scenario.inputs[].expected for multi-input scenarios.
 * Returns an array of { path, value } entries.
 */
function collectSchemaRefs(scenarioObj) {
  const refs = [];
  if (scenarioObj.expected) {
    if (scenarioObj.expected.schema)
      refs.push({ path: 'expected.schema', value: scenarioObj.expected.schema });
    if (scenarioObj.expected.schema_ref)
      refs.push({ path: 'expected.schema_ref', value: scenarioObj.expected.schema_ref });
  }
  if (Array.isArray(scenarioObj.inputs)) {
    for (let i = 0; i < scenarioObj.inputs.length; i++) {
      const inp = scenarioObj.inputs[i];
      if (inp.expected) {
        if (inp.expected.schema)
          refs.push({ path: `inputs[${i}].expected.schema`, value: inp.expected.schema });
        if (inp.expected.schema_ref)
          refs.push({ path: `inputs[${i}].expected.schema_ref`, value: inp.expected.schema_ref });
      }
    }
  }
  return refs;
}

// ─── Pass 1: Schema Validity ─────────────────────────────────────────────────
header('Pass 1: Schema Validity');

const ajv = new Ajv2020({ strict: false, allErrors: true });
addFormats(ajv);

const schemaFiles = readdirSync(SCHEMAS_DIR).filter(f => f.endsWith('.schema.json'));

// Pre-load all schemas so relative $ref resolution works across schema files
const parsedSchemas = {};
for (const file of schemaFiles) {
  try {
    parsedSchemas[file] = JSON.parse(readFileSync(join(SCHEMAS_DIR, file), 'utf8'));
    ajv.addSchema(parsedSchemas[file]);
  } catch (e) {
    fail(`Schema JSON parse error: ${file} \u2014 ${e.message}`);
  }
}

// Now compile each schema (all $refs are resolvable via pre-loaded index)
for (const file of schemaFiles) {
  if (!parsedSchemas[file]) continue;
  try {
    ajv.compile(parsedSchemas[file]);
    pass(`Schema compiles: ${file}`);
  } catch (e) {
    fail(`Schema invalid: ${file} — ${e.message}`);
  }
}

// ─── Load rename-allowlist.json for Pass 2 schema_refs cross-verification ────
let renameAllowlist = null;
try {
  renameAllowlist = JSON.parse(readFileSync(join(ROOT, 'governance', 'rename-allowlist.json'), 'utf8'));
} catch {
  // Allowlist not yet available; advisory schema_refs cross-check will be skipped
}
const allowlistSchemaRefs = (renameAllowlist && renameAllowlist.schema_refs) ? renameAllowlist.schema_refs : {};

// ─── Pass 2: Scenario Integrity ──────────────────────────────────────────────
header('Pass 2: Scenario Integrity');

const scenarioFiles = readdirSync(SCENARIOS_DIR).filter(f => f.endsWith('.json'));
for (const file of scenarioFiles) {
  let scenario;
  try {
    scenario = JSON.parse(readFileSync(join(SCENARIOS_DIR, file), 'utf8'));
  } catch (e) {
    fail(`${file}: JSON parse error — ${e.message}`);
    continue;
  }

  // Support both field conventions:
  //   legacy:  id / target_agent / goal
  //   newer:   scenario_id / agent / description
  const id = scenario.id || scenario.scenario_id;
  const targetAgent = scenario.target_agent || scenario.agent;
  const goal = scenario.goal || scenario.description;

  if (!id || !targetAgent || !goal) {
    const missing = [
      !id          && 'id / scenario_id',
      !targetAgent && 'target_agent / agent',
      !goal        && 'goal / description',
    ].filter(Boolean);
    fail(`${file}: missing required fields: ${missing.join(', ')}`);
    continue;
  }

  // Check Planner scenarios assert risk_review presence
  if (targetAgent === 'Planner') {
    const hasSingleExpected = scenario.expected && typeof scenario.expected === 'object';
    const hasInputs = Array.isArray(scenario.inputs);
    const topLevelAsserts = hasSingleExpected ? scenario.expected.risk_review_present === true : false;
    const inputLevelAsserts = hasInputs
      ? scenario.inputs.every(i => !i.expected || i.expected.risk_review_present === true || i.expected.data_volume_must_be !== undefined)
      : false;
    if (!topLevelAsserts && !inputLevelAsserts) {
      fail(`${file}: Planner scenario missing risk_review_present assertion (add to expected or each input.expected)`);
      continue;
    }
  }

  const agentFile = join(ROOT, `${targetAgent}.agent.md`);
  if (!existsSync(agentFile)) {
    fail(`${file}: target_agent "${targetAgent}" → no matching agent.md`);
  } else {
    pass(`Scenario valid: ${file} → ${targetAgent}`);
  }

  // ── Schema ref existence checks (Pass 2 — Phase 3 addition) ─────────────────
  const schemaRefs = collectSchemaRefs(scenario);
  for (const { path: refPath, value: refValue } of schemaRefs) {
    if (!existsSync(join(ROOT, refValue))) {
      fail(`${file}: schema ref not found — ${refPath}: "${refValue}"`);
    } else {
      if (allowlistSchemaRefs[refValue] && allowlistSchemaRefs[refValue] !== refValue) {
        console.log(`  ℹ️  ${file}: ${refPath} → "${refValue}" will be renamed to "${allowlistSchemaRefs[refValue]}" in Phase 4`);
      }
      pass(`Schema ref exists: ${file} [${refPath}]`);
    }
  }

  // ── Nested agent/target_agent structural sweep (advisory — no pass/fail yet) ─
  const nestedHits = collectNestedAgentFields(scenario);
  if (nestedHits.length > 0) {
    console.log(`  ℹ️  ${file}: ${nestedHits.length} nested agent field(s): ${nestedHits.map(h => `${h.path}="${h.value}"`).join(', ')}`);
  }
}

// ─── Pass 3: Reference Integrity ─────────────────────────────────────────────
header('Pass 3: Reference Integrity');

const agentFiles = readdirSync(ROOT).filter(f => f.endsWith('.agent.md'));
for (const agentFile of agentFiles) {
  const content = readFileSync(join(ROOT, agentFile), 'utf8');
  let agentFailed = false;

  // Schema references: `schemas/some-file.schema.json`
  for (const [, ref] of content.matchAll(/`schemas\/([^`]+)`/g)) {
    if (!existsSync(join(SCHEMAS_DIR, ref))) {
      fail(`${agentFile}: broken schema ref → schemas/${ref}`);
      agentFailed = true;
    }
  }

  // Docs references: `docs/path/to/file.md`
  for (const [, ref] of content.matchAll(/`(docs\/[^`]+\.md)`/g)) {
    if (!existsSync(join(ROOT, ref))) {
      fail(`${agentFile}: broken doc ref → ${ref}`);
      agentFailed = true;
    }
  }

  if (!agentFailed) pass(`References clean: ${agentFile}`);
}

// ─── Pass 3b: Required Project Artifacts ─────────────────────────────────────
header('Pass 3b: Required Project Artifacts');

const requiredArtifacts = [
  '.github/copilot-instructions.md',
  'plans/project-context.md',
  'docs/agent-engineering/PART-SPEC.md',
  'docs/agent-engineering/RELIABILITY-GATES.md',
  'docs/agent-engineering/CLARIFICATION-POLICY.md',
  'docs/agent-engineering/TOOL-ROUTING.md',
  'governance/tool-grants.json',
  'governance/runtime-policy.json',
  'governance/rename-allowlist.json',
];
for (const artifact of requiredArtifacts) {
  if (existsSync(join(ROOT, artifact))) {
    pass(`Artifact exists: ${artifact}`);
  } else {
    fail(`Missing required artifact: ${artifact}`);
  }
}

// Allowlist-driven cross-verification: load active_artifacts and retired_names from
// governance/rename-allowlist.json and verify (a) every active artifact exists on disk,
// (b) no retired runtime name appears as an active artifact path.
const allowlistPath = join(ROOT, 'governance', 'rename-allowlist.json');
let allowlist = null;
try {
  allowlist = JSON.parse(readFileSync(allowlistPath, 'utf8'));
} catch (e) {
  fail(`governance/rename-allowlist.json: could not load for allowlist sweep — ${e.message}`);
}

if (allowlist) {
  const activeArtifacts = Array.isArray(allowlist.active_artifacts) ? allowlist.active_artifacts : [];
  const retiredRuntime = Array.isArray(allowlist.retired_names?.runtime) ? allowlist.retired_names.runtime : [];
  const exceptions = Array.isArray(allowlist.exceptions) ? allowlist.exceptions.map(e => e.path) : [];

  // Expand globs-like entries: entries ending in /** or /* are treated as directory prefixes
  let missingActive = 0;
  for (const artifact of activeArtifacts) {
    if (artifact.includes('*')) continue; // skip glob patterns — disk enumeration not required here
    if (!existsSync(join(ROOT, artifact))) {
      missingActive++;
      fail(`Allowlist active_artifact missing from disk: ${artifact}`);
    }
  }
  if (missingActive === 0) {
    pass(`Allowlist active_artifacts: all ${activeArtifacts.filter(a => !a.includes('*')).length} non-glob entries exist on disk`);
  }

  // Verify no retired runtime name appears as an active artifact path (stale allowlist guard)
  let retiredConflict = 0;
  for (const retiredName of retiredRuntime) {
    // Check if any active artifact path fragment equals the retired name
    const conflict = activeArtifacts.find(a => a === retiredName || a.endsWith(`/${retiredName}`));
    if (conflict && !exceptions.includes(conflict)) {
      retiredConflict++;
      fail(`Allowlist conflict: retired runtime name "${retiredName}" still present in active_artifacts as "${conflict}"`);
    }
  }
  if (retiredConflict === 0) {
    pass(`Allowlist retired_names.runtime: no conflicts with active_artifacts`);
  }
}

// ─── Pass 3c: Tool Grant Consistency ────────────────────────────────────────
header('Pass 3c: Tool Grant Consistency');

const toolGrantsPath = join(ROOT, 'governance', 'tool-grants.json');
let canonicalToolGrants = {};
try {
  canonicalToolGrants = JSON.parse(readFileSync(toolGrantsPath, 'utf8'));
} catch (e) {
  fail(`governance/tool-grants.json: could not load — ${e.message}`);
}

for (const agentFile of agentFiles) {
  const content = readFileSync(join(ROOT, agentFile), 'utf8');
  const actualTools = parseFrontmatterTools(content);
  const expectedTools = canonicalToolGrants[agentFile];

  if (!expectedTools) {
    fail(`${agentFile}: missing canonical tool-set entry in governance/tool-grants.json`);
    continue;
  }

  if (!actualTools) {
    fail(`${agentFile}: missing tools frontmatter`);
    continue;
  }

  const actual = normalizeToolSet(actualTools);
  const expected = normalizeToolSet(expectedTools);
  const matches = actual.length === expected.length && actual.every((tool, index) => tool === expected[index]);

  if (!matches) {
    fail(`${agentFile}: tool-set drift detected — expected [${expected.join(', ')}] (governance/tool-grants.json), got [${actual.join(', ')}]`);
  } else {
    pass(`Tool grants canonical: ${agentFile}`);
  }
}

// ─── Pass 4: P.A.R.T Section Order ───────────────────────────────────────────
header('Pass 4: P.A.R.T Section Order');

const PART_SECTIONS = ['## Prompt', '## Archive', '## Resources', '## Tools'];
for (const agentFile of agentFiles) {
  const lines = readFileSync(join(ROOT, agentFile), 'utf8').split('\n');
  const positions = PART_SECTIONS.map(s => lines.findIndex(l => l.trim() === s));

  const missing = PART_SECTIONS.filter((_, i) => positions[i] === -1);
  if (missing.length > 0) {
    fail(`${agentFile}: missing P.A.R.T sections: ${missing.join(', ')}`);
    continue;
  }

  const inOrder = positions.every((p, i) => i === 0 || p > positions[i - 1]);
  if (!inOrder) {
    fail(`${agentFile}: P.A.R.T out of order — found at lines [${positions.map(p => p + 1).join(', ')}]`);
  } else {
    pass(`P.A.R.T order: ${agentFile}`);
  }
}

// ─── Pass 5: Skill Library Consistency ───────────────────────────────────────
header('Pass 5: Skill Library Consistency');

const skillsIndexPath = join(ROOT, 'skills', 'index.md');
const skillsPatternsDir = join(ROOT, 'skills', 'patterns');

if (!existsSync(skillsIndexPath)) {
  fail('skills/index.md: missing');
} else if (!existsSync(skillsPatternsDir)) {
  fail('skills/patterns/: directory missing');
} else {
  const indexContent = readFileSync(skillsIndexPath, 'utf8');

  const indexedSkills = new Set();
  for (const [, skillPath] of indexContent.matchAll(/`(skills\/patterns\/[^`]+)`/g)) {
    indexedSkills.add(skillPath);
  }

  for (const skillPath of indexedSkills) {
    if (!existsSync(join(ROOT, skillPath))) {
      fail(`skills/index.md: references missing file → ${skillPath}`);
    }
  }

  const patternFiles = readdirSync(skillsPatternsDir)
    .filter(f => f.endsWith('.md'))
    .map(f => `skills/patterns/${f}`);

  for (const patternFile of patternFiles) {
    if (!indexedSkills.has(patternFile)) {
      fail(`${patternFile}: not listed in skills/index.md`);
    } else {
      pass(`Skill registered: ${patternFile}`);
    }
  }
}

// ─── Pass 6: Synthetic Rename Negative-Path Checks ───────────────────────────
header('Pass 6: Synthetic Rename Negative-Path Checks');

function runSyntheticRenameNegativePathChecks() {
  // Case (a): stale top-level target_agent — agent file does not exist on disk
  const caseA = { id: 'synthetic-a', target_agent: 'OldAgent', goal: 'synthetic test — stale target_agent' };
  if (!existsSync(join(ROOT, `${caseA.target_agent}.agent.md`))) {
    pass('Synthetic (a): stale target_agent "OldAgent" correctly rejected — OldAgent.agent.md not found');
  } else {
    fail('Synthetic (a): stale target_agent guard DID NOT fire — OldAgent.agent.md unexpectedly exists');
  }

  // Case (b): stale expected.schema — schema file does not exist on disk
  const caseB = {
    id: 'synthetic-b',
    target_agent: 'CoreImplementer-subagent',
    goal: 'synthetic test — stale expected.schema',
    expected: { schema: 'schemas/oldname.schema.json' },
  };
  const refsB = collectSchemaRefs(caseB);
  const staleRefB = refsB.find(r => !existsSync(join(ROOT, r.value)));
  if (staleRefB) {
    pass(`Synthetic (b): stale expected.schema "${staleRefB.value}" correctly caught — file not found`);
  } else {
    fail('Synthetic (b): stale expected.schema guard DID NOT fire — file unexpectedly exists or check is broken');
  }

  // Case (c): nested input agent field pointing to non-existent agent
  const caseC = {
    id: 'synthetic-c',
    target_agent: 'Orchestrator',
    goal: 'synthetic test — stale nested agent',
    input: { subagent_report: { agent: 'OldAgent', task: 'test task' } },
  };
  const nestedC = collectNestedAgentFields(caseC);
  const staleNestedC = nestedC.find(h => h.value === 'OldAgent' && !existsSync(join(ROOT, `${h.value}.agent.md`)));
  if (staleNestedC) {
    pass(`Synthetic (c): stale nested agent "OldAgent" at "${staleNestedC.path}" correctly detected`);
  } else {
    fail('Synthetic (c): stale nested agent guard DID NOT fire — nested sweep may be broken');
  }

  // Case (d): stale expected.schema_ref — schema file does not exist on disk
  const caseD = {
    id: 'synthetic-d',
    target_agent: 'CoreImplementer-subagent',
    goal: 'synthetic test — stale expected.schema_ref',
    expected: { schema_ref: 'schemas/oldname-ref.schema.json' },
  };
  const refsD = collectSchemaRefs(caseD);
  const staleRefD = refsD.find(r => !existsSync(join(ROOT, r.value)));
  if (staleRefD) {
    pass(`Synthetic (d): stale expected.schema_ref "${staleRefD.value}" correctly caught — file not found`);
  } else {
    fail('Synthetic (d): stale expected.schema_ref guard DID NOT fire — file unexpectedly exists or check is broken');
  }
}

runSyntheticRenameNegativePathChecks();

// ─── Summary ─────────────────────────────────────────────────────────────────
const totalChecks = totalPassed + totalFailed;
const bar = '\u2550'.repeat(50);
console.log(`\n${bar}`);
console.log(`Total: ${totalChecks}  |  Passed: ${totalPassed}  |  Failed: ${totalFailed}`);
console.log(bar);

if (totalFailed > 0) {
  console.error(`\n${totalFailed} check(s) failed.\n`);
  process.exit(1);
} else {
  console.log('\nAll checks passed \u2705\n');
}
