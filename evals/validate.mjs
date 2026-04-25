/**
 * ControlFlow — Structural Validation Harness
 *
 * Six passes:
 *   1. Schema Validity      — all schemas/*.schema.json compile without errors
 *   2. Scenario Integrity   — all evals/scenarios/*.json have required fields and
 *                             point to an existing agent.md. Planner scenarios must
 *                             assert `risk_review_present: true`. Planner terminal-status
 *                             scenarios (ABSTAIN / REPLAN_REQUIRED) must assert
 *                             `plan_file_created: true`.
 *   3. Reference Integrity  — all *.agent.md schema/doc references resolve to
 *                             existing files; required project artifacts exist
 *   3b. Required Artifacts  — shared project context files exist (includes governance/tool-grants.json)
 *   3c. Tool Grant Consistency — every agent frontmatter tools list matches the
 *                              canonical set in governance/tool-grants.json (manifest-driven;
 *                              no tool policy is hardcoded here)
 *   3d. Agent Grant Consistency — for files listed in governance/agent-grants.json only,
 *                              agents: frontmatter must be present, non-wildcard, and exactly
 *                              match the manifest. Files not in the manifest are out of scope.
 *   4. P.A.R.T Section Order — every *.agent.md has Prompt→Archive→Resources→Tools
 *                              in the correct order
 *   4b. §5/§6 Compliance   — Clarification Triggers (§5) and Tool Routing Rules (§6)
 *                              are present per PART-SPEC requirements
 *   5. Skill Library        — every file in skills/patterns/ is listed in skills/index.md
 *                             and every index entry resolves to an existing file
 *   6. Synthetic Rename Negative-Path Checks — structural guard checks: stale target_agent,
 *                             stale expected.schema, and stale nested agent references are
 *                             correctly rejected
 *
 * Exit 0 on all checks passed, exit 1 on any failure.
 *
 * Tool policy source of truth: governance/tool-grants.json
 * Adding a new agent: create the .agent.md + add an entry to governance/tool-grants.json.
 * No changes to this file are needed.
 */

import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  MODEL_ROLE_CHECK_ENABLED,
  validateModelRole,
  validateAgentRoleIndex,
  validateByTierShape,
  parseRosterFromProjectContext,
  compareRosterEnum,
  parseResourcesSchemaPaths,
  buildPlanFileMap,
  findSharedAnchorMaps,
  findUnresolvedOverlaps,
  validateReviewScopeFinalCoupling,
  validateNotesMdStyle,
  validateMemoryContentTaxonomy,
  validateMemoryUseDiscipline,
  validateSessionNotesTemplate,
  validateRepoMemoryHygieneChecklistC,
  validateRepoMemoryHygieneChecklistD,
  validateTutorialParity,
  computeStructuralFingerprint,
  validateOrchestratorCompactionInvariant,
  validateOrchestratorMemoryPromotionOrder,
  validateCodeReviewerSecurityModeSameLine,
  validateCanonicalSourceMatrixHeading,
} from './drift-checks.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SCHEMAS_DIR = join(ROOT, 'schemas');
const SCENARIOS_DIR = join(__dirname, 'scenarios');
const CACHE_DIR = join(__dirname, '.cache');
const CACHE_FILE = join(CACHE_DIR, 'validate-cache.json');

let totalPassed = 0;
let totalFailed = 0;

function pass(msg) { console.log(`  \u2705 ${msg}`); totalPassed++; }
function fail(msg) { console.error(`  \u274c ${msg}`); totalFailed++; }
function header(title) { console.log(`\n=== ${title} ===`); }

// Tool policy is loaded from governance/tool-grants.json at Pass 3c runtime.
// To update tool grants for an agent, edit governance/tool-grants.json — no changes here needed.

