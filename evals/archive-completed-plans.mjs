/**
 * ControlFlow — Auto-Archive Lifecycle Script
 *
 * Scans plans/*.md for closed plans (status in memory_hygiene.archive_eligible_statuses)
 * that are older than memory_hygiene.archive_completed_plans_threshold_days.
 * Moves eligible plans to plans/archive/<YYYY-MM>/ and attempts to move their
 * matching artifact directory using a conservative prefix/substring heuristic.
 *
 * Usage:
 *   node archive-completed-plans.mjs           # dry-run (no changes)
 *   node archive-completed-plans.mjs --apply   # execute moves
 *
 * Safety guarantees:
 *   - Dry-run by default.
 *   - Never deletes files; only moves.
 *   - Idempotent: moving an already-archived plan is a no-op.
 *   - READY_FOR_EXECUTION plans are never eligible (not in archive_eligible_statuses).
 *   - Ambiguous artifact mapping: logs [MANUAL REVIEW NEEDED] and skips artifact archival.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, copyFileSync, rmSync, statSync } from 'fs';
import { join, basename, dirname, resolve } from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { tmpdir } from 'os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// ── Load governance config ────────────────────────────────────────────────────
let policy;
try {
  policy = JSON.parse(readFileSync(join(ROOT, 'governance', 'runtime-policy.json'), 'utf8'));
} catch (e) {
  console.error(`[ERROR] Cannot read governance/runtime-policy.json: ${e.message}`);
  process.exit(1);
}

const hygiene = policy.memory_hygiene;
if (!hygiene) {
  console.error('[ERROR] governance/runtime-policy.json missing "memory_hygiene" block');
  process.exit(1);
}

const ELIGIBLE_STATUSES = new Set(hygiene.archive_eligible_statuses || ['DONE', 'SUPERSEDED', 'DEFERRED']);
const THRESHOLD_DAYS = hygiene.archive_completed_plans_threshold_days ?? 14;
const APPLY = process.argv.includes('--apply');

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseStatus(content) {
  const m = content.match(/^\*\*Status:\*\*\s*`?([A-Z_]+)`?\s*$/m);
  return m ? m[1] : null;
}

function getFileAddDate(filePath) {
  // Try git log for the commit that first added this file
  try {
    const rel = filePath.replace(ROOT + '\\', '').replace(ROOT + '/', '').replace(/\\/g, '/');
    const out = execSync(`git -C "${ROOT}" log --format=%aI --diff-filter=A -- "${rel}"`, {
      encoding: 'utf8',
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    if (out) {
      // Take the first line only (handles rare delete/re-add case)
      const firstLine = out.split('\n')[0].trim();
      const d = new Date(firstLine);
      if (!isNaN(d.getTime())) return d;
    }
  } catch { /* git unavailable or file not in history */ }

  // Fallback: file modification time (birthtime not reliable cross-platform)
  try {
    return new Date(statSync(filePath).mtimeMs);
  } catch {
    return new Date(); // conservative: treat as today (won't archive)
  }
}

function ageInDays(date) {
  return (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24);
}

/**
 * Find a matching artifact directory for a plan file.
 * Strategy: substring heuristic — subdirectory name (lowercased, hyphens normalized)
 * must be a substring of the plan filename stem.
 * Returns the matched directory path, or null if 0 or >1 candidates found.
 */
function findArtifactDir(planFile) {
  const artifactsRoot = join(ROOT, 'plans', 'artifacts');
  if (!existsSync(artifactsRoot)) return { match: null, candidates: [] };

  const planStem = basename(planFile, '.md').toLowerCase();
  let subdirs;
  try {
    subdirs = readdirSync(artifactsRoot, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name);
  } catch {
    return { match: null, candidates: [] };
  }

  const candidates = subdirs.filter(name => planStem.includes(name.toLowerCase()));

  if (candidates.length === 1) {
    return { match: join(artifactsRoot, candidates[0]), candidates };
  }
  return { match: null, candidates };
}

/**
 * Move a file or directory from src to dest.
 * Handles cross-device moves (EXDEV) via copy+verify+unlink.
 * If dest already exists, this is a no-op (idempotent).
 */
