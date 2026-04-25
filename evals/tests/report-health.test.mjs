/**
 * Tests for evals/report-health.mjs — operator health report.
 *
 * Helper-function coverage plus a smoke test that exercises generateReport
 * against an isolated temp fixture tree (no dependency on this repo's git
 * worktree state).
 */

import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

import {
  groupChangesBySurface,
  parseNotesMd,
  parsePlanStatus,
  summarizePlans,
  getLatestSessionOutcome,
  listArtifactDirs,
  inferPlanSlugFromObjective,
  checkActiveObjectiveArtifact,
  generateReport,
  summarizeSessionOutcomes,
  summarizeTraceabilityCoverage,
} from '../report-health.mjs';

let passed = 0;
let failed = 0;

function assert(cond, label) {
  if (cond) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.error(`  ❌ ${label}`);
    failed++;
  }
}

console.log('\n=== report-health: groupChangesBySurface ===');
{
  const porcelain = [
    ' M Orchestrator.agent.md',
    ' M schemas/runtime-policy.schema.json',
    '?? evals/report-health.mjs',
    ' M docs/agent-engineering/PART-SPEC.md',
    ' M skills/index.md',
    ' M governance/runtime-policy.json',
    ' M plans/artifacts/foo/bar.md',
    ' M plans/some-plan.md',
    ' M misc/other.txt',
  ].join('\n');
  const g = groupChangesBySurface(porcelain);
  assert(g.agents.includes('Orchestrator.agent.md'), 'agents bucket');
  assert(g.schemas.includes('schemas/runtime-policy.schema.json'), 'schemas bucket');
  assert(g.evals.includes('evals/report-health.mjs'), 'evals bucket (untracked)');
  assert(g.docs.includes('docs/agent-engineering/PART-SPEC.md'), 'docs bucket');
  assert(g.skills.includes('skills/index.md'), 'skills bucket');
  assert(g.governance.includes('governance/runtime-policy.json'), 'governance bucket');
  assert(g['plans/artifacts'].includes('plans/artifacts/foo/bar.md'), 'plans/artifacts bucket');
  assert(g.plans.includes('plans/some-plan.md'), 'plans bucket excludes artifacts');
  assert(g.other.includes('misc/other.txt'), 'other bucket');
  assert(groupChangesBySurface('').agents.length === 0, 'empty input -> empty groups');
}

console.log('\n=== report-health: rename porcelain handling ===');
{
  const porcelain = 'R  old/path.md -> new/path.md';
  const g = groupChangesBySurface(porcelain);
  assert(g.other.includes('new/path.md'), 'rename uses post-arrow path');
}

console.log('\n=== report-health: parseNotesMd ===');
{
  const c = '# Active Notes\n\n- Active objective: foo bar.\n- Blockers: none.\n- Pending: none.\n';
  const r = parseNotesMd(c);
  assert(r.activeObjective === 'foo bar.', 'parses active objective');
  assert(r.blockers === 'none.', 'parses blockers');
  assert(r.pending === 'none.', 'parses pending');
  assert(r.lineCount === 5, 'counts non-trailing lines');
}

console.log('\n=== report-health: parsePlanStatus ===');
{
  assert(parsePlanStatus('# T\n\n**Status:** DONE\n') === 'DONE', 'bare status');
  assert(
    parsePlanStatus('# T\n\n**Status:** `READY_FOR_EXECUTION`\n') === 'READY_FOR_EXECUTION',
    'backticked status'
  );
  assert(parsePlanStatus('# T\n\nno status here\n') === null, 'missing status -> null');
}

console.log('\n=== report-health: inferPlanSlugFromObjective ===');
{
  assert(
    inferPlanSlugFromObjective(
      'comprehensive-orchestration-audit-improvement-plan COMPLETE — done.'
    ) === 'comprehensive-orchestration-audit-improvement-plan',
    'extracts hyphenated -plan slug'
  );
  assert(inferPlanSlugFromObjective(null) === null, 'null safe');
  assert(inferPlanSlugFromObjective('no slug present') === null, 'no slug -> null');
}

console.log('\n=== report-health: checkActiveObjectiveArtifact ===');
{
  const r = checkActiveObjectiveArtifact('foo-bar-plan in flight', ['foo-bar', 'baz']);
  assert(r.slug === 'foo-bar-plan' && r.hasArtifact === true, 'matches stripped -plan suffix');
  const r2 = checkActiveObjectiveArtifact('xyz-plan', ['other']);
  assert(r2.slug === 'xyz-plan' && r2.hasArtifact === false, 'reports missing artifact');
  const r3 = checkActiveObjectiveArtifact('', []);
  assert(r3.slug === null && r3.hasArtifact === null, 'no objective -> null slug');
}

