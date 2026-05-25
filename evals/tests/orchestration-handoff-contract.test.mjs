/**
 * ControlFlow — Orchestration Handoff Contract Regression Tests
 *
 * Verifies that the Orchestrator agent preserves handoff discipline,
 * review gating, escalation thresholds, and delegation routing invariants.
 *
 * Separate from prompt-behavior-contract tests because handoff discipline
 * is concentrated in a single agent (Orchestrator) with complex state-machine
 * requirements that justify dedicated coverage.
 *
 * Exit 0 on all checks passed, exit 1 on any failure.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { REQUIRED_MODEL_RESOLUTION_NEGATIVE_CASES } from '../drift-checks.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

// ──────────────────────────────────────────────
// Model routing resolver — source-of-truth helper
// Derives expected model values from governance/model-routing.json
// instead of hard-coding model names in assertions.
// ──────────────────────────────────────────────
const modelRouting = JSON.parse(
  readFileSync(join(ROOT, 'governance', 'model-routing.json'), 'utf8')
);
const runtimePolicy = JSON.parse(
  readFileSync(join(ROOT, 'governance', 'runtime-policy.json'), 'utf8')
);

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractBetween(text, startMarker, endMarker) {
  const startIndex = text.indexOf(startMarker);
  if (startIndex === -1) return '';
  const endIndex = text.indexOf(endMarker, startIndex + startMarker.length);
  return endIndex === -1 ? text.slice(startIndex) : text.slice(startIndex, endIndex);
}

function withoutProperty(obj, key) {
  const copy = { ...obj };
  delete copy[key];
  return copy;
}

/**
 * Resolve the effective { primary, fallbacks } for a role+tier.
 * Handles inherit_from: "default" by falling back to the role's top-level values.
 */
function resolveRoleModel(role, tier) {
  const roleDef = modelRouting.roles[role];
  if (!roleDef) return { primary: null, fallbacks: [] };
  const byTier = roleDef.by_tier?.[tier] ?? {};
  if (byTier.inherit_from === 'default' || (!byTier.primary && !byTier.fallbacks)) {
    return { primary: roleDef.primary, fallbacks: roleDef.fallbacks ?? [] };
  }
  return {
    primary: byTier.primary ?? roleDef.primary,
    fallbacks: byTier.fallbacks ?? roleDef.fallbacks ?? [],
  };
}

// Agent → role index for the four review agents
const agentRoleIndex = {
  'CodeReviewer-subagent':          'capable-reviewer',
  'PlanAuditor-subagent':           'capable-reviewer',
  'AssumptionVerifier-subagent':    'capable-reviewer',
  'ExecutabilityVerifier-subagent': 'review-readonly',
};

// Pre-resolved values used in assertions (derived from governance/model-routing.json)
const _capableReviewer       = resolveRoleModel('capable-reviewer', 'MEDIUM');
const capableReviewerPrimary  = _capableReviewer.primary;       // e.g. Claude Sonnet 4.6 (copilot) for MEDIUM
const capableReviewerFallback0 = _capableReviewer.fallbacks[0]; // e.g. GPT-5.4 (copilot) for MEDIUM
const orchestratorDefaultPrimary = resolveRoleModel('orchestration-capable', 'MEDIUM').primary; // e.g. Claude Sonnet 4.6 (copilot)
const evPrimary = resolveRoleModel(agentRoleIndex['ExecutabilityVerifier-subagent'], 'LARGE').primary; // e.g. Claude Sonnet 4.6 (copilot)
const _capableReviewerLarge    = resolveRoleModel('capable-reviewer', 'LARGE');
const capableReviewerLargePrimary  = _capableReviewerLarge.primary;       // e.g. Claude Opus 4.7 (copilot)
const capableReviewerLargeFallback0 = _capableReviewerLarge.fallbacks[0]; // e.g. GPT-5.5 (copilot)

const capableImplementerTrivialPrimary = resolveRoleModel('capable-implementer', 'TRIVIAL').primary;
const capableImplementerLargePrimary = resolveRoleModel('capable-implementer', 'LARGE').primary;
const documentationTrivialPrimary = resolveRoleModel('documentation', 'TRIVIAL').primary;

// Pre-resolved planner role values (derived from governance/model-routing.json)
const _capablePlanner         = resolveRoleModel('capable-planner', 'MEDIUM');
const capablePlannerPrimary   = _capablePlanner.primary;        // GPT-5.5 (copilot)
const capablePlannerFallback0 = _capablePlanner.fallbacks[0];   // Claude Opus 4.7 (copilot)
const capablePlannerFallback1 = _capablePlanner.fallbacks[1];   // GPT-5.4 mini (copilot)
const fastReadonlyPrimary = resolveRoleModel(modelRouting.agent_role_index['CodeMapper-subagent'], 'MEDIUM').primary;
const researchCapableLargePrimary = resolveRoleModel(modelRouting.agent_role_index['Researcher-subagent'], 'LARGE').primary;

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

const orch = readFileSync(join(ROOT, 'Orchestrator.agent.md'), 'utf8');
const planner = readFileSync(join(ROOT, 'Planner.agent.md'), 'utf8');
const delegationProtocolSchema = JSON.parse(
  readFileSync(join(ROOT, 'schemas', 'orchestrator.delegation-protocol.schema.json'), 'utf8')
);
const ajv = new Ajv2020({ strict: false, allErrors: true });
addFormats(ajv);
const plannerDelegationPayloadSchema = delegationProtocolSchema.properties?.agents?.properties?.Planner;
const validatePlannerDelegationPayload = ajv.compile({
  ...plannerDelegationPayloadSchema,
  $defs: delegationProtocolSchema.$defs ?? {},
});
const orchestratorDispatchContract = extractBetween(
  orch,
  '### Dispatch Tool-Call Contract (Required Fields)',
  '#### Capable-Reviewer Model Routing'
);
const universalModelResolutionRule = extractBetween(
  orch,
  '### Universal Model Resolution Rule',
  '### Initial Planner Dispatch Gate'
);
const plannerResearchDispatchRule = extractBetween(
  planner,
  '6. Research (delegate CodeMapper-subagent/Researcher-subagent when scope is large).',
  '7. Design'
);

check(
  'Runtime policy: model_dispatch.default_mode exists and defaults to deterministic',
  runtimePolicy?.model_dispatch?.default_mode === 'deterministic'
);

check(
  'Runtime policy: model_dispatch.auto_mode_allow_outer_model_omission is enabled',
  runtimePolicy?.model_dispatch?.auto_mode_allow_outer_model_omission === true
);

// ──────────────────────────────────────────────
// PLAN_REVIEW gate invariants
// ──────────────────────────────────────────────
console.log('\n=== Orchestrator — PLAN_REVIEW Gate ===');

// No implicit approval from Planner handoff
check(
  'Handoff ≠ approval: plan_path does not bypass PLAN_REVIEW',
  /plan.*artifact.*not.*implicit.*approval|plan_path.*does not bypass/i.test(orch)
);

// Four-way OR trigger conditions
check(
  'Trigger: ≥ min_phases phases condition present',
  /min_phases|≥.*phases/i.test(orch)
);
check(
  'Trigger source: runtime-policy is authoritative for PLAN_REVIEW gate conditions',
  /authoritative source.*runtime-policy\.json.*plan_review_gate_trigger_conditions|runtime-policy\.json.*plan_review_gate_trigger_conditions.*authoritative/i.test(orch)
);
check(
  'Trigger: confidence < threshold condition present',
  /confidence.*threshold|confidence.*0\.9/i.test(orch)
);
check(
  'Trigger: destructive/high-risk scope condition present',
  /destructive.*high.risk|high.risk.*operations/i.test(orch)
);
check(
  'Trigger: risk_review applicable + HIGH + unresolved condition present',
  /applicable.*risk_review.*HIGH.*not.*resolved/i.test(orch)
);

check(
  'Required PLAN_REVIEW: ABSTAIN on required review retries once then escalates to user',
  /required.*PLAN_REVIEW.*ABSTAIN.*retry.*WAITING_APPROVAL|ABSTAIN.*required.*PLAN_REVIEW.*retry.*WAITING_APPROVAL/i.test(orch)
);

// ──────────────────────────────────────────────
// Complexity-aware delegation routing
// ──────────────────────────────────────────────
console.log('\n=== Orchestrator — Complexity-Aware Routing ===');

