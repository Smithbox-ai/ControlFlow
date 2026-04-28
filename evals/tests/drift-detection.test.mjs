/**
 * ControlFlow — Drift Detection Negative-Path Tests (Phase 9)
 *
 * For each new Phase 9 drift check we synthesize a broken input in memory and
 * confirm the check's underlying helper FAILS (or flags the drift). No on-disk
 * plan or schema is mutated.
 *
 * Exit 0 on all checks passed, exit 1 on any failure.
 *
 * See plans/artifacts/controlflow-revision/phase-1-existing-drift-checks.yaml
 * for the non-duplication inventory this file's coverage is scoped against.
 */

import { writeFileSync, mkdirSync, rmSync, readFileSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { tmpdir } from 'os';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import {
  MODEL_ROLE_CHECK_ENABLED,
  validateModelRole,
  validateAgentRoleIndex,
  parseRosterFromProjectContext,
  compareRosterEnum,
  parseResourcesRepoPaths,
  parseResourcesSchemaPaths,
  parsePlanFilesSection,
  buildPlanFileMap,
  findSharedAnchorMaps,
  findUnresolvedOverlaps,
  parseYamlConsumers,
  hasSharedAnchorMapFlag,
  validateByTierShape,
  validateReviewScopeFinalCoupling,
  validateOrchestratorCompactionInvariant,
  validateOrchestratorMemoryPromotionOrder,
  validateCodeReviewerSecurityModeSameLine,
  validateMemoryContentTaxonomy,
  validateMemoryUseDiscipline,
  validateSessionNotesTemplate,
  validateRepoMemoryHygieneChecklistC,
  validateRepoMemoryHygieneChecklistD,
  validateTutorialParity,
} from '../drift-checks.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

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

// ──────────────────────────────────────────────
// Check #1 — model_role resolution (enabled after Phase 2 spike pass)
// ──────────────────────────────────────────────
console.log('\n=== Check #1 — model_role resolution ===');
check(
  'Check #1 is enabled (Phase 2 spike passed)',
  MODEL_ROLE_CHECK_ENABLED === true
);

// Negative-path tests for validateModelRole helper
// A minimal routing JSON mirroring governance/model-routing.json shape
const _testRoutingJson = {
  roles: {
    'fast-readonly': {},
    'capable-implementer': {},
    'orchestration-capable': {},
    'capable-planner': {},
  },
};

// Test A: model_role value that is unknown/does not appear in routing.json roles
{
  const frontmatter = '---\nmodel: GPT-5.4 (copilot)\nmodel_role: unknown-role-foo\n---\n## Prompt\n';
  const result = validateModelRole(frontmatter, _testRoutingJson);
  check(
    'Test A: model_role: unknown-role-foo → validation fails',
    result.ok === false && result.errors.length > 0,
    `ok=${result.ok}, errors=${JSON.stringify(result.errors)}`
  );
}

// Test B: frontmatter with NO model_role key at all → all 13 agents must declare it
{
  const frontmatter = '---\nmodel: GPT-5.4 (copilot)\n---\n## Prompt\n';
  const result = validateModelRole(frontmatter, _testRoutingJson);
  check(
    'Test B: missing model_role key → validation fails',
    result.ok === false && result.errors.length > 0,
    `ok=${result.ok}, errors=${JSON.stringify(result.errors)}`
  );
}

// Test C: model_role value absent from governance/model-routing.json roles keys
{
  const frontmatter = '---\nmodel: GPT-5.4 (copilot)\nmodel_role: capable-planner-TYPO\n---\n## Prompt\n';
  const result = validateModelRole(frontmatter, _testRoutingJson);
  check(
    'Test C: model_role value absent from routing.json roles → validation fails',
    result.ok === false && result.errors.length > 0,
    `ok=${result.ok}, errors=${JSON.stringify(result.errors)}`
  );
}

// Test D: body contains a stray `model_role:` line but frontmatter omits it →
// validation must fail (frontmatter-scoping regression — CodeReviewer Phase 2)
{
  const file = '---\nmodel: GPT-5.4 (copilot)\n---\n## Prompt\n\nmodel_role: capable-planner\n';
  const result = validateModelRole(file, _testRoutingJson);
  check(
    'Test D: body-only model_role (no frontmatter key) → validation fails',
    result.ok === false && result.errors.length > 0,
    `ok=${result.ok}, errors=${JSON.stringify(result.errors)}`
  );
}

// ──────────────────────────────────────────────
// Check #2 — Roster ↔ enum bidirectional alignment
// ──────────────────────────────────────────────
console.log('\n=== Check #2 — Roster ↔ enum bidirectional alignment ===');
{
  const goodDoc = [
    '## Phase Executor Agents',
    '',
    '| Agent | Role |',
    '| --- | --- |',
    '| Alpha-subagent | thing |',
    '| Beta-subagent | thing |',
    '',
    '## Next Section',
  ].join('\n');

  const roster = parseRosterFromProjectContext(goodDoc);
  check(
    'positive: parser extracts the two executor agents from the table',
    roster.length === 2 && roster.includes('Alpha-subagent') && roster.includes('Beta-subagent'),
    `got [${roster.join(', ')}]`
  );

  // negative: enum missing one roster member
  const drift1 = compareRosterEnum(['Alpha-subagent', 'Beta-subagent'], ['Alpha-subagent']);
  check(
    'negative: roster-has-but-enum-missing flagged as drift',
    drift1.equal === false && drift1.extraInRoster.includes('Beta-subagent')
  );

  // negative: enum has extra agent not in roster
  const drift2 = compareRosterEnum(['Alpha-subagent'], ['Alpha-subagent', 'Gamma-subagent']);
  check(
    'negative: enum-has-but-roster-missing flagged as drift',
    drift2.equal === false && drift2.extraInEnum.includes('Gamma-subagent')
  );

  const ok = compareRosterEnum(['Alpha-subagent', 'Beta-subagent'], ['Beta-subagent', 'Alpha-subagent']);
  check('positive: equal-as-sets returns equal=true', ok.equal === true);
}

// ──────────────────────────────────────────────
// Check #3 — Agent Resources ↔ schemas existence (parser narrow scope)
// ──────────────────────────────────────────────
console.log('\n=== Check #3 — Agent Resources schema path parser ===');
{
  const agentMd = [
    '## Prompt',
    '',
    '`schemas/decoy-outside-resources.schema.json` should NOT be picked up.',
    '',
    '## Resources',
    '',
    '- `docs/agent-engineering/PART-SPEC.md`',
    '- `schemas/valid-one.schema.json`',
    '- `schemas/valid-two.schema.json`',
    '',
    '## Tools',
    '',
    '- `schemas/ignored-after-resources.schema.json`',
  ].join('\n');

  const paths = parseResourcesSchemaPaths(agentMd);
  check(
    'positive: only backticked schemas/*.json paths inside Resources are returned',
    paths.length === 2 && paths.includes('schemas/valid-one.schema.json') && paths.includes('schemas/valid-two.schema.json'),
    `got [${paths.join(', ')}]`
  );
  check(
    'negative: schema path outside Resources section is not picked up',
    !paths.includes('schemas/decoy-outside-resources.schema.json') &&
    !paths.includes('schemas/ignored-after-resources.schema.json')
  );

  // A broken resources list — the validator would then stat the files and fail;
  // here we simulate that by asserting the parser reports the (hypothetical) bad path.
  const brokenMd = [
    '## Resources',
    '',
    '- `schemas/this-file-does-not-exist-xyzzy.schema.json`',
    '',
    '## Tools',
  ].join('\n');
  const brokenPaths = parseResourcesSchemaPaths(brokenMd);
  check(
    'negative: nonexistent schema ref surfaces for existence check to catch',
    brokenPaths.length === 1 && brokenPaths[0].endsWith('xyzzy.schema.json')
  );

  const repoResourceMd = [
    '## Prompt',
    '',
    '`governance/outside-resources.json` should NOT be picked up.',
    '',
    '## Resources',
    '',
    '- `docs/agent-engineering/PART-SPEC.md`',
    '- `governance/runtime-policy.json`',
    '- `plans/`',
    '- `plans/artifacts/<task>/final_review.md`',
    '',
    '## Tools',
    '',
    '- `governance/ignored-after-resources.json`',
  ].join('\n');

  const resourcePaths = parseResourcesRepoPaths(repoResourceMd);
  check(
    'positive: repo resource parser keeps static docs/governance/directory paths inside Resources',
    resourcePaths.length === 3 &&
    resourcePaths.includes('docs/agent-engineering/PART-SPEC.md') &&
    resourcePaths.includes('governance/runtime-policy.json') &&
    resourcePaths.includes('plans/')
  );
  check(
    'negative: repo resource parser ignores outside-Resources and placeholder paths',
    !resourcePaths.includes('governance/outside-resources.json') &&
    !resourcePaths.includes('governance/ignored-after-resources.json') &&
    !resourcePaths.includes('plans/artifacts/<task>/final_review.md')
  );
}

// ──────────────────────────────────────────────
// Check #4 — Cross-plan file-overlap
// ──────────────────────────────────────────────
console.log('\n=== Check #4 — Cross-plan file-overlap parser + anchor-map discovery ===');
{
  // Parser: bullet-list backticked paths; strip "(new)" annotations; ignore non-path tokens.
  const planContent = [
    '### Phase 1',
    '- **Files:** `evals/validate.mjs`, `README.md` (new), `not-a-path`',
    '- **Tests:** `cd evals && npm test`',
    '',
    '### Phase 2',
    '- **Files:**',
    '  - `evals/tests/drift-detection.test.mjs` — new test file',
    '  - `plans/project-context.md` (read-only)',
    '',
  ].join('\n');

  const parsed = parsePlanFilesSection(planContent);
  check(
    'positive: single-line Files bullet captures backticked paths',
    parsed.includes('evals/validate.mjs') && parsed.includes('README.md')
  );
  check(
    'positive: "(new)" and "(read-only)" annotations stripped when part of the bullet tail',
    !parsed.some(p => /\(.*\)/.test(p)),
    `got [${parsed.join(', ')}]`
  );
  check(
    'positive: multi-line Files bullet captures indented sub-bullet paths',
    parsed.includes('evals/tests/drift-detection.test.mjs') && parsed.includes('plans/project-context.md')
  );
  check(
    'negative: non-path backtick token (no slash or dot) ignored',
    !parsed.includes('not-a-path') && !parsed.includes('cd evals && npm test')
  );

  // Full overlap scenario using a temp dir as ROOT.
  const tmpRoot = join(tmpdir(), `cf-drift-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  mkdirSync(join(tmpRoot, 'plans', 'artifacts', 'coord'), { recursive: true });

  writeFileSync(join(tmpRoot, 'plans', 'plan-a.md'),
    '### Phase 1\n- **Files:** `src/shared.ts`, `src/only-a.ts`\n', 'utf8');
  writeFileSync(join(tmpRoot, 'plans', 'plan-b.md'),
    '### Phase 1\n- **Files:** `src/shared.ts`, `src/only-b.ts`\n', 'utf8');

  const planPaths = ['plans/plan-a.md', 'plans/plan-b.md'];
  const mapNoAnchor = buildPlanFileMap(planPaths, tmpRoot);
  check(
    'positive: file-map records both plans for the shared file',
    mapNoAnchor.get('src/shared.ts')?.size === 2
  );

  const unresolvedNoAnchor = findUnresolvedOverlaps(mapNoAnchor, findSharedAnchorMaps(tmpRoot));
  check(
    'negative: overlap without any shared anchor-map is flagged unresolved',
    unresolvedNoAnchor.length === 1 &&
    unresolvedNoAnchor[0].file === 'src/shared.ts' &&
    unresolvedNoAnchor[0].planA === 'plans/plan-a.md' &&
    unresolvedNoAnchor[0].planB === 'plans/plan-b.md'
  );

  // Write an anchor map covering both consumers — overlap becomes coordinated.
  writeFileSync(
    join(tmpRoot, 'plans', 'artifacts', 'coord', 'anchor.yaml'),
    [
      'shared_anchor_map: true',
      'rule: test-coord',
      'consumers:',
      '  - plans/plan-a.md',
      '  - plans/plan-b.md',
      '',
    ].join('\n'),
    'utf8'
  );

  const anchorMaps = findSharedAnchorMaps(tmpRoot);
  check(
    'positive: anchor map is discovered under plans/artifacts/*/',
    anchorMaps.length === 1 && anchorMaps[0].consumers.length === 2
  );
  check(
    'positive: hasSharedAnchorMapFlag recognises the top-level flag',
    hasSharedAnchorMapFlag('shared_anchor_map: true\nfoo: bar\n') === true
  );
  check(
    'negative: hasSharedAnchorMapFlag rejects flag when set false',
    hasSharedAnchorMapFlag('shared_anchor_map: false\n') === false
  );
  check(
    'positive: parseYamlConsumers reads list items under top-level consumers',
    (() => {
      const cs = parseYamlConsumers('consumers:\n  - a\n  - b\nother: 1\n');
      return cs.length === 2 && cs[0] === 'a' && cs[1] === 'b';
    })()
  );

  const mapWithAnchor = buildPlanFileMap(planPaths, tmpRoot);
  const unresolvedWithAnchor = findUnresolvedOverlaps(mapWithAnchor, anchorMaps);
  check(
    'positive: overlap disappears from unresolved set when anchor-map covers both plans',
    unresolvedWithAnchor.length === 0
  );

  // Negative: anchor-map with only one of the two plans listed — still unresolved.
  writeFileSync(
    join(tmpRoot, 'plans', 'artifacts', 'coord', 'anchor.yaml'),
    [
      'shared_anchor_map: true',
      'consumers:',
      '  - plans/plan-a.md',
      '',
    ].join('\n'),
    'utf8'
  );
  const partialAnchorMaps = findSharedAnchorMaps(tmpRoot);
  const unresolvedPartial = findUnresolvedOverlaps(mapWithAnchor, partialAnchorMaps);
  check(
    'negative: anchor-map missing one of the two consumers still flags overlap',
    unresolvedPartial.length === 1
  );

  try { rmSync(tmpRoot, { recursive: true, force: true }); } catch { /* best-effort */ }
}

// ──────────────────────────────────────────────
// Check #5 — agent_role_index consistency (validateAgentRoleIndex)
// ──────────────────────────────────────────────
console.log('\n=== Check #5 — agent_role_index consistency ===');
{
  const validRouting = {
    roles: {
      alpha: { consumers: ['Alpha.agent.md'] },
      beta: { consumers: ['Beta.agent.md'] },
    },
    agent_role_index: {
      Alpha: 'alpha',
      Beta: 'beta',
    },
  };

  const pos = validateAgentRoleIndex(validRouting);
  check(
    'P5-1: valid agent_role_index matches consumers bidirectionally → ok=true',
    pos.ok === true && pos.errors.length === 0,
    `ok=${pos.ok}, errors=${JSON.stringify(pos.errors)}`
  );

  const missingIndex = validateAgentRoleIndex({
    roles: validRouting.roles,
  });
  check(
    'N5-1a: missing top-level agent_role_index object → ok=false',
    missingIndex.ok === false && missingIndex.errors.some(e => e.includes('agent_role_index key missing or not an object')),
    `ok=${missingIndex.ok}, errors=${JSON.stringify(missingIndex.errors)}`
  );

  const missingAgent = validateAgentRoleIndex({
    roles: validRouting.roles,
    agent_role_index: {
      Alpha: 'alpha',
    },
  });
  check(
    'N5-1: consumers agent missing from agent_role_index → ok=false',
    missingAgent.ok === false && missingAgent.errors.some(e => e.includes('Beta') && e.includes('missing')),
    `ok=${missingAgent.ok}, errors=${JSON.stringify(missingAgent.errors)}`
  );

  const wrongRole = validateAgentRoleIndex({
    roles: validRouting.roles,
    agent_role_index: {
      Alpha: 'beta',
      Beta: 'beta',
    },
  });
  check(
    'N5-2: agent_role_index wrong role mapping against consumers → ok=false',
    wrongRole.ok === false && wrongRole.errors.some(e => e.includes('Alpha') && e.includes('beta')),
    `ok=${wrongRole.ok}, errors=${JSON.stringify(wrongRole.errors)}`
  );

  const extraAgent = validateAgentRoleIndex({
    roles: validRouting.roles,
    agent_role_index: {
      Alpha: 'alpha',
      Beta: 'beta',
      Ghost: 'alpha',
    },
  });
  check(
    'N5-3: extra agent_role_index entry not present in consumers → ok=false',
    extraAgent.ok === false && extraAgent.errors.some(e => e.includes('Ghost') && e.includes('consumers')),
    `ok=${extraAgent.ok}, errors=${JSON.stringify(extraAgent.errors)}`
  );
}

// ──────────────────────────────────────────────
// Check #6 — by_tier matrix shape (validateByTierShape)
// ──────────────────────────────────────────────
console.log('\n=== Check #6 — by_tier matrix shape ===');
{
  // N1: Role missing by_tier entirely → fails
  const n1 = validateByTierShape({ roles: { 'my-role': {} } });
  check(
    'N1: role missing by_tier entirely → validateByTierShape fails',
    n1.ok === false && n1.errors.some(e => e.includes('missing by_tier')),
    `ok=${n1.ok}, errors=${JSON.stringify(n1.errors)}`
  );

  // N2: Role has by_tier but missing LARGE tier → fails
  const n2 = validateByTierShape({
    roles: {
      'my-role': {
        by_tier: {
          TRIVIAL: { inherit_from: 'default' },
          SMALL:   { inherit_from: 'default' },
          MEDIUM:  { inherit_from: 'default' },
          // LARGE deliberately omitted
        },
      },
    },
  });
  check(
    'N2: by_tier missing LARGE tier → validateByTierShape fails',
    n2.ok === false && n2.errors.some(e => e.includes('"LARGE"')),
    `ok=${n2.ok}, errors=${JSON.stringify(n2.errors)}`
  );

  // N3: Role has by_tier with unknown tier key HUGE → fails
  const n3 = validateByTierShape({
    roles: {
      'my-role': {
        by_tier: {
          TRIVIAL: { inherit_from: 'default' },
          SMALL:   { inherit_from: 'default' },
          MEDIUM:  { inherit_from: 'default' },
          LARGE:   { inherit_from: 'default' },
          HUGE:    { inherit_from: 'default' },
        },
      },
    },
  });
  check(
    'N3: by_tier contains unknown tier HUGE → validateByTierShape fails',
    n3.ok === false && n3.errors.some(e => e.includes('HUGE')),
    `ok=${n3.ok}, errors=${JSON.stringify(n3.errors)}`
  );

  // Positive: well-formed role with all 4 tiers, mixed inherit_from and full override → ok=true
  const pos = validateByTierShape({
    roles: {
      'my-role': {
        by_tier: {
          TRIVIAL: { inherit_from: 'default' },
          SMALL:   { inherit_from: 'default' },
          MEDIUM: {
            primary: 'GPT-4o (copilot)',
            fallbacks: ['Claude Sonnet 4.5 (copilot)'],
            cost_tier: 'medium',
            latency_tier: 'medium',
          },
          LARGE: {
            primary: 'Claude Sonnet 4.5 (copilot)',
            fallbacks: ['GPT-4o (copilot)'],
            cost_tier: 'high',
            latency_tier: 'slow',
          },
        },
      },
    },
  });
  check(
    'positive: well-formed role with all 4 tiers (mixed inherit/override) → ok=true',
    pos.ok === true && pos.errors.length === 0,
    `ok=${pos.ok}, errors=${JSON.stringify(pos.errors)}`
  );
}

// ──────────────────────────────────────────────
// Check #7 — Reference-integrity: model-routing.json pointer
// ──────────────────────────────────────────────
console.log('\n=== Check #7 — Reference-integrity: model-routing.json ===');
{
  const ROOT = join(__dirname, '..', '..');
  const projectContextPath = join(ROOT, 'plans', 'project-context.md');
  const routingJsonPath = join(ROOT, 'governance', 'model-routing.json');

  // RI-1: plans/project-context.md contains a reference to governance/model-routing.json
  const projectContextContent = readFileSync(projectContextPath, 'utf8');
  check(
    'RI-1: plans/project-context.md contains reference to governance/model-routing.json',
    projectContextContent.includes('governance/model-routing.json')
  );

  // RI-2: governance/model-routing.json actually exists on disk (resolvable)
  check(
    'RI-2: governance/model-routing.json exists on disk',
    existsSync(routingJsonPath)
  );

  // RI-3: model_role values in agent frontmatters are valid routing JSON role keys
  //       AND all consumers[] entries across all roles collectively cover all 13 agent filenames.
  const routingJson = JSON.parse(readFileSync(routingJsonPath, 'utf8'));

  // Collect all consumers registered in routing JSON
  const allConsumers = new Set();
  for (const role of Object.values(routingJson.roles || {})) {
    for (const c of (role.consumers || [])) {
      allConsumers.add(c);
    }
  }

  // Read all 13 *.agent.md files from repo root
  const agentFiles = readdirSync(ROOT).filter(f => f.endsWith('.agent.md'));
  let allRolesValid = true;
  const roleErrors = [];

  for (const agentFile of agentFiles) {
    const content = readFileSync(join(ROOT, agentFile), 'utf8');
    const result = validateModelRole(content, routingJson);
    if (!result.ok) {
      allRolesValid = false;
      roleErrors.push(`${agentFile}: ${result.errors.join(', ')}`);
    }
  }

  // Every agent filename must appear in at least one consumers[] list
  const uncoveredAgents = agentFiles.filter(f => !allConsumers.has(f));

  check(
    'RI-3: all model_role values in agent frontmatters are valid role keys AND all 13 agents appear in consumers[]',
    allRolesValid && uncoveredAgents.length === 0,
    allRolesValid && uncoveredAgents.length === 0
      ? ''
      : `roleErrors=[${roleErrors.join('; ')}] uncovered=[${uncoveredAgents.join(', ')}]`
  );
}

// ──────────────────────────────────────────────
// Check #8 — Compaction Ladder presence in MEMORY-ARCHITECTURE.md
// ──────────────────────────────────────────────
console.log('\n=== Check #8 — Compaction Ladder presence in MEMORY-ARCHITECTURE.md ===');
{
  const ROOT = join(__dirname, '..', '..');
  const maPath = join(ROOT, 'docs', 'agent-engineering', 'MEMORY-ARCHITECTURE.md');
  const content = existsSync(maPath) ? readFileSync(maPath, 'utf8') : '';

  check(
    'C1: MEMORY-ARCHITECTURE.md contains heading "Compaction Ladder"',
    content.includes('Compaction Ladder')
  );

  const sentinels = ['L1', 'L2', 'L3', 'L4', 'L5'];
  check(
    `C2: MEMORY-ARCHITECTURE.md contains all sentinel labels ${sentinels.join(', ')}`,
    sentinels.every(s => content.includes(s)),
    `missing: [${sentinels.filter(s => !content.includes(s)).join(', ')}]`
  );
}

// ──────────────────────────────────────────────
// Check #9 — Rule 6 / Tool Output Spill presence in TOOL-ROUTING.md
// ──────────────────────────────────────────────
console.log('\n=== Check #9 — Rule 6 / Tool Output Spill presence in TOOL-ROUTING.md ===');
{
  const ROOT = join(__dirname, '..', '..');
  const trPath = join(ROOT, 'docs', 'agent-engineering', 'TOOL-ROUTING.md');
  const content = existsSync(trPath) ? readFileSync(trPath, 'utf8') : '';

  const rule6Idx = content.indexOf('Rule 6');
  const spillIdx = content.indexOf('Tool Output Spill');
  check(
    'D1: TOOL-ROUTING.md contains "Rule 6" and "Tool Output Spill" within 100 chars of each other',
    rule6Idx !== -1 && spillIdx !== -1 && Math.abs(rule6Idx - spillIdx) <= 100,
    `rule6Idx=${rule6Idx}, spillIdx=${spillIdx}`
  );

  check(
    'D2: TOOL-ROUTING.md references "tool_output_policy"',
    content.includes('tool_output_policy')
  );
}

// ──────────────────────────────────────────────
// Check #10 — review_scope=final bidirectional coupling
// ──────────────────────────────────────────────
console.log('\n=== Check #10 — review_scope=final bidirectional coupling ===');
{
  // Positive: both agent and schema reference "final" → ok=true
  const agentWithFinal = '## Prompt\n\n### Final Scope (`review_scope=final`)\n\nsome text\n';
  const schemaWithFinal = { properties: { review_scope: { enum: ['phase', 'wave', 'final'] } } };
  const pos = validateReviewScopeFinalCoupling(agentWithFinal, schemaWithFinal);
  check(
    'F1: both agent references review_scope=final and schema enum has "final" → ok=true',
    pos.ok === true && pos.agentReferencesFinal === true && pos.schemaHasFinal === true,
    `ok=${pos.ok}, agentReferencesFinal=${pos.agentReferencesFinal}, schemaHasFinal=${pos.schemaHasFinal}`
  );

  // Negative: agent references "final" but schema enum lacks it → drift detected
  const schemaMissingFinal = { properties: { review_scope: { enum: ['phase', 'wave'] } } };
  const n1 = validateReviewScopeFinalCoupling(agentWithFinal, schemaMissingFinal);
  check(
    'F2: agent references review_scope=final but schema enum lacks "final" → drift detected',
    n1.ok === false && n1.errors.length > 0 && n1.agentReferencesFinal === true && n1.schemaHasFinal === false,
    `ok=${n1.ok}, errors=${JSON.stringify(n1.errors)}`
  );

  // Negative: schema has "final" but agent never references it → drift detected
  const agentWithoutFinal = '## Prompt\n\nThis agent does not mention final scope.\n';
  const n2 = validateReviewScopeFinalCoupling(agentWithoutFinal, schemaWithFinal);
  check(
    'F3: schema review_scope enum contains "final" but agent has no reference → drift detected',
    n2.ok === false && n2.errors.length > 0 && n2.agentReferencesFinal === false && n2.schemaHasFinal === true,
    `ok=${n2.ok}, errors=${JSON.stringify(n2.errors)}`
  );

  // Real-world positive: actual CodeReviewer-subagent.agent.md + code-reviewer.verdict.schema.json must be coupled
  const ROOT_REAL = join(__dirname, '..', '..');
  const realAgent = existsSync(join(ROOT_REAL, 'CodeReviewer-subagent.agent.md'))
    ? readFileSync(join(ROOT_REAL, 'CodeReviewer-subagent.agent.md'), 'utf8')
    : '';
  let realSchema = {};
  try {
    realSchema = JSON.parse(readFileSync(join(ROOT_REAL, 'schemas', 'code-reviewer.verdict.schema.json'), 'utf8'));
  } catch { /* will fail below */ }
  const realResult = validateReviewScopeFinalCoupling(realAgent, realSchema);
  check(
    'F4: actual CodeReviewer-subagent.agent.md and code-reviewer.verdict.schema.json are coupled',
    realResult.ok === true,
    realResult.ok ? '' : `errors=${JSON.stringify(realResult.errors)}`
  );
}

// ──────────────────────────────────────────────
// Check #11 — Phase 5 negative-case drift tests (6 tests)
// ──────────────────────────────────────────────
console.log('\n=== Check #11 — Phase 5 negative-case drift tests ===');

// Set up AJV with runtime-policy schema for tests N11-1, N11-2, N11-3
const _rpSchemaPath = join(__dirname, '..', '..', 'schemas', 'runtime-policy.schema.json');
const _rpBaselinePath = join(__dirname, '..', 'scenarios', 'runtime-policy', 'valid-baseline.json');
const _ajv11 = new Ajv2020({ strict: false, allErrors: true });
addFormats(_ajv11);
let _rpValidate = null;
try {
  const rpSchema = JSON.parse(readFileSync(_rpSchemaPath, 'utf8'));
  _ajv11.addSchema(rpSchema);
  _rpValidate = _ajv11.compile(rpSchema);
} catch (e) {
  console.error(`  Check #11 setup: could not load runtime-policy schema — ${e.message}`);
}

// Helper: load valid baseline and strip metadata fields
function loadBaselineClone() {
  const raw = JSON.parse(readFileSync(_rpBaselinePath, 'utf8'));
  const { _expected_validation: _ev, _comment: _c, ...data } = raw;
  return JSON.parse(JSON.stringify(data));
}

// N11-1: runtime-policy.json missing compaction.max_consecutive_failures → validation fails
{
  if (_rpValidate) {
    const data = loadBaselineClone();
    delete data.compaction.max_consecutive_failures;
    const valid = _rpValidate(data);
    check(
      'N11-1: runtime-policy missing compaction.max_consecutive_failures → schema validation fails',
      valid === false,
      `valid=${valid}`
    );
  } else {
    check('N11-1: runtime-policy missing compaction.max_consecutive_failures → schema validation fails', false, 'schema not loaded');
  }
}

// N11-2: runtime-policy.json notes_md_max_lines is a string instead of integer → validation fails
{
  if (_rpValidate) {
    const data = loadBaselineClone();
    data.memory_hygiene.notes_md_max_lines = '20'; // string instead of integer
    const valid = _rpValidate(data);
    check(
      'N11-2: runtime-policy notes_md_max_lines as string instead of integer → schema validation fails',
      valid === false,
      `valid=${valid}`
    );
  } else {
    check('N11-2: runtime-policy notes_md_max_lines as string instead of integer → schema validation fails', false, 'schema not loaded');
  }
}

// N11-3: evals/scenarios/runtime-policy/invalid-misspelled-key.json (memry_hygiene typo) → validation fails
{
  if (_rpValidate) {
    const misspelledPath = join(__dirname, '..', 'scenarios', 'runtime-policy', 'invalid-misspelled-key.json');
    const raw = JSON.parse(readFileSync(misspelledPath, 'utf8'));
    const { _expected_validation: _ev, _comment: _c, ...data } = raw;
    const valid = _rpValidate(data);
    check(
      'N11-3: invalid-misspelled-key.json (memry_hygiene typo) → schema additionalProperties rejects it',
      valid === false,
      `valid=${valid}`
    );
  } else {
    check('N11-3: invalid-misspelled-key.json (memry_hygiene typo) → schema additionalProperties rejects it', false, 'schema not loaded');
  }
}

// N11-4: Orchestrator with Context Compaction Policy missing compaction.max_consecutive_failures
{
  const syntheticOrchestrator = [
    '## Prompt',
    '',
    '### Context Compaction Policy',
    '',
    '- If context failures exceed the limit, transition to WAITING_APPROVAL.',
    '  (max_consecutive_failures key deliberately omitted here)',
    '',
    '## Archive',
  ].join('\n');
  const result = validateOrchestratorCompactionInvariant(syntheticOrchestrator);
  check(
    'N11-4: Orchestrator Context Compaction Policy missing compaction.max_consecutive_failures → invariant fails',
    result.ok === false && result.errors.some(e => e.includes('compaction.max_consecutive_failures')),
    `ok=${result.ok}, errors=${JSON.stringify(result.errors)}`
  );
}

// N11-5: Orchestrator Agentic Memory Policy with memory-promotion-candidates.md AFTER Checklist C
{
  const syntheticOrchestrator = [
    '## Archive',
    '',
    '### Agentic Memory Policy',
    '',
    '- At each phase completion, run Checklist C of skills/patterns/repo-memory-hygiene.md.',
    '- Before running Checklist C, load skills/patterns/memory-promotion-candidates.md.',
    '',
    '## Resources',
  ].join('\n');
  const result = validateOrchestratorMemoryPromotionOrder(syntheticOrchestrator);
  check(
    'N11-5: Orchestrator Agentic Memory Policy with memory-promotion-candidates.md AFTER Checklist C → order assertion fails',
    result.ok === false && result.errors.some(e => e.includes('BEFORE')),
    `ok=${result.ok}, errors=${JSON.stringify(result.errors)}`
  );
}

// N11-6: CodeReviewer where review_mode: "security" and security-review-discipline.md are on different lines
{
  const syntheticCodeReviewer = [
    '## Prompt',
    '',
    '- When delegation payload contains review_mode: "security",',
    '  the agent MUST load skills/patterns/security-review-discipline.md.',
    '',
    '## Archive',
  ].join('\n');
  const result = validateCodeReviewerSecurityModeSameLine(syntheticCodeReviewer);
  check(
    'N11-6: CodeReviewer review_mode: "security" and security-review-discipline.md on different lines → same-line assertion fails',
    result.ok === false,
    `ok=${result.ok}, errors=${JSON.stringify(result.errors)}`
  );
}

// ──────────────────────────────────────────────
// Check #12 — Phase 5 negative tests for memory drift validators
// (5 memory drift functions + 1 tutorial-parity)
// ──────────────────────────────────────────────
console.log('\n=== Check #12 — Phase 5 memory drift + parity negative tests ===');

// N12-1: validateMemoryContentTaxonomy — missing canonical heading → pass: false
{
  const corrupted = '# MEMORY-ARCHITECTURE\n\nNo taxonomy section here.\n';
  const policy = { memory_hygiene: { memory_content_types: ['user', 'feedback'] } };
  const r = validateMemoryContentTaxonomy(corrupted, policy);
  check(
    'N12-1: validateMemoryContentTaxonomy with missing taxonomy heading → pass=false',
    r.pass === false && typeof r.reason === 'string' && r.reason.length > 0,
    `pass=${r.pass}, reason=${r.reason}`
  );
}

// N12-2: validateMemoryUseDiscipline — missing required heading → pass: false
{
  const corrupted = '# PROMPT BEHAVIOR CONTRACT\n\nNo memory section.\n';
  const r = validateMemoryUseDiscipline(corrupted, { expected: {} });
  check(
    'N12-2: validateMemoryUseDiscipline with missing § 7 heading → pass=false',
    r.pass === false && typeof r.reason === 'string' && r.reason.length > 0,
    `pass=${r.pass}, reason=${r.reason}`
  );
}

// N12-3: validateSessionNotesTemplate — missing required section → pass: false
{
  const corrupted = '# Session Notes\n\nNo required sections present.\n';
  const scenario = { expected: { session_notes_sections: ['## Active Objective', '## Blockers'] } };
  const r = validateSessionNotesTemplate(corrupted, scenario);
  check(
    'N12-3: validateSessionNotesTemplate with missing required section → pass=false',
    r.pass === false && typeof r.reason === 'string' && r.reason.length > 0,
    `pass=${r.pass}, reason=${r.reason}`
  );
}

// N12-4: validateRepoMemoryHygieneChecklistC — missing Checklist C heading → pass: false
{
  const corrupted = '# repo-memory-hygiene\n\nNo Checklist C anywhere.\n';
  const r = validateRepoMemoryHygieneChecklistC(corrupted, { expected: {} });
  check(
    'N12-4: validateRepoMemoryHygieneChecklistC with missing heading → pass=false',
    r.pass === false && typeof r.reason === 'string' && r.reason.length > 0,
    `pass=${r.pass}, reason=${r.reason}`
  );
}

// N12-5: validateRepoMemoryHygieneChecklistD — missing Checklist D heading → pass: false
{
  const corrupted = '# repo-memory-hygiene\n\n## Checklist C\n\n- only C, no D.\n';
  const r = validateRepoMemoryHygieneChecklistD(corrupted, { expected: {} });
  check(
    'N12-5: validateRepoMemoryHygieneChecklistD with missing heading → pass=false',
    r.pass === false && typeof r.reason === 'string' && r.reason.length > 0,
    `pass=${r.pass}, reason=${r.reason}`
  );
}

// N12-6: validateTutorialParity — synthesized divergent EN/RU dirs → pass: false
{
  const tmpRoot = join(tmpdir(), `parity-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(tmpRoot, { recursive: true });
  const enDir = join(tmpRoot, 'en');
  const ruDir = join(tmpRoot, 'ru');
  mkdirSync(enDir, { recursive: true });
  mkdirSync(ruDir, { recursive: true });
  writeFileSync(join(enDir, '14-evals.md'), '## Heading One\n\ntext\n\n## Heading Two\n\ntext\n');
  writeFileSync(join(ruDir, '14-evals.md'), '## Заголовок Один\n\ntext\n\n## Совершенно Другой\n\ntext\n');
  const allowlist = {
    _status: 'active',
    _chapters_in_scope: ['14-evals.md'],
    en_only: [],
    ru_only: [],
    heading_aliases: { 'Heading One': 'Заголовок Один' /* Heading Two intentionally unmapped */ }
  };
  let r;
  try {
    r = validateTutorialParity(enDir, ruDir, allowlist);
  } finally {
    rmSync(tmpRoot, { recursive: true, force: true });
  }
  check(
    'N12-6: validateTutorialParity with EN/RU heading divergence outside allowlist → pass=false',
    r.pass === false && (typeof r.reason === 'string' || (r.headingMismatches && r.headingMismatches.length > 0)),
    `pass=${r.pass}, reason=${r.reason}, mismatches=${JSON.stringify(r.headingMismatches)}`
  );
}

// ──────────────────────────────────────────────
// Summary
// ──────────────────────────────────────────────
const total = passed + failed;
const bar = '='.repeat(50);
console.log(`\n${bar}`);
console.log(`Drift-detection: ${total} checks | ${passed} passed | ${failed} failed`);
console.log(bar);

if (failed > 0) {
  console.error(`\n${failed} drift-detection check(s) failed.\n`);
  process.exit(1);
}
console.log('\nAll drift-detection checks passed ✅\n');
