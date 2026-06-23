/**
 * ControlFlow — CLAUDE.md Contract Drift Tests (Phase 2 re-anchor)
 *
 * Asserts the human-facing control doc (CLAUDE.md) stays aligned with the
 * machine-enforced plan contract:
 *   - schemas/planner.plan.schema.json (agent const, schema_version const)
 *   - governance/project-context-registry.json (phase_executor_agents enum)
 *   - governance/runtime-policy.json (verdict_routing.confidence_thresholds.ready_for_execution_min)
 *
 * Phase 2 re-anchor: the slimmed runtime-policy cut plan_review_gate_trigger_conditions;
 * the confidence threshold now lives at verdict_routing.confidence_thresholds.ready_for_execution_min
 * (M4 single source of truth for the 0.9 threshold). The contract-drift check reads that
 * surviving key and asserts the CLAUDE.md "below <threshold>" phrase matches.
 *
 * Exit 0 on all checks passed, exit 1 on any failure.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { checkControlFlowContractDrift } from '../drift-checks.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

const FIXTURES_DIR = join(__dirname, 'fixtures', 'contract-drift');
const CLAUDE_MD_PATH = join(ROOT, 'CLAUDE.md');
const SCHEMA_PATH = join(ROOT, 'schemas', 'planner.plan.schema.json');
const REGISTRY_PATH = join(ROOT, 'governance', 'project-context-registry.json');
const RUNTIME_POLICY_PATH = join(ROOT, 'governance', 'runtime-policy.json');
const PLAN_TEMPLATE_PATH = join(ROOT, 'plans', 'templates', 'plan-document-template.md');

function loadJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

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

console.log('\n=== CLAUDE.md Contract Drift ===');

const plannerSchema = loadJson(SCHEMA_PATH);
const registry = loadJson(REGISTRY_PATH);
const runtimePolicy = loadJson(RUNTIME_POLICY_PATH);
const planTemplate = readFileSync(PLAN_TEMPLATE_PATH, 'utf8');

// ─── Plan-format anchors (Phase 2 re-anchor) ─────────────────────────────────
// Assert the plan-format contract anchors against the schema + registry + slimmed
// runtime-policy + plan-document-template. These assertions guard against drift in
// the machine-enforced plan contract: YAML header fields, 10-section order, 5 lifecycle
// sections, 7 semantic-risk categories, executor-agent enum, and the slimmed runtime-
// policy's 3 surviving blocks (review_pipeline_by_tier, semantic_risk_policy, verdict_routing).

console.log('\n=== Plan-format anchors (schema + registry + slimmed runtime-policy + template) ===');

// A: YAML header fields — schema enums/consts match the template's documented header
{
  const expectedStatusEnum = plannerSchema?.properties?.status?.enum;
  check('schema status enum has 3 values [READY_FOR_EXECUTION, ABSTAIN, REPLAN_REQUIRED]',
    Array.isArray(expectedStatusEnum) && expectedStatusEnum.length === 3 &&
      expectedStatusEnum.includes('READY_FOR_EXECUTION') &&
      expectedStatusEnum.includes('ABSTAIN') &&
      expectedStatusEnum.includes('REPLAN_REQUIRED'),
    `got ${JSON.stringify(expectedStatusEnum)}`);

  const expectedAgent = plannerSchema?.properties?.agent?.const;
  check('schema agent const is "Planner"', expectedAgent === 'Planner', `got ${JSON.stringify(expectedAgent)}`);

  const expectedSchemaVersion = plannerSchema?.properties?.schema_version?.const;
  check('schema schema_version const is "1.2.0"', expectedSchemaVersion === '1.2.0', `got ${JSON.stringify(expectedSchemaVersion)}`);

  const expectedTierEnum = plannerSchema?.properties?.complexity_tier?.enum;
  check('schema complexity_tier enum has 4 values [TRIVIAL, SMALL, MEDIUM, LARGE]',
    Array.isArray(expectedTierEnum) && expectedTierEnum.length === 4 &&
      expectedTierEnum.includes('TRIVIAL') && expectedTierEnum.includes('SMALL') &&
      expectedTierEnum.includes('MEDIUM') && expectedTierEnum.includes('LARGE'),
    `got ${JSON.stringify(expectedTierEnum)}`);

  const confidenceSchema = plannerSchema?.properties?.confidence;
  check('schema confidence is number 0..1',
    confidenceSchema?.type === 'number' && confidenceSchema?.minimum === 0 && confidenceSchema?.maximum === 1,
    `got ${JSON.stringify(confidenceSchema)}`);

  const abstainRequired = plannerSchema?.properties?.abstain?.required;
  check('schema abstain requires [is_abstaining, reasons]',
    Array.isArray(abstainRequired) && abstainRequired.length === 2 &&
      abstainRequired.includes('is_abstaining') && abstainRequired.includes('reasons'),
    `got ${JSON.stringify(abstainRequired)}`);

  // Template header mirrors schema (Status / Agent / schema_version / Complexity Tier / Confidence / Abstain / Summary)
  check('template documents Status enum (READY_FOR_EXECUTION | ABSTAIN | REPLAN_REQUIRED)',
    /READY_FOR_EXECUTION.*ABSTAIN.*REPLAN_REQUIRED/s.test(planTemplate) || /ABSTAIN.*REPLAN_REQUIRED.*READY_FOR_EXECUTION/s.test(planTemplate),
    'expected all 3 status values in template header');
  check('template documents Agent: Planner', /\*\*Agent:\*\*\s*Planner/.test(planTemplate), 'expected **Agent:** Planner in template');
  check('template documents schema_version: 1.2.0', /schema_version:\*\*\s*1\.2\.0/.test(planTemplate), 'expected **schema_version:** 1.2.0 in template');
  check('template documents Complexity Tier enum', /\*\*Complexity Tier:\*\*\s*`TRIVIAL`.*`SMALL`.*`MEDIUM`.*`LARGE`/s.test(planTemplate), 'expected all 4 tier values in template');
}

// B: 10-section order — the plan-format reference (.github/skills/controlflow-plan/references/
// plan-format.md) is the Phase 1 deliverable that declares the canonical 10-section order
// (it explicitly says "10 sections, in order" with a numbered list). The plan-document-template
// is the immutable contract that contains the sections as ### headings but splits #10
// ("Handoff & Execution Notes") into "Handoff" + "Notes for Orchestrator" and places
// "Architecture Visualization" later in the document. We assert:
//   - All 10 sections appear as ### headings in the template (presence, not order).
//   - The plan-format reference lists all 10 sections in canonical numbered order (order enforced
//     against the file that declares the order).
// The template-vs-plan-format section-order drift is recorded as a Phase 2 finding (out of
// scope to fix: template is immutable, plan-format.md is a Phase 1 deliverable).
{
  const expectedSections = [
    'Context & Analysis',
    'Design Decisions',
    'Implementation Phases',
    'Inter-Phase Contracts',
    'Open Questions',
    'Risks',
    'Semantic Risk Review',
    'Architecture Visualization',
    'Success Criteria',
    'Handoff',
  ];
  // Template presence check (all 10 sections appear as ### headings, allowing parenthetical
  // suffixes like "Architecture Visualization (Mandatory for 3+ phase plans)").
  const templatePositions = expectedSections.map(name => {
    const escaped = name.replace(/[&]/g, '[&]');
    const re = new RegExp(`^###\\s+${escaped}(?:\\s|$)`, 'm');
    const m = planTemplate.match(re);
    return m ? m.index : -1;
  });
  const allPresentInTemplate = templatePositions.every(p => p >= 0);
  check('template has all 10 base sections as ### headings', allPresentInTemplate,
    `missing: ${expectedSections.filter((_, i) => templatePositions[i] < 0).join(', ')}`);

  // Plan-format.md canonical order check (the file that declares "10 sections, in order").
  const PLAN_FORMAT_REF_PATH = join(ROOT, '.github', 'skills', 'controlflow-plan', 'references', 'plan-format.md');
  const planFormatRef = readFileSync(PLAN_FORMAT_REF_PATH, 'utf8');
  const refPositions = expectedSections.map(name => {
    const escaped = name.replace(/[&]/g, '[&]');
    // Plan-format.md uses a numbered list: "1. Context & Analysis — ...", "5. Open Questions.".
    // Allow any non-letter boundary after the section name (whitespace, em-dash, period, end-of-line).
    const re = new RegExp(`^\\d+\\.\\s+${escaped}(?:[^A-Za-z]|$)`, 'm');
    const m = planFormatRef.match(re);
    return m ? m.index : -1;
  });
  const allPresentInRef = refPositions.every(p => p >= 0);
  check('plan-format.md documents all 10 base sections in its numbered list', allPresentInRef,
    `missing: ${expectedSections.filter((_, i) => refPositions[i] < 0).join(', ')}`);
  const strictlyIncreasing = refPositions.every((p, i) => i === 0 || p > refPositions[i - 1]);
  check('plan-format.md 10 sections appear in canonical numbered order', allPresentInRef && strictlyIncreasing,
    `positions=${JSON.stringify(refPositions)}`);

  // Schema-required section fields that map to template sections (cross-source consistency)
  const schemaRequired = plannerSchema?.required || [];
  const schemaSectionFields = ['phases', 'open_questions', 'risks', 'risk_review', 'success_criteria', 'handoff'];
  const allSchemaSectionsRequired = schemaSectionFields.every(f => schemaRequired.includes(f));
  check('schema requires the 6 plan-body section fields (phases, open_questions, risks, risk_review, success_criteria, handoff)',
    allSchemaSectionsRequired, `missing: ${schemaSectionFields.filter(f => !schemaRequired.includes(f)).join(', ')}`);
}

// C: 5 lifecycle sections — exact headings, exact order. The plan-format reference
// (.github/skills/controlflow-plan/references/plan-format.md) is a Phase 1 deliverable that
// lists them explicitly as `## Progress`, `## Discoveries`, `## Decision Log`, `## Outcomes`,
// `## Idempotence & Recovery`. We assert against that file as a read-only contract source
// (Phase 2 scope is evals/ only; we read but do not modify the Phase 1 deliverable).
{
  const PLAN_FORMAT_REF_PATH = join(ROOT, '.github', 'skills', 'controlflow-plan', 'references', 'plan-format.md');
  const planFormatRef = readFileSync(PLAN_FORMAT_REF_PATH, 'utf8');
  const expectedLifecycle = [
    'Progress',
    'Discoveries',
    'Decision Log',
    'Outcomes',
    'Idempotence & Recovery',
  ];
  const positions = expectedLifecycle.map(name => {
    const escaped = name.replace(/[&]/g, '[&]');
    const re = new RegExp(`\`## ${escaped}\``);
    const m = planFormatRef.match(re);
    return m ? m.index : -1;
  });
  const allPresent = positions.every(p => p >= 0);
  check('plan-format.md documents all 5 lifecycle section headings (Progress, Discoveries, Decision Log, Outcomes, Idempotence & Recovery)',
    allPresent, `missing: ${expectedLifecycle.filter((_, i) => positions[i] < 0).join(', ')}`);
  const strictlyIncreasing = positions.every((p, i) => i === 0 || p > positions[i - 1]);
  check('plan-format.md 5 lifecycle sections appear in canonical order', allPresent && strictlyIncreasing,
    `positions=${JSON.stringify(positions)}`);
}

// D: 7 semantic-risk categories — schema's allOf contains block matches slimmed runtime-policy
{
  const schemaAllOf = plannerSchema?.properties?.risk_review?.allOf;
  const schemaCategories = schemaAllOf
    ? schemaAllOf.map(s => s?.contains?.properties?.category?.const).filter(Boolean)
    : [];
  check('schema risk_review.allOf lists all 7 semantic-risk categories',
    schemaCategories.length === 7 &&
      ['data_volume', 'performance', 'concurrency', 'access_control', 'migration_rollback', 'dependency', 'operability']
        .every(c => schemaCategories.includes(c)),
    `got ${JSON.stringify(schemaCategories)}`);

  const policyCategories = runtimePolicy?.semantic_risk_policy?.categories;
  check('slimmed runtime-policy.semantic_risk_policy.categories has all 7 categories',
    Array.isArray(policyCategories) && policyCategories.length === 7 &&
      ['data_volume', 'performance', 'concurrency', 'access_control', 'migration_rollback', 'dependency', 'operability']
        .every(c => policyCategories.includes(c)),
    `got ${JSON.stringify(policyCategories)}`);

  check('schema semantic-risk categories match slimmed runtime-policy categories (cross-source drift guard)',
    Array.isArray(policyCategories) &&
      schemaCategories.length === policyCategories.length &&
      schemaCategories.every(c => policyCategories.includes(c)),
    `schema=${JSON.stringify(schemaCategories)} policy=${JSON.stringify(policyCategories)}`);

  // Enum consistency between schema and slimmed runtime-policy
  const schemaApplicability = plannerSchema?.properties?.risk_review?.items?.properties?.applicability?.enum;
  const policyApplicability = runtimePolicy?.semantic_risk_policy?.applicability_values;
  check('schema applicability enum matches slimmed runtime-policy.applicability_values',
    Array.isArray(schemaApplicability) && Array.isArray(policyApplicability) &&
      schemaApplicability.length === policyApplicability.length &&
      schemaApplicability.every(v => policyApplicability.includes(v)),
    `schema=${JSON.stringify(schemaApplicability)} policy=${JSON.stringify(policyApplicability)}`);

  const schemaImpact = plannerSchema?.properties?.risk_review?.items?.properties?.impact?.enum;
  const policyImpact = runtimePolicy?.semantic_risk_policy?.impact_values;
  check('schema impact enum matches slimmed runtime-policy.impact_values',
    Array.isArray(schemaImpact) && Array.isArray(policyImpact) &&
      schemaImpact.length === policyImpact.length &&
      schemaImpact.every(v => policyImpact.includes(v)),
    `schema=${JSON.stringify(schemaImpact)} policy=${JSON.stringify(policyImpact)}`);

  const schemaDisposition = plannerSchema?.properties?.risk_review?.items?.properties?.disposition?.enum;
  const policyDisposition = runtimePolicy?.semantic_risk_policy?.disposition_values;
  check('schema disposition enum matches slimmed runtime-policy.disposition_values',
    Array.isArray(schemaDisposition) && Array.isArray(policyDisposition) &&
      schemaDisposition.length === policyDisposition.length &&
      schemaDisposition.every(v => policyDisposition.includes(v)),
    `schema=${JSON.stringify(schemaDisposition)} policy=${JSON.stringify(policyDisposition)}`);
}

// E: executor-agent enum — schema's phases.items.properties.executor_agent.enum matches registry
{
  const schemaExecutors = plannerSchema?.properties?.phases?.items?.properties?.executor_agent?.enum;
  const registryExecutors = Array.isArray(registry?.phase_executor_agents)
    ? registry.phase_executor_agents.map(a => a.agent).filter(Boolean)
    : [];
  check('schema executor_agent enum has all 8 subagents',
    Array.isArray(schemaExecutors) && schemaExecutors.length === 8,
    `got ${JSON.stringify(schemaExecutors)}`);
  check('registry phase_executor_agents lists all 8 subagents',
    registryExecutors.length === 8,
    `got ${JSON.stringify(registryExecutors)}`);
  check('schema executor_agent enum matches registry phase_executor_agents (cross-source drift guard)',
    Array.isArray(schemaExecutors) &&
      schemaExecutors.length === registryExecutors.length &&
      schemaExecutors.every(a => registryExecutors.includes(a)),
    `schema=${JSON.stringify(schemaExecutors)} registry=${JSON.stringify(registryExecutors)}`);
}

// F: slimmed runtime-policy 3 surviving blocks (review_pipeline_by_tier, semantic_risk_policy, verdict_routing)
{
  check('slimmed runtime-policy has review_pipeline_by_tier block',
    runtimePolicy?.review_pipeline_by_tier && typeof runtimePolicy.review_pipeline_by_tier === 'object',
    `got ${typeof runtimePolicy?.review_pipeline_by_tier}`);
  check('slimmed runtime-policy has semantic_risk_policy block',
    runtimePolicy?.semantic_risk_policy && typeof runtimePolicy.semantic_risk_policy === 'object',
    `got ${typeof runtimePolicy?.semantic_risk_policy}`);
  check('slimmed runtime-policy has verdict_routing block',
    runtimePolicy?.verdict_routing && typeof runtimePolicy.verdict_routing === 'object',
    `got ${typeof runtimePolicy?.verdict_routing}`);

  // review_pipeline_by_tier: tier→phase mapping (TRIVIAL/SMALL/MEDIUM/LARGE)
  const tiers = ['TRIVIAL', 'SMALL', 'MEDIUM', 'LARGE'];
  const rpb = runtimePolicy?.review_pipeline_by_tier;
  check('review_pipeline_by_tier has all 4 tiers (TRIVIAL, SMALL, MEDIUM, LARGE)',
    rpb && tiers.every(t => rpb[t] && typeof rpb[t] === 'object'),
    `got ${JSON.stringify(Object.keys(rpb || {}))}`);
  // Each tier maps 4 verify phases: plan_auditor, assumption_verifier, executability_verifier, code_review
  const verifyPhases = ['plan_auditor', 'assumption_verifier', 'executability_verifier', 'code_review'];
  check('review_pipeline_by_tier each tier has 4 verify phases (plan_auditor, assumption_verifier, executability_verifier, code_review)',
    rpb && tiers.every(t => verifyPhases.every(p => typeof rpb[t][p] === 'boolean')),
    `got ${JSON.stringify(rpb)}`);
  // Tier→phase mapping invariants from CLAUDE.md workflow table (TRIVIAL→P1 only; SMALL→P1; MEDIUM→P1-2; LARGE→P1-3)
  check('review_pipeline_by_tier TRIVIAL: plan_auditor=false, assumption_verifier=false, executability_verifier=false, code_review=true',
    rpb?.TRIVIAL && rpb.TRIVIAL.plan_auditor === false && rpb.TRIVIAL.assumption_verifier === false &&
      rpb.TRIVIAL.executability_verifier === false && rpb.TRIVIAL.code_review === true,
    `got ${JSON.stringify(rpb?.TRIVIAL)}`);
  check('review_pipeline_by_tier SMALL: plan_auditor=true, assumption_verifier=false, executability_verifier=false, code_review=true',
    rpb?.SMALL && rpb.SMALL.plan_auditor === true && rpb.SMALL.assumption_verifier === false &&
      rpb.SMALL.executability_verifier === false && rpb.SMALL.code_review === true,
    `got ${JSON.stringify(rpb?.SMALL)}`);
  check('review_pipeline_by_tier MEDIUM: plan_auditor=true, assumption_verifier=true, executability_verifier=false, code_review=true',
    rpb?.MEDIUM && rpb.MEDIUM.plan_auditor === true && rpb.MEDIUM.assumption_verifier === true &&
      rpb.MEDIUM.executability_verifier === false && rpb.MEDIUM.code_review === true,
    `got ${JSON.stringify(rpb?.MEDIUM)}`);
  check('review_pipeline_by_tier LARGE: plan_auditor=true, assumption_verifier=true, executability_verifier=true, code_review=true',
    rpb?.LARGE && rpb.LARGE.plan_auditor === true && rpb.LARGE.assumption_verifier === true &&
      rpb.LARGE.executability_verifier === true && rpb.LARGE.code_review === true,
    `got ${JSON.stringify(rpb?.LARGE)}`);

  // semantic_risk_policy: 7 categories + override rule
  const srp = runtimePolicy?.semantic_risk_policy;
  check('semantic_risk_policy has override_rule (Any unresolved HIGH-impact semantic risk forces LARGE)',
    typeof srp?.override_rule === 'string' && srp.override_rule.length > 0 &&
      /HIGH/i.test(srp.override_rule) && /LARGE/i.test(srp.override_rule),
    `got ${JSON.stringify(srp?.override_rule)}`);

  // verdict_routing: 3 verdicts + confidence thresholds (M4 single source of truth for 0.9 / 0.85 / 0.7)
  const vr = runtimePolicy?.verdict_routing;
  const verdicts = vr?.verdicts;
  check('verdict_routing.verdicts has APPROVED, NEEDS_REVISION, REJECTED',
    verdicts && typeof verdicts.APPROVED === 'string' && typeof verdicts.NEEDS_REVISION === 'string' && typeof verdicts.REJECTED === 'string',
    `got ${JSON.stringify(verdicts)}`);
  const ct = vr?.confidence_thresholds;
  check('verdict_routing.confidence_thresholds has ready_for_execution_min=0.9, uncertain_count_cap=0.85, high_impact_open_question_cap=0.7',
    ct && ct.ready_for_execution_min === 0.9 && ct.uncertain_count_cap === 0.85 && ct.high_impact_open_question_cap === 0.7,
    `got ${JSON.stringify(ct)}`);
}

// ─── Fixture: good CLAUDE.md ─────────────────────────────────────────────────
{
  const good = readFileSync(join(FIXTURES_DIR, 'good-claude.md'), 'utf8');
  const r = checkControlFlowContractDrift(good, plannerSchema, registry, runtimePolicy);
  check('good-claude.md: drift check returns ok', r.ok, r.errors.join('; '));
  check('good-claude.md: no errors reported', r.errors.length === 0, `got ${r.errors.length}: ${r.errors.join('; ')}`);
  check('good-claude.md: checked all 4 contract fields', r.checked === 4, `checked=${r.checked}`);
}

// ─── Fixture: bad CLAUDE.md ──────────────────────────────────────────────────
{
  const bad = readFileSync(join(FIXTURES_DIR, 'bad-claude.md'), 'utf8');
  const r = checkControlFlowContractDrift(bad, plannerSchema, registry, runtimePolicy);
  check('bad-claude.md: drift check fails', !r.ok, `errors=${r.errors.length}`);
  check('bad-claude.md: reports ≥4 contract drifts', r.errors.length >= 4, `got ${r.errors.length}: ${r.errors.join('; ')}`);
  check(
    'bad-claude.md: errors cover Agent, Schema Version, confidence, and executor enum',
    r.errors.some(e => e.includes('Agent')) &&
      r.errors.some(e => e.includes('Schema Version')) &&
      r.errors.some(e => e.includes('confidence')) &&
      r.errors.some(e => e.includes('executor')),
    `errors=[${r.errors.join('; ')}]`
  );
}

// ─── Live-tree smoke test against the real CLAUDE.md ──────────────────────────
{
  const live = readFileSync(CLAUDE_MD_PATH, 'utf8');
  const r = checkControlFlowContractDrift(live, plannerSchema, registry, runtimePolicy);
  check('live CLAUDE.md: drift check passes', r.ok, r.errors.join('; '));
}

// ─── Summary ─────────────────────────────────────────────────────────────────
const total = passed + failed;
const bar = '='.repeat(50);
console.log(`\n${bar}`);
console.log(`CLAUDE.md contract drift: ${total} checks | ${passed} passed | ${failed} failed`);
console.log(bar);

if (failed > 0) {
  console.error(`\n${failed} CLAUDE.md contract-drift check(s) failed.\n`);
  process.exit(1);
}
console.log('\nAll CLAUDE.md contract-drift checks passed ✅\n');
