/**
 * Copilot Atlas — Structural Validation Harness
 *
 * Four passes:
 *   1. Schema Validity      — all schemas/*.schema.json compile without errors
 *   2. Scenario Integrity   — all evals/scenarios/*.json have required fields and
 *                             point to an existing agent.md
 *   3. Reference Integrity  — all *.agent.md schema/doc references resolve to
 *                             existing files; required project artifacts exist
 *   3b. Required Artifacts  — shared project context files exist
 *   3c. Tool Grant Consistency — every agent frontmatter tools list matches
 *                              the repo's least-privilege canonical set
 *   4. P.A.R.T Section Order — every *.agent.md has Prompt→Archive→Resources→Tools
 *                              in the correct order
 *
 * Exit 0 on all checks passed, exit 1 on any failure.
 */

import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SCHEMAS_DIR = join(ROOT, 'schemas');
const SCENARIOS_DIR = join(__dirname, 'scenarios');

let totalPassed = 0;
let totalFailed = 0;

function pass(msg) { console.log(`  \u2705 ${msg}`); totalPassed++; }
function fail(msg) { console.error(`  \u274c ${msg}`); totalFailed++; }
function header(title) { console.log(`\n=== ${title} ===`); }

const EXPECTED_AGENT_TOOLS = {
  'Atlas.agent.md': [
    'vscode/askQuestions',
    'execute/testFailure',
    'execute/getTerminalOutput',
    'execute/awaitTerminal',
    'execute/killTerminal',
    'execute/createAndRunTask',
    'execute/runInTerminal',
    'read/problems',
    'read/readFile',
    'agent',
    'edit/createFile',
    'edit/editFiles',
    'search/changes',
    'search/codebase',
    'search/fileSearch',
    'search/listDirectory',
    'search/textSearch',
    'search/usages',
    'web/fetch',
    'web/githubRepo',
    'todo',
  ],
  'Prometheus.agent.md': [
    'read/readFile',
    'agent/runSubagent',
    'edit/createFile',
    'search/codebase',
    'search/fileSearch',
    'search/listDirectory',
    'search/textSearch',
    'search/usages',
    'web/fetch',
    'web/githubRepo',
    'vscode/askQuestions',
    'vscode/getProjectSetupInfo',
    'io.github.upstash/context7/get-library-docs',
    'io.github.upstash/context7/resolve-library-id',
  ],
  'Oracle-subagent.agent.md': ['search', 'usages', 'problems', 'changes', 'fetch', 'agent'],
  'Scout-subagent.agent.md': ['search', 'usages', 'problems', 'changes', 'testFailure'],
  'Sisyphus-subagent.agent.md': ['edit', 'search', 'runCommands', 'runTasks', 'usages', 'problems', 'changes', 'testFailure', 'fetch', 'githubRepo', 'agent'],
  'Frontend-Engineer-subagent.agent.md': ['edit', 'search', 'runCommands', 'runTasks', 'usages', 'problems', 'changes', 'testFailure', 'fetch', 'githubRepo'],
  'DevOps-subagent.agent.md': ['edit', 'search', 'runCommands', 'runTasks', 'usages', 'problems', 'changes', 'testFailure', 'fetch', 'githubRepo'],
  'DocWriter-subagent.agent.md': ['search', 'usages', 'problems', 'changes', 'edit', 'fetch'],
  'BrowserTester-subagent.agent.md': ['search', 'usages', 'problems', 'changes', 'edit', 'fetch'],
  'Code-Review-subagent.agent.md': ['search', 'usages', 'problems', 'changes', 'runCommands', 'runTasks'],
  'Challenger-subagent.agent.md': ['read/readFile', 'read/problems', 'search/codebase', 'search/fileSearch', 'search/textSearch', 'search/listDirectory', 'search/usages'],
};

