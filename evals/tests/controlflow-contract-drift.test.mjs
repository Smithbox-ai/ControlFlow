/**
 * ControlFlow — CLAUDE.md Contract Drift Tests (remediation Phase 4)
 *
 * Asserts the human-facing control doc (CLAUDE.md) stays aligned with the
 * machine-enforced plan contract:
 *   - schemas/planner.plan.schema.json (agent const, schema_version const)
 *   - governance/project-context-registry.json (phase_executor_agents enum)
 *   - governance/runtime-policy.json (plan_review_gate_trigger_conditions.confidence_threshold)
 *
 * Exit 0 on all checks passed, exit 1 on any failure.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { checkControlFlowContractDrift } from '../drift-checks.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

const FIXTURES_DIR = join(__dirname, 'fixtures', 'contract-drift');
const CLAUDE_MD_PATH = join(ROOT, 'CLAUDE.md');
const SCHEMA_PATH = join(ROOT, 'schemas', 'planner.plan.schema.json');
const REGISTRY_PATH = join(ROOT, 'governance', 'project-context-registry.json');
const RUNTIME_POLICY_PATH = join(ROOT, 'governance', 'runtime-policy.json');

function loadJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

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

console.log('\n=== CLAUDE.md Contract Drift ===');

const plannerSchema = loadJson(SCHEMA_PATH);
const registry = loadJson(REGISTRY_PATH);
const runtimePolicy = loadJson(RUNTIME_POLICY_PATH);

// ─── Fixture: good CLAUDE.md ─────────────────────────────────────────────────
{
  const good = readFileSync(join(FIXTURES_DIR, 'good-claude.md'), 'utf8');
  const r = checkControlFlowContractDrift(good, plannerSchema, registry, runtimePolicy);
  check('good-claude.md: drift check returns ok', r.ok, r.errors.join('; '));
  check('good-claude.md: no errors reported', r.errors.length === 0, `got ${r.errors.length}: ${r.errors.join('; ')}`);
  check('good-claude.md: checked all 4 contract fields', r.checked === 4, `checked=${r.checked}`);
}

// ─── Fixture: bad CLAUDE.md ──────────────────────────────────────────────────
{
  const bad = readFileSync(join(FIXTURES_DIR, 'bad-claude.md'), 'utf8');
  const r = checkControlFlowContractDrift(bad, plannerSchema, registry, runtimePolicy);
  check('bad-claude.md: drift check fails', !r.ok, `errors=${r.errors.length}`);
  check('bad-claude.md: reports ≥4 contract drifts', r.errors.length >= 4, `got ${r.errors.length}: ${r.errors.join('; ')}`);
  check(
    'bad-claude.md: errors cover Agent, Schema Version, confidence, and executor enum',
    r.errors.some(e => e.includes('Agent')) &&
      r.errors.some(e => e.includes('Schema Version')) &&
      r.errors.some(e => e.includes('confidence')) &&
      r.errors.some(e => e.includes('executor')),
    `errors=[${r.errors.join('; ')}]`
  );
}

// ─── Live-tree smoke test against the real CLAUDE.md ──────────────────────────
{
  const live = readFileSync(CLAUDE_MD_PATH, 'utf8');
  const r = checkControlFlowContractDrift(live, plannerSchema, registry, runtimePolicy);
  check('live CLAUDE.md: drift check passes', r.ok, r.errors.join('; '));
}

// ─── Summary ─────────────────────────────────────────────────────────────────
const total = passed + failed;
const bar = '='.repeat(50);
console.log(`\n${bar}`);
console.log(`CLAUDE.md contract drift: ${total} checks | ${passed} passed | ${failed} failed`);
console.log(bar);

if (failed > 0) {
  console.error(`\n${failed} CLAUDE.md contract-drift check(s) failed.\n`);
  process.exit(1);
}
console.log('\nAll CLAUDE.md contract-drift checks passed ✅\n');
