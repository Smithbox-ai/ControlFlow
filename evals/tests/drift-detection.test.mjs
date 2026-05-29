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
  validateFrontmatterModelDefaults,
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
  parseYamlSharedFiles,
  hasSharedAnchorMapFlag,
  validateByTierShape,
  validatePayloadModelDescriptionSemantics,
  validateModelResolutionScenarioNegatives,
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
  validateCanonicalSourceMatrixContract,
  validateProjectContextRegistryMirror,
  validateToolCountLabelConsistency,
  validatePatternFileLineBudget,
  countTextLines,
  scanDocCountMismatches,
  validateDocCountConsistency,
  validatePluginGenerationParity,
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

// Negative/positive coverage for direct-invocation frontmatter defaults.
// Semantics key off pinned_agents membership: pinned agents must declare a
// frontmatter `model:` matching the role top-level primary; non-pinned (auto)
// agents must omit `model:` entirely so Copilot's picker selects it.
{
  const routingJson = {
    pinned_agents: ['Orchestrator.agent.md'],
    roles: {
      'orchestration-capable': {
        primary: 'Claude Opus 4.8 (copilot)',
        by_tier: {
          LARGE: { primary: 'GPT-5.5 (copilot)' },
        },
      },
      'capable-implementer': {
        primary: 'Claude Sonnet 4.6 (copilot)',
        by_tier: {
          TRIVIAL: { primary: 'GPT-5.4 mini (copilot)' },
          LARGE: { primary: 'GPT-5.5 (copilot)' },
        },
      },
    },
  };

  // (a) PINNED agent WITHOUT model: → fail (missing model)
  const pinnedMissingModel = validateFrontmatterModelDefaults(
    'Orchestrator.agent.md',
    '---\nmodel_role: orchestration-capable\n---\n## Prompt\n',
    routingJson
  );
  check(
    'Test E: pinned agent missing frontmatter model -> validation fails',
    pinnedMissingModel.ok === false && pinnedMissingModel.errors.some(e => e.includes('model key missing')),
    `ok=${pinnedMissingModel.ok}, errors=${JSON.stringify(pinnedMissingModel.errors)}`
  );

  // (b) PINNED agent WITH model: !== role primary → fail ("top-level primary" mismatch)
  const pinnedMismatch = validateFrontmatterModelDefaults(
    'Orchestrator.agent.md',
    '---\nmodel: GPT-5.5 (copilot)\nmodel_role: orchestration-capable\n---\n## Prompt\n',
    routingJson
  );
  check(
    'Test F: pinned agent model differing from role default primary -> validation fails',
    pinnedMismatch.ok === false && pinnedMismatch.errors.some(e => e.includes('top-level primary')),
    `ok=${pinnedMismatch.ok}, errors=${JSON.stringify(pinnedMismatch.errors)}`
  );

  // (c) PINNED agent WITH model: === role primary → PASS
  const pinnedMatch = validateFrontmatterModelDefaults(
    'Orchestrator.agent.md',
    '---\nmodel: Claude Opus 4.8 (copilot)\nmodel_role: orchestration-capable\n---\n## Prompt\n',
    routingJson
  );
  check(
    'Test G: pinned agent model matches role default primary despite by_tier overrides -> validation passes',
    pinnedMatch.ok === true,
    `ok=${pinnedMatch.ok}, errors=${JSON.stringify(pinnedMatch.errors)}`
  );

  // (d) NON-pinned agent WITH model: present → fail (model must be absent on auto agent)
  const autoWithModel = validateFrontmatterModelDefaults(
    'CoreImplementer-subagent.agent.md',
    '---\nmodel: Claude Sonnet 4.6 (copilot)\nmodel_role: capable-implementer\n---\n## Prompt\n',
    routingJson
  );
  check(
    'Test H: non-pinned (auto) agent with frontmatter model present -> validation fails',
    autoWithModel.ok === false && autoWithModel.errors.some(e => e.includes('non-pinned (auto) agent')),
    `ok=${autoWithModel.ok}, errors=${JSON.stringify(autoWithModel.errors)}`
  );

  // (e) NON-pinned agent WITHOUT model: → PASS
  const autoNoModel = validateFrontmatterModelDefaults(
    'CoreImplementer-subagent.agent.md',
    '---\nmodel_role: capable-implementer\n---\n## Prompt\n',
    routingJson
  );
  check(
    'Test I: non-pinned (auto) agent omitting frontmatter model -> validation passes',
    autoNoModel.ok === true,
    `ok=${autoNoModel.ok}, errors=${JSON.stringify(autoNoModel.errors)}`
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
    '- **Files:** `edit/editFiles`, `agent/runSubagent`',
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
    'negative: non-path and tool-id backtick tokens are ignored',
    !parsed.includes('not-a-path') &&
      !parsed.includes('cd evals && npm test') &&
      !parsed.includes('edit/editFiles') &&
      !parsed.includes('agent/runSubagent')
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

  // Negative: consumer-only anchor map (no shared_files) — file-level overlap stays unresolved.
  writeFileSync(
    join(tmpRoot, 'plans', 'artifacts', 'coord', 'anchor.yaml'),
    [
      'shared_anchor_map: true',
      'consumers:',
      '  - plans/plan-a.md',
      '  - plans/plan-b.md',
      '',
    ].join('\n'),
    'utf8'
  );

  {
    const consumerOnlyMaps = findSharedAnchorMaps(tmpRoot);
    check(
      'negative: consumer-only anchor-map has empty sharedFiles array',
      Array.isArray(consumerOnlyMaps[0]?.sharedFiles) && consumerOnlyMaps[0].sharedFiles.length === 0
    );
    const unresolvedConsumerOnly = findUnresolvedOverlaps(mapNoAnchor, consumerOnlyMaps);
    check(
      'negative: consumer-only anchor-map (no shared_files) does not mask file-level overlap',
      unresolvedConsumerOnly.length === 1
    );
  }

  // Write an anchor map covering both consumers with explicit shared_files — overlap becomes coordinated.
  writeFileSync(
    join(tmpRoot, 'plans', 'artifacts', 'coord', 'anchor.yaml'),
    [
      'shared_anchor_map: true',
      'rule: test-coord',
      'consumers:',
      '  - plans/plan-a.md',
      '  - plans/plan-b.md',
      'shared_files:',
      '  - src/shared.ts',
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
    'positive: anchor map sharedFiles is populated from shared_files YAML key',
    Array.isArray(anchorMaps[0]?.sharedFiles) && anchorMaps[0].sharedFiles.includes('src/shared.ts')
  );
  check(
    'positive: parseYamlSharedFiles reads list items under top-level shared_files',
    (() => {
      const sf = parseYamlSharedFiles('shared_files:\n  - a/b.ts\n  - c/d.ts\nother: 1\n');
      return sf.length === 2 && sf[0] === 'a/b.ts' && sf[1] === 'c/d.ts';
    })()
  );
  check(
    'positive: parseYamlSharedFiles reads legacy shared_surfaces as explicit file coverage',
    (() => {
      const sf = parseYamlSharedFiles('shared_surfaces:\n  - docs/agent-engineering/\n  - Orchestrator.agent.md\nother: 1\n');
      return sf.length === 2 && sf.includes('docs/agent-engineering/') && sf.includes('Orchestrator.agent.md');
    })()
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

  writeFileSync(join(tmpRoot, 'plans', 'plan-c.md'),
    '### Phase 1\n- **Files:** `docs/agent-engineering/MODEL-ROUTING.md`\n', 'utf8');
  writeFileSync(join(tmpRoot, 'plans', 'plan-d.md'),
    '### Phase 1\n- **Files:** `docs/agent-engineering/MODEL-ROUTING.md`\n', 'utf8');
  writeFileSync(
    join(tmpRoot, 'plans', 'artifacts', 'coord', 'dir-anchor.yaml'),
    [
      'shared_anchor_map: true',
      'shared_files:',
      '  - docs/agent-engineering/',
      'consumers:',
      '  - plans/plan-c.md',
      '  - plans/plan-d.md',
      '',
    ].join('\n'),
    'utf8'
  );
  const dirMap = buildPlanFileMap(['plans/plan-c.md', 'plans/plan-d.md'], tmpRoot);
  const unresolvedDirAnchor = findUnresolvedOverlaps(dirMap, findSharedAnchorMaps(tmpRoot));
  check(
    'positive: shared_files directory entry covers files below that directory',
    unresolvedDirAnchor.length === 0,
    `unresolved=${JSON.stringify(unresolvedDirAnchor)}`
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
            fallbacks: ['Claude Sonnet 4.6 (copilot)'],
            cost_tier: 'medium',
            latency_tier: 'medium',
          },
          LARGE: {
            primary: 'Claude Sonnet 4.6 (copilot)',
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
// Check #6b — payload model description semantics
// ──────────────────────────────────────────────
console.log('\n=== Check #6b — payload model description semantics ===');
{
  const validDescription = 'Payload-level model field carrying governance-resolved model context for delegation contract, validation, and audit context. Runtime enforcement is the outer tool-call model parameter passed to agent/runSubagent; this payload field does not by itself override frontmatter or select the runtime model. Deterministic mode requires this payload field; auto mode may omit it when runtime_model_mode is auto.';
  const validSchema = {
    properties: {
      agents: {
        properties: {
          Planner: {
            required: ['task_description'],
            properties: {
              runtime_model_mode: {
                type: 'string',
                enum: ['deterministic', 'auto'],
              },
              model: {
                type: 'string',
                description: validDescription,
              },
            },
            allOf: [
              {
                else: { required: ['model'] },
              },
            ],
          },
        },
      },
    },
  };

  const positive = validatePayloadModelDescriptionSemantics(validSchema);
  check(
    'positive: payload model description names payload-level context, outer tool-call model, and non-override semantics',
    positive.ok === true,
    `ok=${positive.ok}, errors=${JSON.stringify(positive.errors)}`
  );

  const conflatedSchema = JSON.parse(JSON.stringify(validSchema));
  conflatedSchema.properties.agents.properties.Planner.properties.model.description =
    "Runtime-resolved model string from governance/model-routing.json. Orchestrator sets this when dispatching to override the agent's literal frontmatter model.";
  const conflated = validatePayloadModelDescriptionSemantics(conflatedSchema);
  check(
    'negative: payload model description that implies nested field overrides frontmatter -> drift detected',
    conflated.ok === false && conflated.errors.some(e => e.includes('does not by itself override frontmatter')),
    `ok=${conflated.ok}, errors=${JSON.stringify(conflated.errors)}`
  );

  const missingRequiredSchema = JSON.parse(JSON.stringify(validSchema));
  missingRequiredSchema.properties.agents.properties.Planner.allOf = [];
  const missingRequired = validatePayloadModelDescriptionSemantics(missingRequiredSchema);
  check(
    'negative: payload object missing conditional model requirement -> drift detected',
    missingRequired.ok === false && missingRequired.errors.some(e => e.includes('conditionally required')),
    `ok=${missingRequired.ok}, errors=${JSON.stringify(missingRequired.errors)}`
  );
}

// ──────────────────────────────────────────────
// Check #6c — model resolution scenario negative cases
// ──────────────────────────────────────────────
console.log('\n=== Check #6c — model resolution scenario negative cases ===');
{
  const validScenario = {
    input: {
      dispatch_contract: {
        outer_agentName_field: 'agentName',
        outer_model_field: 'model',
        payload_model_field: 'model',
        payload_runtime_model_mode_field: 'runtime_model_mode',
        payload_model_is_runtime_enforcement_boundary: false,
      },
      negative_cases: [
        {
          case_id: 'missing-outer-agentName',
          broken_dispatch: {
            outer_fields: { agentName_present: false, model_present: true },
            payload_fields: { agentName_present: true, model_present: true },
          },
          expected: { rejected: true, violates: 'missing_outer_agentName', offline_detection_scope: 'structural_contract', live_runtime_assertion: false },
        },
        {
          case_id: 'missing-outer-model',
          broken_dispatch: {
            outer_fields: { agentName_present: true, model_present: false },
            payload_fields: { model_present: false },
          },
          expected: { rejected: true, violates: 'missing_outer_model', offline_detection_scope: 'structural_contract', live_runtime_assertion: false },
        },
        {
          case_id: 'payload-only-model',
          broken_dispatch: {
            outer_fields: { agentName_present: true, model_present: false },
            payload_fields: { model_present: true },
          },
          expected: { rejected: true, violates: 'payload_only_model', offline_detection_scope: 'structural_contract', live_runtime_assertion: false },
        },
        {
          case_id: 'auto-mode-missing-outer-model-allowed',
          input_context: { runtime_model_mode: 'auto' },
          broken_dispatch: {
            outer_fields: { agentName_present: true, model_present: false },
            payload_fields: { runtime_model_mode_present: true, runtime_model_mode: 'auto', model_present: false },
          },
          expected: { rejected: false, resolution_mode: 'platform_auto', runtime_model_mode_marker_required: true, offline_detection_scope: 'structural_contract', live_runtime_assertion: false },
        },
        {
          case_id: 'wrong-effective-review-tier',
          input_context: { plan_complexity_tier: 'MEDIUM', unresolved_high_risk: true },
          broken_resolution: { effective_review_tier: 'MEDIUM' },
          expected: { rejected: true, violates: 'wrong_effective_review_tier', effective_review_tier: 'LARGE', resolved_primary_model: 'Claude Opus 4.8 (copilot)', offline_detection_scope: 'structural_contract', live_runtime_assertion: false },
        },
        {
          case_id: 'unconfigured-fallback',
          input_context: { effective_review_tier: 'MEDIUM' },
          broken_retry: { model: 'Claude Opus 4.8 (copilot)', configured_fallbacks: ['GPT-5.4 (copilot)', 'GPT-5.5 (copilot)'] },
          expected: { rejected: true, violates: 'unconfigured_fallback', configured_fallbacks_only: true, offline_detection_scope: 'structural_contract', live_runtime_assertion: false },
        },
        {
          case_id: 'omitted-model-due-missing-tier-context',
          input_context: { complexity_tier_present: false },
          broken_dispatch: { outer_fields: { agentName_present: true, model_present: false } },
          expected: { rejected: true, violates: 'omitted_model_missing_tier_context', resolution_when_tier_missing: 'top_level_primary', resolved_primary_model: 'GPT-5.5 (copilot)', offline_detection_scope: 'structural_contract', live_runtime_assertion: false },
        },
      ],
    },
    expected: { negative_cases_documented: 7 },
  };

  const positive = validateModelResolutionScenarioNegatives(validScenario);
  check(
    'positive: required model-resolution negative cases are structurally complete',
    positive.ok === true,
    `ok=${positive.ok}, errors=${JSON.stringify(positive.errors)}`
  );

  const missingCaseScenario = JSON.parse(JSON.stringify(validScenario));
  missingCaseScenario.input.negative_cases = missingCaseScenario.input.negative_cases.filter(c => c.case_id !== 'payload-only-model');
  const missingCase = validateModelResolutionScenarioNegatives(missingCaseScenario);
  check(
    'negative: missing payload-only-model case is flagged',
    missingCase.ok === false && missingCase.errors.some(e => e.includes('payload-only-model')),
    `ok=${missingCase.ok}, errors=${JSON.stringify(missingCase.errors)}`
  );

  const payloadOnlyConflatedScenario = JSON.parse(JSON.stringify(validScenario));
  payloadOnlyConflatedScenario.input.negative_cases.find(c => c.case_id === 'payload-only-model').broken_dispatch.outer_fields.model_present = true;
  const payloadOnlyConflated = validateModelResolutionScenarioNegatives(payloadOnlyConflatedScenario);
  check(
    'negative: payload-only-model case with outer model present is flagged',
    payloadOnlyConflated.ok === false && payloadOnlyConflated.errors.some(e => e.includes('payload-only-model')),
    `ok=${payloadOnlyConflated.ok}, errors=${JSON.stringify(payloadOnlyConflated.errors)}`
  );

  const autoModeRejectedScenario = JSON.parse(JSON.stringify(validScenario));
  autoModeRejectedScenario.input.negative_cases.find(c => c.case_id === 'auto-mode-missing-outer-model-allowed').expected.rejected = true;
  const autoModeRejected = validateModelResolutionScenarioNegatives(autoModeRejectedScenario);
  check(
    'negative: auto-mode omission case marked rejected is flagged',
    autoModeRejected.ok === false && autoModeRejected.errors.some(e => e.includes('auto-mode-missing-outer-model-allowed')),
    `ok=${autoModeRejected.ok}, errors=${JSON.stringify(autoModeRejected.errors)}`
  );

  const wrongTierScenario = JSON.parse(JSON.stringify(validScenario));
  wrongTierScenario.input.negative_cases.find(c => c.case_id === 'wrong-effective-review-tier').expected.effective_review_tier = 'MEDIUM';
  const wrongTier = validateModelResolutionScenarioNegatives(wrongTierScenario);
  check(
    'negative: wrong-effective-review-tier case that does not require LARGE is flagged',
    wrongTier.ok === false && wrongTier.errors.some(e => e.includes('wrong-effective-review-tier')),
    `ok=${wrongTier.ok}, errors=${JSON.stringify(wrongTier.errors)}`
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
// Check #9b — Rule 8 boot-time path-resolution availability
// ──────────────────────────────────────────────
console.log('\n=== Check #9b — Rule 8 boot-time path-resolution availability ===');
{
  const ROOT = join(__dirname, '..', '..');
  const trPath = join(ROOT, 'docs', 'agent-engineering', 'TOOL-ROUTING.md');
  const ciPath = join(ROOT, '.github', 'copilot-instructions.md');
  const toolRouting = existsSync(trPath) ? readFileSync(trPath, 'utf8') : '';
  const sharedInstructions = existsSync(ciPath) ? readFileSync(ciPath, 'utf8') : '';

  const requiredTokens = [
    '{{VSCODE_USER_PROMPTS_FOLDER}}/',
    'Never fabricate file contents',
    'missing governance file contained default values',
  ];

  check(
    'D3: TOOL-ROUTING.md contains Rule 8 resource path fallback',
    toolRouting.includes('Rule 8 - Resource Path Resolution Fallback') &&
    requiredTokens.every(token => toolRouting.includes(token))
  );

  check(
    'D4: copilot-instructions.md contains boot-time Path Resolution fallback',
    sharedInstructions.includes('## Path Resolution') &&
    requiredTokens.every(token => sharedInstructions.includes(token))
  );

  check(
    'D5: Rule 8 and copilot instructions cross-reference intentional duplication',
    toolRouting.includes('intentionally duplicated in `.github/copilot-instructions.md`') &&
    sharedInstructions.includes('intentionally duplicates `docs/agent-engineering/TOOL-ROUTING.md` Rule 8')
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
// Check #13 — Canonical Source Matrix semantic contract
// ──────────────────────────────────────────────
console.log('\n=== Check #13 — canonical source matrix semantic contract ===');
{
  const projectContext = [
    '## Canonical Source Matrix',
    '',
    '| Concern | Authoritative File | Notes |',
    '| --- | --- | --- |',
    '| Executor roster | `governance/project-context-registry.json` | Defines allowed executor_agent names for phases. |',
    '| Review pipeline roster | `governance/project-context-registry.json` | Defines PLAN_REVIEW-only auditing agents and their routing roles. |',
    '| Agent role matrix | `governance/project-context-registry.json` | Defines schema outputs, tool profiles, and delegation sources for project agents. |',
    '| Complexity tiers | `plans/project-context.md` | Maps file counts/risk to pipeline depth. |',
    '| Semantic-risk taxonomy | `plans/project-context.md` | Defines the 7 risk categories evaluated during planning. |',
    '| Review routing | `governance/runtime-policy.json` | Active rules for PLAN_REVIEW and Completion Gate execution. |',
    '| Retry budgets | `governance/runtime-policy.json` | Exact numeric limits, backoffs, and escalation thresholds. |',
    '| Shared evidence discipline | `docs/agent-engineering/PROMPT-BEHAVIOR-CONTRACT.md` | Mandates evidence citations for claims across all agents. |',
    '| Gate-event contract | `docs/agent-engineering/RELIABILITY-GATES.md` | Governs PreFlect, Completion, and validation structural rules. |',
    '',
  ].join('\n');

  const matrixJson = {
    entries: [
      { concern: 'Executor roster', authoritative_file: 'governance/project-context-registry.json' },
      { concern: 'Review pipeline roster', authoritative_file: 'governance/project-context-registry.json' },
      { concern: 'Agent role matrix', authoritative_file: 'governance/project-context-registry.json' },
      { concern: 'Complexity tiers', authoritative_file: 'plans/project-context.md' },
      { concern: 'Semantic-risk taxonomy', authoritative_file: 'plans/project-context.md' },
      { concern: 'Review routing', authoritative_file: 'governance/runtime-policy.json' },
      { concern: 'Retry budgets', authoritative_file: 'governance/runtime-policy.json' },
      { concern: 'Shared evidence discipline', authoritative_file: 'docs/agent-engineering/PROMPT-BEHAVIOR-CONTRACT.md' },
      { concern: 'Gate-event contract', authoritative_file: 'docs/agent-engineering/RELIABILITY-GATES.md' },
    ],
  };

  const positive = validateCanonicalSourceMatrixContract(projectContext, matrixJson);
  check(
    'positive: markdown canonical table matches machine-readable matrix entries',
    positive.ok === true,
    `ok=${positive.ok}, errors=${JSON.stringify(positive.errors)}`
  );

  const missingRowContext = projectContext.replace(
    '| Retry budgets | `governance/runtime-policy.json` | Exact numeric limits, backoffs, and escalation thresholds. |\n',
    ''
  );
  const missingRow = validateCanonicalSourceMatrixContract(missingRowContext, matrixJson);
  check(
    'negative: missing row in markdown matrix is detected',
    missingRow.ok === false && missingRow.errors.some(e => e.includes('Retry budgets')),
    `ok=${missingRow.ok}, errors=${JSON.stringify(missingRow.errors)}`
  );

  const duplicateConcernJson = JSON.parse(JSON.stringify(matrixJson));
  duplicateConcernJson.entries.push({ concern: 'Retry budgets', authoritative_file: 'governance/runtime-policy.json' });
  const duplicateConcern = validateCanonicalSourceMatrixContract(projectContext, duplicateConcernJson);
  check(
    'negative: duplicate concern in machine-readable matrix is detected',
    duplicateConcern.ok === false && duplicateConcern.errors.some(e => e.includes('duplicate concern')),
    `ok=${duplicateConcern.ok}, errors=${JSON.stringify(duplicateConcern.errors)}`
  );
}

// ──────────────────────────────────────────────
// Check #14 — project-context registry mirror contract
// ──────────────────────────────────────────────
console.log('\n=== Check #14 — project-context registry mirror contract ===');
{
  const projectContext = [
    '## Phase Executor Agents',
    '',
    '| Agent | Role | Primary Use Case | Model Routing Role |',
    '| --- | --- | --- | --- |',
    '| CodeMapper-subagent | Read-only discovery | Codebase exploration, file mapping | `fast-readonly` |',
    '| Researcher-subagent | Research & evidence | Deep investigation, evidence extraction | `research-capable` |',
    '',
    '## Review Pipeline Agents',
    '',
    '| Agent | Role | Primary Use Case | Model Routing Role |',
    '| --- | --- | --- | --- |',
    '| PlanAuditor-subagent | Pre-impl plan audit | Architecture, security, risk review | `capable-reviewer` |',
    '| AssumptionVerifier-subagent | Mirage detection | Assumption verification, hallucination hunting | `capable-reviewer` |',
    '',
    '## Agent Role Matrix',
    '',
    '| Agent | Schema Output | Tools Profile | Delegation Source |',
    '| --- | --- | --- | --- |',
    '| CodeMapper-subagent | code-mapper.discovery.schema.json | Read-only (5 tools) | Orchestrator, Researcher, Planner |',
    '| PlanAuditor-subagent | plan-auditor.plan-audit.schema.json | Read-only (7 tools) | Orchestrator |',
    '',
  ].join('\n');

  const registryJson = {
    phase_executor_agents: [
      {
        agent: 'CodeMapper-subagent',
        role: 'Read-only discovery',
        primary_use_case: 'Codebase exploration, file mapping',
        model_routing_role: 'fast-readonly',
      },
      {
        agent: 'Researcher-subagent',
        role: 'Research & evidence',
        primary_use_case: 'Deep investigation, evidence extraction',
        model_routing_role: 'research-capable',
      },
    ],
    review_pipeline_agents: [
      {
        agent: 'PlanAuditor-subagent',
        role: 'Pre-impl plan audit',
        primary_use_case: 'Architecture, security, risk review',
        model_routing_role: 'capable-reviewer',
      },
      {
        agent: 'AssumptionVerifier-subagent',
        role: 'Mirage detection',
        primary_use_case: 'Assumption verification, hallucination hunting',
        model_routing_role: 'capable-reviewer',
      },
    ],
    agent_role_matrix: [
      {
        agent: 'CodeMapper-subagent',
        schema_output: 'code-mapper.discovery.schema.json',
        tools_profile: 'Read-only (5 tools)',
        delegation_source: 'Orchestrator, Researcher, Planner',
      },
      {
        agent: 'PlanAuditor-subagent',
        schema_output: 'plan-auditor.plan-audit.schema.json',
        tools_profile: 'Read-only (7 tools)',
        delegation_source: 'Orchestrator',
      },
    ],
  };

  const positive = validateProjectContextRegistryMirror(projectContext, registryJson);
  check(
    'positive: project-context metadata tables mirror registry rows exactly',
    positive.ok === true,
    `ok=${positive.ok}, errors=${JSON.stringify(positive.errors)}`
  );

  const missingExecutorRowContext = projectContext.replace(
    '| Researcher-subagent | Research & evidence | Deep investigation, evidence extraction | `research-capable` |\n',
    ''
  );
  const missingExecutorRow = validateProjectContextRegistryMirror(missingExecutorRowContext, registryJson);
  check(
    'negative: missing executor row is detected',
    missingExecutorRow.ok === false && missingExecutorRow.errors.some(e => e.includes('Phase Executor Agents')),
    `ok=${missingExecutorRow.ok}, errors=${JSON.stringify(missingExecutorRow.errors)}`
  );

  const reviewPipelineDriftContext = projectContext.replace(
    '| AssumptionVerifier-subagent | Mirage detection | Assumption verification, hallucination hunting | `capable-reviewer` |',
    '| AssumptionVerifier-subagent | Mirage detection | Assumption verification only | `capable-reviewer` |'
  );
  const reviewPipelineDrift = validateProjectContextRegistryMirror(reviewPipelineDriftContext, registryJson);
  check(
    'negative: edited review pipeline cell is detected',
    reviewPipelineDrift.ok === false && reviewPipelineDrift.errors.some(e => e.includes('Review Pipeline Agents')),
    `ok=${reviewPipelineDrift.ok}, errors=${JSON.stringify(reviewPipelineDrift.errors)}`
  );

  const roleMatrixDriftContext = projectContext.replace(
    '| PlanAuditor-subagent | plan-auditor.plan-audit.schema.json | Read-only (7 tools) | Orchestrator |',
    '| PlanAuditor-subagent | WRONG.schema.json | Read-only (7 tools) | Orchestrator |'
  );
  const roleMatrixDrift = validateProjectContextRegistryMirror(roleMatrixDriftContext, registryJson);
  check(
    'negative: edited role matrix cell is detected',
    roleMatrixDrift.ok === false && roleMatrixDrift.errors.some(e => e.includes('Agent Role Matrix')),
    `ok=${roleMatrixDrift.ok}, errors=${JSON.stringify(roleMatrixDrift.errors)}`
  );

  const reorderedExecutorContext = projectContext.replace(
    '| CodeMapper-subagent | Read-only discovery | Codebase exploration, file mapping | `fast-readonly` |\n| Researcher-subagent | Research & evidence | Deep investigation, evidence extraction | `research-capable` |',
    '| Researcher-subagent | Research & evidence | Deep investigation, evidence extraction | `research-capable` |\n| CodeMapper-subagent | Read-only discovery | Codebase exploration, file mapping | `fast-readonly` |'
  );
  const reorderedExecutor = validateProjectContextRegistryMirror(reorderedExecutorContext, registryJson);
  check(
    'negative: executor row reorder drift is detected',
    reorderedExecutor.ok === false && reorderedExecutor.errors.some(e => e.includes('Phase Executor Agents')),
    `ok=${reorderedExecutor.ok}, errors=${JSON.stringify(reorderedExecutor.errors)}`
  );
}

// ──────────────────────────────────────────────
// Check #15 — tool-count label consistency
// ──────────────────────────────────────────────
console.log('\n=== Check #15 — tool-count label consistency ===');
{
  // Positive (real repo): registry "(N tools)" labels match tool-grants array lengths.
  const ROOT = join(__dirname, '..', '..');
  const realRegistry = JSON.parse(
    readFileSync(join(ROOT, 'governance', 'project-context-registry.json'), 'utf8')
  );
  const realToolGrants = JSON.parse(
    readFileSync(join(ROOT, 'governance', 'tool-grants.json'), 'utf8')
  );
  const realResult = validateToolCountLabelConsistency(realRegistry, realToolGrants);
  check(
    'TC1: real governance registry/tool-grants "(N tools)" labels are consistent',
    realResult.ok === true,
    realResult.ok ? '' : `errors=${JSON.stringify(realResult.errors)}`
  );

  // Synthetic positive baseline.
  const baselineRegistry = {
    agent_role_matrix: [
      { agent: 'CodeReviewer-subagent', schema_output: 's.json', tools_profile: 'Search + run (7 tools)', delegation_source: 'Orchestrator' },
      { agent: 'CodeMapper-subagent', schema_output: 's.json', tools_profile: 'Read-only (5 tools)', delegation_source: 'Orchestrator' },
    ],
  };
  const baselineGrants = {
    'CodeReviewer-subagent.agent.md': ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
    'CodeMapper-subagent.agent.md': ['a', 'b', 'c', 'd', 'e'],
  };
  const baseline = validateToolCountLabelConsistency(baselineRegistry, baselineGrants);
  check(
    'TC2: synthetic matched labels → ok=true',
    baseline.ok === true,
    `ok=${baseline.ok}, errors=${JSON.stringify(baseline.errors)}`
  );

  // Negative: label says "(6 tools)" but grant array holds 7 (the CodeReviewer-class bug).
  const mismatchRegistry = JSON.parse(JSON.stringify(baselineRegistry));
  mismatchRegistry.agent_role_matrix[0].tools_profile = 'Search + run (6 tools)';
  const mismatch = validateToolCountLabelConsistency(mismatchRegistry, baselineGrants);
  check(
    'TC3: label "(6 tools)" but grant array length 7 → drift detected',
    mismatch.ok === false && mismatch.errors.some(e => e.includes('CodeReviewer-subagent') && e.includes('7 tool')),
    `ok=${mismatch.ok}, errors=${JSON.stringify(mismatch.errors)}`
  );

  // Negative: labeled agent missing from tool-grants entirely → drift detected.
  const missingGrants = { 'CodeMapper-subagent.agent.md': ['a', 'b', 'c', 'd', 'e'] };
  const missing = validateToolCountLabelConsistency(baselineRegistry, missingGrants);
  check(
    'TC4: labeled agent absent from tool-grants → drift detected',
    missing.ok === false && missing.errors.some(e => e.includes('CodeReviewer-subagent.agent.md')),
    `ok=${missing.ok}, errors=${JSON.stringify(missing.errors)}`
  );

  // Skip path: tools_profile without a "(N tools)" label is ignored even if grants differ.
  const unlabeledRegistry = {
    agent_role_matrix: [
      { agent: 'CodeMapper-subagent', schema_output: 's.json', tools_profile: 'Read-only', delegation_source: 'Orchestrator' },
    ],
  };
  const unlabeled = validateToolCountLabelConsistency(unlabeledRegistry, { 'CodeMapper-subagent.agent.md': ['a', 'b'] });
  check(
    'TC5: tools_profile without "(N tools)" label is skipped → ok=true',
    unlabeled.ok === true,
    `ok=${unlabeled.ok}, errors=${JSON.stringify(unlabeled.errors)}`
  );
}

// ──────────────────────────────────────────────
// Pattern-file line budget — skills/patterns/*.md must be ≤100 lines
// ──────────────────────────────────────────────
console.log('\n=== Pattern-file line budget (skills/patterns/*.md ≤100 lines) ===');
{
  // Positive (real repo): every skills/patterns/*.md file is within the 100-line budget.
  const ROOT = join(__dirname, '..', '..');
  const realPatternsDir = join(ROOT, 'skills', 'patterns');
  const realResult = validatePatternFileLineBudget(realPatternsDir);
  check(
    'PB1: real skills/patterns/*.md files are all ≤100 lines',
    realResult.ok === true,
    realResult.ok ? '' : `errors=${JSON.stringify(realResult.errors)}`
  );

  // Line-counting semantics: a single trailing newline is not a phantom line.
  check(
    'PB2: countTextLines treats trailing newline as wc(1) does',
    countTextLines('a\nb\nc') === 3 && countTextLines('a\nb\nc\n') === 3 && countTextLines('') === 0,
    `got [${countTextLines('a\nb\nc')}, ${countTextLines('a\nb\nc\n')}, ${countTextLines('')}]`
  );

  // Negative (synthetic): a 101-line pattern file in a temp dir → drift detected.
  // No real oversized file is added to the repo.
  const tmpRoot = join(tmpdir(), `cf-pattern-budget-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  mkdirSync(tmpRoot, { recursive: true });
  try {
    const oversizedLines = Array.from({ length: 101 }, (_, i) => `line ${i + 1}`).join('\n');
    writeFileSync(join(tmpRoot, 'oversized.md'), oversizedLines);
    writeFileSync(join(tmpRoot, 'within-budget.md'), Array.from({ length: 100 }, (_, i) => `line ${i + 1}`).join('\n'));
    const negative = validatePatternFileLineBudget(tmpRoot);
    check(
      'PB3: synthetic 101-line pattern file → drift detected with file + count',
      negative.ok === false
        && negative.errors.some(e => e.includes('oversized.md') && e.includes('101'))
        && !negative.errors.some(e => e.includes('within-budget.md')),
      `ok=${negative.ok}, errors=${JSON.stringify(negative.errors)}`
    );
  } finally {
    rmSync(tmpRoot, { recursive: true, force: true });
  }
}

// ──────────────────────────────────────────────
// Doc-count consistency — canonical doc totals match files on disk
// ──────────────────────────────────────────────
console.log('\n=== Doc-count consistency (canonical doc totals vs files on disk) ===');
{
  const ROOT = join(__dirname, '..', '..');

  // Positive (real repo): allowlisted docs already state correct totals (Wave 1 fix).
  const realResult = validateDocCountConsistency(ROOT);
  check(
    'DC1: real docs state counts matching the files on disk',
    realResult.ok === true,
    realResult.ok ? '' : `errors=${JSON.stringify(realResult.errors)}`
  );

  // Synthetic positive: fabricated text with correct counts → no mismatch.
  const truth = { schemas: 17, skills: 18, governance: 7, agents: 13 };
  const goodText = [
    'ControlFlow (13 agents)',
    '13 agents, 17 schemas, 7 governance files, 18 skills.',
    '17 JSON-схем и 18 паттернов; 13 агентов; 7 governance.',
  ].join('\n');
  const good = scanDocCountMismatches('synthetic-good.md', goodText, truth);
  check(
    'DC2: synthetic text with correct counts → no mismatch',
    good.length === 0,
    `errors=${JSON.stringify(good)}`
  );

  // Negative (synthetic): a wrong count in fabricated text is caught with file:line.
  const badText = [
    'intro line',
    '13 agents, 99 schemas, 7 governance files, 18 skills.',
  ].join('\n');
  const bad = scanDocCountMismatches('synthetic-bad.md', badText, truth);
  check(
    'DC3: synthetic "99 schemas" with truth 17 → drift caught with line + expected/found',
    bad.length === 1
      && bad[0].includes('synthetic-bad.md:2')
      && bad[0].includes('99 schemas')
      && bad[0].includes('actual is 17'),
    `errors=${JSON.stringify(bad)}`
  );

  // Negative guard: the AssumptionVerifier mirage phrasing must NOT be misread as the
  // skills-pattern total (18). The RU genitive "17 паттернов" is the REAL collision case
  // (identical surface form to the allowlisted "18 паттернов" skills phrasing) — the
  // anchored RU pattern ignores it because no same-line "skill"/"patterns/" marker precedes.
  const mirageText = 'AssumptionVerifier uses 17 mirage patterns / 17 patterns / таксономия из 17 паттернов.';
  const mirage = scanDocCountMismatches('synthetic-mirage.md', mirageText, truth);
  check(
    'DC4: genitive "17 паттернов" mirage not flagged as skills-count drift',
    mirage.length === 0,
    `errors=${JSON.stringify(mirage)}`
  );

  // Positive guard: a WRONG skills total in the real allowlisted RU phrasing IS still
  // caught — proves the anchor narrows false positives without losing real coverage.
  const wrongRuText = 'Skill library, протокол выбора (≤3 на фазу), 17 паттернов';
  const wrongRu = scanDocCountMismatches('synthetic-wrong-ru.md', wrongRuText, truth);
  check(
    'DC5: anchored RU "Skill library ... 17 паттернов" with truth 18 → drift caught',
    wrongRu.length === 1
      && wrongRu[0].includes('synthetic-wrong-ru.md:1')
      && wrongRu[0].includes('17 паттернов')
      && wrongRu[0].includes('actual is 18'),
    `errors=${JSON.stringify(wrongRu)}`
  );
}

// ──────────────────────────────────────────────
// Plugin generation parity — controlflow-codex matches shared-source (verbatim)
// ──────────────────────────────────────────────
console.log('\n=== Plugin generation parity (controlflow-codex == shared-source, no deltas) ===');
{
  const PLUGINS_ROOT = join(__dirname, '..', '..', 'plugins');

  // Positive (real repo): codex output is byte-identical (line-ending normalized)
  // to the shared-source managed file set.
  const realResult = validatePluginGenerationParity(PLUGINS_ROOT);
  check(
    `PP1: real controlflow-codex matches shared-source (checked ${realResult.checked} managed files)`,
    realResult.ok === true && realResult.checked > 0,
    realResult.ok ? '' : `errors=${JSON.stringify(realResult.errors)}`
  );

  // Synthetic positive: matching content with CRLF vs LF → still parity (normalized).
  const tmpOk = join(tmpdir(), `cf-plugin-parity-ok-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  mkdirSync(join(tmpOk, 'controlflow-shared-source', 'skills', 'demo'), { recursive: true });
  mkdirSync(join(tmpOk, 'controlflow-codex', 'skills', 'demo'), { recursive: true });
  try {
    const manifest = {
      version: '1.0.0',
      targets: [
        { source_path: 'skills', host_outputs: { codex: { dest_path: 'skills', allowed_deltas: false } } },
      ],
    };
    writeFileSync(join(tmpOk, 'controlflow-shared-source', 'generation-manifest.json'), JSON.stringify(manifest));
    writeFileSync(join(tmpOk, 'controlflow-shared-source', 'skills', 'demo', 'SKILL.md'), 'line one\nline two\n');
    // Same content, CRLF line endings + a codex-only host file that must be ignored.
    writeFileSync(join(tmpOk, 'controlflow-codex', 'skills', 'demo', 'SKILL.md'), 'line one\r\nline two\r\n');
    writeFileSync(join(tmpOk, 'controlflow-codex', 'skills', 'demo', 'openai.yaml'), 'host: codex\n');
    const okRes = validatePluginGenerationParity(tmpOk);
    check(
      'PP2: matching content (CRLF vs LF) + codex-only host file → parity holds',
      okRes.ok === true && okRes.checked === 1,
      `ok=${okRes.ok}, checked=${okRes.checked}, errors=${JSON.stringify(okRes.errors)}`
    );
  } finally {
    rmSync(tmpOk, { recursive: true, force: true });
  }

  // Negative (synthetic): mismatching content + a missing managed file → drift caught.
  // No real plugin files are mutated.
  const tmpBad = join(tmpdir(), `cf-plugin-parity-bad-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  mkdirSync(join(tmpBad, 'controlflow-shared-source', 'skills'), { recursive: true });
  mkdirSync(join(tmpBad, 'controlflow-codex', 'skills'), { recursive: true });
  try {
    const manifest = {
      version: '1.0.0',
      targets: [
        { source_path: 'skills', host_outputs: { codex: { dest_path: 'skills', allowed_deltas: false } } },
      ],
    };
    writeFileSync(join(tmpBad, 'controlflow-shared-source', 'generation-manifest.json'), JSON.stringify(manifest));
    writeFileSync(join(tmpBad, 'controlflow-shared-source', 'skills', 'a.md'), 'source content\n');
    writeFileSync(join(tmpBad, 'controlflow-shared-source', 'skills', 'b.md'), 'managed but absent in codex\n');
    writeFileSync(join(tmpBad, 'controlflow-codex', 'skills', 'a.md'), 'TAMPERED content\n');
    const badRes = validatePluginGenerationParity(tmpBad);
    check(
      'PP3: tampered content + missing managed file → drift caught with relative paths',
      badRes.ok === false
        && badRes.errors.some(e => e.includes('skills/a.md') && e.includes('hash mismatch'))
        && badRes.errors.some(e => e.includes('skills/b.md') && e.includes('missing managed file')),
      `ok=${badRes.ok}, errors=${JSON.stringify(badRes.errors)}`
    );
  } finally {
    rmSync(tmpBad, { recursive: true, force: true });
  }
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