check(
  'TRIVIAL: skips PLAN_REVIEW entirely',
  /TRIVIAL.*skip.*PLAN_REVIEW|TRIVIAL.*no.*PlanAuditor/i.test(orch)
);
check(
  'SMALL: PlanAuditor only, max 2 iterations',
  /SMALL.*PlanAuditor.*only|SMALL.*max 2/i.test(orch)
);
check(
  'MEDIUM: PlanAuditor + AssumptionVerifier parallel',
  /MEDIUM.*PlanAuditor.*AssumptionVerifier/i.test(orch)
);
check(
  'LARGE: full pipeline — all 3 reviewers',
  /LARGE.*full pipeline|LARGE.*PlanAuditor.*AssumptionVerifier.*ExecutabilityVerifier/i.test(orch)
);

// ──────────────────────────────────────────────
// Iterative review loop constraints
// ──────────────────────────────────────────────
console.log('\n=== Orchestrator — Review Loop ===');

// Max 5 iterations
check(
  'Review loop: max_iterations are sourced from runtime-policy tiers',
  /max_iterations_by_tier|up to `max_iterations`|iteration_index.*max_iterations/i.test(orch)
);
check(
  'Review loop source: State Machine defers detailed PLAN_REVIEW flow to Execution Protocol',
  /State Machine[\s\S]*Execution Protocol §4|detailed PLAN_REVIEW flow.*Execution Protocol|Execution Protocol section 4.*PLAN_REVIEW/i.test(orch)
);

// Convergence detection: 5% threshold
check(
  'Convergence: 5% improvement stagnation threshold',
  /5%.*improvement|improvement.*5%|stagnation/i.test(orch)
);

// Stagnation gate at 3+ iterations
check(
  'Stagnation: detected at iteration_index ≥ 3',
  /iteration_index.*3|iteration.*3.*stagnation|≥ 3/i.test(orch)
);

check(
  'Revision loop: sensitive or ambiguous changes fall back to full rerun',
  /full rerun/i.test(orch) &&
  /Planner\.agent\.md|Planner/i.test(orch) &&
  /Orchestrator\.agent\.md|Orchestrator/i.test(orch) &&
  /runtime-policy\.json/i.test(orch) &&
  /review routing/i.test(orch) &&
  /verification commands/i.test(orch) &&
  /policy surfaces/i.test(orch) &&
  /phase structure/i.test(orch) &&
  /task or file paths|task\/file paths|file paths/i.test(orch) &&
  /contracts/i.test(orch) &&
  /risk_review/i.test(orch) &&
  /complexity_tier/i.test(orch) &&
  /executability-bearing/i.test(orch) &&
  /ambiguous/i.test(orch)
);

check(
  'Revision loop: selective rerun is limited to reviewer-local wording or evidence citations only',
  /selective rerun/i.test(orch) &&
  /reviewer-local summary wording/i.test(orch) &&
  /evidence-citation text only/i.test(orch) &&
  /no changes to plan artifacts, prompts, policy surfaces, tests, routing, commands|no plan\/prompt\/policy\/test\/routing\/command changes/i.test(orch)
);

check(
  'Revision loop: closed-world reruns default to full rerun outside the narrow exception',
  /does not match the narrow selective exception exactly|if a revision does not match.*selective exception.*full rerun|closed-world rule/i.test(orch)
);

check(
  'Revision loop: ExecutabilityVerifier is never bypassed when current tier or risk override keeps it in scope',
  /ExecutabilityVerifier/i.test(orch) &&
  /never bypass/i.test(orch) &&
  /current tier/i.test(orch) &&
  /risk override/i.test(orch) &&
  /in scope/i.test(orch)
);

// ──────────────────────────────────────────────
// Failure classification and escalation
// ──────────────────────────────────────────────
console.log('\n=== Orchestrator — Failure Handling ===');

// All 4 failure classifications with routing
check(
  'Failure routing: transient → retry (budget 3)',
  /transient.*retry|transient.*3/i.test(orch)
);
check(
  'Failure routing: fixable → retry with fix hint (budget 1)',
  /fixable.*retry.*fix hint|fixable.*1/i.test(orch)
);
check(
  'Failure routing: needs_replan → delegate to Planner',
  /needs_replan.*Planner|needs_replan.*replan/i.test(orch)
);
check(
  'Failure routing: escalate → STOP + WAITING_APPROVAL',
  /escalate.*STOP|escalate.*WAITING_APPROVAL/i.test(orch)
);

check(
  'Failure routing: model_unavailable → retry up to retry_budgets.model_unavailable_max then escalate',
  /model_unavailable.*retry.*model_unavailable_max/i.test(orch)
);

// 3-strike escalation policy
check(
  'Escalation: 3 failures with same classification → escalate to user',
  /same.*failure_classification.*escalate|fails 3 times.*same.*escalate/i.test(orch)
);

// ──────────────────────────────────────────────
// Phase verification checklist (blocking)
// ──────────────────────────────────────────────
console.log('\n=== Orchestrator — Phase Verification ===');

check(
  'Phase verification: tests pass required',
  /Phase Verification.*Mandatory|tests pass/i.test(orch) && /Tests pass/i.test(orch)
);
check(
  'Phase verification: build state PASS required',
  /build.*PASS|Build passes/i.test(orch)
);
check(
  'Phase verification: lint/problems clean required',
  /lint.*clean|problems clean/i.test(orch)
);
check(
  'Phase verification: review APPROVED required',
  /review.*APPROVED/i.test(orch)
);
check(
  'Phase verification: CodeReviewer-subagent explicitly named as code review delegate in implementation loop',
  /Delegate to CodeReviewer-subagent/i.test(orch)
);
check(
  'Phase verification: code review mandatory for all tiers with runtime-policy reference',
  /mandatory for all.*tiers|review_pipeline_by_tier.*code_review/i.test(orch)
);

// ──────────────────────────────────────────────
// Todo lifecycle (blocking prerequisite)
// ──────────────────────────────────────────────
console.log('\n=== Orchestrator — Todo Lifecycle ===');

const todoScenario = JSON.parse(
  readFileSync(join(ROOT, 'evals', 'scenarios', 'orchestrator-todo-orchestration.json'), 'utf8')
);
const todoResumeScenario = JSON.parse(
  readFileSync(join(ROOT, 'evals', 'scenarios', 'orchestrator-todo-resume-reconciliation.json'), 'utf8')
);
const todoExpected = todoScenario.expected ?? {};
const todoCalls = todoExpected.todo_tool_calls ?? {};
const resumeExpected = todoResumeScenario.expected ?? {};
const resumeCalls = resumeExpected.todo_tool_calls ?? {};
const todoNegativeCases = [
  ...(todoExpected.negative_cases ?? []),
  ...(resumeExpected.negative_cases ?? []),
];

check(
  'Todo scenario: phase review pass requires one #todos completion before approval pause',
  todoCalls.on_phase_review_pass?.tool === '#todos' &&
  todoCalls.on_phase_review_pass?.action === 'complete' &&
  todoCalls.on_phase_review_pass?.one_completion_call_per_phase === true &&
  todoCalls.on_phase_review_pass?.count_per_review_pass === 1 &&
  todoCalls.on_phase_review_pass?.must_occur_after === 'phase_review_gate_pass' &&
  todoCalls.on_phase_review_pass?.must_occur_before === 'approval_pause' &&
  todoCalls.on_phase_review_pass?.must_not_batch_with_other_phases === true
);

check(
  'Todo scenario: plan completion reconciles all phase todos before summary',
  todoCalls.on_plan_completion?.tool === '#todos' &&
  todoCalls.on_plan_completion?.action === 'reconcile' &&
  todoCalls.on_plan_completion?.all_todos_completed === true &&
  todoCalls.on_plan_completion?.must_not_produce_summary_with_open_todos === true
);

check(
  'Todo scenario: open prior phase todo blocks P2/P3 start until #todos reconciliation',
  todoCalls.on_prior_phase_open_before_next_phase_start?.tool === '#todos' &&
  todoCalls.on_prior_phase_open_before_next_phase_start?.blocks_next_phase_start === true &&
  todoCalls.on_prior_phase_open_before_next_phase_start?.must_occur_before_next_phase_start === true &&
  todoCalls.on_prior_phase_open_before_next_phase_start?.applicable_phase_transitions?.includes('P1→P2') === true &&
  todoCalls.on_prior_phase_open_before_next_phase_start?.applicable_phase_transitions?.includes('P1→P3') === true &&
  todoExpected.pre_phase_open_todo_reconcile_required?.if_prior_phase_todo_is_open === true
);

