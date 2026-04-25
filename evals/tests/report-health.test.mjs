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
  summarizeSessionOutcomes,
  summarizeTraceabilityCoverage,
  listArtifactDirs,
  inferPlanSlugFromObjective,
  checkActiveObjectiveArtifact,
  generateReport,
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
  // empty content
  const empty = summarizeSessionOutcomes('');
  assert(empty.totalEntries === 0, 'empty: zero entries');
  assert(empty.entriesMissingFields.length === 0, 'empty: no missing-field entries');
  assert(empty.duplicatePlanIds.length === 0, 'empty: no duplicates');
  assert(empty.archiveWarning === false, 'empty: no archive warning');
  assert(empty.lastEntryDate === null, 'empty: null lastEntryDate');

  // one complete entry
  const complete = summarizeSessionOutcomes(
    '## Entry\n\n**Plan ID:** `my-plan`\n**Date:** `2026-01-01`\n**Complexity Tier:** `SMALL`\n**Status:** `SUCCESS`\n'
  );
  assert(complete.totalEntries === 1, 'complete: one entry');
  assert(complete.entriesMissingFields.length === 0, 'complete: no missing fields');
  assert(complete.duplicatePlanIds.length === 0, 'complete: no duplicates');
  assert(complete.archiveWarning === false, 'complete: no archive warning');
  assert(complete.lastEntryDate === '2026-01-01', 'complete: lastEntryDate from first entry');

  // entry missing Complexity Tier and Status
  const incomplete = summarizeSessionOutcomes(
    '## Entry\n\n**Plan ID:** `missing-plan`\n**Date:** `2026-01-02`\n'
  );
  assert(incomplete.totalEntries === 1, 'incomplete: one entry');
  assert(incomplete.entriesMissingFields.length === 1, 'incomplete: one missing-field entry');
  assert(incomplete.entriesMissingFields[0].planId === 'missing-plan', 'incomplete: correct planId');
  assert(
    incomplete.entriesMissingFields[0].missingFields.includes('Complexity Tier'),
    'incomplete: flags missing Complexity Tier'
  );
  assert(
    incomplete.entriesMissingFields[0].missingFields.includes('Status'),
    'incomplete: flags missing Status'
  );

  // duplicate Plan IDs
  const dupContent =
    '## Entry\n\n**Plan ID:** `dup-plan`\n**Date:** `2026-01-01`\n**Complexity Tier:** `SMALL`\n**Status:** `SUCCESS`\n\n' +
    '## Entry\n\n**Plan ID:** `dup-plan`\n**Date:** `2026-01-02`\n**Complexity Tier:** `MEDIUM`\n**Status:** `SUCCESS`\n';
  const dup = summarizeSessionOutcomes(dupContent);
  assert(dup.duplicatePlanIds.length === 1, 'dup: one duplicate id');
  assert(dup.duplicatePlanIds[0] === 'dup-plan', 'dup: correct duplicate id');
  assert(dup.entriesMissingFields.length === 0, 'dup: no missing fields when dup has all fields');

  // archive threshold MET (exactly 50)
  const manyEntries = Array.from(
    { length: 50 },
    (_, i) =>
      `## Entry\n\n**Plan ID:** \`plan-${i}\`\n**Date:** \`2026-01-01\`\n**Complexity Tier:** \`SMALL\`\n**Status:** \`SUCCESS\`\n`
  ).join('\n');
  const many = summarizeSessionOutcomes(manyEntries);
  assert(many.archiveWarning === true, 'threshold: archive warning at 50');
  assert(many.totalEntries === 50, 'threshold: 50 entries counted');

  // archive threshold NOT met (49)
  const almostEntries = Array.from(
    { length: 49 },
    (_, i) =>
      `## Entry\n\n**Plan ID:** \`plan-${i}\`\n**Date:** \`2026-01-01\`\n**Complexity Tier:** \`SMALL\`\n**Status:** \`SUCCESS\`\n`
  ).join('\n');
  const almost = summarizeSessionOutcomes(almostEntries);
  assert(almost.archiveWarning === false, 'threshold: no warning at 49');

  // custom threshold via opts.archiveThreshold
  const customThreshold = summarizeSessionOutcomes(
    '## Entry\n\n**Plan ID:** `t1`\n**Date:** `2026-01-01`\n**Complexity Tier:** `SMALL`\n**Status:** `SUCCESS`\n',
    { archiveThreshold: 1 }
  );
  assert(customThreshold.archiveWarning === true, 'custom threshold: warning triggered at 1');
}

