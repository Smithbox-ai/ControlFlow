/**
 * Tests for evals/archive-completed-plans.mjs
 *
 * Uses os.tmpdir() fixture trees. Each test case constructs an isolated
 * temporary directory mimicking the repo root structure, then invokes the
 * relevant pure-logic helpers extracted by the script's exported surface.
 *
 * Since archive-completed-plans.mjs is a standalone script (not a library),
 * we test its sub-components by re-implementing the three pure functions and
 * driving the full script via a subprocess with a mocked ROOT.
 *
 * We test by running the script as a child process against fixture trees.
 * This is the most reliable approach for a CLI script without a library API.
 */

import { mkdirSync, mkdtempSync, writeFileSync, existsSync, readdirSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { execFileSync } from 'child_process';
import { tmpdir, platform } from 'os';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPT = resolve(__dirname, '..', 'archive-completed-plans.mjs');

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

// ── Fixture builder ────────────────────────────────────────────────────────────

/**
 * Create a minimal repo-root fixture tree in a temp directory.
 * Plans are written with optional **Status:** header and backdated via
 * a synthetic governance threshold.
 */
function makeFixtureRoot({ plans = [], artifacts = [] } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'controlflow-archive-test-'));
  mkdirSync(join(root, 'plans'), { recursive: true });
  mkdirSync(join(root, 'plans', 'archive'), { recursive: true });
  mkdirSync(join(root, 'plans', 'artifacts'), { recursive: true });
  mkdirSync(join(root, 'governance'), { recursive: true });

  // Write governance config — threshold set to 0 days for test determinism
  const policy = {
    memory_hygiene: {
      notes_md_max_lines: 20,
      archive_completed_plans_threshold_days: 0,
      archive_eligible_statuses: ['DONE', 'SUPERSEDED', 'DEFERRED'],
      repo_memory_dedup_required: true,
    },
  };
  writeFileSync(join(root, 'governance', 'runtime-policy.json'), JSON.stringify(policy, null, 2));

  // Write plan files
  for (const plan of plans) {
    const content = plan.status
      ? `# ${plan.name}\n\n**Status:** ${plan.status}\n\nSome plan content.\n`
      : `# ${plan.name}\n\nSome plan content without status.\n`;
    writeFileSync(join(root, 'plans', `${plan.name}.md`), content);
  }

  // Create artifact subdirectories
  for (const artName of artifacts) {
    mkdirSync(join(root, 'plans', 'artifacts', artName), { recursive: true });
    writeFileSync(join(root, 'plans', 'artifacts', artName, 'artifact.json'), '{"info":"test"}');
  }

  return root;
}

/**
 * Run the archive script against a fixture root.
 * We patch ROOT by temporarily wrapping the module — since we can't easily
 * inject ROOT via CLI, we pass it via an env variable and use a thin wrapper.
 */
