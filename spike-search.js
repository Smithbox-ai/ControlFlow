const fs = require('fs');
const t = fs.readFileSync('c:/MyProgram/Microsoft VS Code Insiders/f2b51f3f64/resources/app/extensions/copilot/dist/extension.js', 'utf8');

// Find the runSubagent tool definition - where it extracts arguments from the LLM call
// First find the debug handler that reads 'description' from runSubagent args
const search1 = 'runSubagent: ';
const idx1 = t.indexOf(search1);
if (idx1 >= 0) {
  console.log('=== runSubagent label context at ' + idx1 + ' ===');
  console.log(t.substring(Math.max(0, idx1 - 300), idx1 + 600));
  console.log('');
}

// Now find the main runSubagent tool execution handler
// Look for where it processes input args and potentially extracts model
const patterns = [
  'invoke_subagent',
  'invokeSubagent', 
  'SubAgentInvocationRequest',
  'subAgentRequest',
  'modelOverride',
  'model_override',
  '.model,',
  'request.model'
];
for (const p of patterns) {
  const idx = t.indexOf(p);
  if (idx >= 0) {
    console.log('=== Found "' + p + '" at ' + idx + ' ===');
    console.log(t.substring(Math.max(0, idx - 100), idx + 300));
    console.log('');
  }
}