function parseFrontmatterTools(content) {
  const match = content.match(/^tools:\s*\[(.*?)\]$/m);
  if (!match) return null;

  return match[1]
    .split(',')
    .map(entry => entry.trim())
    .filter(Boolean)
    .map(entry => entry.replace(/^['"]|['"]$/g, ''));
}

function normalizeToolSet(tools) {
  return [...tools].sort();
}

// ─── Pass 1: Schema Validity ─────────────────────────────────────────────────
header('Pass 1: Schema Validity');

const ajv = new Ajv2020({ strict: false, allErrors: true });
addFormats(ajv);

const schemaFiles = readdirSync(SCHEMAS_DIR).filter(f => f.endsWith('.schema.json'));

// Pre-load all schemas so relative $ref resolution works across schema files
const parsedSchemas = {};
for (const file of schemaFiles) {
  try {
    parsedSchemas[file] = JSON.parse(readFileSync(join(SCHEMAS_DIR, file), 'utf8'));
    ajv.addSchema(parsedSchemas[file]);
  } catch (e) {
    fail(`Schema JSON parse error: ${file} \u2014 ${e.message}`);
  }
}

// Now compile each schema (all $refs are resolvable via pre-loaded index)
for (const file of schemaFiles) {
  if (!parsedSchemas[file]) continue;
  try {
    ajv.compile(parsedSchemas[file]);
    pass(`Schema compiles: ${file}`);
  } catch (e) {
    fail(`Schema invalid: ${file} — ${e.message}`);
  }
}

// ─── Pass 2: Scenario Integrity ──────────────────────────────────────────────
header('Pass 2: Scenario Integrity');

const scenarioFiles = readdirSync(SCENARIOS_DIR).filter(f => f.endsWith('.json'));
for (const file of scenarioFiles) {
  let scenario;
  try {
    scenario = JSON.parse(readFileSync(join(SCENARIOS_DIR, file), 'utf8'));
  } catch (e) {
    fail(`${file}: JSON parse error — ${e.message}`);
    continue;
  }

  // Support both field conventions:
  //   legacy:  id / target_agent / goal
  //   newer:   scenario_id / agent / description
  const id = scenario.id || scenario.scenario_id;
  const targetAgent = scenario.target_agent || scenario.agent;
  const goal = scenario.goal || scenario.description;

  if (!id || !targetAgent || !goal) {
    const missing = [
      !id          && 'id / scenario_id',
      !targetAgent && 'target_agent / agent',
      !goal        && 'goal / description',
    ].filter(Boolean);
    fail(`${file}: missing required fields: ${missing.join(', ')}`);
    continue;
  }

  const agentFile = join(ROOT, `${targetAgent}.agent.md`);
  if (!existsSync(agentFile)) {
    fail(`${file}: target_agent "${targetAgent}" → no matching agent.md`);
  } else {
    pass(`Scenario valid: ${file} → ${targetAgent}`);
  }
}

// ─── Pass 3: Reference Integrity ─────────────────────────────────────────────
header('Pass 3: Reference Integrity');

const agentFiles = readdirSync(ROOT).filter(f => f.endsWith('.agent.md'));
for (const agentFile of agentFiles) {
  const content = readFileSync(join(ROOT, agentFile), 'utf8');
  let agentFailed = false;

  // Schema references: `schemas/some-file.schema.json`
  for (const [, ref] of content.matchAll(/`schemas\/([^`]+)`/g)) {
    if (!existsSync(join(SCHEMAS_DIR, ref))) {
      fail(`${agentFile}: broken schema ref → schemas/${ref}`);
      agentFailed = true;
    }
  }

  // Docs references: `docs/path/to/file.md`
  for (const [, ref] of content.matchAll(/`(docs\/[^`]+\.md)`/g)) {
    if (!existsSync(join(ROOT, ref))) {
      fail(`${agentFile}: broken doc ref → ${ref}`);
      agentFailed = true;
    }
  }

  if (!agentFailed) pass(`References clean: ${agentFile}`);
}

// ─── Pass 3b: Required Project Artifacts ─────────────────────────────────────
header('Pass 3b: Required Project Artifacts');

const requiredArtifacts = [
  '.github/copilot-instructions.md',
  'plans/project-context.md',
  'docs/agent-engineering/PART-SPEC.md',
  'docs/agent-engineering/RELIABILITY-GATES.md',
  'docs/agent-engineering/CLARIFICATION-POLICY.md',
  'docs/agent-engineering/TOOL-ROUTING.md',
];
for (const artifact of requiredArtifacts) {
  if (existsSync(join(ROOT, artifact))) {
    pass(`Artifact exists: ${artifact}`);
  } else {
    fail(`Missing required artifact: ${artifact}`);
  }
}

// ─── Pass 3c: Tool Grant Consistency ────────────────────────────────────────
header('Pass 3c: Tool Grant Consistency');

for (const agentFile of agentFiles) {
  const content = readFileSync(join(ROOT, agentFile), 'utf8');
  const actualTools = parseFrontmatterTools(content);
  const expectedTools = EXPECTED_AGENT_TOOLS[agentFile];

  if (!expectedTools) {
    fail(`${agentFile}: missing canonical tool-set entry in validator`);
    continue;
  }

  if (!actualTools) {
    fail(`${agentFile}: missing tools frontmatter`);
    continue;
  }

  const actual = normalizeToolSet(actualTools);
  const expected = normalizeToolSet(expectedTools);
  const matches = actual.length === expected.length && actual.every((tool, index) => tool === expected[index]);

  if (!matches) {
    fail(`${agentFile}: tool-set drift detected — expected [${expected.join(', ')}], got [${actual.join(', ')}]`);
  } else {
    pass(`Tool grants canonical: ${agentFile}`);
  }
}

// ─── Pass 4: P.A.R.T Section Order ───────────────────────────────────────────
header('Pass 4: P.A.R.T Section Order');

const PART_SECTIONS = ['## Prompt', '## Archive', '## Resources', '## Tools'];
for (const agentFile of agentFiles) {
  const lines = readFileSync(join(ROOT, agentFile), 'utf8').split('\n');
  const positions = PART_SECTIONS.map(s => lines.findIndex(l => l.trim() === s));

  const missing = PART_SECTIONS.filter((_, i) => positions[i] === -1);
  if (missing.length > 0) {
    fail(`${agentFile}: missing P.A.R.T sections: ${missing.join(', ')}`);
    continue;
  }

  const inOrder = positions.every((p, i) => i === 0 || p > positions[i - 1]);
  if (!inOrder) {
    fail(`${agentFile}: P.A.R.T out of order — found at lines [${positions.map(p => p + 1).join(', ')}]`);
  } else {
    pass(`P.A.R.T order: ${agentFile}`);
  }
}

// ─── Summary ──────────────────────────────────────────────────────────────────
const totalChecks = totalPassed + totalFailed;
const bar = '\u2550'.repeat(50);
console.log(`\n${bar}`);
console.log(`Total: ${totalChecks}  |  Passed: ${totalPassed}  |  Failed: ${totalFailed}`);
console.log(bar);

if (totalFailed > 0) {
  console.error(`\n${totalFailed} check(s) failed.\n`);
  process.exit(1);
} else {
  console.log('\nAll checks passed \u2705\n');
}