check(
  'Todo resume scenario: compaction/resume reconciliation includes active Phase 1 before work resumes',
  todoResumeScenario.input?.resume_context?.active_phase_id === 'P1' &&
  resumeCalls.on_resume_or_compaction?.tool === '#todos' &&
  resumeCalls.on_resume_or_compaction?.action === 'reconcile' &&
  resumeCalls.on_resume_or_compaction?.must_be_first_action_after_resume === true &&
  resumeCalls.on_resume_or_compaction?.must_occur_before_phase_work_resumes === true &&
  resumeExpected.pre_phase_open_todo_reconcile_required?.active_phase_1_included === true
);

for (const caseId of [
  'no-batching-phase-completions',
  'resume-active-phase-1-after-compaction',
  'open-prior-todo-blocks-next-phase',
]) {
  const negativeCase = todoNegativeCases.find(c => c.case_id === caseId);
  check(
    `Todo negative scenario: ${caseId} is rejected`,
    negativeCase?.expected?.rejected === true && negativeCase?.expected?.violates === caseId
  );
}

check(
  'Orchestrator: phase review pass completion is a separate #todos call before approval pause',
  /phase review gate passes[\s\S]{0,240}#todos[\s\S]{0,240}before.*approval pause|#todos[\s\S]{0,240}after.*phase review gate passes[\s\S]{0,240}before.*approval pause/i.test(orch)
);

check(
  'Orchestrator: no batching of phase todo completions is explicit',
  /No batching of completions[\s\S]{0,500}own `#todos` call[\s\S]{0,500}bulk update|No batching of todo completions[\s\S]{0,500}separate `#todos` call/i.test(orch)
);

check(
  'Orchestrator: resume reconciliation is first action and explicitly includes active Phase 1',
  /first action before any other phase work[\s\S]{0,500}Phase 1|Phase 1[\s\S]{0,500}first action before any other phase work/i.test(orch)
);

check(
  'Orchestrator: no phase or wave advancement with open prior todos',
  /open prior phase todo[\s\S]{0,500}before.*phase or wave advancement|phase or wave advancement[\s\S]{0,500}open prior phase todo/i.test(orch)
);

// ──────────────────────────────────────────────
// Observability: trace ID propagation
// ──────────────────────────────────────────────
console.log('\n=== Orchestrator — Observability ===');

check(
  'Trace ID: UUID v4 generated at task start',
  /trace_id.*UUID.*v4|trace_id.*uuid/i.test(orch)
);
check(
  'Trace ID: propagated to all gate events and delegations',
  /propagate.*gate.*event|propagate.*delegation/i.test(orch)
);

