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

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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

// Pre-resolved planner role values (derived from governance/model-routing.json)
const _capablePlanner         = resolveRoleModel('capable-planner', 'MEDIUM');
const capablePlannerPrimary   = _capablePlanner.primary;        // GPT-5.5 (copilot)
const capablePlannerFallback0 = _capablePlanner.fallbacks[0];   // Claude Opus 4.7 (copilot)
const capablePlannerFallback1 = _capablePlanner.fallbacks[1];   // GPT-5.4 mini (copilot)

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

check(
  'Todo-before-advance: todo marking is blocking prerequisite',
  /todo.*blocking prerequisite|no phase transition.*todo/i.test(orch)
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
  'Model resolution: non-negotiable rule prohibits omitting model parameter on any dispatch',
  /No.*agent.*runSubagent.*omit.*model|every dispatch must apply the Universal Model Resolution Rule/i.test(orch)
);
check(
  'Model resolution: missing pre-plan complexity_tier falls back to top-level primary model without omitting model',
  /initial planning dispatches before any plan `complexity_tier` exists.*top-level `primary` model/i.test(orch) &&
  /Never omit `model` because tier context is missing/i.test(orch)
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
// These checks are intentionally RED until Phase 2 is implemented.
// ══════════════════════════════════════════════
console.log('\n=== Orchestrator — Dispatch API Shape (Phase 1 RED checks) ===');

check(
  // RED until Phase 2: Orchestrator must name agentName as the tool-call field
  // Evidence: agentName verified from extensionHostWorkerMain.js RunSubagentTool.getToolData()
  'Dispatch contract: Orchestrator documents agentName as the agent/runSubagent target-agent field [RED — Phase 2 required]',
  /agentName/i.test(orch)
);

check(
  // RED until Phase 2: agentName must not appear only in prose — it must be in the dispatch contract
  'Dispatch contract: agentName field referenced in the Universal Model Resolution Rule or dispatch contract section [RED — Phase 2 required]',
  /Universal Model Resolution Rule[\s\S]{0,1200}agentName|agentName[\s\S]{0,400}Universal Model Resolution Rule|dispatch.*tool.call.*contract[\s\S]{0,400}agentName|agentName[\s\S]{0,400}dispatch.*tool.call.*contract/i.test(orch)
);

check(
  // RED until Phase 2: capable-reviewer primary dispatch must be derived from
  // governance/model-routing.json by effective review tier, not hardcoded by model name.
  'Review dispatch: capable-reviewer primary resolves from governance/model-routing.json by effective review tier [RED — Phase 2 required]',
  /capable.reviewer[\s\S]{0,500}Effective review tier[\s\S]{0,500}Primary dispatch[\s\S]{0,500}governance\/model-routing\.json|Primary dispatch[\s\S]{0,500}roles\.capable-reviewer\.by_tier\[<effective_review_tier>\]/i.test(orch)
);

check(
  // RED until Phase 2: first model_unavailable retry for capable-reviewer must use the configured
  // fallbacks list from governance/model-routing.json for the effective tier in order.
  // Derived from governance/model-routing.json roles.capable-reviewer.by_tier[effective_tier].fallbacks
  'Review dispatch: model_unavailable retry for capable-reviewer uses configured fallbacks from governance/model-routing.json by effective tier in order [RED — Phase 2 required]',
  /capable.reviewer[\s\S]{0,500}model_unavailable[\s\S]{0,400}configured.*fallbacks|model_unavailable[\s\S]{0,400}configured.*fallbacks.*list[\s\S]{0,200}effective.tier|fallbacks.*list[\s\S]{0,200}effective.tier[\s\S]{0,200}order/i.test(orch)
);

check(
  // RED until Phase 2: Orchestrator must not silently substitute any unconfigured model for
  // capable-reviewer dispatches (e.g., its own frontmatter model), and must escalate to
  // WAITING_APPROVAL when all configured models for the effective tier are exhausted.
  'Review dispatch: Orchestrator must not use unconfigured models as silent fallback for capable-reviewer; escalate to WAITING_APPROVAL when all configured models exhausted [RED — Phase 2 required]',
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

check(
  'Model resolution scenario: offline_harness_observes_live_runSubagent_model_parameters is false',
  modelResScenario.expected?.offline_harness_observes_live_runSubagent_model_parameters === false
);

check(
  'Model resolution scenario: verified target-agent field is documented as agentName in scenario metadata',
  modelResScenario.input?.verified_target_agent_field === 'agentName'
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