function moveItem(src, dest) {
  if (existsSync(dest)) return { skipped: true };
  mkdirSync(dirname(dest), { recursive: true });
  try {
    renameSync(src, dest);
  } catch (e) {
    if (e.code === 'EXDEV') {
      // Cross-device: copy recursively then remove source
      copyRecursive(src, dest);
      rmRecursive(src);
    } else {
      throw e;
    }
  }
  return { skipped: false };
}

function copyRecursive(src, dest) {
  const st = statSync(src);
  if (st.isDirectory()) {
    mkdirSync(dest, { recursive: true });
    for (const child of readdirSync(src)) {
      copyRecursive(join(src, child), join(dest, child));
    }
  } else {
    copyFileSync(src, dest);
  }
}

function rmRecursive(target) {
  rmSync(target, { recursive: true, force: true });
}

function archiveMonth(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

// ── Main scan ─────────────────────────────────────────────────────────────────

const plansDir = join(ROOT, 'plans');
const archiveBase = join(plansDir, 'archive');

let planFiles;
try {
  planFiles = readdirSync(plansDir)
    .filter(f => f.endsWith('.md'))
    .map(f => join(plansDir, f));
} catch (e) {
  console.error(`[ERROR] Cannot read plans/ directory: ${e.message}`);
  process.exit(1);
}

console.log(`\nControlFlow Auto-Archive — ${APPLY ? 'APPLY mode' : 'DRY-RUN mode'}`);
console.log(`  Eligible statuses: ${[...ELIGIBLE_STATUSES].join(', ')}`);
console.log(`  Threshold: ${THRESHOLD_DAYS} days\n`);

let eligible = 0;
let skipped = 0;
let moved = 0;
let warnings = 0;

for (const planPath of planFiles) {
  let content;
  try {
    content = readFileSync(planPath, 'utf8');
  } catch {
    continue;
  }

  const status = parseStatus(content);
  if (!status || !ELIGIBLE_STATUSES.has(status)) {
    continue;
  }

  const addDate = getFileAddDate(planPath);
  const age = ageInDays(addDate);

  if (age < THRESHOLD_DAYS) {
    console.log(`  [SKIP] ${basename(planPath)} — status=${status}, age=${Math.floor(age)}d < ${THRESHOLD_DAYS}d threshold`);
    skipped++;
    continue;
  }

  eligible++;
  const month = archiveMonth(addDate);
  const destPlan = join(archiveBase, month, basename(planPath));

  // Artifact mapping
  const { match: artifactSrc, candidates } = findArtifactDir(planPath);
  let artifactNote = '';
  if (artifactSrc) {
    artifactNote = ` + artifacts/${basename(artifactSrc)}/`;
  } else if (candidates.length > 1) {
    artifactNote = ` [MANUAL REVIEW NEEDED: ${candidates.length} artifact candidates: ${candidates.join(', ')}]`;
    warnings++;
  } else {
    artifactNote = ' (no artifacts)';
  }

  console.log(`  [ELIGIBLE] ${basename(planPath)} — status=${status}, age=${Math.floor(age)}d → plans/archive/${month}/${artifactNote}`);

  if (APPLY) {
    // Move plan file
    const planResult = moveItem(planPath, destPlan);
    if (planResult.skipped) {
      console.log(`    already archived: ${destPlan}`);
    } else {
      console.log(`    moved: ${basename(planPath)} → plans/archive/${month}/`);
      moved++;
    }

    // Move artifact dir (only if confident match)
    if (artifactSrc) {
      const destArtifact = join(archiveBase, month, 'artifacts', basename(artifactSrc));
      const artResult = moveItem(artifactSrc, destArtifact);
      if (artResult.skipped) {
        console.log(`    already archived: artifacts/${basename(artifactSrc)}/`);
      } else {
        console.log(`    moved: artifacts/${basename(artifactSrc)}/ → plans/archive/${month}/artifacts/`);
      }
    } else if (candidates.length > 1) {
      console.log(`    [MANUAL REVIEW NEEDED] artifact mapping ambiguous — skipping artifact archival`);
    }
  }
}

console.log(`\nSummary: ${eligible} eligible, ${skipped} below threshold, ${moved} moved, ${warnings} warnings`);
if (warnings > 0) {
  console.log(`  ${warnings} plan(s) require manual artifact review — plan files were still moved (in --apply mode).`);
}
if (!APPLY && eligible > 0) {
  console.log(`\nRun with --apply to execute the moves above.`);
}
if (eligible === 0) {
  console.log('No plans currently eligible for archival.');
}
