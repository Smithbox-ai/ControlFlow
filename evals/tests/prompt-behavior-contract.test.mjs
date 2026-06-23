/**
 * ControlFlow — Prompt Behavior Contract Regression Tests (Phase 2 rewrite)
 *
 * Re-anchored to the slim Copilot-first canonical surface:
 *   - 3 skills: .github/skills/controlflow-{plan,verify,review}/SKILL.md (+ references/)
 *   - 1 agent:  .github/agents/controlflow-planner.agent.md
 *   - routing stub: .github/copilot-instructions.md
 *   - slimmed governance/runtime-policy.json (review_pipeline_by_tier +
 *     semantic_risk_policy + verdict_routing only)
 *   - immutable contract: schemas/planner.plan.schema.json +
 *     plans/templates/plan-document-template.md
 *
 * The heavy 13-agent model (Orchestrator + 12 subagents) is a retired surface and is
 * no longer referenced here. Phase 3 deletes those files; Phase 2 only rewires the eval.
 *
 * Exit 0 on all checks passed, exit 1 on any failure.
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const SCENARIOS_DIR = join(__dirname, '..', 'scenarios');

let passed = 0;
let failed = 0;

function check(label, ok) {
  if (ok) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.log(`  ❌ ${label}`);
    failed++;
  }
}

function readSkill(name) {
  return readFileSync(join(ROOT, '.github', 'skills', `controlflow-${name}`, 'SKILL.md'), 'utf8');
}
function readSkillRef(name, ref) {
  return readFileSync(join(ROOT, '.github', 'skills', `controlflow-${name}`, 'references', ref), 'utf8');
}
function readPlannerAgent() {
  return readFileSync(join(ROOT, '.github', 'agents', 'controlflow-planner.agent.md'), 'utf8');
}
function readShared() {
  return readFileSync(join(ROOT, '.github', 'copilot-instructions.md'), 'utf8');
}
function readSchema() {
  return JSON.parse(readFileSync(join(ROOT, 'schemas', 'planner.plan.schema.json'), 'utf8'));
}
function readTemplate() {
  return readFileSync(join(ROOT, 'plans', 'templates', 'plan-document-template.md'), 'utf8');
}
function readRuntimePolicy() {
  return JSON.parse(readFileSync(join(ROOT, 'governance', 'runtime-policy.json'), 'utf8'));
}
function loadScenario(file) {
  return JSON.parse(readFileSync(join(SCENARIOS_DIR, file), 'utf8'));
}

// ──────────────────────────────────────────────
// controlflow-plan skill — behavioral invariants
// ──────────────────────────────────────────────
console.log('\n=== controlflow-plan — Behavioral Invariants ===');
{
  const plan = readSkill('plan');
  const schema = readSchema();
  const template = readTemplate();
  const policy = readRuntimePolicy();

  // Plan-format single-sourcing from schema + template
  check(
    'plan skill: single-sources format from schemas/planner.plan.schema.json',
    /schemas\/planner\.plan\.schema\.json/.test(plan)
  );
  check(
    'plan skill: single-sources format from plans/templates/plan-document-template.md',
    /plans\/templates\/plan-document-template\.md/.test(plan)
  );

  // Tier classification + LARGE override
  check(
    'plan skill: assigns one complexity tier from references/complexity-tiers.md',
    /references\/complexity-tiers\.md/.test(plan) && /TRIVIAL|SMALL|MEDIUM|LARGE/.test(plan)
  );
  check(
    'plan skill: unresolved HIGH-impact semantic risk forces LARGE regardless of file count',
    /HIGH-impact semantic risk forces LARGE/i.test(plan)
  );

  // 7 semantic-risk categories, each once, not_applicable allowed with justification
  check(
    'plan skill: requires all seven semantic risk categories',
    /all seven semantic risk categories|seven semantic risk/i.test(plan)
  );
  check(
    'plan skill: never skip a row — use not_applicable with justification',
    /not_applicable/i.test(plan) && /never skip/i.test(plan)
  );

  // 10 sections in order + 5 lifecycle sections
  check(
    'plan skill: documents the 10 sections in order',
    /10 sections in order/i.test(plan)
  );
  check(
    'plan skill: documents the 5 lifecycle sections (Progress, Discoveries, Decision Log, Outcomes, Idempotence & Recovery)',
    /Progress/.test(plan) && /Discoveries/.test(plan) && /Decision Log/.test(plan) &&
    /Outcomes/.test(plan) && /Idempotence & Recovery/.test(plan)
  );

  // executor_agent per phase from schema enum
  check(
    'plan skill: every phase declares exactly one executor_agent from the schema enum',
    /executor_agent/.test(plan) && /schema enum/i.test(plan)
  );

  // ABSTAIN / REPLAN_REQUIRED below 0.9
  check(
    'plan skill: ABSTAIN or REPLAN_REQUIRED when confidence below 0.9',
    /ABSTAIN/.test(plan) && /REPLAN_REQUIRED/.test(plan) && /0\.9/.test(plan)
  );

  // No inline plan in chat — artifact-first
  check(
    'plan skill: do NOT inline the plan in chat (artifact-first)',
    /do NOT inline the plan in chat/i.test(plan)
  );

  // Mermaid rules per tier
  check(
    'plan skill: Mermaid sequenceDiagram for MEDIUM+ non-trivial orchestration; flowchart TD + sequenceDiagram for LARGE',
    /sequenceDiagram/.test(plan) && /flowchart TD/.test(plan) && /LARGE/.test(plan)
  );

  // Quality gates use only the five standard values (cross-check schema)
  const schemaGates = schema?.properties?.phases?.items?.properties?.quality_gates;
  check(
    'plan skill: quality gates referenced (schema phase quality_gates present)',
    schemaGates != null
  );

  // Cross-source: plan skill 7 categories == runtime-policy semantic_risk_policy.categories
  const policyCats = policy?.semantic_risk_policy?.categories;
  check(
    'plan skill: runtime-policy semantic_risk_policy.categories has 7 categories',
    Array.isArray(policyCats) && policyCats.length === 7
  );
}

// ──────────────────────────────────────────────
// controlflow-planner agent — behavioral invariants
// ──────────────────────────────────────────────
console.log('\n=== controlflow-planner agent — Behavioral Invariants ===');
{
  const agent = readPlannerAgent();
  const schema = readSchema();

  // Single output is a saved plan artifact
  check(
    'planner agent: single output is a saved, execution-ready plan artifact',
    /saved/.test(agent) && /plan artifact/i.test(agent)
  );
  check(
    'planner agent: do NOT inline the plan in chat',
    /do NOT inline the plan in chat/i.test(agent)
  );

  // Idea Interview for vague requests
  check(
    'planner agent: Idea Interview when request is vague',
    /Idea Interview/i.test(agent)
  );
  check(
    'planner agent: Idea Interview asks Goal, Scope, Constraints, Success criteria, Risk tolerance',
    /Goal/i.test(agent) && /Scope/i.test(agent) && /Constraints/i.test(agent) &&
    /Success criteria/i.test(agent) && /Risk tolerance/i.test(agent)
  );
  check(
    'planner agent: stop interview once unknowns can be bounded assumptions',
    /bounded assumptions/i.test(agent)
  );

  // ABSTAIN / REPLAN_REQUIRED discipline
  check(
    'planner agent: ABSTAIN or REPLAN_REQUIRED when evidence insufficient',
    /ABSTAIN/.test(agent) && /REPLAN_REQUIRED/.test(agent)
  );
  check(
    'planner agent: do not force a plan past the evidence',
    /do not force a plan past the evidence/i.test(agent)
  );

  // Hand off to native Copilot for implementation (no ControlFlow implementer agent)
  check(
    'planner agent: implementation is native Copilot job, no ControlFlow implementer agent',
    /native Copilot/i.test(agent) && /no ControlFlow implementer agent/i.test(agent)
  );

  // executor_agent is a per-phase role label, not a spawned agent
  check(
    'planner agent: executor_agent is a per-phase role label, not a spawned agent',
    /per-phase role label/i.test(agent)
  );

  // Schema: AssumptionVerifier/ExecutabilityVerifier NOT in executor_agent enum (review-only)
  const executorAgentEnum = schema?.properties?.phases?.items?.properties?.executor_agent?.enum ?? [];
  check(
    'planner schema: AssumptionVerifier-subagent NOT in executor_agent enum (review-only)',
    !executorAgentEnum.includes('AssumptionVerifier-subagent')
  );
  check(
    'planner schema: ExecutabilityVerifier-subagent NOT in executor_agent enum (review-only)',
    !executorAgentEnum.includes('ExecutabilityVerifier-subagent')
  );
  check(
    'planner schema: complexity_tier is in the top-level required array',
    Array.isArray(schema.required) && schema.required.includes('complexity_tier')
  );
  // Phase 2 re-anchor: the complexity_tier description in the schema still mentions Orchestrator
  // (a retired surface). We assert the surviving invariant — the description references
  // runtime-policy.json as the routing authority — without requiring "Orchestrator".
  check(
    'planner schema: complexity_tier description references runtime-policy.json as routing authority',
    schema?.properties?.complexity_tier?.description != null &&
    /runtime-policy\.json/i.test(schema.properties.complexity_tier.description)
  );
}

// ──────────────────────────────────────────────
// controlflow-verify skill — behavioral invariants
// ──────────────────────────────────────────────
console.log('\n=== controlflow-verify — Behavioral Invariants ===');
{
  const verify = readSkill('verify');
  const mirageRef = readSkillRef('verify', 'mirage-patterns.md');
  const policy = readRuntimePolicy();

  // Adversarial framing
  check(
    'verify skill: adversarial framing — job is to break the plan, not defend it',
    /break the plan/i.test(verify) && /steelman the rejection/i.test(verify)
  );
  check(
    'verify skill: default to flagged when evidence insufficient',
    /default to .?flagged/i.test(verify)
  );

  // Three phases + tier gating
  check(
    'verify skill: three phases (Structural Audit, Assumption/Mirage Check, Executability Cold-Start)',
    /Phase 1 — Structural Audit/.test(verify) &&
    /Phase 2 — Assumption \/ Mirage Check/.test(verify) &&
    /Phase 3 — Executability Cold-Start Simulation/.test(verify)
  );
  check(
    'verify skill: tier gating TRIVIAL skip, SMALL phase 1, MEDIUM phases 1–2, LARGE phases 1–3',
    /SMALL.*phase 1/i.test(verify) && /MEDIUM.*phases 1–2/i.test(verify) && /LARGE.*phases 1–3/i.test(verify)
  );
  check(
    'verify skill: unresolved HIGH-impact semantic risk runs all three regardless of tier',
    /HIGH-impact semantic risk/i.test(verify) && /all three/i.test(verify)
  );

  // Mirage taxonomy P1–P10 presence, A11–A17 absence
  const presenceIds = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'P9', 'P10'];
  const absenceIds = ['A11', 'A12', 'A13', 'A14', 'A15', 'A16', 'A17'];
  check(
    'verify skill: references mirage-patterns.md with P1–P10 and A11–A17',
    /P1–P10/.test(verify) && /A11–A17/.test(verify) && /mirage-patterns\.md/.test(verify)
  );
  check(
    'mirage-patterns.md: all 10 presence mirage ids P1–P10 present',
    presenceIds.every(id => new RegExp(`\\b${id}\\b`).test(mirageRef))
  );
  check(
    'mirage-patterns.md: all 7 absence mirage ids A11–A17 present',
    absenceIds.every(id => new RegExp(`\\b${id}\\b`).test(mirageRef))
  );
  check(
    'mirage-patterns.md: presence mirages section and absence mirages section both present',
    /Presence Mirages/.test(mirageRef) && /Absence Mirages/.test(mirageRef)
  );

  // Executability cold-start
  check(
    'verify skill: Phase 1 must execute without asking the user a question',
    /execute without asking the user a question/i.test(verify)
  );
  check(
    'verify skill: verification commands concrete enough to run as-is',
    /concrete enough to run as-is/i.test(verify)
  );
  check(
    'verify skill: destructive/migration phases need rollback; HIGH → human_approved_if_required, MEDIUM → safety_clear',
    /human_approved_if_required/i.test(verify) && /safety_clear/i.test(verify)
  );

  // Verdict logic: APPROVED / NEEDS_REVISION / REJECTED
  check(
    'verify skill: emits APPROVED verdict',
    /\bAPPROVED\b/.test(verify)
  );
  check(
    'verify skill: emits NEEDS_REVISION verdict',
    /NEEDS_REVISION/.test(verify)
  );
  check(
    'verify skill: emits REJECTED verdict',
    /\bREJECTED\b/.test(verify)
  );

  // Confidence caps (M4: runtime-policy.json is the single source of truth)
  const ct = policy?.verdict_routing?.confidence_thresholds;
  check(
    'runtime-policy verdict_routing.confidence_thresholds: ready_for_execution_min = 0.9',
    ct?.ready_for_execution_min === 0.9
  );
  check(
    'runtime-policy verdict_routing.confidence_thresholds: uncertain_count_cap = 0.85',
    ct?.uncertain_count_cap === 0.85
  );
  check(
    'runtime-policy verdict_routing.confidence_thresholds: high_impact_open_question_cap = 0.7',
    ct?.high_impact_open_question_cap === 0.7
  );
  check(
    'verify skill: uncertain ≥ 2 caps confidence at 0.85',
    /uncertain ≥ 2/i.test(verify) && /0\.85/.test(verify)
  );
  check(
    'verify skill: any HIGH-impact open question caps confidence at 0.7',
    /HIGH-impact open question/i.test(verify) && /0\.7/.test(verify)
  );

  // M4 cross-phase note: the verify SKILL.md restates the two caps its verdict logic
  // uses (0.85 uncertain cap, 0.7 HIGH-impact open-question cap). The 0.9
  // ready_for_execution_min is the planner's gate and is restated in the plan skill,
  // not the verify skill. Assert the numbers the verify skill does restate match
  // runtime-policy.json (record drift as a finding if mismatch). 0.9 is intentionally
  // not required here — its absence from the verify skill is correct, not drift.
  const verifyHas085 = /0\.85/.test(verify);
  const verifyHas07 = /0\.7/.test(verify);
  check(
    'M4: verify SKILL.md restates confidence caps 0.85 / 0.7 (matches runtime-policy.json; 0.9 is the planner gate, not restated here)',
    verifyHas085 && verifyHas07
  );

  // Verdict artifact written for auditability
  check(
    'verify skill: writes verdict artifact to plans/artifacts/<task-slug>/verify-verdict.md',
    /verify-verdict\.md/.test(verify)
  );

  // Read plan from disk, not chat
  check(
    'verify skill: reads the plan from disk — do not work from a chat-embedded copy',
    /read it from disk/i.test(verify) || /do not work from a chat-embedded copy/i.test(verify)
  );
  check(
    'verify skill: must not let the planner confidence substitute for own scoring',
    /do not let the planner'?s confidence/i.test(verify)
  );
}

// ──────────────────────────────────────────────
// controlflow-review skill — behavioral invariants
// ──────────────────────────────────────────────
console.log('\n=== controlflow-review — Behavioral Invariants ===');
{
  const review = readSkill('review');

  // Layer over native Copilot review, not a replacement
  check(
    'review skill: layer over native Copilot review, not a replacement',
    /layer over/i.test(review) && /not a\s+replacement/i.test(review)
  );

  // Native-pass delegation
  check(
    'review skill: delegates mechanical/style pass to native Copilot code review',
    /native Copilot code review/i.test(review) && /delegate/i.test(review)
  );
  check(
    'review skill: references security-review for security-focused work',
    /security-review/i.test(review)
  );
  check(
    'review skill: must not duplicate native Copilot code review mechanical pass',
    /do not duplicate native Copilot code review/i.test(review)
  );

  // ControlFlow layer: scope drift, evidence discipline, proactive vulnerability search
  check(
    'review skill: adds plan-vs-implementation scope-drift comparison',
    /scope.?drift/i.test(review) && /plan/i.test(review)
  );
  check(
    'review skill: adds evidence-backed finding discipline',
    /evidence/i.test(review) && /finding/i.test(review)
  );
  check(
    'review skill: adds proactive vulnerability/error search',
    /proactive/i.test(review) && /vulnerability/i.test(review)
  );

  // Scope drift detection detail
  check(
    'review skill: tracks planned-but-not-implemented and implemented-but-not-planned',
    /implemented but not planned/i.test(review) && /planned but not implemented/i.test(review)
  );
  check(
    'review skill: must not skip plan comparison when a plan artifact exists',
    /do not skip the plan comparison/i.test(review)
  );

  // Evidence labels
  check(
    'review skill: each finding labeled with severity, confidence, file, line, user impact, validation method',
    /severity/i.test(review) && /confidence/i.test(review) && /file/i.test(review) &&
    /line/i.test(review) && /user impact/i.test(review) && /validation method/i.test(review)
  );
  check(
    'review skill: Nit / Optional / FYI only after blocking findings',
    /Nit/.test(review) && /Optional/.test(review) && /FYI/.test(review) &&
    /only after blocking findings/i.test(review)
  );
  check(
    'review skill: soft labels must not hide correctness, security, or test-coverage defects',
    /must not hide/i.test(review)
  );

  // Structured text, not raw JSON (re-anchored from old Shared Policy section)
  check(
    'review skill: structured text output, not raw JSON',
    /structured text, not raw JSON/i.test(review)
  );

  // Findings first, ordered by severity
  check(
    'review skill: findings first, ordered by severity',
    /findings first/i.test(review) && /ordered by severity/i.test(review)
  );

  // Proactive absence mirage hunt A11–A13, A16, A17
  check(
    'review skill: proactive hunt references absence mirages A11–A13, A16, A17',
    /A11–A13/.test(review) && /A16/.test(review) && /A17/.test(review)
  );

  // ControlFlow keeps no agents of its own beyond the planner
  check(
    'review skill: ControlFlow keeps no agents of its own beyond the planner',
    /no agents of its own beyond the planner/i.test(readShared()) || /keeps no agents/i.test(readShared())
  );
}

// ──────────────────────────────────────────────
// Plan Template — Design Decisions section (kept)
// ──────────────────────────────────────────────
console.log('\n=== Plan Template — Design Decisions Section ===');
{
  const template = readTemplate();

  check('Template: "### Design Decisions" section heading present', /^### Design Decisions$/m.test(template));
  check('Template: "#### Architectural Choices" subsection present', /^#### Architectural Choices$/m.test(template));
  check('Template: "#### Boundary & Integration Points" subsection present', /^#### Boundary & Integration Points$/m.test(template));
  check('Template: "#### Temporal Flow" subsection present', /^#### Temporal Flow$/m.test(template));
  check('Template: "#### Constraints & Trade-offs" subsection present', /^#### Constraints & Trade-offs$/m.test(template));
  check('Template: Architecture Visualization — MEDIUM tier requires sequenceDiagram', /MEDIUM/i.test(template) && /sequenceDiagram/i.test(template));
  check('Template: Architecture Visualization — LARGE tier requires sequenceDiagram', /LARGE/i.test(template) && /sequenceDiagram/i.test(template));
  check('Template: Architecture Visualization — Baseline DAG for 3+ phases', /3\+?\s*phases/i.test(template) && /DAG/i.test(template));
  check(
    'Template: plan quality standards section with all key standard names',
    /Incremental/i.test(template) && /TDD/i.test(template) &&
    /Specific/i.test(template) && /Testable/i.test(template) && /Practical/i.test(template)
  );
}

// ──────────────────────────────────────────────
// Mermaid Scenario — medium-tier case (kept)
// ──────────────────────────────────────────────
console.log('\n=== Mermaid Scenario — medium-tier-requires-sequence-diagram ===');
{
  const scenario = loadScenario('planner-mermaid-output.json');
  const mediumInput = scenario.inputs?.find(i => i.label === 'medium-tier-requires-sequence-diagram');

  check('Mermaid scenario: medium-tier-requires-sequence-diagram input case exists', mediumInput != null);
  check(
    'Mermaid scenario: medium-tier expected.diagrams_must_include_types contains "flowchart"',
    Array.isArray(mediumInput?.expected?.diagrams_must_include_types) &&
    mediumInput.expected.diagrams_must_include_types.includes('flowchart')
  );
  check(
    'Mermaid scenario: medium-tier expected.diagrams_must_include_types contains "sequenceDiagram"',
    Array.isArray(mediumInput?.expected?.diagrams_must_include_types) &&
    mediumInput.expected.diagrams_must_include_types.includes('sequenceDiagram')
  );
}

// ──────────────────────────────────────────────
// Shared policy behavioral invariants (re-anchored subset)
// ──────────────────────────────────────────────
console.log('\n=== Shared Policy — Behavioral Invariants ===');
{
  const src = readShared();

  check(
    'Failure classification: transient, fixable, needs_replan, escalate',
    /transient/i.test(src) && /fixable/i.test(src) &&
    /needs_replan/i.test(src) && /escalate/i.test(src)
  );
  check(
    'NOTES.md: persistent state maintenance required',
    /NOTES\.md/i.test(src) && /persistent state/i.test(src)
  );
  check(
    'Complexity tiers: TRIVIAL / SMALL / MEDIUM / LARGE',
    /TRIVIAL/i.test(src) && /SMALL/i.test(src) && /MEDIUM/i.test(src) && /LARGE/i.test(src)
  );
  // P.A.R.T was a retired 13-agent-structure concept; the raw-JSON check is re-anchored
  // to the review skill above. Both old checks are intentionally retired (the slim stub
  // dropped P.A.R.T and the raw-JSON rule now lives in controlflow-review).
}

// ──────────────────────────────────────────────
// Slimmed runtime-policy — shape assertions
// ──────────────────────────────────────────────
console.log('\n=== Slimmed runtime-policy — Shape ===');
{
  const policy = readRuntimePolicy();
  const topKeys = Object.keys(policy).filter(k => !k.startsWith('_'));
  check(
    'runtime-policy: top-level keys are exactly review_pipeline_by_tier, semantic_risk_policy, verdict_routing',
    topKeys.length === 3 &&
    topKeys.includes('review_pipeline_by_tier') &&
    topKeys.includes('semantic_risk_policy') &&
    topKeys.includes('verdict_routing')
  );
  check(
    'runtime-policy: review_pipeline_by_tier has TRIVIAL/SMALL/MEDIUM/LARGE',
    policy.review_pipeline_by_tier &&
    ['TRIVIAL', 'SMALL', 'MEDIUM', 'LARGE'].every(t => policy.review_pipeline_by_tier[t])
  );
  check(
    'runtime-policy: semantic_risk_policy.categories has 7 categories',
    Array.isArray(policy.semantic_risk_policy?.categories) &&
    policy.semantic_risk_policy.categories.length === 7
  );
  check(
    'runtime-policy: verdict_routing.verdicts has APPROVED, NEEDS_REVISION, REJECTED',
    policy.verdict_routing?.verdicts &&
    policy.verdict_routing.verdicts.APPROVED &&
    policy.verdict_routing.verdicts.NEEDS_REVISION &&
    policy.verdict_routing.verdicts.REJECTED
  );
}

// ──────────────────────────────────────────────
// Fixture-driven behavior scenarios (8 fixtures)
// ──────────────────────────────────────────────
console.log('\n=== Fixture-Driven Behavior Scenarios ===');
{
  const policy = readRuntimePolicy();
  const schema = readSchema();

  // 1. planner-schema-output — schema conformance
  {
    const fx = loadScenario('planner-schema-output.json');
    check(
      'planner-schema-output: expected.schema is schemas/planner.plan.schema.json',
      fx.expected?.schema === 'schemas/planner.plan.schema.json'
    );
    check(
      'planner-schema-output: persisted_artifact + executor_agent required in all phases + artifact-first handoff',
      fx.expected?.persisted_artifact === true &&
      fx.expected?.executor_agent_required_in_all_phases === true &&
      fx.expected?.artifact_first_handoff === true &&
      fx.expected?.must_not_inline_plan_in_chat === true
    );
    check(
      'planner-schema-output: risk_review covers all categories + complexity tier present',
      fx.expected?.risk_review_covers_all_categories === true &&
      fx.expected?.complexity_tier_present === true
    );
  }

  // 2. planner-semantic-risk-seven-categories
  {
    const fx = loadScenario('planner-semantic-risk-seven-categories.json');
    const expectedCats = fx.expected?.categories;
    check(
      'planner-semantic-risk-seven-categories: 7 categories in canonical order',
      Array.isArray(expectedCats) && expectedCats.length === 7 &&
      expectedCats.every(c => ['data_volume', 'performance', 'concurrency', 'access_control', 'migration_rollback', 'dependency', 'operability'].includes(c))
    );
    check(
      'planner-semantic-risk-seven-categories: fixture categories deep-equal runtime-policy.semantic_risk_policy.categories',
      Array.isArray(expectedCats) &&
      Array.isArray(policy.semantic_risk_policy?.categories) &&
      expectedCats.length === policy.semantic_risk_policy.categories.length &&
      expectedCats.every((c, i) => c === policy.semantic_risk_policy.categories[i])
    );
    check(
      'planner-semantic-risk-seven-categories: schema risk_review.allOf has 7 const category entries',
      fx.expected?.schema_allOf_const_count === 7
    );
    check(
      'planner-semantic-risk-seven-categories: override_rule references HIGH + LARGE',
      /HIGH/i.test(fx.expected?.override_rule) && /LARGE/i.test(fx.expected?.override_rule)
    );
    // Cross-check schema risk_review allOf count
    const schemaAllOf = schema?.properties?.risk_review?.allOf;
    const schemaCatCount = Array.isArray(schemaAllOf) ? schemaAllOf.length : 0;
    check(
      'planner-semantic-risk-seven-categories: schema risk_review.allOf actually has 7 entries on disk',
      schemaCatCount === 7
    );
  }

  // 3. verify-mirage-detection
  {
    const fx = loadScenario('verify-mirage-detection.json');
    const presence = fx.expected?.presence_mirages ?? [];
    const absence = fx.expected?.absence_mirages ?? [];
    check(
      'verify-mirage-detection: 10 presence mirages P1–P10',
      Array.isArray(presence) && presence.length === 10 &&
      presence.every(m => /^P\d+$/.test(m.id))
    );
    check(
      'verify-mirage-detection: 7 absence mirages A11–A17',
      Array.isArray(absence) && absence.length === 7 &&
      absence.every(m => /^A1[1-7]$/.test(m.id))
    );
    check(
      'verify-mirage-detection: each mirage records claim, pattern, evidence, verdict',
      Array.isArray(fx.expected?.each_mirage_recorded_fields) &&
      fx.expected.each_mirage_recorded_fields.includes('claim') &&
      fx.expected.each_mirage_recorded_fields.includes('pattern') &&
      fx.expected.each_mirage_recorded_fields.includes('evidence') &&
      fx.expected.each_mirage_recorded_fields.includes('verdict')
    );
    check(
      'verify-mirage-detection: unconfirmable verdict is "uncertain" (not pass)',
      fx.expected?.unconfirmable_verdict === 'uncertain'
    );
  }

  // 4. verify-executability-cold-start
  {
    const fx = loadScenario('verify-executability-cold-start.json');
    check(
      'verify-executability-cold-start: Phase 1 executable without user question',
      fx.expected?.phase_1_executable_without_user_question === true
    );
    check(
      'verify-executability-cold-start: verification commands concrete + destructive phases have rollback',
      fx.expected?.verification_commands_concrete === true &&
      fx.expected?.destructive_phases_have_rollback === true
    );
    check(
      'verify-executability-cold-start: HIGH blast radius → human_approved_if_required, MEDIUM → safety_clear',
      fx.expected?.high_blast_radius_gate === 'human_approved_if_required' &&
      fx.expected?.medium_blast_radius_gate === 'safety_clear'
    );
    check(
      'verify-executability-cold-start: inter-phase contract format explicit + downstream validates',
      fx.expected?.inter_phase_contract_format_explicit === true &&
      fx.expected?.downstream_validates_deliverable === true
    );
  }

  // 5. verify-verdict-logic
  {
    const fx = loadScenario('verify-verdict-logic.json');
    const verdicts = fx.expected?.verdicts ?? {};
    check(
      'verify-verdict-logic: fixture verdicts has APPROVED, NEEDS_REVISION, REJECTED',
      verdicts.APPROVED && verdicts.NEEDS_REVISION && verdicts.REJECTED
    );
    check(
      'verify-verdict-logic: fixture verdicts deep-equal runtime-policy.verdict_routing.verdicts',
      policy.verdict_routing?.verdicts &&
      verdicts.APPROVED === policy.verdict_routing.verdicts.APPROVED &&
      verdicts.NEEDS_REVISION === policy.verdict_routing.verdicts.NEEDS_REVISION &&
      verdicts.REJECTED === policy.verdict_routing.verdicts.REJECTED
    );
    const caps = fx.expected?.confidence_caps ?? {};
    check(
      'verify-verdict-logic: confidence_caps match runtime-policy.confidence_thresholds (0.9 / 0.85 / 0.7)',
      caps.ready_for_execution_min === 0.9 &&
      caps.uncertain_count_cap === 0.85 &&
      caps.high_impact_open_question_cap === 0.7
    );
    check(
      'verify-verdict-logic: uncertain threshold for cap is 2',
      fx.expected?.uncertain_threshold_for_cap === 2
    );
    check(
      'verify-verdict-logic: must not substitute planner confidence',
      fx.expected?.must_not_substitute_planner_confidence === true
    );
  }

  // 6. review-scope-drift
  {
    const fx = loadScenario('review-scope-drift.json');
    check(
      'review-scope-drift: compares implementation to plan',
      fx.expected?.compares_implementation_to_plan === true
    );
    check(
      'review-scope-drift: scope drift finding types include planned-but-not-implemented and implemented-but-not-planned',
      Array.isArray(fx.expected?.scope_drift_finding_types) &&
      fx.expected.scope_drift_finding_types.includes('planned_but_not_implemented') &&
      fx.expected.scope_drift_finding_types.includes('implemented_but_not_planned')
    );
    check(
      'review-scope-drift: scope drift is a review issue not a style preference',
      fx.expected?.scope_drift_is_review_issue_not_style === true
    );
    check(
      'review-scope-drift: must not skip plan comparison when plan exists',
      fx.expected?.does_not_skip_plan_comparison_when_plan_exists === true
    );
  }

  // 7. review-evidence-labels
  {
    const fx = loadScenario('review-evidence-labels.json');
    const requiredFields = fx.expected?.finding_required_fields ?? [];
    check(
      'review-evidence-labels: finding required fields include severity, confidence, file, line, user_impact, validation_method',
      requiredFields.includes('severity') && requiredFields.includes('confidence') &&
      requiredFields.includes('file') && requiredFields.includes('line') &&
      requiredFields.includes('user_impact') && requiredFields.includes('validation_method')
    );
    check(
      'review-evidence-labels: soft labels Nit/Optional/FYI only after blocking findings',
      fx.expected?.soft_labels_only_after_blocking_findings === true
    );
    check(
      'review-evidence-labels: soft labels must not hide correctness/security/test-coverage',
      fx.expected?.soft_labels_must_not_hide_correctness_security_or_test_coverage === true
    );
    check(
      'review-evidence-labels: structured text not raw JSON',
      fx.expected?.structured_text_not_raw_json === true
    );
  }

  // 8. review-native-pass-delegation
  {
    const fx = loadScenario('review-native-pass-delegation.json');
    check(
      'review-native-pass-delegation: native review delegated',
      fx.expected?.native_review_delegated === true
    );
    check(
      'review-native-pass-delegation: native review tools include native Copilot code review and security-review',
      Array.isArray(fx.expected?.native_review_tools) &&
      fx.expected.native_review_tools.includes('native Copilot code review') &&
      fx.expected.native_review_tools.includes('security-review')
    );
    check(
      'review-native-pass-delegation: ControlFlow layer adds scope-drift, evidence discipline, proactive vulnerability search',
      Array.isArray(fx.expected?.controlflow_layer_added) &&
      fx.expected.controlflow_layer_added.length === 3
    );
    check(
      'review-native-pass-delegation: mechanical pass not duplicated',
      fx.expected?.mechanical_pass_not_duplicated === true
    );
    check(
      'review-native-pass-delegation: ControlFlow keeps no agents beyond planner',
      fx.expected?.controlflow_keeps_no_agents_beyond_planner === true
    );
  }
}

// ──────────────────────────────────────────────
// Summary
// ──────────────────────────────────────────────
console.log(`\n${'═'.repeat(50)}`);
console.log(`Behavior Contract: ${passed + failed}  |  Passed: ${passed}  |  Failed: ${failed}`);
console.log(`${'═'.repeat(50)}\n`);

if (failed > 0) {
  console.log('Behavior contract regression detected ❌');
  process.exit(1);
} else {
  console.log('All behavior contract checks passed ✅');
  process.exit(0);
}