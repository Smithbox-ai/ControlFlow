const fs = require('fs');
const t = fs.readFileSync('c:/MyProgram/Microsoft VS Code Insiders/f2b51f3f64/resources/app/extensions/copilot/dist/extension.js', 'utf8');

// Find the runSubagent tool's input schema definition
// Looking for 'inputSchema' or 'parameters' with 'model' near runSubagent
let s = 0;
while (true) {
  const i = t.indexOf('runSubagent', s);
  if (i < 0) break;
  const ctx = t.substring(i, i + 1200);
  if (ctx.includes('inputSchema') || ctx.includes('parameters') || ctx.indexOf('model') > 0 && ctx.indexOf('model') < 500) {
    console.log('pos=' + i + ':');
    console.log(ctx.substring(0, 700));
    console.log('---');
  }
  s = i + 1;
  if (s > t.length) break;
}

// Also look for the AgentTool definition that handles runSubagent invocations
const searches = [
  'AgentInvocationTool',
  'SubagentInvocationTool', 
  'ChatSubagentTool',
  'getSubagentModel',
  'resolveSubagentModel'
];
for (const search of searches) {
  const idx = t.indexOf(search);
  if (idx >= 0) {
    console.log('FOUND ' + search + ' at ' + idx);
    console.log(t.substring(Math.max(0, idx - 100), idx + 500));
    console.log('---');
  }
}