console.log('\n=== report-health: getLatestSessionOutcome ===');
{
  const c = [
    'intro',
    '',
    '## Entry',
    '',
    '**Plan ID:** `foo-plan`',
    '**Date:** `2026-01-01`',
    '**Complexity Tier:** `LARGE`',
    '**Status:** `SUCCESS`',
    '',
    '## Entry',
    '',
    '**Plan ID:** `bar-plan`',
    '**Status:** `SUCCESS`',
    '',
  ].join('\n');
  const o = getLatestSessionOutcome(c);
  assert(o.planId === 'foo-plan', 'picks first entry');
  assert(o.tier === 'LARGE', 'parses tier');
  assert(o.status === 'SUCCESS', 'parses status');
  assert(getLatestSessionOutcome('no entries here') === null, 'null when no entries');
}

console.log('\n=== report-health: summarizeSessionOutcomes ===');
{
  const entryAll = '## Entry\n\n**Plan ID:** `alpha-plan`\n**Date:** `2026-01-01`\n**Complexity Tier:** `SMALL`\n**Status:** `SUCCESS`\n\n';
  const entryMissing = '## Entry\n\n**Plan ID:** `beta-plan`\n**Date:** `2026-02-01`\n\n';
  const entryDup = '## Entry\n\n**Plan ID:** `alpha-plan`\n**Date:** `2026-03-01`\n**Complexity Tier:** `LARGE`\n**Status:** `SUCCESS`\n\n';

  const r = summarizeSessionOutcomes(entryAll + entryMissing + entryDup);
  assert(r.totalEntries === 3, 'counts all entries');
  assert(r.entriesMissingFields.length === 1, 'reports one missing-field entry');
  assert(r.entriesMissingFields[0].label === 'beta-plan', 'missing-field entry labeled by plan ID');
  assert(r.entriesMissingFields[0].missing.includes('Complexity Tier'), 'reports missing Complexity Tier');
  assert(r.entriesMissingFields[0].missing.includes('Status'), 'reports missing Status');
  assert(!r.entriesMissingFields[0].missing.includes('Date'), 'present Date not flagged');
  assert(r.duplicatePlanIds.includes('alpha-plan'), 'detects duplicate Plan ID');
  assert(r.archiveWarning === false, 'no archive warning at 3 entries');
  assert(r.lastEntryDate === '2026-01-01', 'last entry date from first entry');

  // Archive threshold
  const manyEntries = Array.from({ length: 50 }, (_, i) =>
    `## Entry\n\n**Plan ID:** \`plan-${i}\`\n**Date:** \`2026-01-01\`\n**Complexity Tier:** \`SMALL\`\n**Status:** \`SUCCESS\`\n\n`
  ).join('');
  assert(summarizeSessionOutcomes(manyEntries).archiveWarning === true, 'archive warning at threshold 50');
  assert(summarizeSessionOutcomes(manyEntries, { archiveThreshold: 51 }).archiveWarning === false, 'no archive warning below custom threshold');

  // Empty content
  const empty = summarizeSessionOutcomes('');
  assert(empty.totalEntries === 0, 'zero entries for empty content');
  assert(empty.archiveWarning === false, 'no archive warning for empty');
  assert(empty.duplicatePlanIds.length === 0, 'no duplicates for empty');
  assert(empty.lastEntryDate === null, 'null lastEntryDate for empty');
}

console.log('\n=== report-health: summarizeTraceabilityCoverage ===');
{
  const trRoot = mkdtempSync(join(tmpdir(), 'coverage-'));
  try {
    mkdirSync(join(trRoot, 'plans', 'artifacts', 'traced'), { recursive: true });
    writeFileSync(join(trRoot, 'plans', 'artifacts', 'traced', 'traceability-index.yaml'), 'schema_version: 1\n');
    mkdirSync(join(trRoot, 'plans', 'artifacts', 'untraced'), { recursive: true });
    const artifactsRoot = join(trRoot, 'plans', 'artifacts');

    const r = summarizeTraceabilityCoverage(['traced', 'untraced'], artifactsRoot);
    assert(r.withIndex.includes('traced'), 'dir with index in withIndex');
    assert(r.withoutIndex.includes('untraced'), 'dir without index in withoutIndex');
    assert(!r.withIndex.includes('untraced'), 'untraced not in withIndex');
    assert(!r.withoutIndex.includes('traced'), 'traced not in withoutIndex');

    // Sorted
    const r2 = summarizeTraceabilityCoverage(['zebra', 'apple'], artifactsRoot);
    assert(r2.withoutIndex[0] === 'apple' && r2.withoutIndex[1] === 'zebra', 'withoutIndex is sorted');

    // Empty input
    const r3 = summarizeTraceabilityCoverage([], artifactsRoot);
    assert(r3.withIndex.length === 0 && r3.withoutIndex.length === 0, 'empty input returns empty arrays');
  } finally {
    rmSync(trRoot, { recursive: true, force: true });
  }
}

