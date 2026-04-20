/**
 * ControlFlow — Prompt Behavior Contract Regression Tests
 *
 * Verifies that agent prompt files preserve behavioral invariants
 * defined in docs/agent-engineering/PROMPT-BEHAVIOR-CONTRACT.md.
 *
 * These tests complement validate.mjs (structural) by checking
 * behavioral consistency: evidence discipline, follow-through,
 * abstention rules, and output contracts.
 *
 * Exit 0 on all checks passed, exit 1 on any failure.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

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

function readAgent(name) {
  return readFileSync(join(ROOT, `${name}.agent.md`), 'utf8');
}

function readShared() {
  return readFileSync(join(ROOT, '.github', 'copilot-instructions.md'), 'utf8');
}

// ──────────────────────────────────────────────
// Planner behavioral invariants
// ──────────────────────────────────────────────
console.log('\n=== Planner — Behavioral Invariants ===');
{
  const src = readAgent('Planner');

  // Confidence threshold gate
  check(
    'Confidence threshold: ABSTAIN or REPLAN when below 0.9',
    /confidence.*0\.9/i.test(src) && /ABSTAIN|REPLAN_REQUIRED/i.test(src)
  );

  // Mandatory workflow gates (sequential order)
  check(
    'Mandatory gate: Idea Interview Gate present',
    /Idea Interview Gate/i.test(src)
  );
  check(
    'Mandatory gate: Clarification Gate present',
    /Clarification Gate/i.test(src)
  );
  check(
    'Mandatory gate: Semantic Risk Discovery Gate present',
    /Semantic Risk Discovery Gate/i.test(src)
  );
  check(
    'Mandatory gate: Complexity Gate present',
    /Complexity Gate/i.test(src)
  );

  // Gate ordering: Idea Interview < Clarification < Semantic Risk < Complexity
  const ideaIdx = src.search(/Idea Interview Gate/i);
  const clarIdx = src.search(/Clarification Gate/i);
  const riskIdx = src.search(/Semantic Risk Discovery Gate/i);
  const compIdx = src.search(/Complexity Gate/i);
  check(
    'Gate ordering: Idea Interview → Clarification → Semantic Risk → Complexity',
    ideaIdx < clarIdx && clarIdx < riskIdx && riskIdx < compIdx
  );

  // Artifact-before-response contract
  check(
    'Output contract: artifact file created before chat response',
    /create the markdown plan file first/i.test(src) ||
    /plan file.*before.*chat/i.test(src) ||
    /do not produce any chat output until the file is saved/i.test(src)
  );

  // Chat-after-artifact: no inline plan content in chat
  check(
    'Output contract: chat must not contain inline plan breakdowns',
    /must NOT contain inline phase breakdowns/i.test(src) ||
    /concise handoff message/i.test(src)
  );

  // Quality standards: incremental, TDD, specific, testable, practical
  check(
    'Quality standards: Incremental + TDD + Specific + Testable + Practical',
    /Incremental/i.test(src) && /TDD/i.test(src) && /Specific/i.test(src) &&
    /Testable/i.test(src) && /Practical/i.test(src)
  );

  // Phase count bounds (3–10)
  check(
    'Phase count bounds: 3–10 enforced',
    /phase count.*3.*10|3[–-]10/i.test(src)
  );

  // Semantic risk heuristics should anchor to the canonical taxonomy source.
  check(
    'Semantic risk taxonomy: Planner points to project-context canonical source',
    /plans\/project-context\.md/i.test(src) && /Semantic Risk Taxonomy/i.test(src)
  );

  // All 7 semantic risk categories required
  check(
    'Semantic risk: all 7 categories referenced or delegated to canonical taxonomy',
    (
      /data_volume/i.test(src) && /performance/i.test(src) &&
      /concurrency/i.test(src) && /access_control/i.test(src) &&
      /migration_rollback/i.test(src) && /dependency/i.test(src) &&
      /operability/i.test(src)
    ) || /plans\/project-context\.md.*Semantic Risk Taxonomy|Semantic Risk Taxonomy.*plans\/project-context\.md/i.test(src)
  );

  const complexityGateSection = src.match(/4\. Complexity Gate:[\s\S]*?5\. Skill Selection:/i)?.[0] ?? '';

  check(
    'Complexity gate: Planner emits complexity_tier but defers tier routing to Orchestrator/runtime-policy',
    /complexity_tier/i.test(complexityGateSection) &&
    /Orchestrator/i.test(complexityGateSection) &&
    /runtime-policy\.json/i.test(complexityGateSection) &&
    /LARGE[\s\S]*mandatory Researcher(?:-subagent)? pre-research phase/i.test(complexityGateSection) &&
    !/MEDIUM[\s\S]*(PlanAuditor|AssumptionVerifier|ExecutabilityVerifier|full review|iteration)/i.test(complexityGateSection) &&
    !/LARGE[\s\S]*(PlanAuditor|AssumptionVerifier|ExecutabilityVerifier|full review|all agents active|iteration)/i.test(complexityGateSection)
  );

  // Terminal states still produce artifacts
  check(
    'Terminal states: ABSTAIN and REPLAN_REQUIRED must produce plan file',
    /ABSTAIN.*REPLAN_REQUIRED.*must produce.*plan file|Both.*ABSTAIN.*REPLAN_REQUIRED.*MUST produce/i.test(src)
  );

  // No ABSTAIN without clarification attempt
  check(
    'ABSTAIN discipline: clarification must be attempted first',
    /do not return.*ABSTAIN.*without.*clarification/i.test(src)
  );

  // ── Phase 3: delegate roster and critic ownership ─────────────────────────
  // Parse agents: frontmatter for Planner
  const plannerAgentsMatch = src.match(/^agents:\s*\[(.*)\]$/m);
  const plannerAgentEntries = plannerAgentsMatch
    ? plannerAgentsMatch[1].split(',').map(x => x.trim().replace(/^["']|["']$/g, '')).filter(Boolean)
    : [];

  check(
    'Agents frontmatter: explicit non-empty roster present (non-wildcard)',
    plannerAgentEntries.length > 0
  );
  check(
    'Agents frontmatter: no wildcard "*" in roster',
    !plannerAgentEntries.includes('*')
  );
  check(
    'Agents frontmatter: exactly CodeMapper-subagent and Researcher-subagent, no extras',
    plannerAgentEntries.length === 2 &&
    plannerAgentEntries.includes('CodeMapper-subagent') &&
    plannerAgentEntries.includes('Researcher-subagent')
  );
  check(
    'Delegation scope: prompt restricts delegation to CodeMapper-subagent or Researcher-subagent',
    /MUST delegate only to.*CodeMapper-subagent.*or.*Researcher-subagent/i.test(src)
  );
  check(
    'Delegation scope: external agents explicitly prohibited in prompt text',
    /External agents are prohibited/i.test(src)
  );
  check(
    'Critic activation: Planner defers PLAN_REVIEW ownership to Orchestrator',
    /those belong to Orchestrator/i.test(src)
  );
  check(
    'Critic activation: Planner does not invoke PlanAuditor/AssumptionVerifier/ExecutabilityVerifier directly',
    /No invoking PlanAuditor-subagent.*AssumptionVerifier-subagent.*or ExecutabilityVerifier-subagent/i.test(src) ||
    /does not invoke PlanAuditor-subagent.*AssumptionVerifier-subagent.*or ExecutabilityVerifier-subagent/i.test(src)
  );
  check(
    'Critic activation: complexity_tier signals which review agents to activate, routing deferred to Orchestrator',
    /complexity_tier.*signals.*Orchestrator.*which review agents.*activate|complexity_tier.*field.*signals.*Orchestrator/i.test(src)
  );

  // ── Phase 2: schema-level contract checks (F1–F3) ─────────────────────────
  {
    const plannerSchema = JSON.parse(readFileSync(join(ROOT, 'schemas', 'planner.plan.schema.json'), 'utf8'));
    const executorAgentEnum = plannerSchema.properties?.phases?.items?.properties?.executor_agent?.enum ?? [];
    check(
      'Planner: TRIVIAL risk_review shortcut must not use category "all" — seven specific not_applicable entries required',
      !/category:\s*["']all["']/.test(src)
    );
    check(
      'Planner schema: complexity_tier is in the top-level required array',
      Array.isArray(plannerSchema.required) && plannerSchema.required.includes('complexity_tier')
    );
    check(
      'Planner schema: AssumptionVerifier-subagent must NOT be in executor_agent enum (review-only)',
      !executorAgentEnum.includes('AssumptionVerifier-subagent')
    );
    check(
      'Planner schema: ExecutabilityVerifier-subagent must NOT be in executor_agent enum (review-only)',
      !executorAgentEnum.includes('ExecutabilityVerifier-subagent')
    );
  }
}

// ──────────────────────────────────────────────
// Researcher behavioral invariants
// ──────────────────────────────────────────────
console.log('\n=== Researcher — Behavioral Invariants ===');
{
  const src = readAgent('Researcher-subagent');

  // Every claim requires evidence with file/line
  check(
    'Evidence discipline: every claim requires file/line evidence',
    /every claim.*evidence/i.test(src) && /file.*line/i.test(src)
  );

  // ABSTAIN on insufficient evidence
  check(
    'ABSTAIN: required when evidence is insufficient',
    /insufficient.*ABSTAIN|ABSTAIN.*insufficient/i.test(src) ||
    /evidence.*insufficient.*ABSTAIN/i.test(src)
  );

  // No speculative inference
  check(
    'No speculation: facts separated from hypotheses',
    /separate.*facts.*hypotheses|speculative/i.test(src)
  );

  // Status enum bounded to 3 values
  check(
    'Status enum: COMPLETE, ABSTAIN, INSUFFICIENT_EVIDENCE only',
    /COMPLETE/i.test(src) && /ABSTAIN/i.test(src) && /INSUFFICIENT_EVIDENCE/i.test(src)
  );

  // Convergence: 2+ sources required
  check(
    'Convergence: 2+ independent sources required',
    /2\+.*sources.*agree|2\+.*independent.*sources/i.test(src)
  );
}

// ──────────────────────────────────────────────
// CodeMapper behavioral invariants
// ──────────────────────────────────────────────
console.log('\n=== CodeMapper — Behavioral Invariants ===');
{
  const src = readAgent('CodeMapper-subagent');

  // Read-only constraint
  check(
    'Read-only: no file edits, no command execution',
    /read.only/i.test(src) && /no.*edit/i.test(src)
  );

  // Parallel-first search mandate (3–10)
  check(
    'Parallel-first: 3–10 independent searches before sequential reads',
    /parallel.*3.*10|3[–-]10.*parallel|parallel batch.*3/i.test(src) ||
    (/parallel/i.test(src) && /3.*search/i.test(src))
  );

  // PreFlect evaluation before output
  check(
    'PreFlect: evaluation required before returning discovery report',
    /PreFlect/i.test(src)
  );

  // ABSTAIN on contradictory/insufficient results
  check(
    'ABSTAIN: required on contradictory or insufficient results',
    /ABSTAIN/i.test(src) && /contradict|insufficient/i.test(src)
  );

  // No speculative claims
  check(
    'No speculation: no claims without references',
    /speculative.*claim|no.*claim.*without.*ref/i.test(src)
  );
}

// ──────────────────────────────────────────────
// CoreImplementer behavioral invariants (F9)
// ──────────────────────────────────────────────
console.log('\n=== CoreImplementer — Behavioral Invariants ===');
{
  const src = readAgent('CoreImplementer-subagent');

  check(
    'CoreImplementer: failure_classification present with all four values',
    /transient/i.test(src) && /fixable/i.test(src) &&
    /needs_replan/i.test(src) && /escalate/i.test(src)
  );

  check(
    'CoreImplementer: COMPLETE status value documented',
    /COMPLETE/i.test(src)
  );

  check(
    'CoreImplementer: NEEDS_INPUT status value documented',
    /NEEDS_INPUT/i.test(src)
  );

  check(
    'CoreImplementer: build evidence required before reporting completion',
    /build.*pass|build.*PASS|PASS.*build/i.test(src)
  );
}

// ──────────────────────────────────────────────
// CodeReviewer behavioral invariants (F9)
// ──────────────────────────────────────────────
console.log('\n=== CodeReviewer — Behavioral Invariants ===');
{
  const src = readAgent('CodeReviewer-subagent');

  check(
    'CodeReviewer: validated_blocking_issues output field documented',
    /validated_blocking_issues/i.test(src)
  );

  check(
    'CodeReviewer: APPROVED and NEEDS_REVISION status values present',
    /APPROVED/i.test(src) && /NEEDS_REVISION/i.test(src)
  );

  check(
    'CodeReviewer: blocks only on confirmed validated issues, not unvalidated findings',
    /validated.*block|confirmed.*block|block.*confirmed/i.test(src)
  );

  check(
    'CodeReviewer: final scope section present (review_scope=final)',
    /review_scope.*final|final.*review_scope/i.test(src)
  );

  check(
    'CodeReviewer: final scope novelty filter documented (skip already-surfaced findings)',
    /novelty.filter|only report findings.*not already|not.*already.*surfaced/i.test(src)
  );

  check(
    'CodeReviewer: out_of_scope_changes detection compares changed_files against plan_phases_snapshot',
    /out_of_scope_changes/i.test(src) &&
    /changed_files|plan_phases_snapshot/i.test(src)
  );

  check(
    'CodeReviewer: CodeReviewer never owns fix cycles (final scope constraint)',
    /never.*own.*fix.cycle|CodeReviewer.*NEVER.*own/i.test(src)
  );
}

// ──────────────────────────────────────────────
// TechnicalWriter behavioral invariants (F9)
// ──────────────────────────────────────────────
console.log('\n=== TechnicalWriter — Behavioral Invariants ===');
{
  const src = readAgent('TechnicalWriter-subagent');

  check(
    'TechnicalWriter: documentation-only scope (no test writing/execution)',
    /documentation.only|doc.*only/i.test(src) ||
    /no.*test.*writ|no.*execut/i.test(src)
  );

  check(
    'TechnicalWriter: COMPLETE status value documented',
    /COMPLETE/i.test(src)
  );
}

// ──────────────────────────────────────────────
// AssumptionVerifier behavioral invariants (F9)
// ──────────────────────────────────────────────
console.log('\n=== AssumptionVerifier — Behavioral Invariants ===');
{
  const src = readAgent('AssumptionVerifier-subagent');

  check(
    'AssumptionVerifier: COMPLETE and ABSTAIN status values present (review-only, no NEEDS_REVISION)',
    /COMPLETE/i.test(src) && /ABSTAIN/i.test(src)
  );

  check(
    'AssumptionVerifier: blocking mirages distinguished from non-blocking',
    /blocking.*mirage|BLOCKING/i.test(src)
  );
}

// ──────────────────────────────────────────────
// PlanAuditor behavioral invariants (F9)
// ──────────────────────────────────────────────
console.log('\n=== PlanAuditor — Behavioral Invariants ===');
{
  const src = readAgent('PlanAuditor-subagent');

  check(
    'PlanAuditor: APPROVED, NEEDS_REVISION, REJECTED status values present',
    /APPROVED/i.test(src) && /NEEDS_REVISION/i.test(src) && /REJECTED/i.test(src)
  );

  check(
    'PlanAuditor: executability_checklist output field documented',
    /executability_checklist/i.test(src)
  );

  check(
    'PlanAuditor: failure classification required on non-approved outcomes',
    /Failure Classification|failure.*class/i.test(src)
  );
}

// ──────────────────────────────────────────────
// Planner — Design Step (Step 7) assertions
// ──────────────────────────────────────────────
console.log('\n=== Planner — Design Step (Step 7) ===');
{
  const src = readAgent('Planner');

  check(
    'Design checklist: Boundary changes dimension present',
    /Boundary/i.test(src)
  );

  check(
    'Design checklist: Data/artifact flow dimension present',
    /data.*artifact.*flow|Data\/artifact flow/i.test(src)
  );

  check(
    'Design checklist: Temporal choreography dimension present',
    /temporal/i.test(src)
  );

  check(
    'Design checklist: Constraints & trade-offs dimension present',
    /Constraints/i.test(src) && /trade-offs/i.test(src)
  );

  check(
    'Tier-gated diagrams: TRIVIAL and SMALL exempt from supplemental diagrams',
    /TRIVIAL.*SMALL.*No supplemental diagrams|TRIVIAL \/ SMALL.*No supplemental/i.test(src)
  );

  check(
    'Tier-gated diagrams: MEDIUM conditionally requires sequenceDiagram',
    /MEDIUM.*sequenceDiagram/i.test(src)
  );

  check(
    'Tier-gated diagrams: LARGE unconditionally requires sequenceDiagram',
    /LARGE.*Always include.*sequenceDiagram/i.test(src)
  );
}

// ──────────────────────────────────────────────
// Plan Template — Design Decisions section
// ──────────────────────────────────────────────
console.log('\n=== Plan Template — Design Decisions Section ===');
{
  const template = readFileSync(join(ROOT, 'plans', 'templates', 'plan-document-template.md'), 'utf8');

  check(
    'Template: "### Design Decisions" section heading present',
    /^### Design Decisions$/m.test(template)
  );

  check(
    'Template: "#### Architectural Choices" subsection present',
    /^#### Architectural Choices$/m.test(template)
  );

  check(
    'Template: "#### Boundary & Integration Points" subsection present',
    /^#### Boundary & Integration Points$/m.test(template)
  );

  check(
    'Template: "#### Temporal Flow" subsection present',
    /^#### Temporal Flow$/m.test(template)
  );

  check(
    'Template: "#### Constraints & Trade-offs" subsection present',
    /^#### Constraints & Trade-offs$/m.test(template)
  );

  check(
    'Template: Architecture Visualization — MEDIUM tier requires sequenceDiagram',
    /MEDIUM/i.test(template) && /sequenceDiagram/i.test(template)
  );

  check(
    'Template: Architecture Visualization — LARGE tier requires sequenceDiagram',
    /LARGE/i.test(template) && /sequenceDiagram/i.test(template)
  );

  check(
    'Template: Architecture Visualization — Baseline DAG for 3+ phases',
    /3\+?\s*phases/i.test(template) && /DAG/i.test(template)
  );
}

// ──────────────────────────────────────────────
// Mermaid Scenario — medium-tier case
// ──────────────────────────────────────────────
console.log('\n=== Mermaid Scenario — medium-tier-requires-sequence-diagram ===');
{
  const scenario = JSON.parse(readFileSync(join(ROOT, 'evals', 'scenarios', 'planner-mermaid-output.json'), 'utf8'));
  const mediumInput = scenario.inputs?.find(i => i.label === 'medium-tier-requires-sequence-diagram');

  check(
    'Mermaid scenario: medium-tier-requires-sequence-diagram input case exists',
    mediumInput != null
  );

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
// Orchestrator behavioral invariants
// ──────────────────────────────────────────────
console.log('\n=== Orchestrator — Behavioral Invariants ===');
{
  const src = readAgent('Orchestrator');

  // Archive section must reference repo-memory-hygiene.md Checklist C
  check(
    'Orchestrator Archive: Checklist C reference wired to repo-memory-hygiene.md',
    src.includes('Checklist C') && src.includes('repo-memory-hygiene.md')
  );
}

// ──────────────────────────────────────────────
// Shared policy behavioral invariants
// ──────────────────────────────────────────────
console.log('\n=== Shared Policy — Behavioral Invariants ===');
{
  const src = readShared();

  // Failure classification: all 4 categories present
  check(
    'Failure classification: transient, fixable, needs_replan, escalate',
    /transient/i.test(src) && /fixable/i.test(src) &&
    /needs_replan/i.test(src) && /escalate/i.test(src)
  );

  // Structured text output (no raw JSON in chat)
  check(
    'Output format: structured text, no raw JSON in chat',
    /do NOT output raw JSON/i.test(src)
  );

  // NOTES.md maintenance required
  check(
    'NOTES.md: persistent state maintenance required',
    /NOTES\.md/i.test(src) && /persistent state/i.test(src)
  );

  // P.A.R.T section order enforced
  check(
    'P.A.R.T: Prompt → Archive → Resources → Tools order enforced',
    /Prompt.*Archive.*Resources.*Tools/i.test(src)
  );

  // Complexity tiers defined
  check(
    'Complexity tiers: TRIVIAL / SMALL / MEDIUM / LARGE',
    /TRIVIAL/i.test(src) && /SMALL/i.test(src) &&
    /MEDIUM/i.test(src) && /LARGE/i.test(src)
  );
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