// ──────────────────────────────────────────────
// Planner revision payload contract
// ──────────────────────────────────────────────
console.log('\n=== Orchestrator — Planner Revision Payload Contract ===');
{
  const plannerRequired = plannerDelegationPayloadSchema.required ?? [];
  const basePlannerPayload = {
    task_description: 'Create an implementation plan for a focused eval migration.',
    model: capablePlannerPrimary,
  };
  const validInPlacePayload = {
    ...basePlannerPayload,
    trace_id: '550e8400-e29b-41d4-a716-446655440100',
    iteration_index: 2,
    revision_mode: 'in_place_update',
    revision_reason: 'Address PLAN_REVIEW findings PA-MAJOR-1 and AV-BLOCKING-2.',
    active_plan_path: 'plans/active-plan.md',
  };
  const validSupersessionPayload = {
    ...basePlannerPayload,
    trace_id: '550e8400-e29b-41d4-a716-446655440101',
    iteration_index: 3,
    revision_mode: 'new_artifact_supersession',
    revision_reason: 'Material architecture pivot requires a citable replacement plan.',
    existing_plan_path: 'plans/active-plan.md',
  };

  check(
    'Delegation schema: base Planner payload does not unconditionally require trace_id',
    !plannerRequired.includes('trace_id') && validatePlannerDelegationPayload(basePlannerPayload)
  );
  check(
    'Delegation schema: base Planner payload does not unconditionally require revision_mode',
    !plannerRequired.includes('revision_mode') && validatePlannerDelegationPayload(basePlannerPayload)
  );
  check(
    'Delegation schema: in_place_update requires trace_id',
    !validatePlannerDelegationPayload(withoutProperty(validInPlacePayload, 'trace_id'))
  );
  check(
    'Delegation schema: in_place_update requires review-loop iteration_index',
    !validatePlannerDelegationPayload(withoutProperty(validInPlacePayload, 'iteration_index'))
  );
  check(
    'Delegation schema: in_place_update requires active_plan_path and accepts the complete payload',
    !validatePlannerDelegationPayload(withoutProperty(validInPlacePayload, 'active_plan_path')) &&
    validatePlannerDelegationPayload(validInPlacePayload)
  );
  check(
    'Delegation schema: new_artifact_supersession requires existing_plan_path and accepts the complete payload',
    !validatePlannerDelegationPayload(withoutProperty(validSupersessionPayload, 'existing_plan_path')) &&
    validatePlannerDelegationPayload(validSupersessionPayload)
  );
  check(
    'Planner replan/update dispatch: prompt requires trace_id, iteration_index, revision_mode, revision_reason, and selected path field before active-plan edits',
    /Planner payload must include payload-level `model`, `trace_id`, review-loop `iteration_index`, `revision_mode`, `revision_reason`/i.test(orch) &&
    /active_plan_path` for `in_place_update` or `existing_plan_path` for `new_artifact_supersession`/i.test(orch) &&
    /edit only the supplied `active_plan_path`/i.test(planner)
  );
  check(
    'Planner write dispatch: Orchestrator serializes same trace_id and active_plan_path revisions',
    /Serialize write-capable Planner revisions by[\s\S]{0,80}trace_id[\s\S]{0,80}active_plan_path/i.test(orch) &&
    /Never run two write-capable Planner updates to the same plan in parallel/i.test(orch)
  );
}

// ──────────────────────────────────────────────
// Gate-event schema contract (F4)
// ──────────────────────────────────────────────
console.log('\n=== Orchestrator — Gate-Event Schema Contract ===');
{
  const gateEventSchema = JSON.parse(
    readFileSync(join(ROOT, 'schemas', 'orchestrator.gate-event.schema.json'), 'utf8')
  );
  check(
    'Gate-event schema: trace_id is in the required array (mandatory per Orchestrator prompt)',
    Array.isArray(gateEventSchema.required) && gateEventSchema.required.includes('trace_id')
  );
  check(
    'Gate-event schema: iteration_index is in the required array (mandatory per Orchestrator prompt)',
    Array.isArray(gateEventSchema.required) && gateEventSchema.required.includes('iteration_index')
  );
  check(
    'Gate-event schema: max_iterations is in the required array (mandatory per Orchestrator prompt)',
    Array.isArray(gateEventSchema.required) && gateEventSchema.required.includes('max_iterations')
  );
}

// ──────────────────────────────────────────────
// Batch Approval Policy
// ──────────────────────────────────────────────
console.log('\n=== Orchestrator — Batch Approval Policy ===');
{
  const runtimePolicy = JSON.parse(
    readFileSync(join(ROOT, 'governance', 'runtime-policy.json'), 'utf8')
  );
  check(
    'Runtime policy: batch_approval.approval_per is "wave"',
    runtimePolicy.batch_approval?.approval_per === 'wave'
  );
  check(
    'Runtime policy: retry_budgets contains model_unavailable_max',
    'model_unavailable_max' in (runtimePolicy.retry_budgets ?? {})
  );
  check(
    'Orchestrator: batch approval section specifies one approval per wave, not per phase',
    /ONE approval request per wave/i.test(orch)
  );
  check(
    'Orchestrator: batch approval exception for destructive operations requires per-phase approval',
    /exception.*destructive.*per.?phase|destructive.*production.*per.?phase/i.test(orch)
  );
}

// ──────────────────────────────────────────────
// Stopping Rules Harmonization (Phase 6)
// ──────────────────────────────────────────────
console.log('\n=== Orchestrator — Stopping Rules Harmonization ===');

check(
  'Stopping rules: wave-level approval for ordinary phases, per-phase only for destructive/high-risk or failed/blocked',
  /After each wave.*Batch Approval/i.test(orch) &&
  /per.phase.*destructive|destructive.*per.phase/i.test(orch)
);

check(
  'Stopping rules: code review and todo completion remain per-phase even in batch-approval waves',
  /per.phase.*regardless of wave|code review.*per.phase|CodeReviewer.*per.phase/i.test(orch)
);

// ──────────────────────────────────────────────
// Delegation protocol: parallel dispatch
// ──────────────────────────────────────────────
console.log('\n=== Orchestrator — Delegation Protocol ===');

check(
  'Parallel dispatch: PlanAuditor + AssumptionVerifier dispatched in parallel',
  /PlanAuditor.*AssumptionVerifier.*parallel|parallel.*PlanAuditor.*AND.*AssumptionVerifier|dispatch.*parallel/i.test(orch)
);
check(
  'Sequential gating: ExecutabilityVerifier runs after PlanAuditor approval',
  /ExecutabilityVerifier[\s\S]*after[\s\S]*PlanAuditor|PlanAuditor[\s\S]*APPROVED[\s\S]*dispatch[\s\S]*ExecutabilityVerifier/i.test(orch)
);

// ──────────────────────────────────────────────
// Agent delegation roster invariants (Phase 3)
// ──────────────────────────────────────────────
console.log('\n=== Orchestrator — Agent Delegation Roster ===');

// Parse agents: frontmatter from Orchestrator
const orchAgentsMatch = orch.match(/^agents:\s*\[(.*)\]$/m);
const orchAgentEntries = orchAgentsMatch
  ? orchAgentsMatch[1].split(',').map(x => x.trim().replace(/^["']|["']$/g, '')).filter(Boolean)
  : [];

// Load governance manifest for exact roster comparison
const agentGrants = JSON.parse(
  readFileSync(join(ROOT, 'governance', 'agent-grants.json'), 'utf8')
);
const manifestRoster = agentGrants['Orchestrator.agent.md'] ?? [];

check(
  'Agents frontmatter: matches governance/agent-grants.json manifest exactly',
  orchAgentEntries.length === manifestRoster.length &&
  orchAgentEntries.every(a => manifestRoster.includes(a)) &&
  manifestRoster.every(a => orchAgentEntries.includes(a))
);
check(
  'Agents frontmatter: no wildcard "*" in roster or manifest',
  !orchAgentEntries.includes('*') && !manifestRoster.includes('*')
);
check(
  'Delegation policy: external or third-party agents explicitly prohibited in prompt text',
  /External or third-party agents are prohibited/i.test(orch)
);
check(
  'Delegation policy: all targets must be Planner or project-internal subagents',
  /All delegation must target.*Planner.*or a project subagent/i.test(orch)
);

// ──────────────────────────────────────────────
// HIGH-risk review override invariants (Phase 3)
// ──────────────────────────────────────────────
console.log('\n=== Orchestrator — HIGH-Risk Review Override ===');

check(
  'HIGH-risk override: risk_review HIGH-impact applicable entry forces full pipeline regardless of tier',
  /force full pipeline regardless of tier/i.test(orch)
);
check(
  'HIGH-risk override: override is documented within the Plan Review Gate section',
  /applicable.*risk_review.*HIGH.*not.*resolved/i.test(orch)
);
check(
  'HIGH-risk override: override escalates even TRIVIAL-tier plans to full reviewer pipeline',
  /force full pipeline regardless of tier/i.test(orch) &&
  /TRIVIAL.*skip.*PLAN_REVIEW|TRIVIAL.*no.*PlanAuditor/i.test(orch)
);

// Scenario fixture: resolved-HIGH negative case and unresolved-HIGH positive cases
const overrideScenario = JSON.parse(
  readFileSync(join(ROOT, 'evals', 'scenarios', 'orchestrator-high-risk-review-override.json'), 'utf8')
);
const resolvedHighCase = overrideScenario.inputs.find(
  i => i.input.risk_review?.some(r => r.applicability === 'applicable' && r.impact === 'HIGH' && r.disposition === 'resolved')
);
const unresolvedHighCases = overrideScenario.inputs.filter(
  i => i.input.risk_review?.some(r => r.applicability === 'applicable' && r.impact === 'HIGH' && r.disposition !== 'resolved')
);
check(
  'HIGH-risk scenario: resolved HIGH disposition does NOT trigger override',
  resolvedHighCase !== undefined && resolvedHighCase.expected.override_triggered === false
);
check(
  'HIGH-risk scenario: all unresolved-HIGH cases trigger override',
  unresolvedHighCases.length > 0 && unresolvedHighCases.every(i => i.expected.override_triggered === true)
);

// ──────────────────────────────────────────────
// Final Review Gate invariants
// ──────────────────────────────────────────────
console.log('\n=== Orchestrator — Final Review Gate ===');

check(
  'Completion Gate: final_review_gate read from governance/runtime-policy.json',
  /final_review_gate/i.test(orch)
);

{
  const rp = JSON.parse(readFileSync(join(ROOT, 'governance', 'runtime-policy.json'), 'utf8'));
  check(
    'Governance: runtime-policy.json contains final_review_gate top-level key',
    'final_review_gate' in rp
  );
}

check(
  'Completion Gate: optional final review activates for auto_trigger_tiers',
  /auto_trigger_tiers/i.test(orch)
);

check(
  'Completion Gate: changed_files normalization mapping documented (CoreImplementer, UIImplementer, TechnicalWriter, PlatformEngineer)',
  /CoreImplementer.*changes.*file|changes.*file.*CoreImplementer/i.test(orch) &&
  /UIImplementer.*ui_changes|ui_changes.*UIImplementer/i.test(orch) &&
  /TechnicalWriter.*docs_created|docs_created.*TechnicalWriter/i.test(orch) &&
  /PlatformEngineer.*changes.*file|changes.*file.*PlatformEngineer/i.test(orch)
);

check(
  'Completion Gate: CodeReviewer dispatched with review_scope=final and phase_id=0 sentinel',
  /review_scope.*final/i.test(orch) && /phase_id.*0.*sentinel|sentinel.*phase_id.*0/i.test(orch)
);

check(
  'Completion Gate: CodeReviewer final dispatch includes prior_phase_findings[] for novelty filtering',
  /prior_phase_findings/i.test(orch)
);

check(
  'Completion Gate: fix executor resolved from plan phases (highest phase_id wins), not CodeReviewer',
  /highest.*phase_id.*wins|highest phase_id/i.test(orch)
);

check(
  'Completion Gate: CodeReviewer NEVER owns fix cycle (fix dispatched to original phase executor)',
  /CodeReviewer.*NEVER.*own.*fix|never.*owns.*fix.*cycle/i.test(orch)
);

check(
  'Completion Gate: empty validated_blocking_issues logs advisory, does not block',
  /validated_blocking_issues.*empty.*log|empty.*validated_blocking_issues.*log/i.test(orch)
);

// Scenario fixture: final review gate trigger and routing
const finalReviewScenario = JSON.parse(
  readFileSync(join(ROOT, 'evals', 'scenarios', 'orchestrator-final-review-gate.json'), 'utf8')
);
check(
  'Final review gate scenario: exists and has expected field',
  finalReviewScenario.expected !== undefined &&
  finalReviewScenario.expected.final_review_gate_triggered !== undefined
);
check(
  'Final review gate scenario: LARGE tier auto-triggers gate',
  finalReviewScenario.inputs?.some(i => i.input.complexity_tier === 'LARGE' && i.expected.final_review_gate_triggered === true) ?? false
);
check(
  'Final review gate scenario: SMALL tier does not auto-trigger gate',
  finalReviewScenario.inputs?.some(i => i.input.complexity_tier === 'SMALL' && i.expected.final_review_gate_triggered === false) ?? false
);
check(
  'Final review gate scenario: enabled_by_default=true triggers gate regardless of tier',
  finalReviewScenario.inputs?.some(i =>
    i.input.final_review_gate_policy?.enabled_by_default === true &&
    i.expected.final_review_gate_triggered === true
  ) ?? false
);
check(
  'Final review gate scenario: blocking findings route to original phase executor, not CodeReviewer',
  finalReviewScenario.inputs?.some(i =>
    i.expected.code_reviewer_owns_fix === false &&
    i.expected.fix_executor_resolution === 'highest_phase_id_wins'
  ) ?? false
);
check(
  'Final review gate scenario: still-blocked findings escalate after max fix cycles',
  finalReviewScenario.inputs?.some(i =>
    i.expected.escalate_if_still_blocked_after_fix_cycles === true
  ) ?? false
);

// ──────────────────────────────────────────────
// Canonical Source References (Phase 3)
// ──────────────────────────────────────────────
console.log('\n=== Orchestrator — Canonical Source References ===');

check(
  'Canonical: retry budgets defer to governance/runtime-policy.json retry_budgets (not inline table)',
  /retry_budgets|runtime-policy\.json.*retry\s+budget|retry.*runtime-policy\.json/i.test(orch)
);
check(
  'Canonical: tier routing explicitly references governance/runtime-policy.json review_pipeline_by_tier',
  /review_pipeline_by_tier/i.test(orch)
);
check(
  'Canonical: agent role descriptions reference plans/project-context.md Agent Role Matrix',
  /plans\/project-context\.md.*Agent Role Matrix|Agent Role Matrix.*plans\/project-context\.md/i.test(orch)
);

// ──────────────────────────────────────────────
// Universal Model Resolution Rule (all dispatch paths)
// ──────────────────────────────────────────────
console.log('\n=== Orchestrator — Universal Model Resolution Rule ===');

check(
  'Model resolution: universal rule section defined in Execution Protocol',
  /Universal Model Resolution Rule/i.test(orch)
);
check(
  'Model resolution: rule explicitly covers Plan Review Gate reviewer dispatches (PlanAuditor, AssumptionVerifier, ExecutabilityVerifier)',
  /Universal Model Resolution Rule[\s\S]{0,800}PlanAuditor|This rule covers all dispatch paths[\s\S]{0,400}PlanAuditor/i.test(orch)
);
check(
  'Model resolution: rule explicitly covers ExecutabilityVerifier follow-up dispatch',
  /ExecutabilityVerifier[\s\S]{0,60}apply Universal Model Resolution Rule|apply Universal Model Resolution Rule[\s\S]{0,60}ExecutabilityVerifier/i.test(orch)
);
check(
  'Model resolution: rule explicitly covers phase CodeReviewer dispatch',
  /CodeReviewer-subagent for phase code review[\s\S]{0,60}apply Universal Model Resolution Rule|apply Universal Model Resolution Rule[\s\S]{0,60}CodeReviewer-subagent for phase code review/i.test(orch)
);
check(
  'Model resolution: rule explicitly covers final CodeReviewer dispatch',
  /Dispatch CodeReviewer-subagent[\s\S]{0,60}apply Universal Model Resolution Rule|apply Universal Model Resolution Rule[\s\S]{0,60}Dispatch CodeReviewer-subagent/i.test(orch)
);
check(
  'Model resolution: rule explicitly covers needs_replan Planner dispatch',
  /needs_replan[\s\S]{0,300}Universal Model Resolution Rule|Universal Model Resolution Rule[\s\S]{0,300}needs_replan/i.test(orch)
);
check(
  'Model resolution: Implementation Loop references shared universal rule (not standalone)',
  /Apply the Universal Model Resolution Rule.*before delegating execution/i.test(orch)
);
check(
  'Model resolution: deterministic mode keeps non-negotiable outer model requirement; auto mode allows omission',
  /Deterministic mode.*Never omit outer `model`|never omit outer `model` in deterministic mode/i.test(orch) &&
  /Auto mode.*omit the outer `model`|auto mode.*omit outer `model`/i.test(orch)
);
check(
  'Model resolution: missing pre-plan complexity_tier uses top-level primary in deterministic mode and preserves omission in auto mode',
  /initial planning dispatches before any plan `complexity_tier` exists.*top-level `primary` model/i.test(orch) &&
  /auto mode.*omits outer `model` intentionally|preserves omission/i.test(orch)
);

// ──────────────────────────────────────────────
// Outer dispatch contract: agentName/model fields and payload separation
// ──────────────────────────────────────────────
console.log('\n=== Orchestrator — Outer Dispatch Contract ===');

check(
  'Dispatch contract: required fields are scoped to the outer agent/runSubagent tool-call envelope',
  /Every `agent\/runSubagent` call must include these outer tool-call fields/i.test(orchestratorDispatchContract) &&
  /\*\*`agentName`\*\*/.test(orchestratorDispatchContract) &&
  /\*\*`model`\*\*/.test(orchestratorDispatchContract)
);

check(
  'Dispatch contract: outer model is separated from payload-level model and payload model cannot substitute for runtime enforcement',
  /outer (?:tool-call )?`model`|outer `model`/i.test(orchestratorDispatchContract) &&
  /payload-level `model`|nested payload-level `model`/i.test(orchestratorDispatchContract) &&
  /does not by itself select|not a substitute|cannot substitute|does not enforce/i.test(orchestratorDispatchContract)
);

check(
  'Dispatch coverage: Universal Model Resolution Rule covers PLAN_REVIEW reviewer dispatches',
  /Plan Review Gate reviewers[\s\S]{0,160}PlanAuditor[\s\S]{0,160}AssumptionVerifier[\s\S]{0,160}ExecutabilityVerifier/i.test(universalModelResolutionRule)
);

check(
  'Dispatch coverage: Universal Model Resolution Rule covers implementation executor dispatch',
  /Implementation Loop executor dispatch/i.test(universalModelResolutionRule)
);

check(
  'Dispatch coverage: Universal Model Resolution Rule covers phase CodeReviewer dispatch',
  /phase CodeReviewer dispatch/i.test(universalModelResolutionRule)
);

check(
  'Dispatch coverage: Universal Model Resolution Rule covers final CodeReviewer dispatch',
  /final CodeReviewer dispatch/i.test(universalModelResolutionRule)
);

check(
  'Dispatch coverage: Universal Model Resolution Rule covers retry dispatch',
  /retry dispatch/i.test(universalModelResolutionRule)
);

check(
  'Dispatch coverage: Universal Model Resolution Rule covers needs_replan Planner dispatch',
  /needs_replan Planner dispatch/i.test(universalModelResolutionRule)
);

check(
  'Payload schema review: runtime_model_mode marker exists and payload-level model is conditionally required (deterministic default)',
  delegationProtocolSchema.properties?.agents?.properties?.['Planner']?.properties?.runtime_model_mode !== undefined &&
  delegationProtocolSchema.properties?.agents?.properties?.['CodeMapper-subagent']?.properties?.runtime_model_mode !== undefined &&
  Array.isArray(delegationProtocolSchema.properties?.agents?.properties?.['Planner']?.allOf) &&
  !/Every `agent\/runSubagent` call must include these outer tool-call fields/i.test(JSON.stringify(delegationProtocolSchema))
);

// ──────────────────────────────────────────────
// Planner research dispatch contract
// ──────────────────────────────────────────────
console.log('\n=== Planner — Research Dispatch Contract ===');

check(
  'Planner research dispatch: CodeMapper and Researcher are the scoped research delegates',
  /CodeMapper-subagent/i.test(plannerResearchDispatchRule) && /Researcher-subagent/i.test(plannerResearchDispatchRule)
);

check(
  'Planner research dispatch: requires outer agentName for every CodeMapper/Researcher agent/runSubagent call',
  /outer `agentName`|`agentName`.*outer/i.test(plannerResearchDispatchRule) &&
  /agent\/runSubagent/i.test(plannerResearchDispatchRule)
);

check(
  'Planner research dispatch: requires outer model from governance and does not treat payload-level model as the runtime selector',
  /outer (?:tool-call )?`model`|outer `model`/i.test(plannerResearchDispatchRule) &&
  /governance\/model-routing\.json/i.test(plannerResearchDispatchRule) &&
  /payload-level `model`|nested payload-level `model`/i.test(plannerResearchDispatchRule) &&
  /does not by itself select|not a substitute|cannot substitute|does not enforce/i.test(plannerResearchDispatchRule)
);

check(
  'Planner research dispatch: deterministic missing tier context uses top-level primary, while auto mode allows outer model omission',
  /complexity_tier.*unavailable[\s\S]{0,240}top-level `primary`|top-level `primary`[\s\S]{0,240}complexity_tier.*unavailable/i.test(plannerResearchDispatchRule) &&
  /auto mode.*omit the outer `model` intentionally|auto mode.*omit outer `model`/i.test(plannerResearchDispatchRule)
);

// ──────────────────────────────────────────────
// Initial Planner Dispatch Gate
// ──────────────────────────────────────────────
console.log('\n=== Orchestrator — Initial Planner Dispatch Gate ===');

check(
  'Initial dispatch gate: explicit "Initial Planner Dispatch Gate" section exists in Execution Protocol',
  /Initial Planner Dispatch Gate/i.test(orch)
);
check(
  'Initial dispatch gate: triggers when no plan_path or active plan exists and user requests planning or implementation',
  /Initial Planner Dispatch Gate[\s\S]{0,600}no.*plan_path.*active plan|Initial Planner Dispatch Gate[\s\S]{0,600}plan_path.*does not exist/i.test(orch)
);
check(
  'Initial dispatch gate: dispatches Planner with original user request and applies Universal Model Resolution Rule',
  /Initial Planner Dispatch Gate[\s\S]{0,800}dispatch.*Planner[\s\S]{0,200}Universal Model Resolution Rule|Initial Planner Dispatch Gate[\s\S]{0,800}Universal Model Resolution Rule[\s\S]{0,200}Planner/i.test(orch)
);
check(
  'Initial dispatch gate: Planner\'s returned plan_path enters Planning Gate / PLAN_REVIEW evaluation (not treated as implementation approval)',
  /Initial Planner Dispatch Gate[\s\S]{0,800}plan_path[\s\S]{0,200}Planning Gate|plan_path.*returned.*Planner.*enters.*Planning Gate/i.test(orch)
);
check(
  'Initial dispatch gate: Planner is entry-point delegate, not phase executor',
  /entry.point.*delegate.*not.*executor|Planner.*entry.point.*delegate.*not.*executor/i.test(orch)
);

// Scenario fixture: initial Planner dispatch structural reference
const initialDispatchScenario = JSON.parse(
  readFileSync(join(ROOT, 'evals', 'scenarios', 'orchestrator-initial-planner-dispatch.json'), 'utf8')
);
check(
  'Initial dispatch scenario: fixture exists with expected structural fields',
  initialDispatchScenario.id === 'orchestrator-initial-planner-dispatch' &&
  initialDispatchScenario.target_agent === 'Orchestrator' &&
  initialDispatchScenario.expected !== undefined
);
check(
  'Initial dispatch scenario: no-plan-path case expects Planner dispatch and plan_path re-entry',
  initialDispatchScenario.inputs?.some(i =>
    i.input?.plan_path === undefined &&
    i.expected?.dispatches_planner === true &&
    i.expected?.plan_path_re_enters_planning_gate === true
  ) ?? false
);
check(
  'Initial dispatch scenario: Planner is not listed as phase executor',
  initialDispatchScenario.expected?.planner_is_phase_executor === false
);
check(
  'Initial dispatch scenario: model resolution uses top-level primary when no complexity_tier exists',
  initialDispatchScenario.expected?.model_resolution_before_tier !== undefined &&
  initialDispatchScenario.expected?.model_resolution_before_tier === 'top_level_primary'
);

// ══════════════════════════════════════════════
// Phase 1 — Dispatch API Shape and RED Review Model Coverage
//
// Evidence: VS Code Insiders build 7e4091cc0c,
//   resources/app/out/vs/workbench/api/worker/extensionHostWorkerMain.js
//   pos ~1502074: RunSubagentTool.getToolData() defines the inputSchema:
//     o.agentName = { type:"string", description:"Name of the agent to invoke." }
//     o.model = { type:"string", description:'Optional model for the subagent. Format: "Model Name (Vendor)"...' }
//   pos ~1502836: RunSubagentTool.invoke() extracts: x = s.agentName
//
// Verified target-agent field: agentName (not "agent_name", "target", or any other variant)
// Verified model-override field: model
//
// The following checks enforce that Orchestrator uses the verified `agentName` field
// for review dispatches and applies correct capable-reviewer model routing.
// ══════════════════════════════════════════════
console.log('\n=== Orchestrator — Dispatch API Shape (Phase 1) ===');

check(
  // Orchestrator must name agentName as the tool-call field.
  // Evidence: agentName verified from extensionHostWorkerMain.js RunSubagentTool.getToolData()
  'Dispatch contract: Orchestrator documents agentName as the agent/runSubagent target-agent field',
  /agentName/i.test(orch)
);

check(
  // agentName must not appear only in prose: it must be in the dispatch contract.
  'Dispatch contract: agentName field referenced in the Universal Model Resolution Rule or dispatch contract section',
  /Universal Model Resolution Rule[\s\S]{0,1200}agentName|agentName[\s\S]{0,400}Universal Model Resolution Rule|dispatch.*tool.call.*contract[\s\S]{0,400}agentName|agentName[\s\S]{0,400}dispatch.*tool.call.*contract/i.test(orch)
);

check(
  // capable-reviewer primary dispatch must be derived from
  // governance/model-routing.json by effective review tier, not hardcoded by model name.
  'Review dispatch: capable-reviewer primary resolves from governance/model-routing.json by effective review tier',
  /capable.reviewer[\s\S]{0,500}Effective review tier[\s\S]{0,500}Primary dispatch[\s\S]{0,500}governance\/model-routing\.json|Primary dispatch[\s\S]{0,500}roles\.capable-reviewer\.by_tier\[<effective_review_tier>\]/i.test(orch)
);

check(
  // first model_unavailable retry for capable-reviewer must use the configured
  // fallbacks list from governance/model-routing.json for the effective tier in order.
  // Derived from governance/model-routing.json roles.capable-reviewer.by_tier[effective_tier].fallbacks
  'Review dispatch: model_unavailable retry for capable-reviewer uses configured fallbacks from governance/model-routing.json by effective tier in order',
  /capable.reviewer[\s\S]{0,500}model_unavailable[\s\S]{0,400}configured.*fallbacks|model_unavailable[\s\S]{0,400}configured.*fallbacks.*list[\s\S]{0,200}effective.tier|fallbacks.*list[\s\S]{0,200}effective.tier[\s\S]{0,200}order/i.test(orch)
);

check(
  // Orchestrator must not silently substitute any unconfigured model for
  // capable-reviewer dispatches (e.g., its own frontmatter model), and must escalate to
  // WAITING_APPROVAL when all configured models for the effective tier are exhausted.
  'Review dispatch: Orchestrator must not use unconfigured models as silent fallback for capable-reviewer; escalate to WAITING_APPROVAL when all configured models exhausted',
  /Do not silently substitute.*Orchestrator frontmatter model.*unconfigured model|unconfigured model.*permitted.*substitutes|escalate.*WAITING_APPROVAL.*all.*configured.*models.*unavailable|all.*configured.*models.*unavailable.*escalate.*WAITING_APPROVAL/i.test(orch)
);

check(
  // SHOULD PASS (ExecutabilityVerifier intentional Sonnet route is already present in Orchestrator
  // via Universal Model Resolution Rule; this check verifies the rule hasn't regressed)
  // This check is GREEN — it validates the existing rule covers ExecutabilityVerifier.
  // If it fails, that is a regression from Phase 2 work, not a Phase 1 defect.
  'Review dispatch: ExecutabilityVerifier review-readonly Sonnet route preserved via Universal Model Resolution Rule [should remain GREEN]',
  /Universal Model Resolution Rule[\s\S]{0,800}ExecutabilityVerifier|This rule covers all dispatch paths[\s\S]{0,400}ExecutabilityVerifier/i.test(orch)
);

check(
  // Effective review tier concept: high-risk override forces LARGE even when plan tier is lower
  'Review dispatch: effective review tier defined — high-impact unresolved risk forces LARGE even if plan complexity_tier is lower [tier-aware routing]',
  /effective review tier[\s\S]{0,400}complexity_tier|high.impact.*unresolved.*LARGE.*even if|LARGE.*even if.*plan.*complexity.*lower/i.test(orch)
);

check(
  // LARGE premium routing preserved: when effective_review_tier = LARGE, capable-reviewer resolves
  // to the role default (inherit_from: "default") which is the premium tier in governance/model-routing.json.
  // Derived: capableReviewerLargePrimary = governance/model-routing.json roles.capable-reviewer primary
  `Review dispatch: LARGE effective tier (high-risk override) routes capable-reviewer to role default (premium: ${capableReviewerLargePrimary}) via governance/model-routing.json [tier-aware routing]`,
  /LARGE[\s\S]{0,400}role default|role default[\s\S]{0,200}LARGE|LARGE[\s\S]{0,400}inherit_from|inherit_from[\s\S]{0,200}LARGE|LARGE[\s\S]{0,400}governance\/model-routing\.json/i.test(orch)
);

// ──────────────────────────────────────────────
// Scenario fixture: capable-reviewer and review-readonly model routing reference cases
// ──────────────────────────────────────────────
console.log('\n=== Orchestrator — Review Model Routing Scenario ===');

const modelResScenario = JSON.parse(
  readFileSync(join(ROOT, 'evals', 'scenarios', 'orchestrator-model-resolution.json'), 'utf8')
);

// All cases must remain reference-only (Phase 1 plan requirement 6)
const allCases = modelResScenario.input?.reference_cases ?? [];
const negativeCases = modelResScenario.input?.negative_cases ?? [];

check(
  'Model resolution scenario: offline_harness_observes_live_runSubagent_model_parameters is false',
  modelResScenario.expected?.offline_harness_observes_live_runSubagent_model_parameters === false
);

check(
  'Model resolution scenario: verified target-agent field is documented as agentName in scenario metadata',
  modelResScenario.input?.verified_target_agent_field === 'agentName'
);

const dispatchContract = modelResScenario.input?.dispatch_contract ?? {};
check(
  'Model resolution scenario: metadata separates outer agentName, outer model, and payload model fields',
  dispatchContract.outer_agentName_field === 'agentName' &&
  dispatchContract.outer_model_field === 'model' &&
  dispatchContract.payload_model_field === 'model' &&
  dispatchContract.payload_runtime_model_mode_field === 'runtime_model_mode' &&
  dispatchContract.payload_model_is_runtime_enforcement_boundary === false
);

check(
  'Model resolution scenario: direct frontmatter model remains the fallback for direct invocation only',
  dispatchContract.frontmatter_model_direct_invocation_fallback === true &&
  /direct invocation/i.test(dispatchContract.frontmatter_scope ?? '')
);

const casesMissingOuterPayloadFields = allCases.filter(c => {
  const expectation = c.reference_expectation ?? {};
  return expectation.outer_agentName_field !== 'agentName' ||
    expectation.outer_model_field !== 'model' ||
    expectation.payload_model_field !== 'model' ||
    expectation.payload_model_is_runtime_enforcement_boundary !== false;
});
check(
  'Model resolution scenario: every reference case records outer and payload model fields separately',
  casesMissingOuterPayloadFields.length === 0
);

check(
  'Model resolution scenario: all required dispatch contract cases are documented',
  REQUIRED_MODEL_RESOLUTION_NEGATIVE_CASES.every(caseId => negativeCases.some(c => c.case_id === caseId)) &&
  modelResScenario.expected?.negative_cases_documented === REQUIRED_MODEL_RESOLUTION_NEGATIVE_CASES.length
);

for (const caseId of REQUIRED_MODEL_RESOLUTION_NEGATIVE_CASES) {
  const negativeCase = negativeCases.find(c => c.case_id === caseId);
  check(
    `Model resolution contract scenario: ${caseId} preserves structural contract expectations`,
    (caseId === 'auto-mode-missing-outer-model-allowed'
      ? negativeCase?.expected?.rejected === false
      : negativeCase?.expected?.rejected === true) &&
      negativeCase?.expected?.offline_detection_scope === 'structural_contract' &&
      negativeCase?.expected?.live_runtime_assertion === false
  );
}

const missingOuterAgentNameCase = negativeCases.find(c => c.case_id === 'missing-outer-agentName');
check(
  'Model resolution negative scenario: missing outer agentName cannot be repaired by payload agentName',
  missingOuterAgentNameCase?.broken_dispatch?.outer_fields?.agentName_present === false &&
  missingOuterAgentNameCase?.broken_dispatch?.payload_fields?.agentName_present === true &&
  missingOuterAgentNameCase?.expected?.violates === 'missing_outer_agentName'
);

const missingOuterModelCase = negativeCases.find(c => c.case_id === 'missing-outer-model');
check(
  'Model resolution negative scenario: missing outer model is rejected even when agentName is present',
  missingOuterModelCase?.broken_dispatch?.outer_fields?.agentName_present === true &&
  missingOuterModelCase?.broken_dispatch?.outer_fields?.model_present === false &&
  missingOuterModelCase?.expected?.violates === 'missing_outer_model'
);

const payloadOnlyModelCase = negativeCases.find(c => c.case_id === 'payload-only-model');
check(
  'Model resolution negative scenario: payload-only model is not runtime enforcement',
  payloadOnlyModelCase?.broken_dispatch?.outer_fields?.model_present === false &&
  payloadOnlyModelCase?.broken_dispatch?.payload_fields?.model_present === true &&
  payloadOnlyModelCase?.expected?.violates === 'payload_only_model'
);

const autoModeOuterModelOmittedCase = negativeCases.find(c => c.case_id === 'auto-mode-missing-outer-model-allowed');
check(
  'Model resolution auto-mode scenario: missing outer model is allowed when runtime_model_mode=auto marker is present',
  autoModeOuterModelOmittedCase?.input_context?.runtime_model_mode === 'auto' &&
  autoModeOuterModelOmittedCase?.broken_dispatch?.outer_fields?.model_present === false &&
  autoModeOuterModelOmittedCase?.broken_dispatch?.payload_fields?.runtime_model_mode_present === true &&
  autoModeOuterModelOmittedCase?.expected?.rejected === false &&
  autoModeOuterModelOmittedCase?.expected?.resolution_mode === 'platform_auto'
);

const wrongEffectiveReviewTierCase = negativeCases.find(c => c.case_id === 'wrong-effective-review-tier');
check(
  `Model resolution negative scenario: unresolved HIGH risk must use LARGE capable-reviewer model ${capableReviewerLargePrimary}`,
  wrongEffectiveReviewTierCase?.input_context?.plan_complexity_tier === 'MEDIUM' &&
  wrongEffectiveReviewTierCase?.input_context?.unresolved_high_risk === true &&
  wrongEffectiveReviewTierCase?.broken_resolution?.effective_review_tier === 'MEDIUM' &&
  wrongEffectiveReviewTierCase?.expected?.effective_review_tier === 'LARGE' &&
  wrongEffectiveReviewTierCase?.expected?.resolved_primary_model === capableReviewerLargePrimary &&
  wrongEffectiveReviewTierCase?.expected?.violates === 'wrong_effective_review_tier'
);

const unconfiguredFallbackCase = negativeCases.find(c => c.case_id === 'unconfigured-fallback');
check(
  'Model resolution negative scenario: unconfigured fallback is rejected for the effective tier',
  unconfiguredFallbackCase?.input_context?.effective_review_tier === 'MEDIUM' &&
  unconfiguredFallbackCase?.expected?.configured_fallbacks_only === true &&
  !resolveRoleModel('capable-reviewer', 'MEDIUM').fallbacks.includes(unconfiguredFallbackCase?.broken_retry?.model)
);

const omittedDueMissingTierCase = negativeCases.find(c => c.case_id === 'omitted-model-due-missing-tier-context');
check(
  `Model resolution negative scenario: missing tier context still resolves top-level primary ${capablePlannerPrimary}`,
  omittedDueMissingTierCase?.input_context?.complexity_tier_present === false &&
  omittedDueMissingTierCase?.broken_dispatch?.outer_fields?.model_present === false &&
  omittedDueMissingTierCase?.expected?.resolution_when_tier_missing === 'top_level_primary' &&
  omittedDueMissingTierCase?.expected?.resolved_primary_model === capablePlannerPrimary &&
  omittedDueMissingTierCase?.expected?.violates === 'omitted_model_missing_tier_context'
);

const reviewPrimaryCase = allCases.find(c => c.case_id === 'capable-reviewer-primary-dispatch');
check(
  'Model resolution scenario: capable-reviewer-primary-dispatch case exists',
  reviewPrimaryCase !== undefined
);
check(
  // Derived from governance/model-routing.json roles.capable-reviewer.primary
  `Model resolution scenario: capable-reviewer-primary-dispatch uses ${capableReviewerPrimary}`,
  reviewPrimaryCase?.reference_expectation?.resolved_primary_model === capableReviewerPrimary
);
check(
  'Model resolution scenario: capable-reviewer-primary-dispatch live_runtime_assertion is false',
  reviewPrimaryCase?.reference_expectation?.live_runtime_assertion === false
);

const fallbackCase = allCases.find(c => c.case_id === 'capable-reviewer-model-unavailable-first-retry');
check(
  'Model resolution scenario: capable-reviewer-model-unavailable-first-retry case exists',
  fallbackCase !== undefined
);
check(
  // Derived from governance/model-routing.json roles.capable-reviewer.fallbacks[0]
  `Model resolution scenario: first retry for capable-reviewer uses ${capableReviewerFallback0}`,
  fallbackCase?.reference_expectation?.first_retry_model === capableReviewerFallback0
);
check(
  // Derived from governance/model-routing.json roles.orchestration-capable.primary
  `Model resolution scenario: first retry must not use ${orchestratorDefaultPrimary}`,
  fallbackCase?.reference_expectation?.first_retry_model !== orchestratorDefaultPrimary
);
check(
  'Model resolution scenario: first retry live_runtime_assertion is false',
  fallbackCase?.reference_expectation?.live_runtime_assertion === false
);

const evCase = allCases.find(c => c.case_id === 'executability-verifier-review-readonly-sonnet');
check(
  'Model resolution scenario: executability-verifier-review-readonly-sonnet case exists',
  evCase !== undefined
);
check(
  // Derived from governance/model-routing.json roles.review-readonly.primary
  `Model resolution scenario: ExecutabilityVerifier resolves through review-readonly to ${evPrimary}`,
  evCase?.reference_expectation?.resolved_primary_model === evPrimary
);
check(
  'Model resolution scenario: ExecutabilityVerifier role is review-readonly (intentional exception)',
  evCase?.role === 'review-readonly'
);
check(
  'Model resolution scenario: ExecutabilityVerifier live_runtime_assertion is false',
  evCase?.reference_expectation?.live_runtime_assertion === false
);

const codeMapperCase = allCases.find(c => c.case_id === 'fast-readonly-codemapper-sonnet');
check(
  'Model resolution scenario: fast-readonly-codemapper-sonnet case exists',
  codeMapperCase !== undefined
);
check(
  `Model resolution scenario: CodeMapper resolves through fast-readonly to ${fastReadonlyPrimary}`,  // Claude Sonnet 4.6 (copilot)
  codeMapperCase?.reference_expectation?.resolved_primary_model === fastReadonlyPrimary
);
check(
  'Model resolution scenario: CodeMapper live_runtime_assertion is false',
  codeMapperCase?.reference_expectation?.live_runtime_assertion === false
);

const researcherCase = allCases.find(c => c.case_id === 'researcher-research-capable-large-override');
check(
  'Model resolution scenario: researcher-research-capable-large-override case exists',
  researcherCase !== undefined
);
check(
  `Model resolution scenario: Researcher LARGE dispatch resolves through research-capable to ${researchCapableLargePrimary}`,
  researcherCase?.reference_expectation?.resolved_primary_model === researchCapableLargePrimary
);
check(
  'Model resolution scenario: Researcher dispatch is reference-only and would mismatch direct frontmatter if outer model is omitted',
  researcherCase?.reference_expectation?.live_runtime_assertion === false &&
  researcherCase?.reference_expectation?.mismatch_if_outer_model_omitted === true
);

const capableImplementerTrivialCase = allCases.find(c => c.case_id === 'capable-implementer-trivial-override');
check(
  'Model resolution scenario: capable-implementer-trivial-override case exists',
  capableImplementerTrivialCase !== undefined
);
check(
  `Model resolution scenario: capable-implementer TRIVIAL resolves to ${capableImplementerTrivialPrimary}`,
  capableImplementerTrivialCase?.reference_expectation?.resolved_primary_model === capableImplementerTrivialPrimary
);
check(
  'Model resolution scenario: capable-implementer TRIVIAL records mismatch risk when outer model is omitted',
  capableImplementerTrivialCase?.reference_expectation?.mismatch_if_outer_model_omitted === true
);

const capableImplementerLargeCase = allCases.find(c => c.case_id === 'capable-implementer-large-override');
check(
  'Model resolution scenario: capable-implementer-large-override case exists',
  capableImplementerLargeCase !== undefined
);
check(
  `Model resolution scenario: capable-implementer LARGE resolves to ${capableImplementerLargePrimary}`,
  capableImplementerLargeCase?.reference_expectation?.resolved_primary_model === capableImplementerLargePrimary
);
check(
  'Model resolution scenario: capable-implementer LARGE records mismatch risk when outer model is omitted',
  capableImplementerLargeCase?.reference_expectation?.mismatch_if_outer_model_omitted === true
);

const documentationTrivialCase = allCases.find(c => c.case_id === 'documentation-trivial-override');
check(
  'Model resolution scenario: documentation-trivial-override case exists',
  documentationTrivialCase !== undefined
);
check(
  `Model resolution scenario: documentation TRIVIAL resolves to ${documentationTrivialPrimary}`,
  documentationTrivialCase?.reference_expectation?.resolved_primary_model === documentationTrivialPrimary
);
check(
  'Model resolution scenario: documentation TRIVIAL records mismatch risk when outer model is omitted',
  documentationTrivialCase?.reference_expectation?.mismatch_if_outer_model_omitted === true
);

const largeHighRiskCase = allCases.find(c => c.case_id === 'capable-reviewer-large-high-risk-override');
check(
  'Model resolution scenario: capable-reviewer-large-high-risk-override case exists',
  largeHighRiskCase !== undefined
);
check(
  // Derived from governance/model-routing.json roles.capable-reviewer (LARGE = inherit_from default = role primary)
  `Model resolution scenario: large-high-risk-override resolves to premium LARGE primary ${capableReviewerLargePrimary}`,
  largeHighRiskCase?.reference_expectation?.resolved_primary_model === capableReviewerLargePrimary
);
check(
  'Model resolution scenario: large-high-risk-override documents effective_review_tier=LARGE and override_reason containing high_risk',
  largeHighRiskCase?.reference_expectation?.effective_review_tier === 'LARGE' &&
  typeof largeHighRiskCase?.reference_expectation?.override_reason === 'string' &&
  largeHighRiskCase?.reference_expectation?.override_reason?.includes('high_risk') === true
);
check(
  // Derived from governance/model-routing.json roles.capable-reviewer.fallbacks[0]
  `Model resolution scenario: large-high-risk-override first fallback remains premium fallback ${capableReviewerLargeFallback0}`,
  largeHighRiskCase?.reference_expectation?.first_fallback_model === capableReviewerLargeFallback0
);

check(
  'Model resolution scenario: total reference_cases_documented matches array length',
  modelResScenario.expected?.reference_cases_documented === allCases.length
);

// ──────────────────────────────────────────────
// Planner Role Fallback Chain Regression (Phase 3)
// Locks the capable-planner ordered fallback contract so drift is immediately
// visible: primary GPT-5.5 (copilot) → Claude Opus 4.7 (copilot) → GPT-5.4 mini (copilot)
// ──────────────────────────────────────────────
console.log('\n=== Model Routing — Planner Role Fallback Chain ===');

check(
  'Planner routing: capable-planner role present in governance/model-routing.json',
  modelRouting.roles['capable-planner'] !== undefined
);
check(
  `Planner routing: primary is GPT-5.5 (copilot) (resolved: ${capablePlannerPrimary})`,
  capablePlannerPrimary === 'GPT-5.5 (copilot)'
);
check(
  `Planner routing: fallback[0] is Claude Opus 4.7 (copilot) (resolved: ${capablePlannerFallback0})`,
  capablePlannerFallback0 === 'Claude Opus 4.7 (copilot)'
);
check(
  `Planner routing: fallback[1] is GPT-5.4 mini (copilot) (resolved: ${capablePlannerFallback1})`,
  capablePlannerFallback1 === 'GPT-5.4 mini (copilot)'
);
check(
  'Planner routing: fallback chain has exactly 2 entries',
  (modelRouting.roles['capable-planner']?.fallbacks ?? []).length === 2
);
check(
  'Planner routing: all tiers inherit_from default (no tier-specific planner override)',
  Object.values(modelRouting.roles['capable-planner']?.by_tier ?? {})
    .every(t => t.inherit_from === 'default')
);
check(
  'Planner routing: primary and fallback order consistent across all complexity tiers',
  ['TRIVIAL', 'SMALL', 'MEDIUM', 'LARGE'].every(tier => {
    const r = resolveRoleModel('capable-planner', tier);
    return r.primary === capablePlannerPrimary &&
           r.fallbacks[0] === capablePlannerFallback0 &&
           r.fallbacks[1] === capablePlannerFallback1;
  })
);

// ──────────────────────────────────────────────
// Summary
// ──────────────────────────────────────────────
console.log(`\n${'═'.repeat(50)}`);
console.log(`Orchestration Handoff: ${passed + failed}  |  Passed: ${passed}  |  Failed: ${failed}`);
console.log(`${'═'.repeat(50)}\n`);

if (failed > 0) {
  console.log('Orchestration handoff contract regression detected ❌');
  process.exit(1);
} else {
  console.log('All orchestration handoff checks passed ✅');
  process.exit(0);
}
