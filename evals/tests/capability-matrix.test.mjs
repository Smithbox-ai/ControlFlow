/**
 * Tests for evals/capability-matrix.mjs
 *
 * Covers:
 *   - parseAgentFrontmatter: positive and negative fixture cases
 *   - parseProjectContextRoster: positive and negative fixture cases
 *   - buildCapabilityMatrix: clean agent, each drift flag variant, meta-key filtering
 *   - renderMatrixMarkdown: deterministic output, drift flag surfacing
 *   - Smoke test against live tree: row count equals non-meta tool-grants keys
 *
 * Uses plain Node custom assert pattern (no test framework).
 * Exit 0 on all checks passed, exit 1 on any failure.
 *
 * Run directly:
 *   node evals/tests/capability-matrix.test.mjs
 * (Phase 4 wires this file into the `npm test` chain.)
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import {
  parseAgentFrontmatter,
  parseProjectContextRoster,
  buildCapabilityMatrix,
  renderMatrixMarkdown,
} from '../capability-matrix.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

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

// ── parseAgentFrontmatter ─────────────────────────────────────────────────────

console.log('\n=== capability-matrix: parseAgentFrontmatter ===');

{
  // Positive: single-quoted inline array
  const content =
    `---\ndescription: 'Test agent'\ntools: ['edit', 'search', 'runCommands']\n` +
    `model: GPT-4\nmodel_role: capable-implementer\n---\nBody text`;
  const r = parseAgentFrontmatter(content);
  assert(r.modelRole === 'capable-implementer', 'parses model_role from single-quoted tools frontmatter');
  assert(Array.isArray(r.tools), 'tools is an array');
  assert(r.tools.length === 3, 'parses 3 tools from single-quoted inline array');
  assert(r.tools.includes('edit'), 'tools includes "edit"');
  assert(r.tools.includes('runCommands'), 'tools includes "runCommands"');
}

{
  // Positive: double-quoted inline array with namespaced tools
  const content =
    `---\ntools: ["vscode/askQuestions", "execute/runInTerminal", "read/readFile"]\n` +
    `model_role: orchestration-capable\n---\n`;
  const r = parseAgentFrontmatter(content);
  assert(r.modelRole === 'orchestration-capable', 'parses model_role from double-quoted tools frontmatter');
  assert(r.tools.length === 3, 'parses 3 tools from double-quoted inline array');
  assert(r.tools.includes('vscode/askQuestions'), 'tools includes namespaced tool');
}

{
  // Positive: unquoted inline array
  const content =
    `---\ntools: [read/readFile, search/codebase, search/fileSearch]\nmodel_role: capable-reviewer\n---\n`;
  const r = parseAgentFrontmatter(content);
  assert(r.tools.length === 3, 'parses 3 tools from unquoted inline array');
  assert(r.tools.includes('read/readFile'), 'tools includes unquoted namespaced tool');
  assert(r.modelRole === 'capable-reviewer', 'parses model_role from unquoted-array frontmatter');
}

{
  // Negative: no frontmatter
  const content = `# Just a regular markdown file\nNo frontmatter here.`;
  const r = parseAgentFrontmatter(content);
  assert(r.modelRole === null, 'modelRole is null when no frontmatter');
  assert(r.tools.length === 0, 'tools is empty when no frontmatter');
}

{
  // Negative: frontmatter present but missing tools and model_role
  const content = `---\ndescription: 'no tools listed'\n---\nbody`;
  const r = parseAgentFrontmatter(content);
  assert(r.modelRole === null, 'modelRole is null when missing from frontmatter');
  assert(r.tools.length === 0, 'tools is empty when missing from frontmatter');
}

// ── parseProjectContextRoster ─────────────────────────────────────────────────

console.log('\n=== capability-matrix: parseProjectContextRoster ===');

{
  // Positive: minimal fixture with all three sections
  const content = [
    '# Project Context',
    '',
    '## Phase Executor Agents',
    '',
    '| Agent | Role | Primary Use Case | Model Recommendation |',
    '| --- | --- | --- | --- |',
    '| AgentAlpha | Executor role | Implementation | Fast model |',
    '| AgentBeta | Another role | Testing | Capable model |',
    '',
    '## Review Pipeline Agents',
    '',
    '| Agent | Role | Primary Use Case | Model Recommendation |',
    '| --- | --- | --- | --- |',
    '| AgentGamma | Review role | Auditing | Read-only |',
    '',
    '## Agent Role Matrix',
    '',
    '| Agent | Schema Output | Tools Profile | Delegation Source |',
    '| --- | --- | --- | --- |',
    '| AgentAlpha | alpha.schema.json | Full (5 tools) | Orchestrator |',
    '| AgentBeta | beta.schema.json | Partial (3 tools) | Orchestrator |',
    '| AgentGamma | gamma.schema.json | Read-only (2 tools) | Orchestrator |',
    '',
    '## Other Section',
    '',
    'Should not be parsed.',
  ].join('\n');

  const r = parseProjectContextRoster(content);
  assert(r.executors.length === 2, 'parses 2 executors');
  assert(r.executors.includes('AgentAlpha'), 'executors includes AgentAlpha');
  assert(r.executors.includes('AgentBeta'), 'executors includes AgentBeta');
  assert(r.reviewPipeline.length === 1, 'parses 1 review pipeline agent');
  assert(r.reviewPipeline.includes('AgentGamma'), 'reviewPipeline includes AgentGamma');
  assert(r.roleMatrix.size === 3, 'roleMatrix has 3 entries');
  assert(
    r.roleMatrix.get('AgentAlpha')?.schemaOutput === 'alpha.schema.json',
    'roleMatrix has correct schemaOutput for AgentAlpha'
  );
  assert(
    r.roleMatrix.get('AgentGamma')?.schemaOutput === 'gamma.schema.json',
    'roleMatrix has correct schemaOutput for AgentGamma'
  );
}

{
  // Negative: empty content
  const r = parseProjectContextRoster('');
  assert(r.executors.length === 0, 'executors empty for empty content');
  assert(r.reviewPipeline.length === 0, 'reviewPipeline empty for empty content');
  assert(r.roleMatrix.size === 0, 'roleMatrix empty for empty content');
}

{
  // Negative: content with no recognised section headers
  const r = parseProjectContextRoster('# Heading\n\nSome prose without sections.');
  assert(r.executors.length === 0, 'executors empty when no matching section headers');
  assert(r.reviewPipeline.length === 0, 'reviewPipeline empty when no matching section headers');
}

// ── buildCapabilityMatrix ─────────────────────────────────────────────────────

console.log('\n=== capability-matrix: buildCapabilityMatrix ===');

{
  // Positive: clean agent — matching tool counts, in roster, schema present
  const grants = { 'AgentAlpha.agent.md': ['tool1', 'tool2', 'tool3'] };
  const agents = new Map([
    ['AgentAlpha.agent.md', { modelRole: 'capable-implementer', tools: ['tool1', 'tool2', 'tool3'] }],
  ]);
  const roster = {
    executors: ['AgentAlpha'],
    reviewPipeline: [],
    roleMatrix: new Map([
      ['AgentAlpha', { schemaOutput: 'alpha.schema.json', toolsProfile: '', delegationSource: '' }],
    ]),
  };
  const rows = buildCapabilityMatrix({ grants, agents, roster });
  assert(rows.length === 1, 'produces 1 row for 1 grants entry (no ghost rows)');
  const row = rows[0];
  assert(row.agent === 'AgentAlpha.agent.md', 'row.agent is the grants key');
  assert(row.role === 'executor', 'role is executor');
  assert(row.toolGrantCount === 3, 'toolGrantCount equals grants array length');
  assert(row.frontmatterToolCount === 3, 'frontmatterToolCount equals frontmatter tools length');
  assert(row.schemaOutput === 'alpha.schema.json', 'schemaOutput from roleMatrix');
  assert(row.driftFlags.length === 0, 'no drift flags for clean matching agent');
}

{
  // Drift: tools_count_mismatch
  const grants = { 'AgentBeta.agent.md': ['tool1', 'tool2'] };
  const agents = new Map([
    ['AgentBeta.agent.md', { modelRole: 'capable-implementer', tools: ['tool1', 'tool2', 'tool3'] }],
  ]);
  const roster = {
    executors: ['AgentBeta'],
    reviewPipeline: [],
    roleMatrix: new Map([['AgentBeta', { schemaOutput: 'beta.schema.json' }]]),
  };
  const rows = buildCapabilityMatrix({ grants, agents, roster });
  assert(rows[0].driftFlags.includes('tools_count_mismatch'), 'tools_count_mismatch when frontmatter count differs from grant count');
}

{
  // No tools_count_mismatch when frontmatterToolCount is 0 (no frontmatter data)
  const grants = { 'AgentNoFm.agent.md': ['tool1', 'tool2'] };
  const agents = new Map([
    ['AgentNoFm.agent.md', { modelRole: null, tools: [] }],
  ]);
  const roster = {
    executors: ['AgentNoFm'],
    reviewPipeline: [],
    roleMatrix: new Map([['AgentNoFm', { schemaOutput: 'nofm.schema.json' }]]),
  };
  const rows = buildCapabilityMatrix({ grants, agents, roster });
  assert(
    !rows[0].driftFlags.includes('tools_count_mismatch'),
    'no tools_count_mismatch when frontmatterToolCount is 0 (no frontmatter)'
  );
}

{
  // Drift: missing_in_roster (agent in grants but not in executors or reviewPipeline)
  const grants = { 'Orchestrator.agent.md': ['tool1'] };
  const agents = new Map([
    ['Orchestrator.agent.md', { modelRole: 'orchestration-capable', tools: ['tool1'] }],
  ]);
  const roster = {
    executors: [],
    reviewPipeline: [],
    roleMatrix: new Map(),
  };
  const rows = buildCapabilityMatrix({ grants, agents, roster });
  assert(rows[0].driftFlags.includes('missing_in_roster'), 'missing_in_roster when agent not in executors or reviewPipeline');
}

{
  // Drift: missing_schema_output (schemaOutput is empty)
  const grants = { 'AgentX.agent.md': ['tool1'] };
  const agents = new Map([
    ['AgentX.agent.md', { modelRole: 'capable-implementer', tools: ['tool1'] }],
  ]);
  const roster = {
    executors: ['AgentX'],
    reviewPipeline: [],
    roleMatrix: new Map([['AgentX', { schemaOutput: '' }]]),
  };
  const rows = buildCapabilityMatrix({ grants, agents, roster });
  assert(rows[0].driftFlags.includes('missing_schema_output'), 'missing_schema_output when schemaOutput is empty string');
}

{
  // Drift: missing_in_grants (roster agent absent from grants — ghost row)
  const grants = { 'AgentA.agent.md': ['tool1'] };
  const agents = new Map([
    ['AgentA.agent.md', { modelRole: 'capable', tools: ['tool1'] }],
  ]);
  const roster = {
    executors: ['AgentA', 'AgentB'], // AgentB not in grants
    reviewPipeline: [],
    roleMatrix: new Map([
      ['AgentA', { schemaOutput: 'a.json' }],
      ['AgentB', { schemaOutput: 'b.json' }],
    ]),
  };
  const rows = buildCapabilityMatrix({ grants, agents, roster });
  const ghostRow = rows.find((r) => r.agent === 'AgentB.agent.md');
  assert(ghostRow !== undefined, 'creates ghost row for roster agent missing from grants');
  assert(ghostRow.driftFlags.includes('missing_in_grants'), 'ghost row has missing_in_grants drift flag');
  assert(ghostRow.toolGrantCount === 0, 'ghost row toolGrantCount is 0');
}

{
  // Meta keys (_comment, _format_note, _naming_policy) are filtered out
  const grants = {
    _comment: 'this is a comment',
    _format_note: 'format note',
    'RealAgent.agent.md': ['tool1'],
  };
  const agents = new Map([
    ['RealAgent.agent.md', { modelRole: 'capable', tools: ['tool1'] }],
  ]);
  const roster = {
    executors: ['RealAgent'],
    reviewPipeline: [],
    roleMatrix: new Map([['RealAgent', { schemaOutput: 'real.json' }]]),
  };
  const rows = buildCapabilityMatrix({ grants, agents, roster });
  assert(rows.length === 1, 'meta keys filtered: only 1 row for 1 real agent');
  assert(rows[0].agent === 'RealAgent.agent.md', 'row is for the real agent, not meta keys');
}

// ── renderMatrixMarkdown ──────────────────────────────────────────────────────

console.log('\n=== capability-matrix: renderMatrixMarkdown ===');

{
  const rows = [
    {
      agent: 'TestAgent.agent.md',
      role: 'executor',
      toolGrantCount: 5,
      frontmatterToolCount: 5,
      schemaOutput: 'test.schema.json',
      executionOrReviewStatus: 'executor',
      driftFlags: [],
    },
    {
      agent: 'AuditAgent.agent.md',
      role: 'reviewer',
      toolGrantCount: 3,
      frontmatterToolCount: 4,
      schemaOutput: '',
      executionOrReviewStatus: 'reviewer',
      driftFlags: ['tools_count_mismatch', 'missing_schema_output'],
    },
  ];

  const md = renderMatrixMarkdown(rows);
  assert(typeof md === 'string', 'renderMatrixMarkdown returns a string');
  assert(md.includes('| Agent |'), 'output contains header row');
  assert(md.includes('| --- |'), 'output contains separator row');
  assert(md.includes('TestAgent.agent.md'), 'output contains first agent');
  assert(md.includes('AuditAgent.agent.md'), 'output contains second agent');
  assert(md.includes('tools_count_mismatch'), 'output surfaces drift flags');
  assert(md.includes('missing_schema_output'), 'output surfaces missing_schema_output flag');
  assert(md.includes('—'), 'output uses — for no-drift row and empty schema output');
  assert(md.endsWith('\n'), 'output ends with newline');

  // Determinism: calling twice with same input produces identical output
  const md2 = renderMatrixMarkdown(rows);
  assert(md === md2, 'renderMatrixMarkdown is deterministic');
}

{
  // Empty rows produce only header + separator
  const md = renderMatrixMarkdown([]);
  assert(md.includes('| Agent |'), 'empty rows: header row present');
  assert(md.includes('| --- |'), 'empty rows: separator row present');
  assert(!md.includes('.agent.md'), 'empty rows: no agent rows rendered');
}

// ── Smoke test: live tree ─────────────────────────────────────────────────────

console.log('\n=== capability-matrix: live tree smoke test ===');

{
  const grantsPath = join(ROOT, 'governance', 'tool-grants.json');
  const projectContextPath = join(ROOT, 'plans', 'project-context.md');

  const grantsRaw = JSON.parse(readFileSync(grantsPath, 'utf8'));
  const projectContextContent = readFileSync(projectContextPath, 'utf8');

  const nonMetaKeys = Object.keys(grantsRaw).filter((k) => !k.startsWith('_'));

  // Build agents map from agent files on disk
  const agents = new Map();
  for (const agentFile of nonMetaKeys) {
    const agentPath = join(ROOT, agentFile);
    try {
      const content = readFileSync(agentPath, 'utf8');
      agents.set(agentFile, parseAgentFrontmatter(content));
    } catch {
      agents.set(agentFile, { modelRole: null, tools: [] });
    }
  }

  const roster = parseProjectContextRoster(projectContextContent);
  const rows = buildCapabilityMatrix({ grants: grantsRaw, agents, roster });

  // Each non-meta grants key produces exactly one row; in the live tree no
  // roster-only ghost rows are expected (all executor/reviewer agents are in grants).
  assert(
    rows.length === nonMetaKeys.length,
    `row count (${rows.length}) equals non-meta tool-grants keys count (${nonMetaKeys.length})`
  );

  // All rows have the required structural fields
  const allValid = rows.every(
    (r) =>
      typeof r.agent === 'string' &&
      typeof r.role === 'string' &&
      typeof r.toolGrantCount === 'number' &&
      typeof r.frontmatterToolCount === 'number' &&
      typeof r.schemaOutput === 'string' &&
      typeof r.executionOrReviewStatus === 'string' &&
      Array.isArray(r.driftFlags)
  );
  assert(allValid, 'all rows have required structural fields');

  // Each non-meta grants agent appears exactly once in the rows
  const rowAgents = new Set(rows.map((r) => r.agent));
  const allGrantsRepresented = nonMetaKeys.every((k) => rowAgents.has(k));
  assert(allGrantsRepresented, 'every non-meta grants key appears as a row agent');

  // Drift flags are surfaced (not asserted absent)
  const allFlags = rows.flatMap((r) => r.driftFlags);
  console.log(`  ℹ  drift flags surfaced in live tree: [${allFlags.join(', ') || 'none'}]`);

  // Rendered markdown covers every agent
  const md = renderMatrixMarkdown(rows);
  assert(md.includes('| Agent |'), 'live tree markdown includes table header');
  const allAgentsInMd = rows.every((r) => md.includes(r.agent));
  assert(allAgentsInMd, 'every agent appears in rendered live-tree markdown');
}

// ── Final summary ─────────────────────────────────────────────────────────────

console.log(`\n=== capability-matrix: summary ===`);
console.log(`Passed: ${passed}, Failed: ${failed}`);
if (failed > 0) {
  process.exit(1);
}
