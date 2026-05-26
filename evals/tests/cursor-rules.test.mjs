/**
 * ControlFlow — Cursor Rule Validation Regression Tests
 *
 * Exercises the Cursor .mdc validator helper path in validate.mjs without
 * importing the full structural harness and triggering cache side effects.
 */

import { mkdtempSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EVALS_DIR = join(__dirname, '..');

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

function runCursorRuleFixture(content) {
  const tempDir = mkdtempSync(join(tmpdir(), 'controlflow-cursor-rule-'));
  const fixturePath = join(tempDir, 'fixture.mdc');
  try {
    writeFileSync(fixturePath, content, 'utf8');
    return spawnSync(process.execPath, ['validate.mjs', '--cursor-rule-fixture', fixturePath], {
      cwd: EVALS_DIR,
      encoding: 'utf8',
    });
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

console.log('\n=== Cursor Rule Validation Tests ===');

{
  const result = runCursorRuleFixture(`---
alwaysApply: true
---
# Cursor Rule Fixture

Reference \`.github/copilot-instructions.md\` for canonical policy.
`);
  check(
    'valid fixture with line-1 frontmatter, closing delimiter, alwaysApply, and canonical reference passes',
    result.status === 0,
    result.stderr.trim() || result.stdout.trim()
  );
}

{
  const result = runCursorRuleFixture(`---
alwaysApply: true
# Cursor Rule Fixture

Reference \`.github/copilot-instructions.md\` for canonical policy.
`);
  check(
    'missing closing --- fails with actionable frontmatter-bounds error',
    result.status !== 0 && result.stderr.includes('missing closing frontmatter delimiter'),
    result.stderr.trim() || result.stdout.trim()
  );
}

{
  const result = runCursorRuleFixture(`---
owner: platform
---
# Cursor Rule Fixture

Reference \`.github/copilot-instructions.md\` for canonical policy.
`);
  check(
    'bounded frontmatter missing all activation keys fails with activation-metadata error',
    result.status !== 0 && result.stderr.includes('activation metadata key'),
    result.stderr.trim() || result.stdout.trim()
  );
}

const total = passed + failed;
const bar = '='.repeat(50);
console.log(`\n${bar}`);
console.log(`Cursor rules: ${total} checks | ${passed} passed | ${failed} failed`);
console.log(bar);

if (failed > 0) {
  console.error(`\n${failed} Cursor rule check(s) failed.\n`);
  process.exit(1);
}
console.log('\nAll Cursor rule checks passed ✅\n');