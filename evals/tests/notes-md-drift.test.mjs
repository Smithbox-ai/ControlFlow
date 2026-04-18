/**
 * Negative-path coverage for validateNotesMdStyle (drift-checks.mjs Check #11).
 * Each fixture exercises one anti-pattern; the passing fixture exercises none.
 * All tests are deterministic and offline — no file system access.
 */
import { validateNotesMdStyle } from '../drift-checks.mjs';

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.error(`  ❌ ${label}`);
    failed++;
  }
}

console.log('\n=== NOTES.md Style Drift Tests ===');

// ── Passing fixture ──────────────────────────────────────────────────────────
{
  const content = `# Active Notes\n\nRepo-persistent active-objective state only.\n\n- Active objective: memory hygiene enforcement plan in ACTING phase.\n- Blockers: none.\n- Pending: archive script delivery (Phase 4).\n`;
  const result = validateNotesMdStyle(content);
  assert(result.ok, 'passing fixture: clean NOTES.md produces no violations');
  assert(result.violations.length === 0, 'passing fixture: violations array is empty');
}

// ── Anti-pattern: "iteration" keyword ───────────────────────────────────────
{
  const content = `# Active Notes\n\n- Active objective: something.\n- Blockers: iteration 2 of audit is pending.\n`;
  const result = validateNotesMdStyle(content);
  assert(!result.ok, 'iteration keyword: result.ok is false');
  assert(result.violations.some(v => v.includes('iteration')), 'iteration keyword: violation message mentions "iteration"');
}

// ── Anti-pattern: "verdict" keyword ─────────────────────────────────────────
{
  const content = `# Active Notes\n\n- Active objective: review done.\n- Last verdict: NEEDS_REVISION from PlanAuditor.\n`;
  const result = validateNotesMdStyle(content);
  assert(!result.ok, 'verdict keyword: result.ok is false');
  assert(result.violations.some(v => v.includes('verdict')), 'verdict keyword: violation message mentions "verdict"');
}

// ── Anti-pattern: phase artifact path fragment (phase-N-) ───────────────────
{
  const content = `# Active Notes\n\n- Active objective: see phase-3-delivery.yaml for details.\n`;
  const result = validateNotesMdStyle(content);
  assert(!result.ok, 'phase artifact path: result.ok is false');
  assert(result.violations.some(v => v.includes('phase artifact path')), 'phase artifact path: violation message is descriptive');
}

// ── Anti-pattern: fenced code block ─────────────────────────────────────────
{
  const content = `# Active Notes\n\n- Active objective: some task.\n\n\`\`\`json\n{ "foo": "bar" }\n\`\`\`\n`;
  const result = validateNotesMdStyle(content);
  assert(!result.ok, 'fenced code block: result.ok is false');
  assert(result.violations.some(v => v.includes('fenced code block')), 'fenced code block: violation message mentions fenced code block');
}

// ── Anti-pattern: more than 3 consecutive bullets under a heading ────────────
{
  const content = `# Active Notes\n\n- item 1\n- item 2\n- item 3\n- item 4\n`;
  const result = validateNotesMdStyle(content);
  assert(!result.ok, 'excess bullets: result.ok is false');
  assert(result.violations.some(v => v.includes('more than 3 consecutive bullet')), 'excess bullets: violation message mentions consecutive bullets');
}

// ── Boundary: exactly 3 bullets is allowed ───────────────────────────────────
{
  const content = `# Active Notes\n\n- item 1\n- item 2\n- item 3\n`;
  const result = validateNotesMdStyle(content);
  assert(result.ok, 'exactly 3 bullets: result.ok is true (boundary is allowed)');
}

// ── Bullets reset across headings ────────────────────────────────────────────
{
  const content = `# Active Notes\n\n- item 1\n- item 2\n- item 3\n\n## Section 2\n\n- item A\n- item B\n- item C\n`;
  const result = validateNotesMdStyle(content);
  assert(result.ok, 'bullets reset across headings: 3+3 bullets across two headings is allowed');
}

console.log(`\nTotal: ${passed + failed}  |  Passed: ${passed}  |  Failed: ${failed}`);
if (failed > 0) {
  console.error('Notes-md-drift tests FAILED');
  process.exit(1);
} else {
  console.log('All notes-md-drift tests passed ✅');
}