function parseFrontmatterAgents(content) {
  const match = content.match(/^agents:\s*\[(.*?)\]$/m);
  if (!match) return null;

  return match[1]
    .split(',')
    .map(entry => entry.trim())
    .filter(Boolean)
    .map(entry => entry.replace(/^['"]|['"]$/g, ''));
}

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

// ─── Warm Cache (Structural Passes) ──────────────────────────────────────────
// computeStructuralFingerprint is exported from drift-checks.mjs so fingerprint
// regression tests can import it without triggering validate.mjs side effects.

const currentFingerprint = computeStructuralFingerprint();

// Cache read — any failure is a cold run, never a harness error
let cacheHit = false;
try {
  const cached = JSON.parse(readFileSync(CACHE_FILE, 'utf8'));
  if (cached && cached.fingerprint === currentFingerprint) cacheHit = true;
} catch { /* cache miss */ }

if (cacheHit) {
  console.log('\n[cache] Structural inputs unchanged — reusing successful cached result.\n');
  console.log('All checks passed \u2705 (cached)\n');
  process.exit(0);
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

// ── Runtime-policy schema: validate live governance file + negative scenarios ─
{
  const rpSchemaFile = 'runtime-policy.schema.json';
  const rpSchema = parsedSchemas[rpSchemaFile];
  if (!rpSchema) {
    fail('Pass 1: runtime-policy.schema.json not loaded — cannot validate governance/runtime-policy.json');
  } else {
    const validateRp = ajv.getSchema(rpSchema.$id);
    if (!validateRp) {
      fail('Pass 1: runtime-policy schema validator not found in ajv cache');
    } else {
      // Live governance file must pass
      const rpLivePath = join(ROOT, 'governance', 'runtime-policy.json');
      try {
        const rpLiveRaw = JSON.parse(readFileSync(rpLivePath, 'utf8'));
        const { _expected_validation: _ev, _comment: _c, ...rpData } = rpLiveRaw;
        if (validateRp(rpData)) {
          pass('Runtime-policy schema: governance/runtime-policy.json is valid');
        } else {
          fail(`Runtime-policy schema: governance/runtime-policy.json failed — ${ajv.errorsText(validateRp.errors)}`);
        }
      } catch (e) {
        fail(`Runtime-policy schema: cannot load governance/runtime-policy.json — ${e.message}`);
      }
      // Negative-case scenarios under evals/scenarios/runtime-policy/
      const rpScenariosDir = join(SCENARIOS_DIR, 'runtime-policy');
      const rpFixtures = [
        { file: 'valid-baseline.json', shouldPass: true },
        { file: 'invalid-misspelled-key.json', shouldPass: false },
        { file: 'invalid-wrong-type.json', shouldPass: false },
        { file: 'invalid-enum-approval-per.json', shouldPass: false },
        { file: 'invalid-enum-auto-trigger-tiers.json', shouldPass: false },
      ];
      for (const { file, shouldPass } of rpFixtures) {
        const fp = join(rpScenariosDir, file);
        if (!existsSync(fp)) {
          fail(`Runtime-policy scenario missing: evals/scenarios/runtime-policy/${file}`);
          continue;
        }
        try {
          const raw = JSON.parse(readFileSync(fp, 'utf8'));
          const expectedReason = raw._expected_validation;
          const { _expected_validation: _ev2, _comment: _c2, ...data } = raw;
          const valid = validateRp(data);
          if (shouldPass && valid) {
            pass(`Runtime-policy scenario (expected pass): ${file}`);
          } else if (!shouldPass && !valid) {
            pass(`Runtime-policy scenario (expected fail): ${file} — ${expectedReason}`);
          } else if (shouldPass && !valid) {
            fail(`Runtime-policy scenario: ${file} expected to PASS but failed — ${ajv.errorsText(validateRp.errors)}`);
          } else {
            fail(`Runtime-policy scenario: ${file} expected to FAIL but passed unexpectedly`);
          }
        } catch (e) {
          fail(`Runtime-policy scenario: cannot load ${file} — ${e.message}`);
        }
      }
    }
  }
}

// ── Planner plan schema: validate fixtures ────────────────────────────────────
{
  const plannerSchemaKey = 'planner.plan.schema.json';
  const plannerSchema = parsedSchemas[plannerSchemaKey];
  if (!plannerSchema) {
    fail('Pass 1: planner.plan.schema.json not loaded — cannot validate planner fixtures');
  } else {
    const validatePlanner = ajv.getSchema(plannerSchema.$id);
    if (!validatePlanner) {
      fail('Pass 1: planner plan schema validator not found in ajv cache');
    } else {
      const plannerFixturesDir = join(SCENARIOS_DIR, 'planner');
      const plannerFixtures = [
        { file: 'valid-all-categories.json', shouldPass: true },
        { file: 'invalid-missing-category.json', shouldPass: false },
        { file: 'invalid-duplicate-category.json', shouldPass: false },
      ];
      for (const { file, shouldPass } of plannerFixtures) {
        const fp = join(plannerFixturesDir, file);
        if (!existsSync(fp)) {
          fail(`Planner fixture missing: evals/scenarios/planner/${file}`);
          continue;
        }
        try {
          const raw = JSON.parse(readFileSync(fp, 'utf8'));
          const expectedReason = raw._expected_validation;
          const { _expected_validation: _ev, _comment: _c, ...data } = raw;
          const valid = validatePlanner(data);
          if (shouldPass && valid) {
            pass(`Planner fixture (expected pass): ${file}`);
          } else if (!shouldPass && !valid) {
            pass(`Planner fixture (expected fail): ${file} — ${expectedReason}`);
          } else if (shouldPass && !valid) {
            fail(`Planner fixture: ${file} expected to PASS but failed — ${ajv.errorsText(validatePlanner.errors)}`);
          } else {
            fail(`Planner fixture: ${file} expected to FAIL but passed unexpectedly`);
          }
        } catch (e) {
          fail(`Planner fixture: cannot load ${file} — ${e.message}`);
        }
      }
    }
  }
}

// ── AssumptionVerifier schema: validate fixtures ──────────────────────────────
{
  const avSchemaKey = 'assumption-verifier.plan-audit.schema.json';
  const avSchema = parsedSchemas[avSchemaKey];
  if (!avSchema) {
    fail('Pass 1: assumption-verifier.plan-audit.schema.json not loaded — cannot validate fixtures');
  } else {
    const validateAV = ajv.getSchema(avSchema.$id);
    if (!validateAV) {
      fail('Pass 1: assumption-verifier schema validator not found in ajv cache');
    } else {
      const avFixturesDir = join(SCENARIOS_DIR, 'assumption-verifier');
      const avFixtures = [
        { file: 'valid-blocking-with-classification.json', shouldPass: true },
        { file: 'invalid-blocking-no-classification.json', shouldPass: false },
      ];
      for (const { file, shouldPass } of avFixtures) {
        const fp = join(avFixturesDir, file);
        if (!existsSync(fp)) {
          fail(`AssumptionVerifier fixture missing: evals/scenarios/assumption-verifier/${file}`);
          continue;
        }
        try {
          const raw = JSON.parse(readFileSync(fp, 'utf8'));
          const expectedReason = raw._expected_validation;
          const { _expected_validation: _ev, _comment: _c, ...data } = raw;
          const valid = validateAV(data);
          if (shouldPass && valid) {
            pass(`AssumptionVerifier fixture (expected pass): ${file}`);
          } else if (!shouldPass && !valid) {
            pass(`AssumptionVerifier fixture (expected fail): ${file} — ${expectedReason}`);
          } else if (shouldPass && !valid) {
            fail(`AssumptionVerifier fixture: ${file} expected to PASS but failed — ${ajv.errorsText(validateAV.errors)}`);
          } else {
            fail(`AssumptionVerifier fixture: ${file} expected to FAIL but passed unexpectedly`);
          }
        } catch (e) {
          fail(`AssumptionVerifier fixture: cannot load ${file} — ${e.message}`);
        }
      }
    }
  }
}

// ── ExecutabilityVerifier schema: validate fixtures ───────────────────────────
{
  const evSchemaKey = 'executability-verifier.execution-report.schema.json';
  const evSchema = parsedSchemas[evSchemaKey];
  if (!evSchema) {
    fail('Pass 1: executability-verifier.execution-report.schema.json not loaded — cannot validate fixtures');
  } else {
    const validateEV = ajv.getSchema(evSchema.$id);
    if (!validateEV) {
      fail('Pass 1: executability-verifier schema validator not found in ajv cache');
    } else {
      const evFixturesDir = join(SCENARIOS_DIR, 'executability-verifier');
      const evFixtures = [
        { file: 'valid-fail-with-classification.json', shouldPass: true },
        { file: 'invalid-fail-no-classification.json', shouldPass: false },
        { file: 'invalid-blocked-no-description.json', shouldPass: false },
      ];
      for (const { file, shouldPass } of evFixtures) {
        const fp = join(evFixturesDir, file);
        if (!existsSync(fp)) {
          fail(`ExecutabilityVerifier fixture missing: evals/scenarios/executability-verifier/${file}`);
          continue;
        }
        try {
          const raw = JSON.parse(readFileSync(fp, 'utf8'));
          const expectedReason = raw._expected_validation;
          const { _expected_validation: _ev, _comment: _c, ...data } = raw;
          const valid = validateEV(data);
          if (shouldPass && valid) {
            pass(`ExecutabilityVerifier fixture (expected pass): ${file}`);
          } else if (!shouldPass && !valid) {
            pass(`ExecutabilityVerifier fixture (expected fail): ${file} — ${expectedReason}`);
          } else if (shouldPass && !valid) {
            fail(`ExecutabilityVerifier fixture: ${file} expected to PASS but failed — ${ajv.errorsText(validateEV.errors)}`);
          } else {
            fail(`ExecutabilityVerifier fixture: ${file} expected to FAIL but passed unexpectedly`);
          }
        } catch (e) {
          fail(`ExecutabilityVerifier fixture: cannot load ${file} — ${e.message}`);
        }
      }
    }
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

  // Check Planner scenarios assert complexity_tier presence (mirrors risk_review_present enforcement)
  if (targetAgent === 'Planner') {
    const hasSingleExpected = scenario.expected && typeof scenario.expected === 'object';
    const hasInputs = Array.isArray(scenario.inputs);
    const topLevelAsserts = hasSingleExpected ? scenario.expected.complexity_tier_present === true : false;
    const inputLevelAsserts = hasInputs && scenario.inputs.length > 0
      ? scenario.inputs.every(i => i.expected && i.expected.complexity_tier_present === true)
      : false;
    if (!topLevelAsserts && !inputLevelAsserts) {
      fail(`${file}: Planner scenario missing complexity_tier_present assertion (add to expected or each input.expected)`);
      continue;
    }
  }

  // Check Planner terminal-status scenarios assert plan_file_created: true
  if (targetAgent === 'Planner') {
    const terminalChecks = [];
    if (scenario.expected) terminalChecks.push({ exp: scenario.expected, label: '' });
    if (Array.isArray(scenario.inputs)) {
      for (const inp of scenario.inputs) {
        if (inp.expected) terminalChecks.push({ exp: inp.expected, label: inp.label ? `input "${inp.label}" — ` : '' });
      }
    }
    for (const { exp, label } of terminalChecks) {
      const isTerminal = exp.required_status === 'ABSTAIN' || exp.required_status === 'REPLAN_REQUIRED';
      if (isTerminal && exp.plan_file_created !== true) {
        fail(`${file}: ${label}terminal Planner status "${exp.required_status}" must assert plan_file_created: true`);
      }
    }
  }

  // ── Phase 1 remediation: targeted structural assertion enforcement ────────────
  // Planner: planner-schema-output must assert handoff-only output, no inline/todo leakage, and ready-path artifact creation
  if (targetAgent === 'Planner' && id === 'planner-schema-output') {
    const exp = scenario.expected || {};
    if (exp.plan_file_created !== true) {
      fail(`${file}: planner-schema-output must assert plan_file_created: true`);
    }
    if (!exp.must_not_inline_plan_in_chat) {
      fail(`${file}: planner-schema-output must assert must_not_inline_plan_in_chat: true`);
    }
    if (!exp.must_not_emit_todo_output) {
      fail(`${file}: planner-schema-output must assert must_not_emit_todo_output: true`);
    }
    if (exp.handoff_message_present !== true) {
      fail(`${file}: planner-schema-output must assert handoff_message_present: true`);
    }
  }

  // Planner: scenarios asserting phases_have_executor_agent must also cover the schema-required per-phase fields
  if (targetAgent === 'Planner') {
    const exp = scenario.expected || {};
    if (exp.phases_have_executor_agent === true) {
      if (!exp.phases_have_acceptance_criteria) {
        fail(`${file}: Planner scenario asserting phases_have_executor_agent must also assert phases_have_acceptance_criteria`);
      }
      if (!exp.phases_have_quality_gates) {
        fail(`${file}: Planner scenario asserting phases_have_executor_agent must also assert phases_have_quality_gates`);
      }
    }
  }

  // Planner: planner-reviewed-flow-routing must assert all architecture-preserving handoff contract keys
  if (targetAgent === 'Planner' && id === 'planner-reviewed-flow-routing') {
    const exp = scenario.expected || {};
    if (exp.plan_file_created !== true) {
      fail(`${file}: planner-reviewed-flow-routing must assert plan_file_created: true`);
    }
    if (!exp.plan_path_produced) {
      fail(`${file}: planner-reviewed-flow-routing must assert plan_path_produced: true`);
    }
    if (!exp.orchestrator_review_applies) {
      fail(`${file}: planner-reviewed-flow-routing must assert orchestrator_review_applies: true`);
    }
    if (exp.planner_does_not_own_plan_review !== true) {
      fail(`${file}: planner-reviewed-flow-routing must assert planner_does_not_own_plan_review: true`);
    }
    if (exp.handoff_message_present !== true) {
      fail(`${file}: planner-reviewed-flow-routing must assert handoff_message_present: true`);
    }
    if (!exp.must_not_inline_plan_in_chat) {
      fail(`${file}: planner-reviewed-flow-routing must assert must_not_inline_plan_in_chat: true`);
    }
  }

  // Orchestrator plan-auditor-integration: for plan-trigger cases, delegation_includes must exist and contain plan_path
  if (targetAgent === 'Orchestrator' && id === 'orchestrator-plan-auditor-integration') {
    const integrationInputs = Array.isArray(scenario.inputs) ? scenario.inputs : [];
    for (const inp of integrationInputs) {
      const eb = inp.expected_behavior || {};
      const isPlanTriggerCase = inp.input !== undefined && inp.input.plan !== undefined;
      if (isPlanTriggerCase && eb.plan_auditor_invoked === true) {
        if (!Array.isArray(eb.delegation_includes)) {
          fail(`${file}: input "${inp.label}" triggers plan_auditor but delegation_includes is missing`);
        } else if (!eb.delegation_includes.includes('plan_path')) {
          fail(`${file}: input "${inp.label}" triggers plan_auditor but delegation_includes is missing "plan_path"`);
        }
      }
    }
  }
  // ── End Phase 1 remediation checks ───────────────────────────────────────────

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

// ─── Pass 3 (extended): Broader Reference Integrity — README + docs ───────────
// Scan active documentation files for broken internal markdown links.
// NOTE: plans/archive/ is intentionally excluded — historical references may be stale.
const broadRefFiles = [
  { name: 'README.md', filePath: join(ROOT, 'README.md') },
];
try {
  const docsEngDir = join(ROOT, 'docs', 'agent-engineering');
  for (const f of readdirSync(docsEngDir).sort()) {
    if (f.endsWith('.md')) {
      broadRefFiles.push({ name: `docs/agent-engineering/${f}`, filePath: join(docsEngDir, f) });
    }
  }
} catch { /* docs dir not found — skip */ }

for (const { name, filePath: docFilePath } of broadRefFiles) {
  if (!existsSync(docFilePath)) continue;
  const content = readFileSync(docFilePath, 'utf8');
  let fileFailed = false;
  // Only check paths rooted in known top-level directories (plans/archive/ excluded via non-existence)
  const topLevelDirs = new Set(['plans', 'schemas', 'docs', 'evals', 'governance', 'skills', '.github']);
  // Extract [text](target) markdown links and verify internal path targets exist
  for (const match of content.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
    const rawTarget = match[1];
    // Skip external links and anchor-only references
    if (rawTarget.startsWith('http://') || rawTarget.startsWith('https://') || rawTarget.startsWith('#')) continue;
    // Strip fragment identifier
    const pathPart = rawTarget.split('#')[0].trim();
    if (!pathPart) continue;
    // Reject path traversal sequences — no legitimate intra-repo link requires ../
    if (pathPart.includes('..')) continue;
    // Only check paths rooted in known top-level directories
    const pathRootSeg = pathPart.split('/')[0];
    if (!topLevelDirs.has(pathRootSeg)) continue;
    if (!existsSync(join(ROOT, pathPart))) {
      fail(`${name}: broken link → ${pathPart}`);
      fileFailed = true;
    }
  }  // Also scan backtick code-formatted path references: `path/to/file.ext`
  // Only check paths that look like file system paths (contain / and have an extension or known top-level dirs)
  for (const match of content.matchAll(/`([^`]+)`/g)) {
    const candidate = match[1].trim();
    // Must contain a slash, must not be a flag/option or URL, must start with a known dir or be a relative path
    if (!candidate.includes('/')) continue;
    if (candidate.startsWith('http') || candidate.startsWith('#') || candidate.startsWith('-') || candidate.startsWith('*')) continue;
    // Check only if root segment is a known top-level directory
    const rootSeg = candidate.split('/')[0];
    if (!topLevelDirs.has(rootSeg)) continue;
    // Strip trailing wildcards and fragment identifiers; reject traversal sequences
    const cleanPath = candidate.split('#')[0].replace(/\/\*.*$/, '').trim();
    if (!cleanPath || cleanPath.endsWith('/') || cleanPath.includes('..')) continue;
    if (!existsSync(join(ROOT, cleanPath))) {
      fail(`${name}: broken code-path reference \u2192 ${cleanPath}`);
      fileFailed = true;
    }
  }  if (!fileFailed) pass(`References clean: ${name}`);
}


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
  'governance/agent-grants.json',
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

// ─── Pass 3d: Agent Grant Consistency ────────────────────────────────────────
header('Pass 3d: Agent Grant Consistency');

const agentGrantsPath = join(ROOT, 'governance', 'agent-grants.json');
let canonicalAgentGrants = {};
try {
  canonicalAgentGrants = JSON.parse(readFileSync(agentGrantsPath, 'utf8'));
} catch (e) {
  fail(`governance/agent-grants.json: could not load — ${e.message}`);
}

for (const [agentFile, allowedAgents] of Object.entries(canonicalAgentGrants)) {
  const filePath = join(ROOT, agentFile);
  if (!existsSync(filePath)) {
    fail(`${agentFile}: listed in agent-grants.json but file not found on disk`);
    continue;
  }

  const content = readFileSync(filePath, 'utf8');
  const actualAgents = parseFrontmatterAgents(content);

  if (actualAgents === null) {
    fail(`${agentFile}: missing agents: frontmatter (required by agent-grants.json)`);
    continue;
  }

  if (actualAgents.length === 1 && actualAgents[0] === '*') {
    fail(`${agentFile}: agents: ["*"] wildcard is not permitted — must use explicit list from agent-grants.json`);
    continue;
  }

  const actual = [...actualAgents].sort();
  const expected = [...allowedAgents].sort();
  const matches = actual.length === expected.length && actual.every((a, i) => a === expected[i]);

  if (!matches) {
    fail(`${agentFile}: agents drift detected — expected [${expected.join(', ')}] (governance/agent-grants.json), got [${actual.join(', ')}]`);
  } else {
    pass(`Agent grants canonical: ${agentFile}`);
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

// ─── Pass 4b: §5 Clarification Triggers & §6 Tool Routing Rules ─────────────
header('Pass 4b: Clarification Triggers (§5) & Tool Routing Rules (§6)');

const EXTERNAL_TOOL_KEYWORDS = ['fetch', 'web/fetch', 'githubRepo', 'web/githubRepo', 'context7', 'io.github.upstash/context7/resolve-library-id', 'io.github.upstash/context7/get-library-docs'];

for (const agentFile of agentFiles) {
  const content = readFileSync(join(ROOT, agentFile), 'utf8');
  const tools = parseFrontmatterTools(content) || [];

  // §5: Clarification — agents must have a clarification section OR NEEDS_INPUT delegation statement
  const hasClarificationSection = /###\s+Clarification/i.test(content);
  const hasNeedsInputDelegation = /NEEDS_INPUT/.test(content) || /clarification is (?:centralized|delegated|routed)/i.test(content);
  const hasAbstainOnlyRole = /returns?\s+(?:`?ABSTAIN`?|findings|verdicts?)/i.test(content) && !/NEEDS_INPUT/.test(content);

  if (hasClarificationSection || hasNeedsInputDelegation || hasAbstainOnlyRole) {
    pass(`§5 Clarification coverage: ${agentFile}`);
  } else {
    fail(`${agentFile}: missing §5 Clarification Triggers — needs a ### Clarification section, NEEDS_INPUT delegation, or ABSTAIN-only role statement`);
  }

  // §6: Tool Routing — required only when agent has external knowledge tools
  const hasExternalTools = tools.some(t => EXTERNAL_TOOL_KEYWORDS.some(kw => t.includes(kw)));
  if (hasExternalTools) {
    const hasRoutingSection = /###\s+(?:External\s+)?Tool\s+Routing/i.test(content) || /###\s+Context7\/MCP\s+Routing/i.test(content);
    if (hasRoutingSection) {
      pass(`§6 Tool Routing coverage: ${agentFile}`);
    } else {
      fail(`${agentFile}: missing §6 Tool Routing Rules — agent has external tools but no ### External Tool Routing or ### Tool Routing section`);
    }
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

// ─── Pass 7: Memory Architecture References (Phase 6) ────────────────────────
header('Pass 7: Memory Architecture References');

{
  const memScenarioPath = join(SCENARIOS_DIR, 'memory-architecture-references.json');
  if (!existsSync(memScenarioPath)) {
    fail('memory-architecture-references.json: scenario missing');
  } else {
    let memScenario;
    try {
      memScenario = JSON.parse(readFileSync(memScenarioPath, 'utf8'));
    } catch (e) {
      fail(`memory-architecture-references.json: JSON parse error — ${e.message}`);
      memScenario = null;
    }
    if (memScenario) {
      const canonicalDoc = memScenario.input?.canonical_doc;
      const requiredAgents = memScenario.input?.reference_required_in || [];
      const minAgents = memScenario.input?.minimum_agents_referencing || 13;
      const notesBudget = memScenario.expected?.notes_md_line_budget || 20;

      // Canonical doc exists
      if (canonicalDoc && existsSync(join(ROOT, canonicalDoc))) {
        pass(`Canonical memory doc exists: ${canonicalDoc}`);
      } else {
        fail(`Canonical memory doc missing: ${canonicalDoc}`);
      }

      // Each required agent references the canonical doc
      let referencingCount = 0;
      for (const agentFile of requiredAgents) {
        const fp = join(ROOT, agentFile);
        if (!existsSync(fp)) {
          fail(`${agentFile}: agent file missing (required for memory-architecture cross-reference)`);
          continue;
        }
        const content = readFileSync(fp, 'utf8');
        if (content.includes('docs/agent-engineering/MEMORY-ARCHITECTURE.md')) {
          referencingCount++;
          pass(`Memory-architecture ref present: ${agentFile}`);
        } else {
          fail(`${agentFile}: missing reference to docs/agent-engineering/MEMORY-ARCHITECTURE.md`);
        }
      }
      if (referencingCount >= minAgents) {
        pass(`Memory-architecture cross-reference count: ${referencingCount} / ${minAgents} required`);
      } else {
        fail(`Memory-architecture cross-reference count: ${referencingCount} / ${minAgents} required`);
      }

      // NOTES.md within budget
      const notesPath = join(ROOT, 'NOTES.md');
      if (existsSync(notesPath)) {
        const lines = readFileSync(notesPath, 'utf8').split('\n');
        // Trim a single trailing empty line (POSIX newline) from the count
        const effective = (lines.length > 0 && lines[lines.length - 1] === '') ? lines.length - 1 : lines.length;
        if (effective <= notesBudget) {
          pass(`NOTES.md within budget: ${effective} ≤ ${notesBudget} lines`);
        } else {
          fail(`NOTES.md exceeds budget: ${effective} > ${notesBudget} lines`);
        }

        // NOTES.md style anti-pattern check (Check #11 from drift-checks.mjs)
        const notesContent = readFileSync(notesPath, 'utf8');
        const styleResult = validateNotesMdStyle(notesContent);
        if (styleResult.ok) {
          pass('NOTES.md style: no task-history anti-patterns detected');
        } else {
          for (const v of styleResult.violations) {
            fail(`NOTES.md style violation: ${v}`);
          }
        }
      } else {
        fail('NOTES.md missing');
      }
    }
  }
}

// ─── Pass 7b: Memory Discipline Contracts ───────────────────────────────────
header('Pass 7b: Memory Discipline Contracts');

{
  const memTaxScenarioPath = join(SCENARIOS_DIR, 'memory-content-taxonomy.json');
  if (!existsSync(memTaxScenarioPath)) {
    fail('memory-content-taxonomy.json: scenario missing');
  } else {
    let memTaxScenario;
    try {
      memTaxScenario = JSON.parse(readFileSync(memTaxScenarioPath, 'utf8'));
    } catch (e) {
      fail(`memory-content-taxonomy.json: JSON parse error — ${e.message}`);
      memTaxScenario = null;
    }

    let runtimePolicyForTax = null;
    const runtimePolicyPath = join(ROOT, 'governance', 'runtime-policy.json');
    try {
      runtimePolicyForTax = JSON.parse(readFileSync(runtimePolicyPath, 'utf8'));
    } catch (e) {
      fail(`Pass 7b memory-taxonomy: cannot read governance/runtime-policy.json — ${e.message}`);
    }

    if (memTaxScenario && runtimePolicyForTax) {
      // Check 1: Memory Content Taxonomy heading + content_types in MEMORY-ARCHITECTURE.md
      const memArchPath = join(ROOT, 'docs', 'agent-engineering', 'MEMORY-ARCHITECTURE.md');
      if (!existsSync(memArchPath)) {
        fail('Pass 7b: docs/agent-engineering/MEMORY-ARCHITECTURE.md missing (memory-taxonomy check)');
      } else {
        const memArchContent = readFileSync(memArchPath, 'utf8');
        const r1 = validateMemoryContentTaxonomy(memArchContent, runtimePolicyForTax);
        if (r1.pass) {
          pass('Memory Content Taxonomy: heading and all content types present in MEMORY-ARCHITECTURE.md');
        } else {
          fail(`Memory Content Taxonomy: ${r1.reason}`);
        }
      }

      // Check 2: Memory Use Discipline in PROMPT-BEHAVIOR-CONTRACT.md
      const pbcPath = join(ROOT, 'docs', 'agent-engineering', 'PROMPT-BEHAVIOR-CONTRACT.md');
      if (!existsSync(pbcPath)) {
        fail('Pass 7b: docs/agent-engineering/PROMPT-BEHAVIOR-CONTRACT.md missing (memory-taxonomy check)');
      } else {
        const pbcContent = readFileSync(pbcPath, 'utf8');
        const r2 = validateMemoryUseDiscipline(pbcContent, memTaxScenario);
        if (r2.pass) {
          pass('Memory Use Discipline: heading and both invariants present in PROMPT-BEHAVIOR-CONTRACT.md');
        } else {
          fail(`Memory Use Discipline: ${r2.reason}`);
        }
      }

      // Check 3: Session notes template sections
      const templatePath = join(ROOT, runtimePolicyForTax.memory_hygiene.session_notes_template_path);
      if (!existsSync(templatePath)) {
        fail(`Pass 7b: session-notes template missing at ${runtimePolicyForTax.memory_hygiene.session_notes_template_path}`);
      } else {
        const templateContent = readFileSync(templatePath, 'utf8');
        const r3 = validateSessionNotesTemplate(templateContent, memTaxScenario);
        if (r3.pass) {
          pass('Session notes template: all required sections present');
        } else {
          fail(`Session notes template: ${r3.reason}`);
        }
      }

      // Check 4 & 5: repo-memory-hygiene.md Checklist C and D
      const hygienePath = join(ROOT, 'skills', 'patterns', 'repo-memory-hygiene.md');
      if (!existsSync(hygienePath)) {
        fail('Pass 7b: skills/patterns/repo-memory-hygiene.md missing (memory-taxonomy check)');
      } else {
        const hygieneContent = readFileSync(hygienePath, 'utf8');
        const r4 = validateRepoMemoryHygieneChecklistC(hygieneContent, memTaxScenario);
        if (r4.pass) {
          pass('repo-memory-hygiene.md: Checklist C heading present');
        } else {
          fail(`repo-memory-hygiene.md: ${r4.reason}`);
        }
        const r5 = validateRepoMemoryHygieneChecklistD(hygieneContent, memTaxScenario);
        if (r5.pass) {
          pass('repo-memory-hygiene.md: Checklist D heading present');
        } else {
          fail(`repo-memory-hygiene.md: ${r5.reason}`);
        }
      }
    }
  }
}

// ─── Pass 7c: Tutorial Parity ────────────────────────────────────────────────
header('Pass 7c: Tutorial Parity');

{
  const parityAllowlistPath = join(SCENARIOS_DIR, 'tutorial-parity', 'allowlist.json');
  if (!existsSync(parityAllowlistPath)) {
    fail('Pass 7c: evals/scenarios/tutorial-parity/allowlist.json missing');
  } else {
    let parityAllowlist;
    try {
      parityAllowlist = JSON.parse(readFileSync(parityAllowlistPath, 'utf8'));
    } catch (e) {
      fail(`Pass 7c: allowlist.json parse error — ${e.message}`);
      parityAllowlist = null;
    }
    if (parityAllowlist) {
      if (parityAllowlist._status === 'placeholder') {
        console.log('  Pass 7c: tutorial-parity check INSTALLED (placeholder mode — activated in Phase 5)');
      } else if (parityAllowlist._status === 'active') {
        const enDir = join(ROOT, 'docs', 'tutorial-en');
        const ruDir = join(ROOT, 'docs', 'tutorial-ru');
        const result = validateTutorialParity(enDir, ruDir, parityAllowlist);
        if (result.pass) {
          pass('Tutorial parity: all chapter pairs have matching heading sets');
        } else {
          fail(`Tutorial parity: ${result.reason}`);
          for (const m of result.headingMismatches) {
            fail(`Tutorial parity: ${m.file} — EN-only: [${m.en_only.join(', ')}], RU-only: [${m.ru_only.join(', ')}]`);
          }
        }
      } else {
        fail(`Pass 7c: allowlist.json has unknown _status "${parityAllowlist._status}" (expected "placeholder" or "active")`);
      }
    }
  }
}

// ─── Pass 8: Drift Detection — Phase 9 Additive Checks ──────────────────────
// Non-duplication: see plans/artifacts/controlflow-revision/phase-1-existing-drift-checks.yaml.
// Only the four checks flagged `missing_checks_target_phase_9` are implemented here.
// Check #1 (`model_role` resolution) is gated off pending Phase 4 spike re-enable.
header('Pass 8: Drift Detection — Roster ↔ Enum Bidirectional Alignment');

const routingPath = join(ROOT, 'governance', 'model-routing.json');
let routingJson = null;
try {
  routingJson = JSON.parse(readFileSync(routingPath, 'utf8'));
} catch (e) {
  fail(`Pass 8 Check #1: cannot read governance/model-routing.json — ${e.message}`);
}

if (routingJson) {
  const agentRoleIndex = validateAgentRoleIndex(routingJson);
  if (!agentRoleIndex.ok) {
    for (const err of agentRoleIndex.errors) {
      fail(`Pass 8 Check #1a: agent_role_index — ${err}`);
    }
  } else {
    pass('agent_role_index consistency: top-level index is bidirectionally aligned with roles[*].consumers');
  }
}

// Check #1 — model_role resolution (enabled after Phase 2 spike pass).
if (MODEL_ROLE_CHECK_ENABLED) {
  if (routingJson) {
    let allPass = true;
    for (const agentFile of agentFiles) {
      const content = readFileSync(join(ROOT, agentFile), 'utf8');
      const result = validateModelRole(content, routingJson);
      if (!result.ok) {
        for (const err of result.errors) {
          fail(`Pass 8 Check #1: ${agentFile} — ${err}`);
        }
        allPass = false;
      }
    }
    // Fold by_tier matrix shape check into the same pass/fail block (zero count drift).
    const tierShape = validateByTierShape(routingJson);
    if (!tierShape.ok) {
      for (const err of tierShape.errors) {
        fail(`Pass 8 Check #1: by_tier shape — ${err}`);
      }
      allPass = false;
    }
    if (allPass) {
      pass(`model_role resolution + by_tier shape: all ${agentFiles.length} agents carry valid model_role; routing matrix has valid by_tier entries`);
    }
  }
}

// Check #2 — Roster ↔ enum bidirectional alignment
{
  const ctxPath = join(ROOT, 'plans', 'project-context.md');
  const plannerSchemaPath = join(SCHEMAS_DIR, 'planner.plan.schema.json');
  if (!existsSync(ctxPath)) {
    fail('Pass 8 Check #2: plans/project-context.md missing');
  } else if (!existsSync(plannerSchemaPath)) {
    fail('Pass 8 Check #2: schemas/planner.plan.schema.json missing');
  } else {
    const ctxContent = readFileSync(ctxPath, 'utf8');
    const rosterRaw = parseRosterFromProjectContext(ctxContent);
    // Executor roster only — exclude "Agent" header if slipped through.
    const roster = rosterRaw.filter(a => a !== 'Agent');
    let schemaJson;
    try { schemaJson = JSON.parse(readFileSync(plannerSchemaPath, 'utf8')); } catch (e) {
      fail(`Pass 8 Check #2: planner schema JSON parse error — ${e.message}`);
      schemaJson = null;
    }
    if (schemaJson) {
      const enumValues = schemaJson.properties?.phases?.items?.properties?.executor_agent?.enum ?? [];
      const cmp = compareRosterEnum(roster, enumValues);
      if (cmp.equal) {
        pass(`Roster ↔ enum bidirectional alignment: ${roster.length} agents set-equal to enum`);
      } else {
        if (cmp.extraInRoster.length > 0) {
          fail(`Roster ↔ enum drift: roster has agents missing from enum → [${cmp.extraInRoster.join(', ')}]`);
        }
        if (cmp.extraInEnum.length > 0) {
          fail(`Roster ↔ enum drift: enum has agents missing from roster → [${cmp.extraInEnum.join(', ')}]`);
        }
      }
    }
  }
}

// Check #3 — Agent Resources ↔ schemas existence (scoped to curated Resources section)
header('Pass 9: Drift Detection — Agent Resources Schema Existence');
{
  let totalResourceRefs = 0;
  let brokenRefs = 0;
  for (const agentFile of agentFiles) {
    const content = readFileSync(join(ROOT, agentFile), 'utf8');
    const schemaPaths = parseResourcesSchemaPaths(content);
    totalResourceRefs += schemaPaths.length;
    for (const rel of schemaPaths) {
      if (!existsSync(join(ROOT, rel))) {
        fail(`${agentFile}: Resources section references missing schema → ${rel}`);
        brokenRefs++;
      }
    }
  }
  if (brokenRefs === 0) {
    pass(`Agent Resources schemas: all ${totalResourceRefs} curated references resolve across ${agentFiles.length} agents`);
  }
}

// Check #4 — Cross-plan file-overlap (anchor-map-backed)
header('Pass 10: Drift Detection — Cross-Plan File-Overlap');
{
  const plansDir = join(ROOT, 'plans');
  const EXCLUDED_PLANS = new Set(['session-outcomes.md']); // per Phase 9 exclusion note
  let planFiles = [];
  try {
    planFiles = readdirSync(plansDir)
      .filter(f => f.endsWith('.md') && !EXCLUDED_PLANS.has(f))
      .map(f => `plans/${f}`);
  } catch (e) {
    fail(`Pass 10: could not enumerate plans/ → ${e.message}`);
  }
  if (planFiles.length > 0) {
    const fileMap = buildPlanFileMap(planFiles, ROOT);
    const anchorMaps = findSharedAnchorMaps(ROOT);
    const unresolved = findUnresolvedOverlaps(fileMap, anchorMaps);
    if (unresolved.length === 0) {
      pass(`Cross-plan overlap: ${fileMap.size} paths across ${planFiles.length} plans; all overlaps coordinated via ${anchorMaps.length} shared anchor-map(s)`);
    } else {
      for (const u of unresolved.slice(0, 10)) {
        fail(`Cross-plan overlap without shared anchor-map: "${u.file}" appears in ${u.planA} AND ${u.planB}`);
      }
      if (unresolved.length > 10) {
        fail(`Cross-plan overlap: ${unresolved.length - 10} additional unresolved pair(s) suppressed`);
      }
    }
  }
}

// ─── Pass 12: Governance Policy Assertions (Phase 4) ─────────────────────────
header('Pass 12: Governance Policy Assertions');

{
  // Load runtime-policy.json once for assertions A and B
  const runtimePolicyPath = join(ROOT, 'governance', 'runtime-policy.json');
  let runtimePolicy = null;
  try {
    runtimePolicy = JSON.parse(readFileSync(runtimePolicyPath, 'utf8'));
  } catch (e) {
    fail(`Pass 12: cannot read governance/runtime-policy.json — ${e.message}`);
  }

  if (runtimePolicy) {
    // A: tool_output_policy structural check
    const rtp = runtimePolicy.tool_output_policy;
    if (!rtp) {
      fail('Pass 12 A: governance/runtime-policy.json missing top-level key tool_output_policy');
    } else {
      const expectedRtp = {
        spill_directory_template: '.cache/tool-output/<task-slug>/',
        task_slug_pattern: '^[a-zA-Z0-9_-]+$',
        purge_timing: 'completion_gate_only',
        max_total_mb: null,
      };
      let rtpOk = true;
      for (const [k, v] of Object.entries(expectedRtp)) {
        if (rtp[k] !== v) {
          fail(`Pass 12 A: tool_output_policy.${k} expected ${JSON.stringify(v)}, got ${JSON.stringify(rtp[k])}`);
          rtpOk = false;
        }
      }
      const extraKeys = Object.keys(rtp).filter(k => !(k in expectedRtp));
      if (extraKeys.length > 0) {
        fail(`Pass 12 A: tool_output_policy has unexpected extra keys: ${extraKeys.join(', ')}`);
        rtpOk = false;
      }
      if (rtpOk) pass('Pass 12 A: tool_output_policy structure and values correct');
    }

    // B: session_telemetry regression guard (full object equality — catches value drift)
    const st = runtimePolicy.session_telemetry;
    const expectedSt = {
      template: 'plans/templates/session-outcome-template.md',
      log_file: 'plans/session-outcomes.md',
      write_timing: 'before_completion_summary',
      archive_threshold_entries: 50,
    };
    if (!st) {
      fail('Pass 12 B: governance/runtime-policy.json missing session_telemetry');
    } else {
      let stOk = true;
      for (const [k, v] of Object.entries(expectedSt)) {
        if (st[k] !== v) {
          fail(`Pass 12 B: session_telemetry.${k} expected ${JSON.stringify(v)}, got ${JSON.stringify(st[k])}`);
          stOk = false;
        }
      }
      if (stOk) pass('Pass 12 B: session_telemetry full object equality verified');
    }
  }

  // E: reasoning_effort_hint coverage — every role in model-routing.json must declare it
  const mrPath = join(ROOT, 'governance', 'model-routing.json');
  let mrJson = null;
  try {
    mrJson = JSON.parse(readFileSync(mrPath, 'utf8'));
  } catch (e) {
    fail(`Pass 12 E: cannot read governance/model-routing.json — ${e.message}`);
  }
  if (mrJson) {
    const validHints = new Set(['low', 'medium', 'high']);
    const roles = Object.entries(mrJson.roles || {});
    let effortOk = true;
    for (const [roleName, roleDef] of roles) {
      if (!('reasoning_effort_hint' in roleDef)) {
        fail(`Pass 12 E: role "${roleName}" missing reasoning_effort_hint`);
        effortOk = false;
      } else if (!validHints.has(roleDef.reasoning_effort_hint)) {
        fail(`Pass 12 E: role "${roleName}" reasoning_effort_hint "${roleDef.reasoning_effort_hint}" must be "low"|"medium"|"high"`);
        effortOk = false;
      }
    }
    if (effortOk) pass(`Pass 12 E: reasoning_effort_hint present and valid for all ${roles.length} roles`);
  }

  // F: Orchestrator Context Compaction Policy invariant
  {
    const orchPath = join(ROOT, 'Orchestrator.agent.md');
    try {
      const orchContent = readFileSync(orchPath, 'utf8');
      const rf = validateOrchestratorCompactionInvariant(orchContent);
      if (rf.ok) {
        pass('Pass 12 F: Orchestrator Context Compaction Policy contains compaction.max_consecutive_failures and WAITING_APPROVAL');
      } else {
        for (const err of rf.errors) fail(`Pass 12 F: ${err}`);
      }
    } catch (e) {
      fail(`Pass 12 F: cannot read Orchestrator.agent.md — ${e.message}`);
    }
  }

  // G: Orchestrator Agentic Memory Policy — promotion order
  {
    const orchPath = join(ROOT, 'Orchestrator.agent.md');
    try {
      const orchContent = readFileSync(orchPath, 'utf8');
      const rg = validateOrchestratorMemoryPromotionOrder(orchContent);
      if (rg.ok) {
        pass('Pass 12 G: Orchestrator memory-promotion-candidates.md precedes Checklist C in Agentic Memory Policy');
      } else {
        for (const err of rg.errors) fail(`Pass 12 G: ${err}`);
      }
    } catch (e) {
      fail(`Pass 12 G: cannot read Orchestrator.agent.md — ${e.message}`);
    }
  }

  // H: CodeReviewer security mode same-line assertion
  {
    const crPath = join(ROOT, 'CodeReviewer-subagent.agent.md');
    try {
      const crContent = readFileSync(crPath, 'utf8');
      const rh = validateCodeReviewerSecurityModeSameLine(crContent);
      if (rh.ok) {
        pass('Pass 12 H: CodeReviewer review_mode: "security" and security-review-discipline.md co-located on same line');
      } else {
        for (const err of rh.errors) fail(`Pass 12 H: ${err}`);
      }
    } catch (e) {
      fail(`Pass 12 H: cannot read CodeReviewer-subagent.agent.md — ${e.message}`);
    }
  }
}

// ─── Pass 13: Drift Detection — review_scope=final Bidirectional Coupling ─────
header('Pass 13: Drift Detection — review_scope=final Bidirectional Coupling');
{
  const codeReviewerPath = join(ROOT, 'CodeReviewer-subagent.agent.md');
  const verdictSchemaPath = join(SCHEMAS_DIR, 'code-reviewer.verdict.schema.json');
  let agentContent = '';
  let schemaJson = null;
  let loadOk = true;
  try { agentContent = readFileSync(codeReviewerPath, 'utf8'); } catch (e) {
    fail(`Pass 13: cannot read CodeReviewer-subagent.agent.md — ${e.message}`);
    loadOk = false;
  }
  try { schemaJson = JSON.parse(readFileSync(verdictSchemaPath, 'utf8')); } catch (e) {
    fail(`Pass 13: cannot read code-reviewer.verdict.schema.json — ${e.message}`);
    loadOk = false;
  }
  if (loadOk) {
    const result = validateReviewScopeFinalCoupling(agentContent, schemaJson);
    if (result.ok) {
      pass('review_scope=final bidirectional coupling: agent and schema are aligned');
    } else {
      for (const err of result.errors) {
        fail(`Pass 13: review_scope=final coupling drift — ${err}`);
      }
    }
  }
}

// ─── Pass 14: Drift Detection — Canonical Source Matrix Heading (PW-F1) ────────
header('Pass 14: Drift Detection — Canonical Source Matrix Heading');
{
  const ctxPath = join(ROOT, 'plans', 'project-context.md');
  if (!existsSync(ctxPath)) {
    fail('Pass 14: plans/project-context.md missing');
  } else {
    const ctxContent = readFileSync(ctxPath, 'utf8');
    const result = validateCanonicalSourceMatrixHeading(ctxContent);
    if (result.pass) {
      pass('Canonical Source Matrix: heading present in plans/project-context.md');
    } else {
      fail(`Pass 14: ${result.reason}`);
    }
  }
}

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
  try {
    mkdirSync(CACHE_DIR, { recursive: true });
    writeFileSync(
      CACHE_FILE,
      JSON.stringify({ fingerprint: currentFingerprint, timestamp: new Date().toISOString() }, null, 2) + '\n',
      'utf8'
    );
  } catch { /* cache write failure is non-fatal */ }
  console.log('\nAll checks passed \u2705\n');
}
