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

// ── Session outcome hygiene ───────────────────────────────────────────────

/**
 * Analyse `plans/session-outcomes.md` content for hygiene signals.
 * Returns deterministic, offline summary — never throws on live content.
 *
 * @param {string} content - Full file text (empty string is safe).
 * @param {{ archiveThreshold?: number }} [opts]
 * @returns {{ totalEntries: number, entriesMissingFields: Array<{planId:string,missingFields:string[]}>, duplicatePlanIds: string[], archiveWarning: boolean, lastEntryDate: string|null }}
 */
export function summarizeSessionOutcomes(content, opts = {}) {
  const archiveThreshold = opts.archiveThreshold ?? 50;
  const indices = [];
  const entryRe = /^## Entry\b/gm;
  let m;
  while ((m = entryRe.exec(content)) !== null) indices.push(m.index);

  const grab = (block, label) => {
    const re = new RegExp(`\\*\\*${label}:\\*\\*\\s*\`?([^\`\\n]+?)\`?\\s*$`, 'm');
    const hit = block.match(re);
    return hit ? hit[1].trim() : null;
  };

  const entriesMissingFields = [];
  const planIdCount = Object.create(null);
  let lastEntryDate = null;

  for (let i = 0; i < indices.length; i++) {
    const start = indices[i];
    const end = i + 1 < indices.length ? indices[i + 1] : content.length;
    const block = content.slice(start, end);

    const planId = grab(block, 'Plan ID');
    const date = grab(block, 'Date');
    const tier = grab(block, 'Complexity Tier');
    const status = grab(block, 'Status');

    if (i === 0) lastEntryDate = date;

    const missing = [];
    if (!planId) missing.push('Plan ID');
    if (!date) missing.push('Date');
    if (!tier) missing.push('Complexity Tier');
    if (!status) missing.push('Status');

    if (missing.length > 0) {
      entriesMissingFields.push({ planId: planId ?? '(unknown)', missingFields: missing });
    }
    if (planId) {
      planIdCount[planId] = (planIdCount[planId] ?? 0) + 1;
    }
  }

  const duplicatePlanIds = Object.entries(planIdCount)
    .filter(([, c]) => c > 1)
    .map(([id]) => id)
    .sort();

  return {
    totalEntries: indices.length,
    entriesMissingFields,
    duplicatePlanIds,
    archiveWarning: indices.length >= archiveThreshold,
    lastEntryDate,
  };
}

// ── Traceability coverage ─────────────────────────────────────────────────

/**
 * Inspect artifact directories for the presence of `traceability-index.yaml`.
 * Returns sorted arrays for deterministic output.
 *
 * @param {string[]} artifactDirs - Directory names under `plans/artifacts/`.
 * @param {string} root - Repo root path.
 * @returns {{ withIndex: string[], withoutIndex: string[] }}
 */
export function summarizeTraceabilityCoverage(artifactDirs, root) {
  const withIndex = [];
  const withoutIndex = [];
  const artifactsBase = join(root, 'plans', 'artifacts');
  for (const dir of artifactDirs) {
    const indexPath = join(artifactsBase, dir, 'traceability-index.yaml');
    if (existsSync(indexPath)) {
      withIndex.push(dir);
    } else {
      withoutIndex.push(dir);
    }
  }
  return {
    withIndex: withIndex.sort(),
    withoutIndex: withoutIndex.sort(),
  };
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
  const aoCheck = checkActiveObjectiveArtifact(
    notes?.activeObjective || '',
    artifactDirs
  );

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
  if (sessionHygiene.lastEntryDate) {
    out.push(`- Last entry date: ${sessionHygiene.lastEntryDate}`);
  }
  if (sessionHygiene.archiveWarning) {
    out.push(
      `- WARNING: Entry count (${sessionHygiene.totalEntries}) meets or exceeds archive threshold.`
    );
  }
  if (sessionHygiene.entriesMissingFields.length > 0) {
    out.push(`- Entries missing required fields: ${sessionHygiene.entriesMissingFields.length}`);
    for (const e of sessionHygiene.entriesMissingFields) {
      out.push(`  - ${e.planId}: missing ${e.missingFields.join(', ')}`);
    }
  } else {
    out.push('- All entries have required fields.');
  }
  if (sessionHygiene.duplicatePlanIds.length > 0) {
    out.push(`- Duplicate Plan IDs (${sessionHygiene.duplicatePlanIds.length}):`);
    for (const id of sessionHygiene.duplicatePlanIds) out.push(`  - ${id}`);
  } else {
    out.push('- No duplicate Plan IDs.');
  }
  out.push('');

  // Traceability Index Coverage
  const traceabilityCoverage = summarizeTraceabilityCoverage(artifactDirs, root);
  out.push('## Traceability Index Coverage');
  out.push(`- With index (${traceabilityCoverage.withIndex.length}):`);
  for (const d of traceabilityCoverage.withIndex) out.push(`  - ${d}`);
  out.push(`- Without index (${traceabilityCoverage.withoutIndex.length}):`);
  for (const d of traceabilityCoverage.withoutIndex) out.push(`  - ${d}`);
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
