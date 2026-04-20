/**
 * ControlFlow — Fingerprint Regression Tests (Phase 5 / N3 follow-up)
 *
 * Proves that computeStructuralFingerprint() invalidates the warm cache
 * when nested fixture files change — including deeply nested paths.
 * This validates the recursive-walk fix from Wave 2.
 *
 * Three logical tests:
 *   FP1 — runtime-policy subdirectory temp file changes and restores fingerprint
 *   FP2 — tutorial-parity subdirectory temp file changes and restores fingerprint
 *   FP3 — deeply nested path (runtime-policy/nested-dir/_temp.json) changes and
 *          restores fingerprint (proves recursive coverage beyond the top level)
 *
 * All temp files are cleaned up via try/finally so test failure never leaks
 * artifacts into the scenarios/ directory.
 *
 * Import computeStructuralFingerprint from drift-checks.mjs (not validate.mjs)
 * to avoid triggering validate.mjs side effects (process.exit calls, pass output).
 *
 * Exit 0 on all checks passed, exit 1 on any failure.
 */

import { writeFileSync, unlinkSync, mkdirSync, rmSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { computeStructuralFingerprint } from '../drift-checks.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCENARIOS_DIR = join(__dirname, '..', 'scenarios');

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

console.log('\n=== Fingerprint Regression Tests ===');

// ─── FP1: runtime-policy subdirectory ────────────────────────────────────────
{
  const tempPath = join(SCENARIOS_DIR, 'runtime-policy', '_fingerprint_test_temp.json');
  const initial = computeStructuralFingerprint();
  let fp1Changed = false;
  let fp1Restored = false;
  try {
    writeFileSync(tempPath, '{"_fingerprint_test": true}', 'utf8');
    fp1Changed = computeStructuralFingerprint() !== initial;
    unlinkSync(tempPath);
    fp1Restored = computeStructuralFingerprint() === initial;
  } finally {
    if (existsSync(tempPath)) { try { unlinkSync(tempPath); } catch { /* best-effort */ } }
  }
  check(
    'FP1: runtime-policy subdir — fingerprint changes on write, restores on delete',
    fp1Changed && fp1Restored,
    `changed=${fp1Changed}, restored=${fp1Restored}`
  );
}

// ─── FP2: tutorial-parity subdirectory ───────────────────────────────────────
{
  const tempPath = join(SCENARIOS_DIR, 'tutorial-parity', '_fingerprint_test_temp.json');
  const initial = computeStructuralFingerprint();
  let fp2Changed = false;
  let fp2Restored = false;
  try {
    writeFileSync(tempPath, '{"_fingerprint_test": true}', 'utf8');
    fp2Changed = computeStructuralFingerprint() !== initial;
    unlinkSync(tempPath);
    fp2Restored = computeStructuralFingerprint() === initial;
  } finally {
    if (existsSync(tempPath)) { try { unlinkSync(tempPath); } catch { /* best-effort */ } }
  }
  check(
    'FP2: tutorial-parity subdir — fingerprint changes on write, restores on delete',
    fp2Changed && fp2Restored,
    `changed=${fp2Changed}, restored=${fp2Restored}`
  );
}

// ─── FP3: deeply nested path (runtime-policy/nested-dir/_temp.json) ──────────
{
  const nestedDir = join(SCENARIOS_DIR, 'runtime-policy', 'nested-dir');
  const tempPath = join(nestedDir, '_temp.json');
  const initial = computeStructuralFingerprint();
  let fp3Changed = false;
  let fp3Restored = false;
  try {
    mkdirSync(nestedDir, { recursive: true });
    writeFileSync(tempPath, '{"_fingerprint_test": true}', 'utf8');
    fp3Changed = computeStructuralFingerprint() !== initial;
    rmSync(nestedDir, { recursive: true, force: true });
    fp3Restored = computeStructuralFingerprint() === initial;
  } finally {
    if (existsSync(nestedDir)) { try { rmSync(nestedDir, { recursive: true, force: true }); } catch { /* best-effort */ } }
  }
  check(
    'FP3: deeply nested path (runtime-policy/nested-dir/_temp.json) — fingerprint changes on write, restores on delete',
    fp3Changed && fp3Restored,
    `changed=${fp3Changed}, restored=${fp3Restored}`
  );
}

// ─── Summary ─────────────────────────────────────────────────────────────────
const total = passed + failed;
const bar = '='.repeat(50);
console.log(`\n${bar}`);
console.log(`Fingerprint: ${total} checks | ${passed} passed | ${failed} failed`);
console.log(bar);

if (failed > 0) {
  console.error(`\n${failed} fingerprint check(s) failed.\n`);
  process.exit(1);
}
console.log('\nAll fingerprint checks passed ✅\n');
