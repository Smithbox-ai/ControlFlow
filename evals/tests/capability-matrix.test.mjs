/**
 * Tests for evals/capability-matrix.mjs
 *
 * Covers:
 *   - parseAgentFrontmatter: positive and negative fixture cases
 *   - loadRosterFromRegistry: positive, negative, and live registry cases
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

import { readFileSync, writeFileSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import {
  parseAgentFrontmatter,
  loadRosterFromRegistry,
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

// ── loadRosterFromRegistry ────────────────────────────────────────────────────

console.log('\n=== capability-matrix: loadRosterFromRegistry ===');

{
  // Positive: minimal fixture with all three arrays — verifies snake_case → camelCase mapping
  const fixture = {
    phase_executor_agents: [
      { agent: 'AgentAlpha', role: 'Executor role', primary_use_case: 'Implementation', model_routing_role: 'fast' },
      { agent: 'AgentBeta', role: 'Another role', primary_use_case: 'Testing', model_routing_role: 'capable' },
    ],
    review_pipeline_agents: [
      { agent: 'AgentGamma', role: 'Review role', primary_use_case: 'Auditing', model_routing_role: 'reviewer' },
    ],
    agent_role_matrix: [
      { agent: 'AgentAlpha', schema_output: 'alpha.schema.json', tools_profile: 'Full (5 tools)', delegation_source: 'Orchestrator' },
      { agent: 'AgentBeta', schema_output: 'beta.schema.json', tools_profile: 'Partial (3 tools)', delegation_source: 'Orchestrator' },
      { agent: 'AgentGamma', schema_output: 'gamma.schema.json', tools_profile: 'Read-only (2 tools)', delegation_source: 'Orchestrator' },
    ],
  };
  const tmpPath = join(tmpdir(), `registry-fixture-${Date.now()}.json`);
  writeFileSync(tmpPath, JSON.stringify(fixture));
  try {
    const r = loadRosterFromRegistry(tmpPath);
    assert(r.executors.length === 2, 'registry: parses 2 executors from phase_executor_agents');
    assert(r.executors.includes('AgentAlpha'), 'registry: executors includes AgentAlpha');
    assert(r.executors.includes('AgentBeta'), 'registry: executors includes AgentBeta');
    assert(r.reviewPipeline.length === 1, 'registry: parses 1 review pipeline agent from review_pipeline_agents');
    assert(r.reviewPipeline.includes('AgentGamma'), 'registry: reviewPipeline includes AgentGamma');
    assert(r.roleMatrix.size === 3, 'registry: roleMatrix has 3 entries from agent_role_matrix');
    // Verify snake_case → camelCase field mapping
    const alpha = r.roleMatrix.get('AgentAlpha');
    assert(alpha !== undefined, 'registry: roleMatrix has entry for AgentAlpha');
    assert(alpha.schemaOutput === 'alpha.schema.json', 'registry: schema_output mapped to schemaOutput');
    assert(alpha.toolsProfile === 'Full (5 tools)', 'registry: tools_profile mapped to toolsProfile');
    assert(alpha.delegationSource === 'Orchestrator', 'registry: delegation_source mapped to delegationSource');
    const gamma = r.roleMatrix.get('AgentGamma');
    assert(gamma?.schemaOutput === 'gamma.schema.json', 'registry: reviewer roleMatrix entry has correct schemaOutput');
  } finally {
    unlinkSync(tmpPath);
  }
}

{
  // Negative: empty arrays produce empty roster
  const fixture = { phase_executor_agents: [], review_pipeline_agents: [], agent_role_matrix: [] };
  const tmpPath = join(tmpdir(), `registry-empty-${Date.now()}.json`);
  writeFileSync(tmpPath, JSON.stringify(fixture));
  try {
    const r = loadRosterFromRegistry(tmpPath);
    assert(r.executors.length === 0, 'registry: empty phase_executor_agents → empty executors');
    assert(r.reviewPipeline.length === 0, 'registry: empty review_pipeline_agents → empty reviewPipeline');
    assert(r.roleMatrix.size === 0, 'registry: empty agent_role_matrix → empty roleMatrix');
  } finally {
    unlinkSync(tmpPath);
  }
}

{
  // Live registry: loadRosterFromRegistry against actual governance/project-context-registry.json
  const registryPath = join(ROOT, 'governance', 'project-context-registry.json');
  const r = loadRosterFromRegistry(registryPath);
  assert(r.executors.length > 0, 'live registry: executors is non-empty');
  assert(r.reviewPipeline.length > 0, 'live registry: reviewPipeline is non-empty');
  assert(r.roleMatrix.size > 0, 'live registry: roleMatrix is non-empty');
  // Every executor entry should have a matching roleMatrix entry with a schemaOutput
  const missingSchema = r.executors.filter((a) => !r.roleMatrix.get(a)?.schemaOutput);
  assert(missingSchema.length === 0, `live registry: all executors have schemaOutput in roleMatrix (missing: ${missingSchema.join(', ') || 'none'})`);
  // Verify at least one known agent appears
  assert(r.executors.includes('CoreImplementer-subagent'), 'live registry: executors includes CoreImplementer-subagent');
  assert(r.reviewPipeline.includes('PlanAuditor-subagent'), 'live registry: reviewPipeline includes PlanAuditor-subagent');
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

// ── Read-only edit denylist guard ─────────────────────────────────────────────

console.log('\n=== capability-matrix: read-only edit denylist ===');

const readOnlyDenylistScenario = JSON.parse(
  readFileSync(join(ROOT, 'evals', 'scenarios', 'read-only-agent-tool-denylist.json'), 'utf8')
);
const readOnlyDenylistedAgents = readOnlyDenylistScenario.input?.no_edit_agents ?? [];

function editToolTokens(tools = []) {
  return tools.filter((tool) => /^edit(?:\/|$)/i.test(tool));
}

{
  const driftConsistentGrants = {
    'CodeReviewer-subagent.agent.md': ['search', 'edit/editFiles'],
  };
  const driftConsistentAgents = new Map([
    ['CodeReviewer-subagent.agent.md', { modelRole: 'capable-reviewer', tools: ['search', 'edit/editFiles'] }],
  ]);
  const roster = {
    executors: [],
    reviewPipeline: ['CodeReviewer-subagent'],
    roleMatrix: new Map([['CodeReviewer-subagent', { schemaOutput: 'schemas/code-reviewer.verdict.schema.json' }]]),
  };
  const rows = buildCapabilityMatrix({ grants: driftConsistentGrants, agents: driftConsistentAgents, roster });
  assert(
    rows[0].driftFlags.length === 0,
    'baseline matrix can look drift-clean when frontmatter and grants consistently add edit tools'
  );
  assert(
    editToolTokens(driftConsistentGrants['CodeReviewer-subagent.agent.md']).length === 1 &&
      editToolTokens(driftConsistentAgents.get('CodeReviewer-subagent.agent.md').tools).length === 1,
    'independent denylist detector catches edit tools even when manifest/frontmatter drift is consistent'
  );
}

{
  const expectedDenylist = [
    'PlanAuditor-subagent.agent.md',
    'AssumptionVerifier-subagent.agent.md',
    'ExecutabilityVerifier-subagent.agent.md',
    'CodeMapper-subagent.agent.md',
    'Researcher-subagent.agent.md',
    'CodeReviewer-subagent.agent.md',
  ];
  assert(
    expectedDenylist.every((agent) => readOnlyDenylistedAgents.includes(agent)) &&
      readOnlyDenylistedAgents.every((agent) => expectedDenylist.includes(agent)),
    'read-only denylist fixture includes every review, discovery, research, and verification-only agent'
  );
}

{
  const grantsPath = join(ROOT, 'governance', 'tool-grants.json');
  const grantsRaw = JSON.parse(readFileSync(grantsPath, 'utf8'));
  let liveViolations = 0;
  for (const agentFile of readOnlyDenylistedAgents) {
    const manifestTokens = editToolTokens(grantsRaw[agentFile] ?? []);
    const agentPath = join(ROOT, agentFile);
    const frontmatterTokens = editToolTokens(parseAgentFrontmatter(readFileSync(agentPath, 'utf8')).tools);
    liveViolations += manifestTokens.length + frontmatterTokens.length;
  }
  assert(liveViolations === 0, 'live read-only denylisted agents have no edit tools in grants or frontmatter');
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
  const registryPath = join(ROOT, 'governance', 'project-context-registry.json');

  const grantsRaw = JSON.parse(readFileSync(grantsPath, 'utf8'));

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

  const roster = loadRosterFromRegistry(registryPath);
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

// ── Source-scan guard: old markdown-table parser path removed from runtime ─────

console.log('\n=== capability-matrix: source-scan guard ===');

{
  const capabilityMatrixSrc = readFileSync(
    join(ROOT, 'evals', 'capability-matrix.mjs'),
    'utf8'
  );

  // Guard 1: the old CLI variable name must not appear in the source
  assert(
    !capabilityMatrixSrc.includes('projectContextPath'),
    'source-scan: "projectContextPath" variable is absent (old CLI path removed)'
  );

  // Guard 2: the obsolete markdown-table parser symbol must not appear in the runtime module
  assert(
    !capabilityMatrixSrc.includes('parseProjectContextRoster'),
    'source-scan: "parseProjectContextRoster" symbol is absent from runtime'
  );

  // Guard 3: the new registry loader must be present and used in the CLI section
  assert(
    capabilityMatrixSrc.includes('loadRosterFromRegistry'),
    'source-scan: "loadRosterFromRegistry" function is present in source'
  );

  // Guard 4: the registry path is referenced in the CLI section (not project-context.md)
  assert(
    capabilityMatrixSrc.includes('project-context-registry.json'),
    'source-scan: "project-context-registry.json" is referenced in source'
  );
}

// ── Final summary ─────────────────────────────────────────────────────────────

console.log(`\n=== capability-matrix: summary ===`);
console.log(`Passed: ${passed}, Failed: ${failed}`);
if (failed > 0) {
  process.exit(1);
}