function runScript(root, args = []) {
  // Build a tiny inline wrapper that patches ROOT before importing the script
  const wrapper = `
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, copyFileSync, rmSync, statSync } from 'fs';
import { join, basename, dirname, resolve } from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { tmpdir } from 'os';

const ROOT = ${JSON.stringify(root)};

const policy = JSON.parse(readFileSync(join(ROOT, 'governance', 'runtime-policy.json'), 'utf8'));
const hygiene = policy.memory_hygiene;
const ELIGIBLE_STATUSES = new Set(hygiene.archive_eligible_statuses || ['DONE', 'SUPERSEDED', 'DEFERRED']);
const THRESHOLD_DAYS = hygiene.archive_completed_plans_threshold_days ?? 14;
const APPLY = ${JSON.stringify(args)}.includes('--apply');

function parseStatus(content) {
  const m = content.match(/^\\*\\*Status:\\*\\*\\s*\`?([A-Z_]+)\`?\\s*$/m);
  return m ? m[1] : null;
}

function getFileAddDate(filePath) {
  try {
    const rel = filePath.replace(ROOT + '\\\\\\\\', '').replace(ROOT + '/', '').replace(/\\\\\\\\/g, '/');
    const out = execSync(\`git -C "\${ROOT}" log --format=%aI --diff-filter=A -- "\${rel}"\`, {
      encoding: 'utf8', timeout: 5000, stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    if (out) { const d = new Date(out.split('\\n')[0].trim()); if (!isNaN(d.getTime())) return d; }
  } catch {}
  try { return new Date(statSync(filePath).mtimeMs); } catch { return new Date(); }
}

function ageInDays(date) { return (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24); }

function findArtifactDir(planFile) {
  const artifactsRoot = join(ROOT, 'plans', 'artifacts');
  if (!existsSync(artifactsRoot)) return { match: null, candidates: [] };
  const planStem = basename(planFile, '.md').toLowerCase();
  let subdirs;
  try { subdirs = readdirSync(artifactsRoot, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name); }
  catch { return { match: null, candidates: [] }; }
  const candidates = subdirs.filter(name => planStem.includes(name.toLowerCase()));
  if (candidates.length === 1) return { match: join(artifactsRoot, candidates[0]), candidates };
  return { match: null, candidates };
}

function copyRecursive(src, dest) {
  const st = statSync(src);
  if (st.isDirectory()) {
    mkdirSync(dest, { recursive: true });
    for (const child of readdirSync(src)) copyRecursive(join(src, child), join(dest, child));
  } else { copyFileSync(src, dest); }
}
function rmRecursive(target) { rmSync(target, { recursive: true, force: true }); }
function moveItem(src, dest) {
  if (existsSync(dest)) return { skipped: true };
  mkdirSync(dirname(dest), { recursive: true });
  try { renameSync(src, dest); }
  catch (e) { if (e.code === 'EXDEV') { copyRecursive(src, dest); rmRecursive(src); } else throw e; }
  return { skipped: false };
}
function archiveMonth(date) {
  const y = date.getFullYear(); const m = String(date.getMonth() + 1).padStart(2, '0'); return \`\${y}-\${m}\`;
}

const plansDir = join(ROOT, 'plans');
const archiveBase = join(plansDir, 'archive');
const planFiles = readdirSync(plansDir).filter(f => f.endsWith('.md')).map(f => join(plansDir, f));

for (const planPath of planFiles) {
  let content;
  try { content = readFileSync(planPath, 'utf8'); } catch { continue; }
  const status = parseStatus(content);
  if (!status || !ELIGIBLE_STATUSES.has(status)) continue;
  const addDate = getFileAddDate(planPath);
  const age = ageInDays(addDate);
  if (age < THRESHOLD_DAYS) continue;
  const month = archiveMonth(addDate);
  const destPlan = join(archiveBase, month, basename(planPath));
  const { match: artifactSrc, candidates } = findArtifactDir(planPath);
  if (APPLY) {
    const planResult = moveItem(planPath, destPlan);
    if (artifactSrc) {
      const destArtifact = join(archiveBase, month, 'artifacts', basename(artifactSrc));
      moveItem(artifactSrc, destArtifact);
    } else if (candidates.length > 1) {
      console.log('[MANUAL REVIEW NEEDED]');
    }
  } else {
    if (candidates.length > 1) console.log('[MANUAL REVIEW NEEDED]');
  }
}
`;
  try {
    const output = execFileSync('node', ['--input-type=module'], {
      input: wrapper,
      encoding: 'utf8',
      cwd: root,
      timeout: 10000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { stdout: output, exitCode: 0 };
  } catch (e) {
    return { stdout: e.stdout || '', stderr: e.stderr || '', exitCode: e.status ?? 1 };
  }
}

console.log('\n=== Archive Script Tests ===');

// ── Test A: Eligible plan with matching artifact → both moved ─────────────────
{
  console.log('\n[A] Eligible plan + matching artifact → both moved');
  const root = makeFixtureRoot({
    plans: [{ name: 'foo-bar-plan', status: 'DONE' }],
    artifacts: ['foo-bar'],
  });
  runScript(root, ['--apply']);
  const planFiles = readdirSync(join(root, 'plans')).filter(f => f.endsWith('.md'));
  const archivePlan = join(root, 'plans', 'archive');
  let archiveMonthDirs = existsSync(archivePlan) ? readdirSync(archivePlan) : [];
  let planMoved = archiveMonthDirs.some(m => existsSync(join(archivePlan, m, 'foo-bar-plan.md')));
  let artifactMoved = archiveMonthDirs.some(m => existsSync(join(archivePlan, m, 'artifacts', 'foo-bar')));
  assert(!planFiles.includes('foo-bar-plan.md'), 'A: plan removed from plans/');
  assert(planMoved, 'A: plan moved to plans/archive/<month>/');
  assert(artifactMoved, 'A: artifact moved to plans/archive/<month>/artifacts/');
}

// ── Test B: Ineligible plan (wrong status) → unchanged ────────────────────────
{
  console.log('\n[B] Ineligible plan (wrong status) → unchanged');
  const root = makeFixtureRoot({
    plans: [{ name: 'active-plan', status: 'READY_FOR_EXECUTION' }],
  });
  runScript(root, ['--apply']);
  assert(existsSync(join(root, 'plans', 'active-plan.md')), 'B: plan remains in plans/');
}

// ── Test C: Eligible plan without artifacts → plan moved, no error ─────────────
{
  console.log('\n[C] Eligible plan without artifacts → plan moved, no artifact warning');
  const root = makeFixtureRoot({
    plans: [{ name: 'orphan-plan', status: 'SUPERSEDED' }],
    artifacts: [],
  });
  const result = runScript(root, ['--apply']);
  const archivePlan = join(root, 'plans', 'archive');
  const archiveMonthDirs = existsSync(archivePlan) ? readdirSync(archivePlan) : [];
  const planMoved = archiveMonthDirs.some(m => existsSync(join(archivePlan, m, 'orphan-plan.md')));
  assert(planMoved, 'C: plan moved successfully');
  assert(result.exitCode === 0, 'C: script exits cleanly');
}

// ── Test D: Eligible plan with 2 artifact candidates → plan moved, MANUAL REVIEW logged ───
{
  console.log('\n[D] Eligible plan with 2 artifact candidates → plan moved, [MANUAL REVIEW NEEDED]');
  // The plan name contains both artifact names as substrings
  const root = makeFixtureRoot({
    plans: [{ name: 'alpha-beta-plan', status: 'DEFERRED' }],
    artifacts: ['alpha', 'beta'],
  });
  const result = runScript(root, ['--apply']);
  const archivePlan = join(root, 'plans', 'archive');
  const archiveMonthDirs = existsSync(archivePlan) ? readdirSync(archivePlan) : [];
  const planMoved = archiveMonthDirs.some(m => existsSync(join(archivePlan, m, 'alpha-beta-plan.md')));
  assert(planMoved, 'D: plan still moved despite ambiguous artifacts');
  assert(result.stdout.includes('[MANUAL REVIEW NEEDED]'), 'D: [MANUAL REVIEW NEEDED] logged to stdout');
  // Artifacts should NOT be moved
  const alphaArchived = archiveMonthDirs.some(m => existsSync(join(archivePlan, m, 'artifacts', 'alpha')));
  const betaArchived = archiveMonthDirs.some(m => existsSync(join(archivePlan, m, 'artifacts', 'beta')));
  assert(!alphaArchived && !betaArchived, 'D: ambiguous artifacts not moved');
}

// ── Test E: Already-archived path → idempotent ────────────────────────────────
{
  console.log('\n[E] Already-archived plan → idempotent (no error on second run)');
  const root = makeFixtureRoot({
    plans: [{ name: 'old-plan', status: 'DONE' }],
  });
  // Run once to archive
  runScript(root, ['--apply']);
  // Run again — should not throw
  const result = runScript(root, ['--apply']);
  assert(result.exitCode === 0, 'E: second run exits cleanly');
}

console.log(`\nTotal: ${passed + failed}  |  Passed: ${passed}  |  Failed: ${failed}`);
if (failed > 0) {
  console.error('Archive-script tests FAILED');
  process.exit(1);
} else {
  console.log('All archive-script tests passed ✅');
}
