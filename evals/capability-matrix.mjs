/**
 * evals/capability-matrix.mjs
 *
 * Offline read-only capability-matrix generator.
 *
 * Reconciles:
 *   - governance/tool-grants.json (meta keys filtered via key.startsWith('_'))
 *   - Each *.agent.md file's frontmatter (model_role, tools)
 *   - plans/project-context.md executor / review-pipeline / Agent Role Matrix tables
 *
 * Exported helpers are covered by evals/tests/capability-matrix.test.mjs.
 *
 * CLI usage:
 *   node evals/capability-matrix.mjs          # prints markdown table, exits 0
 */

import { readFileSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

// ── parseAgentFrontmatter ─────────────────────────────────────────────────────

/**
 * Parse agent frontmatter from a .agent.md file content string.
 *
 * Extracts `model_role` and `tools` from the leading `---`-delimited YAML block.
 * Handles all three inline-array variants used in this repo:
 *   - Single-quoted:  tools: ['edit', 'search', ...]
 *   - Double-quoted:  tools: ["vscode/askQuestions", ...]
 *   - Unquoted:       tools: [read/readFile, search/codebase, ...]
 *
 * @param {string} content - Raw file content of a .agent.md file.
 * @returns {{ modelRole: string|null, tools: string[] }}
 */
export function parseAgentFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return { modelRole: null, tools: [] };
  const fm = match[1];

  // Parse model_role (bare scalar value on the same line)
  const modelRoleMatch = fm.match(/^model_role:\s*(.+)$/m);
  const modelRole = modelRoleMatch ? modelRoleMatch[1].trim() : null;

  // Parse tools inline array: tools: [ ... ]
  // The regex captures everything between the outermost [ and ] on the tools line.
  const toolsLineMatch = fm.match(/^tools:\s*\[([^\]]*)\]/m);
  let tools = [];
  if (toolsLineMatch) {
    tools = toolsLineMatch[1]
      .split(',')
      .map((t) => t.trim().replace(/^['"]|['"]$/g, ''))
      .filter(Boolean);
  }

  return { modelRole, tools };
}

// ── parseProjectContextRoster ─────────────────────────────────────────────────

/**
 * Parse plans/project-context.md to extract executor agents, review-pipeline
 * agents, and the Agent Role Matrix table.
 *
 * Recognised section headers (exact markdown `##` headings):
 *   - "Phase Executor Agents"
 *   - "Review Pipeline Agents"
 *   - "Agent Role Matrix"
 *
 * Agent names are stored without the `.agent.md` suffix (matching table values).
 *
 * @param {string} content - Raw file content of project-context.md.
 * @returns {{
 *   executors: string[],
 *   reviewPipeline: string[],
 *   roleMatrix: Map<string, { schemaOutput: string, toolsProfile: string, delegationSource: string }>
 * }}
 */
export function parseProjectContextRoster(content) {
  const lines = content.split('\n');

  const executors = [];
  const reviewPipeline = [];
  const roleMatrix = new Map();

  let section = null;

  for (const line of lines) {
    // Detect targeted section headers first (continue to skip generic ## check)
    if (/^##\s+Phase Executor Agents/.test(line)) {
      section = 'executors';
      continue;
    }
    if (/^##\s+Review Pipeline Agents/.test(line)) {
      section = 'reviewPipeline';
      continue;
    }
    if (/^##\s+Agent Role Matrix/.test(line)) {
      section = 'roleMatrix';
      continue;
    }
    // Any other ## heading exits the tracked sections
    if (/^##/.test(line)) {
      section = null;
      continue;
    }

    if (!section || !line.includes('|')) continue;

    // Skip markdown separator rows (only -, |, :, space)
    if (/^\s*\|[\s|:-]+\|\s*$/.test(line)) continue;

    // Split pipe-bordered row; meaningful cells start at index 1
    const cells = line.split('|').map((c) => c.trim());
    if (cells.length < 3) continue;

    const agentName = cells[1];
    if (!agentName || agentName === 'Agent') continue; // skip header row

    if (section === 'executors') {
      executors.push(agentName);
    } else if (section === 'reviewPipeline') {
      reviewPipeline.push(agentName);
    } else if (section === 'roleMatrix') {
      const schemaOutput = cells[2] ? cells[2].trim() : '';
      const toolsProfile = cells[3] ? cells[3].trim() : '';
      const delegationSource = cells[4] ? cells[4].trim() : '';
      roleMatrix.set(agentName, { schemaOutput, toolsProfile, delegationSource });
    }
  }

  return { executors, reviewPipeline, roleMatrix };
}

// ── buildCapabilityMatrix ─────────────────────────────────────────────────────

/**
 * Build capability matrix rows by reconciling grants, frontmatter, and roster.
 *
 * Row creation strategy:
 *  1. One row per non-meta key in `grants` (filtered via key.startsWith('_')).
 *  2. One additional "ghost" row per agent present in executors/reviewPipeline
 *     that has NO entry in grants (drift flag: missing_in_grants).
 *
 * Drift flags set per row where applicable:
 *  - tools_count_mismatch  — frontmatterToolCount > 0 and != toolGrantCount
 *  - missing_in_roster     — agent not found in executors or reviewPipeline
 *  - missing_in_grants     — agent in roster but absent from grants (ghost row)
 *  - missing_schema_output — schemaOutput is empty string
 *
 * @param {{
 *   grants: object,
 *   agents: Map<string, { modelRole: string|null, tools: string[] }>,
 *   roster: { executors: string[], reviewPipeline: string[], roleMatrix: Map }
 * }} param0
 * @returns {Array<{
 *   agent: string,
 *   role: string,
 *   toolGrantCount: number,
 *   frontmatterToolCount: number,
 *   schemaOutput: string,
 *   executionOrReviewStatus: string,
 *   driftFlags: string[]
 * }>}
 */
export function buildCapabilityMatrix({ grants, agents, roster }) {
  const { executors, reviewPipeline, roleMatrix } = roster;
  const rows = [];
  const processedAgentNames = new Set();

  for (const [agentFile, grantedTools] of Object.entries(grants)) {
    if (agentFile.startsWith('_')) continue;

    const agentName = agentFile.replace(/\.agent\.md$/, '');
    processedAgentNames.add(agentName);

    const toolGrantCount = Array.isArray(grantedTools) ? grantedTools.length : 0;

    const frontmatter = agents.get(agentFile) || { modelRole: null, tools: [] };
    const frontmatterToolCount = frontmatter.tools.length;

    const isExecutor = executors.includes(agentName);
    const isReviewer = reviewPipeline.includes(agentName);
    const inRoster = isExecutor || isReviewer;
    const role = isExecutor ? 'executor' : isReviewer ? 'reviewer' : 'unclassified';

    const roleInfo = roleMatrix.get(agentName) || {};
    const schemaOutput = roleInfo.schemaOutput || '';

    const driftFlags = [];
    if (frontmatterToolCount > 0 && toolGrantCount !== frontmatterToolCount) {
      driftFlags.push('tools_count_mismatch');
    }
    if (!inRoster) {
      driftFlags.push('missing_in_roster');
    }
    if (!schemaOutput) {
      driftFlags.push('missing_schema_output');
    }

    rows.push({
      agent: agentFile,
      role,
      toolGrantCount,
      frontmatterToolCount,
      schemaOutput,
      executionOrReviewStatus: role,
      driftFlags,
    });
  }

  // Ghost rows: roster agents absent from grants
  const allRosterNames = new Set([...executors, ...reviewPipeline]);
  for (const rosterName of allRosterNames) {
    if (processedAgentNames.has(rosterName)) continue;

    const roleInfo = roleMatrix.get(rosterName) || {};
    const schemaOutput = roleInfo.schemaOutput || '';
    const role = executors.includes(rosterName) ? 'executor' : 'reviewer';
    const driftFlags = ['missing_in_grants'];
    if (!schemaOutput) driftFlags.push('missing_schema_output');

    rows.push({
      agent: `${rosterName}.agent.md`,
      role,
      toolGrantCount: 0,
      frontmatterToolCount: 0,
      schemaOutput,
      executionOrReviewStatus: role,
      driftFlags,
    });
  }

  return rows;
}

// ── renderMatrixMarkdown ──────────────────────────────────────────────────────

/**
 * Render capability matrix rows as a deterministic markdown table.
 *
 * Columns: Agent | Role | Tool Grants | Frontmatter Tools | Schema Output | Status | Drift Flags
 *
 * @param {Array} rows - Output of buildCapabilityMatrix.
 * @returns {string} Markdown table string (ends with newline).
 */
export function renderMatrixMarkdown(rows) {
  const lines = [
    '| Agent | Role | Tool Grants | Frontmatter Tools | Schema Output | Status | Drift Flags |',
    '| --- | --- | --- | --- | --- | --- | --- |',
  ];
  for (const row of rows) {
    const driftStr = row.driftFlags.length > 0 ? row.driftFlags.join(', ') : '—';
    const schemaStr = row.schemaOutput || '—';
    lines.push(
      `| ${row.agent} | ${row.role} | ${row.toolGrantCount} | ${row.frontmatterToolCount} | ${schemaStr} | ${row.executionOrReviewStatus} | ${driftStr} |`
    );
  }
  return lines.join('\n') + '\n';
}

// ── CLI entrypoint ────────────────────────────────────────────────────────────

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(__filename);

if (isMain) {
  const grantsPath = join(ROOT, 'governance', 'tool-grants.json');
  const projectContextPath = join(ROOT, 'plans', 'project-context.md');

  const grants = JSON.parse(readFileSync(grantsPath, 'utf8'));
  const roster = parseProjectContextRoster(readFileSync(projectContextPath, 'utf8'));

  const agents = new Map();
  for (const agentFile of Object.keys(grants)) {
    if (agentFile.startsWith('_')) continue;
    const agentPath = join(ROOT, agentFile);
    try {
      const content = readFileSync(agentPath, 'utf8');
      agents.set(agentFile, parseAgentFrontmatter(content));
    } catch {
      agents.set(agentFile, { modelRole: null, tools: [] });
    }
  }

  const rows = buildCapabilityMatrix({ grants, agents, roster });
  const md = renderMatrixMarkdown(rows);

  process.stdout.write(`# Capability Matrix\n\n${md}`);
  process.exit(0);
}