console.log('\n=== report-health: summarizeTraceabilityCoverage ===');
{
  const root = mkdtempSync(join(tmpdir(), 'tracecov-'));
  try {
    mkdirSync(join(root, 'plans', 'artifacts', 'has-index'), { recursive: true });
    mkdirSync(join(root, 'plans', 'artifacts', 'no-index'), { recursive: true });
    writeFileSync(
      join(root, 'plans', 'artifacts', 'has-index', 'traceability-index.yaml'),
      'type: traceability-index\n'
    );

    const cov = summarizeTraceabilityCoverage(['has-index', 'no-index'], root);
    assert(
      cov.withIndex.length === 1 && cov.withIndex[0] === 'has-index',
      'withIndex contains dir that has index'
    );
    assert(
      cov.withoutIndex.length === 1 && cov.withoutIndex[0] === 'no-index',
      'withoutIndex contains dir missing index'
    );

    // alphabetical sort
    const cov2 = summarizeTraceabilityCoverage(['zz-no', 'aa-no'], root);
    assert(cov2.withoutIndex[0] === 'aa-no', 'withoutIndex sorted alphabetically');

    // empty input
    const empty = summarizeTraceabilityCoverage([], root);
    assert(empty.withIndex.length === 0 && empty.withoutIndex.length === 0, 'empty input: both arrays empty');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

console.log('\n=== report-health: smoke generateReport on temp fixture ===');
{
  const root = mkdtempSync(join(tmpdir(), 'health-report-'));
  try {
    mkdirSync(join(root, 'plans', 'artifacts', 'demo'), { recursive: true });
    mkdirSync(join(root, 'plans', 'artifacts', 'indexed-dir'), { recursive: true });
    writeFileSync(
      join(root, 'plans', 'artifacts', 'indexed-dir', 'traceability-index.yaml'),
      'type: traceability-index\n'
    );
    writeFileSync(join(root, 'plans', 'demo-plan.md'), '# Demo\n\n**Status:** DONE\n');
    writeFileSync(join(root, 'plans', 'no-status.md'), '# X\nno status\n');
    writeFileSync(
      join(root, 'plans', 'session-outcomes.md'),
      '## Entry\n\n**Plan ID:** `demo-plan`\n**Date:** `2026-04-25`\n**Complexity Tier:** `SMALL`\n**Status:** `SUCCESS`\n\n' +
        '## Entry\n\n**Plan ID:** `partial-plan`\n**Date:** `2026-04-20`\n\n' +
        '## Entry\n\n**Plan ID:** `demo-plan`\n**Date:** `2026-04-18`\n**Complexity Tier:** `SMALL`\n**Status:** `PARTIAL`\n'
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

    // New sections: Session Outcome Hygiene and Traceability Index Coverage
    const r4 = generateReport(root, { gitStatus: '' });
    assert(r4.includes('## Session Outcome Hygiene'), 'smoke: session hygiene section heading present');
    assert(r4.includes('## Traceability Index Coverage'), 'smoke: traceability coverage section heading present');
    assert(r4.includes('partial-plan: missing'), 'smoke: missing-field entry flagged in session hygiene');
    assert(r4.includes('Duplicate Plan IDs (1)'), 'smoke: one duplicate plan ID reported');
    assert(r4.includes('With index (1)'), 'smoke: one dir with traceability index');
    assert(r4.includes('  - indexed-dir'), 'smoke: indexed-dir listed under with-index');
    assert(r4.includes('Without index'), 'smoke: without-index group present');
    assert(r4.includes('  - demo'), 'smoke: demo dir listed under without-index');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

console.log(`\nreport-health: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