console.log('\n=== report-health: smoke generateReport on temp fixture ===');
{
  const root = mkdtempSync(join(tmpdir(), 'health-report-'));
  try {
    mkdirSync(join(root, 'plans', 'artifacts', 'demo'), { recursive: true });
    mkdirSync(join(root, 'plans', 'artifacts', 'traced-dir'), { recursive: true });
    writeFileSync(
      join(root, 'plans', 'artifacts', 'traced-dir', 'traceability-index.yaml'),
      'schema_version: 1\n'
    );
    mkdirSync(join(root, 'plans', 'artifacts', 'untraced-dir'), { recursive: true });
    writeFileSync(join(root, 'plans', 'demo-plan.md'), '# Demo\n\n**Status:** DONE\n');
    writeFileSync(join(root, 'plans', 'no-status.md'), '# X\nno status\n');
    writeFileSync(
      join(root, 'plans', 'session-outcomes.md'),
      [
        '## Entry', '',
        '**Plan ID:** `demo-plan`', '**Date:** `2026-04-25`',
        '**Complexity Tier:** `SMALL`', '**Status:** `SUCCESS`', '',
        '## Entry', '',
        '**Plan ID:** `incomplete-plan`', '**Date:** `2026-04-20`', '',
        '## Entry', '',
        '**Plan ID:** `demo-plan`', '**Date:** `2026-04-10`',
        '**Complexity Tier:** `SMALL`', '**Status:** `SUCCESS`', '',
      ].join('\n')
    );
    writeFileSync(
      join(root, 'NOTES.md'),
      '# Active Notes\n\n- Active objective: demo-plan in progress.\n- Blockers: none.\n- Pending: none.\n'
    );

    const summ = summarizePlans(join(root, 'plans'));
    assert(
      summ.byStatus.DONE && summ.byStatus.DONE.includes('demo-plan.md'),
      'summarizePlans buckets DONE'
    );
    assert(summ.withoutStatus.includes('no-status.md'), 'summarizePlans tracks no-status plan');

    const dirs = listArtifactDirs(join(root, 'plans', 'artifacts'));
    assert(dirs.includes('demo'), 'listArtifactDirs returns demo dir');

    const report = generateReport(root, { gitStatus: ' M plans/demo-plan.md\n' });
    assert(report.includes('# Operator Health Report'), 'report has title');
    assert(report.includes('cd evals && npm test'), 'report references canonical command');
    assert(report.includes('plans/demo-plan.md'), 'report includes git-changed path');
    assert(report.includes('Active objective: demo-plan in progress.'), 'report shows active objective');
    assert(report.includes('DONE (1)'), 'report buckets DONE plans with count');
    assert(report.includes('Plans without explicit Status: 1'), 'report counts no-status plans');
    assert(report.includes('Plan: demo-plan'), 'report shows latest session plan');
    assert(
      report.includes('Active-objective plan slug `demo-plan` has matching artifact directory.'),
      'report confirms matching artifact dir'
    );
    assert(report.includes('## Session Outcome Hygiene'), 'report has Session Outcome Hygiene section');
    assert(report.includes('incomplete-plan'), 'report warns about missing-field entry');
    assert(report.includes('Duplicate Plan IDs: 1'), 'report shows duplicate plan ID count');
    assert(report.includes('## Traceability Index Coverage'), 'report has Traceability Index Coverage section');
    assert(report.includes('traced-dir'), 'report lists traced-dir in coverage');
    assert(report.includes('untraced-dir'), 'report lists untraced-dir in coverage');

    // Missing artifact warning
    writeFileSync(
      join(root, 'NOTES.md'),
      '# Active Notes\n\n- Active objective: missing-thing-plan in flight.\n- Blockers: none.\n- Pending: none.\n'
    );
    const r2 = generateReport(root, { gitStatus: '' });
    assert(
      r2.includes('WARNING: Active-objective plan slug `missing-thing-plan`'),
      'warns when artifact dir is missing'
    );
    assert(r2.includes('Working tree clean.'), 'reports clean tree when git status empty');

    const r3 = generateReport(root, { gitStatus: '', gitUnavailable: true });
    assert(
      r3.includes('WARNING: git status unavailable'),
      'warns when git status is unavailable'
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

console.log(`\nreport-health: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
