#!/usr/bin/env node
/**
 * Operator Health Report — offline read-only CLI.
 *
 * Produces a concise text report covering:
 *   - canonical validation command
 *   - git status grouped by repository surface
 *   - NOTES.md active objective / blockers / pending and line count
 *   - plan files grouped by **Status:** (plus count without status)
 *   - latest session outcome summary
 *   - artifact directory count and active-objective coverage warning
 *
 * No network, no live agents, no writes. Uses Node stdlib only.
 *
 * Usage:
 *   cd evals && node report-health.mjs
 *   cd evals && npm run health
 */

import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

// ── Surface classification ────────────────────────────────────────────────

const SURFACE_RULES = [
  { key: 'agents', test: (p) => /\.agent\.md$/.test(p) },
  { key: 'schemas', test: (p) => p.startsWith('schemas/') },
  { key: 'governance', test: (p) => p.startsWith('governance/') },
  { key: 'plans/artifacts', test: (p) => p.startsWith('plans/artifacts/') },
  { key: 'evals', test: (p) => p.startsWith('evals/') },
  { key: 'docs', test: (p) => p.startsWith('docs/') },
  { key: 'skills', test: (p) => p.startsWith('skills/') },
  { key: 'plans', test: (p) => p.startsWith('plans/') },
];

const SURFACE_KEYS = SURFACE_RULES.map((r) => r.key).concat(['other']);

/**
 * Classify `git status --porcelain` output into surface buckets.
 * Returns an object whose values are arrays of file paths.
 */
export function groupChangesBySurface(porcelain) {
  const groups = Object.fromEntries(SURFACE_KEYS.map((k) => [k, []]));
  if (!porcelain) return groups;
  const lines = porcelain.split(/\r?\n/).filter((l) => l.length > 0);
  for (const line of lines) {
    // Porcelain format is "XY path" or "XY old -> new" for renames.
    const rest = line.length >= 3 ? line.slice(3) : line;
    const path = rest.includes(' -> ') ? rest.split(' -> ').pop() : rest;
    let placed = false;
    for (const rule of SURFACE_RULES) {
      if (rule.test(path)) {
        groups[rule.key].push(path);
        placed = true;
        break;
      }
    }
    if (!placed) groups.other.push(path);
  }
  return groups;
}

// ── NOTES.md ──────────────────────────────────────────────────────────────

export function parseNotesMd(content) {
  const lines = content.split(/\r?\n/);
  // Drop trailing empty line produced by terminal newline so the count
  // matches the human-visible line count.
  const lineCount = lines[lines.length - 1] === '' ? lines.length - 1 : lines.length;
  const find = (label) => {
    const re = new RegExp(`^[-*]\\s*${label}\\s*:\\s*(.*)$`, 'i');
    for (const line of lines) {
      const m = line.match(re);
      if (m) return m[1].trim();
    }
    return null;
  };
  return {
    lineCount,
    activeObjective: find('Active objective'),
    blockers: find('Blockers'),
    pending: find('Pending'),
  };
}

// ── Plans ─────────────────────────────────────────────────────────────────

const NON_PLAN_BASENAMES = new Set([
  'session-outcomes.md',
  'project-context.md',
  'pipeline-comparison.md',
]);

export function parsePlanStatus(content) {
  const m = content.match(/^\*\*Status:\*\*\s*`?([A-Z_]+)`?/m);
  return m ? m[1] : null;
}

export function summarizePlans(plansDir) {
  if (!existsSync(plansDir)) return { byStatus: {}, withoutStatus: [], total: 0 };
  const files = readdirSync(plansDir).filter(
    (f) => f.endsWith('.md') && !NON_PLAN_BASENAMES.has(f)
  );
  const byStatus = {};
  const withoutStatus = [];
  for (const f of files) {
    const content = readFileSync(join(plansDir, f), 'utf8');
    const status = parsePlanStatus(content);
    if (!status) {
      withoutStatus.push(f);
    } else {
      (byStatus[status] ??= []).push(f);
    }
  }
  return { byStatus, withoutStatus, total: files.length };
}

// ── Session outcomes ──────────────────────────────────────────────────────

export function getLatestSessionOutcome(content) {
  const idx = content.indexOf('## Entry');
  if (idx === -1) return null;
  const next = content.indexOf('\n## Entry', idx + 1);
  const block = content.slice(idx, next === -1 ? content.length : next);
  const grab = (label) => {
    const re = new RegExp(`\\*\\*${label}:\\*\\*\\s*\`?([^\`\\n]+?)\`?\\s*$`, 'm');
    const m = block.match(re);
    return m ? m[1].trim() : null;
  };
  return {
    planId: grab('Plan ID'),
    date: grab('Date'),
    tier: grab('Complexity Tier'),
    status: grab('Status'),
  };
}

