import { extractSubsection, validateOrchestratorCompactionInvariant, validateOrchestratorMemoryPromotionOrder } from './drift-checks.mjs';
import { readFileSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const content = readFileSync(join(ROOT, 'Orchestrator.agent.md'), 'utf8');
console.log('File length:', content.length);
const slice = extractSubsection(content, 'Context Compaction Policy');
console.log('Slice length:', slice.length);
console.log('Slice preview:', JSON.stringify(slice.slice(0, 200)));
const r1 = validateOrchestratorCompactionInvariant(content);
console.log('CompactionInvariant:', JSON.stringify(r1));
const r2 = validateOrchestratorMemoryPromotionOrder(content);
console.log('MemoryPromotionOrder:', JSON.stringify(r2));
// Also test the headings around line 78
const lines = content.split('\n');
for (let i = 75; i < 90; i++) {
  console.log(`Line ${i}: ${JSON.stringify(lines[i])}`);
}
