/**
 * ControlFlow — Plugin Manifest Parity Tests (remediation Phase 6)
 *
 * Asserts every ControlFlow plugin ships a machine-readable manifest declaring a
 * `version` field, and that the Cursor manifest version matches its README version.
 *
 * Covers the three plugin distributions:
 *   - plugins/controlflow-claude-code/.claude-plugin/plugin.json
 *   - plugins/controlflow-cursor/.cursor-plugin/plugin.json
 *
 * Exit 0 on all checks passed, exit 1 on any failure.
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

const MANIFESTS = [
  { label: 'claude-code', path: join(ROOT, 'plugins', 'controlflow-claude-code', '.claude-plugin', 'plugin.json') },
  { label: 'cursor', path: join(ROOT, 'plugins', 'controlflow-cursor', '.cursor-plugin', 'plugin.json') },
];

let passed = 0;
let failed = 0;

function check(label, ok, detail = '') {
  if (ok) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.log(`  ❌ ${label}${detail ? ' — ' + detail : ''}`);
    failed++;
  }
}

console.log('\n=== Plugin Manifest Parity ===');

const versions = {};
const parsedManifests = {};

for (const m of MANIFESTS) {
  const exists = existsSync(m.path);
  check(`${m.label}: manifest exists at ${m.path.replace(ROOT + '\\', '').replace(ROOT + '/', '')}`, exists);

  let parsed = null;
  let parseOk = false;
  if (exists) {
    try {
      parsed = JSON.parse(readFileSync(m.path, 'utf8'));
      parseOk = true;
    } catch (e) {
      check(`${m.label}: manifest parses as JSON`, false, e.message);
      continue;
    }
  } else {
    continue;
  }
  check(`${m.label}: manifest parses as JSON`, parseOk);
  if (parseOk) parsedManifests[m.label] = parsed;

  const hasVersion = parseOk && typeof parsed.version === 'string' && parsed.version.trim().length > 0;
  check(`${m.label}: manifest declares a non-empty string \`version\``, hasVersion, hasVersion ? `version=${parsed.version}` : 'missing/invalid');
  if (hasVersion) versions[m.label] = parsed.version;

  const hasName = parseOk && typeof parsed.name === 'string' && parsed.name.trim().length > 0;
  check(`${m.label}: manifest declares a \`name\``, hasName);
}

// ─── Cursor manifest version must equal its README "Version:" line ──────────
{
  const cursorReadmePath = join(ROOT, 'plugins', 'controlflow-cursor', 'README.md');
  let readmeVersion = null;
  if (existsSync(cursorReadmePath)) {
    const text = readFileSync(cursorReadmePath, 'utf8');
    const m = text.match(/^\*\*Version:\*\*\s*([0-9]+\.[0-9]+\.[0-9]+)\s*$/m);
    if (m) readmeVersion = m[1];
  }
  const cursorManifestVersion = versions['cursor'];
  const match = !!(cursorManifestVersion && readmeVersion && cursorManifestVersion === readmeVersion);
  check(
    `cursor: manifest version matches README Version (manifest=${cursorManifestVersion ?? 'n/a'}, readme=${readmeVersion ?? 'n/a'})`,
    match
  );
}

// ─── Summary ─────────────────────────────────────────────────────────────────
const total = passed + failed;
const bar = '='.repeat(50);
console.log(`\n${bar}`);
console.log(`Plugin Manifest Parity: ${total} checks | ${passed} passed | ${failed} failed`);
console.log(bar);

if (failed > 0) {
  console.error(`\n${failed} plugin-manifest-parity check(s) failed.\n`);
  process.exit(1);
}
console.log('\nAll plugin-manifest-parity checks passed ✅\n');