const REQUIRED_OUTCOME_FIELDS = ['Plan ID', 'Date', 'Complexity Tier', 'Status'];

export function summarizeSessionOutcomes(content, opts = {}) {
  const threshold = opts.archiveThreshold ?? 50;
  const parts = (content || '').split(/^## Entry\s*$/m).slice(1);
  const totalEntries = parts.length;
  const entriesMissingFields = [];
  const planIdCounts = {};
  let lastEntryDate = null;

  for (let i = 0; i < parts.length; i++) {
    const block = parts[i];
    const missing = [];
    for (const field of REQUIRED_OUTCOME_FIELDS) {
      if (!new RegExp(`\\*\\*${field}:\\*\\*`).test(block)) missing.push(field);
    }
    if (missing.length > 0) {
      const pm = block.match(/\*\*Plan ID:\*\*\s*`?([^`\n]+?)`?\s*$/m);
      entriesMissingFields.push({ label: pm ? pm[1].trim() : `entry-${i + 1}`, missing });
    }
    const pm = block.match(/\*\*Plan ID:\*\*\s*`?([^`\n]+?)`?\s*$/m);
    if (pm) {
      const pid = pm[1].trim();
      planIdCounts[pid] = (planIdCounts[pid] ?? 0) + 1;
    }
    if (i === 0) {
      const dm = block.match(/\*\*Date:\*\*\s*`?([^`\n]+?)`?\s*$/m);
      lastEntryDate = dm ? dm[1].trim() : null;
    }
  }

  const duplicatePlanIds = Object.entries(planIdCounts)
    .filter(([, count]) => count > 1)
    .map(([id]) => id)
    .sort();

  return { totalEntries, entriesMissingFields, duplicatePlanIds, archiveWarning: totalEntries >= threshold, lastEntryDate };
}

// ── Artifacts coverage ────────────────────────────────────────────────────

export function listArtifactDirs(artifactsDir) {
  if (!existsSync(artifactsDir)) return [];
  return readdirSync(artifactsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
}

export function inferPlanSlugFromObjective(activeObjective) {
  if (!activeObjective) return null;
  const m = activeObjective.match(/([a-z0-9][a-z0-9-]*-plan)/i);
  return m ? m[1] : null;
}

export function checkActiveObjectiveArtifact(activeObjective, artifactDirs) {
  const slug = inferPlanSlugFromObjective(activeObjective);
  if (!slug) return { slug: null, hasArtifact: null };
  const stripped = slug.replace(/-plan$/, '');
  const hasArtifact = artifactDirs.includes(slug) || artifactDirs.includes(stripped);
  return { slug, hasArtifact };
}

// ── Traceability index coverage ───────────────────────────────────────────

export function summarizeTraceabilityCoverage(artifactDirs, artifactsRoot) {
  const withIndex = [];
  const withoutIndex = [];
  for (const dir of artifactDirs) {
    if (existsSync(join(artifactsRoot, dir, 'traceability-index.yaml'))) {
      withIndex.push(dir);
    } else {
      withoutIndex.push(dir);
    }
  }
  withIndex.sort();
  withoutIndex.sort();
  return { withIndex, withoutIndex };
}

// ── Report generation ────────────────────────────────────────────────────

function safeGitStatus(root) {
  try {
    const output = execSync('git status --porcelain', {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return { output, unavailable: false };
  } catch {
    return { output: '', unavailable: true };
  }
}

export function generateReport(root, opts = {}) {
  const git = opts.gitStatus !== undefined
    ? { output: opts.gitStatus, unavailable: opts.gitUnavailable ?? false }
    : safeGitStatus(root);
  const gitStatus = git.output;
  const groups = groupChangesBySurface(gitStatus);

  const notesPath = join(root, 'NOTES.md');
  const notes = existsSync(notesPath)
    ? parseNotesMd(readFileSync(notesPath, 'utf8'))
    : null;

  const plans = summarizePlans(join(root, 'plans'));

  const sessionPath = join(root, 'plans', 'session-outcomes.md');
  const sessionContent = existsSync(sessionPath) ? readFileSync(sessionPath, 'utf8') : '';
  const session = sessionContent ? getLatestSessionOutcome(sessionContent) : null;
  const sessionHygiene = summarizeSessionOutcomes(sessionContent);

  const artifactDirs = listArtifactDirs(join(root, 'plans', 'artifacts'));
  const artifactsRoot = join(root, 'plans', 'artifacts');
  const aoCheck = checkActiveObjectiveArtifact(
    notes?.activeObjective || '',
    artifactDirs
  );
  const coverage = summarizeTraceabilityCoverage(artifactDirs, artifactsRoot);

  const out = [];
  out.push('# Operator Health Report');
  out.push('');
  out.push('Canonical validation: `cd evals && npm test`');
  out.push('');

  // Git status
  out.push('## Git Status (by surface)');
  const totalChanges = Object.values(groups).reduce((s, v) => s + v.length, 0);
  if (git.unavailable) {
    out.push('- WARNING: git status unavailable; working-tree grouping may be incomplete.');
  } else if (totalChanges === 0) {
    out.push('- Working tree clean.');
  } else {
    out.push(`- Total changed paths: ${totalChanges}`);
    for (const key of SURFACE_KEYS) {
      const list = groups[key];
      if (list.length === 0) continue;
      out.push(`- ${key} (${list.length}):`);
      for (const p of list) out.push(`  - ${p}`);
    }
  }
  out.push('');

  // NOTES.md
  out.push('## NOTES.md');
  if (!notes) {
    out.push('- NOTES.md not found.');
  } else {
    const budgetTag = notes.lineCount > 20 ? ' (OVER 20-line budget)' : '';
    out.push(`- Lines: ${notes.lineCount}${budgetTag}`);
    out.push(`- Active objective: ${notes.activeObjective ?? '(missing)'}`);
    out.push(`- Blockers: ${notes.blockers ?? '(missing)'}`);
    out.push(`- Pending: ${notes.pending ?? '(missing)'}`);
  }
  out.push('');

  // Plans
  out.push('## Plans');
  out.push(`- Total plan files: ${plans.total}`);
  const statusKeys = Object.keys(plans.byStatus).sort();
  for (const status of statusKeys) {
    const files = plans.byStatus[status];
    out.push(`- ${status} (${files.length}):`);
    for (const f of files) out.push(`  - ${f}`);
  }
  out.push(`- Plans without explicit Status: ${plans.withoutStatus.length}`);
  for (const f of plans.withoutStatus) out.push(`  - ${f}`);
  out.push('');

  // Session outcome
  out.push('## Latest Session Outcome');
  if (!session) {
    out.push('- No session outcomes recorded.');
  } else {
    out.push(`- Plan: ${session.planId ?? '(unknown)'}`);
    out.push(`- Date: ${session.date ?? '(unknown)'}`);
    out.push(`- Tier: ${session.tier ?? '(unknown)'}`);
    out.push(`- Status: ${session.status ?? '(unknown)'}`);
  }
  out.push('');

  // Artifacts
  out.push('## Artifacts');
  out.push(`- Artifact directories: ${artifactDirs.length}`);
  if (aoCheck.slug) {
    if (aoCheck.hasArtifact) {
      out.push(
        `- Active-objective plan slug \`${aoCheck.slug}\` has matching artifact directory.`
      );
    } else {
      out.push(
        `- WARNING: Active-objective plan slug \`${aoCheck.slug}\` has no matching artifact directory.`
      );
    }
  } else {
    out.push('- No active-objective plan slug detected in NOTES.md.');
  }
  out.push('');

  // Session Outcome Hygiene
  out.push('## Session Outcome Hygiene');
  out.push(`- Total entries: ${sessionHygiene.totalEntries}`);
  out.push(`- Last entry date: ${sessionHygiene.lastEntryDate ?? '(none)'}`);
  if (sessionHygiene.entriesMissingFields.length === 0) {
    out.push('- Entries missing required fields: 0');
  } else {
    out.push(`- Entries missing required fields: ${sessionHygiene.entriesMissingFields.length}`);
    for (const e of sessionHygiene.entriesMissingFields) {
      out.push(`  - ${e.label} (missing: ${e.missing.join(', ')})`);
    }
  }
  if (sessionHygiene.duplicatePlanIds.length === 0) {
    out.push('- Duplicate Plan IDs: 0');
  } else {
    out.push(`- Duplicate Plan IDs: ${sessionHygiene.duplicatePlanIds.length}`);
    for (const id of sessionHygiene.duplicatePlanIds) out.push(`  - ${id}`);
  }
  if (sessionHygiene.archiveWarning) {
    out.push(`- ARCHIVE WARNING: ${sessionHygiene.totalEntries} entries; consider archiving.`);
  }
  out.push('');

  // Traceability Index Coverage
  out.push('## Traceability Index Coverage');
  out.push(`- With traceability index (${coverage.withIndex.length}):`);
  for (const d of coverage.withIndex) out.push(`  - ${d}`);
  out.push(`- Without traceability index (${coverage.withoutIndex.length}):`);
  for (const d of coverage.withoutIndex) out.push(`  - ${d}`);
  out.push('');

  return out.join('\n') + '\n';
}

// ── CLI entrypoint ────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const isMain = process.argv[1] && resolve(process.argv[1]) === __filename;
if (isMain) {
  const root = resolve(dirname(__filename), '..');
  process.stdout.write(generateReport(root));
}
