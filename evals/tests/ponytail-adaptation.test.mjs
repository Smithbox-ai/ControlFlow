/**
 * ControlFlow - Ponytail-inspired simplicity adaptation tests.
 *
 * These checks lock in the useful parts of DietrichGebert/ponytail without
 * importing its persona or always-on hook model:
 *   - a minimum viable change ladder in core and portable guidance
 *   - over-engineering review hooks in plugin review/audit checklists
 *   - generated plugin parity for Codex, Claude Code, and Cursor
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

let passed = 0;
let failed = 0;

function check(label, ok) {
  if (ok) {
    console.log(`  PASS ${label}`);
    passed++;
  } else {
    console.error(`  FAIL ${label}`);
    failed++;
  }
}

function read(relPath) {
  return readFileSync(join(ROOT, relPath), 'utf8');
}

function includesAll(text, needles) {
  return needles.every((needle) => text.includes(needle));
}

console.log('\n=== ponytail-adaptation: core simplicity contract ===');
{
  const simplification = read('skills/patterns/code-simplification.md');
  const llmBehavior = read('skills/patterns/llm-behavior-guidelines.md');
  const index = read('skills/index.md');

  const ladderAnchors = [
    'Minimum Viable Change Ladder',
    'Does this need to exist',
    'standard library',
    'native platform',
    'already-installed dependency',
    'one localized line',
  ];

  check('core code-simplification skill has the minimum viable change ladder', includesAll(simplification, ladderAnchors));
  check('core LLM behavior guidelines point implementers at the ladder', includesAll(llmBehavior, [
    'Minimum Viable Change Ladder',
    'standard library',
    'native platform',
    'already-installed dependency',
  ]));
  check('skill index discoverability covers YAGNI and over-engineering terms', includesAll(index, [
    'yagni',
    'stdlib',
    'native',
    'overengineering',
  ]));
}

console.log('\n=== ponytail-adaptation: portable plugin contract ===');
{
  const guidelinePaths = [
    'plugins/controlflow-shared-source/skills/controlflow-planning/references/llm-behavior-guidelines.md',
    'plugins/controlflow-codex/skills/controlflow-planning/references/llm-behavior-guidelines.md',
    'plugins/controlflow-claude-code/skills/controlflow-planning/references/llm-behavior-guidelines.md',
    'plugins/controlflow-cursor/skills/controlflow-planning/references/llm-behavior-guidelines.md',
    '.cursor/skills/controlflow-planning/references/llm-behavior-guidelines.md',
  ];

  for (const relPath of guidelinePaths) {
    check(`${relPath} carries the portable ladder`, includesAll(read(relPath), [
      'Minimum Viable Change Ladder',
      'standard library',
      'native platform',
      'already-installed dependency',
    ]));
  }

  const reviewPaths = [
    'plugins/controlflow-shared-source/skills/controlflow-review/references/review-checklist.md',
    'plugins/controlflow-codex/skills/controlflow-review/references/review-checklist.md',
    'plugins/controlflow-claude-code/skills/controlflow-review/references/review-checklist.md',
    'plugins/controlflow-cursor/skills/controlflow-review/references/review-checklist.md',
    '.cursor/skills/controlflow-review/references/review-checklist.md',
  ];

  for (const relPath of reviewPaths) {
    check(`${relPath} reviews over-engineering as a maintainability signal`, includesAll(read(relPath), [
      'over-engineering',
      'delete, inline, or replace',
      'standard library or native platform',
    ]));
  }

  const auditPaths = [
    'plugins/controlflow-shared-source/skills/controlflow-plan-audit/references/audit-checklist.md',
    'plugins/controlflow-codex/skills/controlflow-plan-audit/references/audit-checklist.md',
    'plugins/controlflow-claude-code/skills/controlflow-plan-audit/references/audit-checklist.md',
    'plugins/controlflow-cursor/skills/controlflow-plan-audit/references/audit-checklist.md',
    '.cursor/skills/controlflow-plan-audit/references/audit-checklist.md',
  ];

  for (const relPath of auditPaths) {
    check(`${relPath} audits plan complexity before implementation`, includesAll(read(relPath), [
      'Minimum Viable Change Ladder',
      'new abstraction',
      'new dependency',
    ]));
  }
}

console.log('\n=== ponytail-adaptation: plugin generation hosts ===');
{
  const manifest = JSON.parse(read('plugins/controlflow-shared-source/generation-manifest.json'));
  const syncScript = read('plugins/controlflow-shared-source/scripts/sync-plugin-assets.ps1');
  const validateScript = read('plugins/controlflow-shared-source/scripts/validate-generated-assets.ps1');

  for (const target of manifest.targets) {
    const hosts = Object.keys(target.host_outputs ?? {});
    check(`${target.source_path} target includes codex host output`, hosts.includes('codex'));
    check(`${target.source_path} target includes claude_code host output`, hosts.includes('claude_code'));
    check(`${target.source_path} target includes cursor host output`, hosts.includes('cursor'));
  }

  check('sync script knows the cursor plugin root', syncScript.includes('plugins\\controlflow-cursor'));
  check('sync script accepts cursor as a target host', syncScript.includes('"cursor"'));
  check('validation wrapper accepts cursor as a target host', validateScript.includes('"cursor"'));
}

console.log(`\n=== ponytail-adaptation: ${passed} passed, ${failed} failed ===`);

if (failed > 0) {
  process.exit(1);
}
