/**
 * ControlFlow — Drift Detection Helpers (Phase 9)
 *
 * Pure functions used by both evals/validate.mjs (Passes 8–11) and
 * evals/tests/drift-detection.test.mjs (negative-path coverage).
 *
 * Non-duplication rationale:
 *   Existing drift coverage is inventoried in
 *   plans/artifacts/controlflow-revision/phase-1-existing-drift-checks.yaml.
 *   This module adds only the checks marked `missing_checks_target_phase_9`;
 *   Check #1 `model_role` validation is active and also covers model-routing
 *   outer-dispatch contract fixtures.
 */

import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';

// Module-level path constants used by computeStructuralFingerprint
const __cfFilename = fileURLToPath(import.meta.url);
const __cfDir = dirname(__cfFilename);
const CF_REPO_ROOT = resolve(__cfDir, '..');
const CF_SCHEMAS_DIR = join(CF_REPO_ROOT, 'schemas');
const CF_SCENARIOS_DIR = join(__cfDir, 'scenarios');
const CF_CURSOR_RULES_DIR = join(CF_REPO_ROOT, '.cursor', 'rules');

// ── Check #1: model_role validation ───────────────────────────────────────────
// Enabled after Phase 2 spike confirmed VS Code tolerates model_role: frontmatter.
export const MODEL_ROLE_CHECK_ENABLED = true;

function extractFrontmatterScope(agentContent) {
  const fmMatch = agentContent.match(/^---\r?\n([\s\S]*?)\r?\n---\s*$/m);
  return fmMatch ? fmMatch[1] : '';
}

function parseFrontmatterScalar(scope, key) {
  const match = scope.match(new RegExp(`^${key}:\\s*(.+?)\\s*$`, 'm'));
  return match ? match[1].trim() : null;
}

/**
 * Validate that an agent's frontmatter declares a valid model_role.
 * Scoped to the first YAML frontmatter block (delimited by `---`) only;
 * matches in the markdown body are ignored.
 * @param {string} agentFrontmatter - Full agent file content (includes frontmatter)
 * @param {object} routingJson - Parsed governance/model-routing.json
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validateModelRole(agentFrontmatter, routingJson) {
  const errors = [];
  // Extract the first frontmatter block: must start with `---` on the first
  // non-empty line and end at the next `---` line. If no block, treat as missing.
  const scope = extractFrontmatterScope(agentFrontmatter);
  const role = parseFrontmatterScalar(scope, 'model_role');
  if (!role) {
    errors.push('model_role key missing from frontmatter');
    return { ok: false, errors };
  }
  const validRoles = Object.keys(routingJson.roles || {});
  if (!validRoles.includes(role)) {
    errors.push(`model_role value "${role}" is not a key in governance/model-routing.json roles (valid: ${validRoles.join(', ')})`);
    return { ok: false, errors };
  }
  return { ok: true, errors };
}

/**
 * Validate direct-invocation frontmatter defaults against governance role primary.
 * Pinned agents (listed in routingJson.pinned_agents) MUST declare a frontmatter
 * `model:` equal to the role top-level primary. Non-pinned (auto) agents MUST omit
 * `model:` entirely so Copilot's picker selects the model at dispatch time.
 * This intentionally does not compare against tier-specific by_tier overrides;
 * those are used only when internal dispatch passes the outer tool-call model.
 * @param {string} agentFileName - Agent filename for diagnostics.
 * @param {string} agentFrontmatter - Full agent file content.
 * @param {object} routingJson - Parsed governance/model-routing.json.
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validateFrontmatterModelDefaults(agentFileName, agentFrontmatter, routingJson) {
  const errors = [];
  const scope = extractFrontmatterScope(agentFrontmatter);
  const model = parseFrontmatterScalar(scope, 'model');
  const role = parseFrontmatterScalar(scope, 'model_role');

  if (!role) {
    errors.push(`${agentFileName}: model_role key missing from frontmatter`);
    return { ok: false, errors };
  }

  const roleConfig = routingJson?.roles?.[role];
  if (!roleConfig) {
    const validRoles = Object.keys(routingJson?.roles || {});
    errors.push(`${agentFileName}: model_role value "${role}" is not a key in governance/model-routing.json roles (valid: ${validRoles.join(', ')})`);
    return { ok: false, errors };
  }

  const pinnedAgents = Array.isArray(routingJson?.pinned_agents) ? routingJson.pinned_agents : [];
  const isPinned = pinnedAgents.includes(agentFileName);

  if (isPinned) {
    if (!model) {
      errors.push(`${agentFileName}: model key missing from frontmatter`);
    }
    const defaultPrimary = roleConfig.primary;
    if (typeof defaultPrimary !== 'string' || defaultPrimary.length === 0) {
      errors.push(`${agentFileName}: role "${role}" is missing a top-level primary model`);
    } else if (model && model !== defaultPrimary) {
      errors.push(`${agentFileName}: frontmatter model "${model}" must match role "${role}" top-level primary "${defaultPrimary}" for direct invocation fallback; tier-specific by_tier overrides are only for internal dispatch`);
    }
  } else if (model) {
    errors.push(`${agentFileName}: model key present on non-pinned (auto) agent '${agentFileName}'; auto agents must omit 'model:' so Copilot's picker selects the model`);
  }

  return { ok: errors.length === 0, errors };
}

function resolveLocalSchemaRef(schemaRoot, schemaNode, visitedRefs = new Set()) {
  if (!schemaNode || typeof schemaNode !== 'object' || Array.isArray(schemaNode) || typeof schemaNode.$ref !== 'string') {
    return schemaNode;
  }

  const ref = schemaNode.$ref;
  if (!ref.startsWith('#/') || visitedRefs.has(ref)) {
    return schemaNode;
  }

  const resolvedNode = ref
    .slice(2)
    .split('/')
    .reduce((current, key) => current?.[key.replace(/~1/g, '/').replace(/~0/g, '~')], schemaRoot);

  if (!resolvedNode || typeof resolvedNode !== 'object' || Array.isArray(resolvedNode)) {
    return schemaNode;
  }

  return resolveLocalSchemaRef(schemaRoot, resolvedNode, new Set([...visitedRefs, ref]));
}

/**
 * Validate payload-level model description semantics in the Orchestrator
 * delegation protocol schema.
 * @param {object} delegationProtocolSchema - Parsed orchestrator delegation schema.
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validatePayloadModelDescriptionSemantics(delegationProtocolSchema) {
  const errors = [];
  const agentSchemas = delegationProtocolSchema?.properties?.agents?.properties;
  if (!agentSchemas || typeof agentSchemas !== 'object' || Array.isArray(agentSchemas)) {
    return { ok: false, errors: ['orchestrator delegation schema missing properties.agents.properties object'] };
  }

  for (const [agentName, agentSchema] of Object.entries(agentSchemas)) {
    const required = agentSchema?.required;
    const modelSchema = resolveLocalSchemaRef(delegationProtocolSchema, agentSchema?.properties?.model);
    const runtimeModeSchema = resolveLocalSchemaRef(delegationProtocolSchema, agentSchema?.properties?.runtime_model_mode);
    const hasConditionalRequirement = Array.isArray(agentSchema?.allOf) && agentSchema.allOf.some(block => {
      const elseRequired = resolveLocalSchemaRef(delegationProtocolSchema, block)?.else?.required;
      return Array.isArray(elseRequired) && elseRequired.includes('model');
    });

    if (!Array.isArray(required)) {
      errors.push(`${agentName}: required array missing`);
    }
    if (!hasConditionalRequirement) {
      errors.push(`${agentName}: payload-level model must be conditionally required via runtime_model_mode contract`);
    }
    if (!runtimeModeSchema || typeof runtimeModeSchema !== 'object') {
      errors.push(`${agentName}: runtime_model_mode property missing`);
    } else {
      const runtimeEnum = runtimeModeSchema.enum;
      if (!Array.isArray(runtimeEnum) || !runtimeEnum.includes('deterministic') || !runtimeEnum.includes('auto')) {
        errors.push(`${agentName}: runtime_model_mode enum must include deterministic and auto`);
      }
    }
    if (!modelSchema || typeof modelSchema !== 'object') {
      errors.push(`${agentName}: payload-level model property missing`);
      continue;
    }

    const description = String(modelSchema.description || '');
    const lower = description.toLowerCase();
    if (!lower.includes('payload-level')) {
      errors.push(`${agentName}: payload model description must include "payload-level"`);
    }
    if (!lower.includes('delegation contract') || !lower.includes('audit context')) {
      errors.push(`${agentName}: payload model description must frame the field as delegation contract and audit context`);
    }
    if (!lower.includes('outer tool-call model')) {
      errors.push(`${agentName}: payload model description must name the outer tool-call model as the runtime enforcement boundary`);
    }
    if (!lower.includes('does not by itself override frontmatter')) {
      errors.push(`${agentName}: payload model description must state it does not by itself override frontmatter`);
    }
    if (!lower.includes('deterministic mode requires')) {
      errors.push(`${agentName}: payload model description must state deterministic mode requires this field`);
    }
    if (!lower.includes('auto mode may omit')) {
      errors.push(`${agentName}: payload model description must state auto mode may omit this field`);
    }
    if (/sets this when dispatching to override/i.test(description)) {
      errors.push(`${agentName}: payload model description still implies Orchestrator overrides frontmatter through the nested payload field`);
    }
  }

  return { ok: errors.length === 0, errors };
}

export const REQUIRED_MODEL_RESOLUTION_NEGATIVE_CASES = Object.freeze([
  'missing-outer-agentName',
  'missing-outer-model',
  'payload-only-model',
  'auto-mode-missing-outer-model-allowed',
  'wrong-effective-review-tier',
  'unconfigured-fallback',
  'omitted-model-due-missing-tier-context',
]);

function requireRejectedNegativeCase(caseId, negativeCase, errors) {
  const expected = negativeCase?.expected ?? {};
  if (expected.rejected !== true) {
    errors.push(`${caseId}: expected.rejected must be true`);
  }
  if (expected.offline_detection_scope !== 'structural_contract') {
    errors.push(`${caseId}: expected.offline_detection_scope must be "structural_contract"`);
  }
  if (expected.live_runtime_assertion !== false) {
    errors.push(`${caseId}: expected.live_runtime_assertion must be false`);
  }
}

/**
 * Validate that the orchestrator model-resolution scenario documents the
 * negative cases needed to guard the outer agent/runSubagent boundary.
 * These checks remain structural: they prove fixture and prompt contract shape,
 * not live runtime model selection.
 * @param {object} scenario - Parsed evals/scenarios/orchestrator-model-resolution.json.
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validateModelResolutionScenarioNegatives(scenario) {
  const errors = [];
  const dispatchContract = scenario?.input?.dispatch_contract ?? {};
  if (dispatchContract.outer_agentName_field !== 'agentName') {
    errors.push('dispatch_contract.outer_agentName_field must be "agentName"');
  }
  if (dispatchContract.outer_model_field !== 'model') {
    errors.push('dispatch_contract.outer_model_field must be "model"');
  }
  if (dispatchContract.payload_model_field !== 'model') {
    errors.push('dispatch_contract.payload_model_field must be "model"');
  }
  if (dispatchContract.payload_runtime_model_mode_field !== 'runtime_model_mode') {
    errors.push('dispatch_contract.payload_runtime_model_mode_field must be "runtime_model_mode"');
  }
  if (dispatchContract.payload_model_is_runtime_enforcement_boundary !== false) {
    errors.push('dispatch_contract.payload_model_is_runtime_enforcement_boundary must be false');
  }

  const negativeCases = scenario?.input?.negative_cases;
  if (!Array.isArray(negativeCases)) {
    errors.push('input.negative_cases must be an array');
    return { ok: false, errors };
  }

  if (scenario?.expected?.negative_cases_documented !== REQUIRED_MODEL_RESOLUTION_NEGATIVE_CASES.length) {
    errors.push(`expected.negative_cases_documented must be ${REQUIRED_MODEL_RESOLUTION_NEGATIVE_CASES.length}`);
  }

  const byId = new Map();
  for (const negativeCase of negativeCases) {
    if (typeof negativeCase?.case_id !== 'string' || negativeCase.case_id.length === 0) {
      errors.push('negative case missing non-empty case_id');
      continue;
    }
    if (byId.has(negativeCase.case_id)) {
      errors.push(`duplicate negative case_id "${negativeCase.case_id}"`);
    }
    byId.set(negativeCase.case_id, negativeCase);
  }

  for (const caseId of REQUIRED_MODEL_RESOLUTION_NEGATIVE_CASES) {
    const negativeCase = byId.get(caseId);
    if (!negativeCase) {
      errors.push(`missing required model-resolution negative case "${caseId}"`);
      continue;
    }
    if (caseId !== 'auto-mode-missing-outer-model-allowed') {
      requireRejectedNegativeCase(caseId, negativeCase, errors);
    }
  }

  const missingOuterAgentName = byId.get('missing-outer-agentName');
  if (missingOuterAgentName) {
    if (missingOuterAgentName?.broken_dispatch?.outer_fields?.agentName_present !== false) {
      errors.push('missing-outer-agentName: outer agentName must be absent');
    }
    if (missingOuterAgentName?.broken_dispatch?.payload_fields?.agentName_present !== true) {
      errors.push('missing-outer-agentName: payload agentName must be present to prove it cannot substitute for the outer field');
    }
    if (missingOuterAgentName?.expected?.violates !== 'missing_outer_agentName') {
      errors.push('missing-outer-agentName: expected.violates must be "missing_outer_agentName"');
    }
  }

  const missingOuterModel = byId.get('missing-outer-model');
  if (missingOuterModel) {
    if (missingOuterModel?.input_context?.runtime_model_mode !== 'deterministic') {
      errors.push('missing-outer-model: input runtime_model_mode must be deterministic');
    }
    if (missingOuterModel?.broken_dispatch?.outer_fields?.agentName_present !== true) {
      errors.push('missing-outer-model: outer agentName must be present so the failure is isolated to model');
    }
    if (missingOuterModel?.broken_dispatch?.outer_fields?.model_present !== false) {
      errors.push('missing-outer-model: outer model must be absent');
    }
    if (missingOuterModel?.expected?.violates !== 'missing_outer_model') {
      errors.push('missing-outer-model: expected.violates must be "missing_outer_model"');
    }
  }

  const payloadOnlyModel = byId.get('payload-only-model');
  if (payloadOnlyModel) {
    if (payloadOnlyModel?.input_context?.runtime_model_mode !== 'deterministic') {
      errors.push('payload-only-model: input runtime_model_mode must be deterministic');
    }
    if (payloadOnlyModel?.broken_dispatch?.outer_fields?.model_present !== false) {
      errors.push('payload-only-model: outer model must be absent');
    }
    if (payloadOnlyModel?.broken_dispatch?.payload_fields?.model_present !== true) {
      errors.push('payload-only-model: payload model must be present to prove payload-only is insufficient');
    }
    if (payloadOnlyModel?.expected?.violates !== 'payload_only_model') {
      errors.push('payload-only-model: expected.violates must be "payload_only_model"');
    }
  }

  const autoModeOuterModelOmitted = byId.get('auto-mode-missing-outer-model-allowed');
  if (autoModeOuterModelOmitted) {
    if (autoModeOuterModelOmitted?.input_context?.runtime_model_mode !== 'auto') {
      errors.push('auto-mode-missing-outer-model-allowed: input runtime_model_mode must be auto');
    }
    if (autoModeOuterModelOmitted?.broken_dispatch?.outer_fields?.model_present !== false) {
      errors.push('auto-mode-missing-outer-model-allowed: outer model must be absent');
    }
    if (autoModeOuterModelOmitted?.expected?.rejected !== false) {
      errors.push('auto-mode-missing-outer-model-allowed: expected.rejected must be false');
    }
    if (autoModeOuterModelOmitted?.expected?.resolution_mode !== 'platform_auto') {
      errors.push('auto-mode-missing-outer-model-allowed: expected.resolution_mode must be "platform_auto"');
    }
    if (autoModeOuterModelOmitted?.expected?.runtime_model_mode_marker_required !== true) {
      errors.push('auto-mode-missing-outer-model-allowed: expected.runtime_model_mode_marker_required must be true');
    }
  }

  const wrongEffectiveReviewTier = byId.get('wrong-effective-review-tier');
  if (wrongEffectiveReviewTier) {
    if (wrongEffectiveReviewTier?.input_context?.plan_complexity_tier !== 'MEDIUM') {
      errors.push('wrong-effective-review-tier: input plan tier must be MEDIUM');
    }
    if (wrongEffectiveReviewTier?.input_context?.unresolved_high_risk !== true) {
      errors.push('wrong-effective-review-tier: unresolved_high_risk must be true');
    }
    if (wrongEffectiveReviewTier?.broken_resolution?.effective_review_tier !== 'MEDIUM') {
      errors.push('wrong-effective-review-tier: broken effective tier must be MEDIUM');
    }
    if (wrongEffectiveReviewTier?.expected?.effective_review_tier !== 'LARGE') {
      errors.push('wrong-effective-review-tier: expected effective tier must be LARGE');
    }
    if (typeof wrongEffectiveReviewTier?.expected?.resolved_primary_model !== 'string' || wrongEffectiveReviewTier.expected.resolved_primary_model.length === 0) {
      errors.push('wrong-effective-review-tier: expected resolved_primary_model must be a non-empty string');
    }
    if (wrongEffectiveReviewTier?.expected?.violates !== 'wrong_effective_review_tier') {
      errors.push('wrong-effective-review-tier: expected.violates must be "wrong_effective_review_tier"');
    }
  }

  const unconfiguredFallback = byId.get('unconfigured-fallback');
  if (unconfiguredFallback) {
    const configuredFallbacks = unconfiguredFallback?.broken_retry?.configured_fallbacks;
    const brokenRetryModel = unconfiguredFallback?.broken_retry?.model;
    if (unconfiguredFallback?.input_context?.effective_review_tier !== 'MEDIUM') {
      errors.push('unconfigured-fallback: effective review tier must be MEDIUM');
    }
    if (!Array.isArray(configuredFallbacks) || configuredFallbacks.length === 0) {
      errors.push('unconfigured-fallback: broken_retry.configured_fallbacks must be a non-empty array');
    } else if (configuredFallbacks.includes(brokenRetryModel)) {
      errors.push('unconfigured-fallback: broken retry model must not be in configured_fallbacks');
    }
    if (unconfiguredFallback?.expected?.configured_fallbacks_only !== true) {
      errors.push('unconfigured-fallback: expected.configured_fallbacks_only must be true');
    }
    if (unconfiguredFallback?.expected?.violates !== 'unconfigured_fallback') {
      errors.push('unconfigured-fallback: expected.violates must be "unconfigured_fallback"');
    }
  }

  const omittedDueMissingTier = byId.get('omitted-model-due-missing-tier-context');
  if (omittedDueMissingTier) {
    if (omittedDueMissingTier?.input_context?.runtime_model_mode !== 'deterministic') {
      errors.push('omitted-model-due-missing-tier-context: input runtime_model_mode must be deterministic');
    }
    if (omittedDueMissingTier?.input_context?.complexity_tier_present !== false) {
      errors.push('omitted-model-due-missing-tier-context: complexity_tier_present must be false');
    }
    if (omittedDueMissingTier?.broken_dispatch?.outer_fields?.model_present !== false) {
      errors.push('omitted-model-due-missing-tier-context: outer model must be absent in the broken dispatch');
    }
    if (omittedDueMissingTier?.expected?.resolution_when_tier_missing !== 'top_level_primary') {
      errors.push('omitted-model-due-missing-tier-context: expected resolution_when_tier_missing must be "top_level_primary"');
    }
    if (typeof omittedDueMissingTier?.expected?.resolved_primary_model !== 'string' || omittedDueMissingTier.expected.resolved_primary_model.length === 0) {
      errors.push('omitted-model-due-missing-tier-context: expected resolved_primary_model must be a non-empty string');
    }
    if (omittedDueMissingTier?.expected?.violates !== 'omitted_model_missing_tier_context') {
      errors.push('omitted-model-due-missing-tier-context: expected.violates must be "omitted_model_missing_tier_context"');
    }
  }

  return { ok: errors.length === 0, errors };
}

function consumerToAgentStem(consumer) {
  return consumer.endsWith('.agent.md')
    ? consumer.slice(0, -'.agent.md'.length)
    : consumer;
}

/**
 * Validate that governance/model-routing.json keeps agent_role_index in
 * bidirectional sync with roles[*].consumers.
 * @param {object} routingJson - Parsed governance/model-routing.json
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validateAgentRoleIndex(routingJson) {
  const errors = [];
  const roles = routingJson?.roles;
  const agentRoleIndex = routingJson?.agent_role_index;

  if (!roles || typeof roles !== 'object' || Array.isArray(roles)) {
    errors.push('roles key missing or not an object');
    return { ok: false, errors };
  }

  if (!agentRoleIndex || typeof agentRoleIndex !== 'object' || Array.isArray(agentRoleIndex)) {
    errors.push('agent_role_index key missing or not an object');
    return { ok: false, errors };
  }

  const consumersByAgent = new Map();

  for (const [roleName, role] of Object.entries(roles)) {
    const consumers = role?.consumers;
    if (!Array.isArray(consumers)) {
      errors.push(`role "${roleName}": consumers must be an array`);
      continue;
    }

    for (const consumer of consumers) {
      if (typeof consumer !== 'string' || consumer.length === 0) {
        errors.push(`role "${roleName}": consumers must contain non-empty strings`);
        continue;
      }
      if (!consumer.endsWith('.agent.md')) {
        errors.push(`role "${roleName}": consumer "${consumer}" must end with ".agent.md"`);
        continue;
      }

      const agentStem = consumerToAgentStem(consumer);
      const priorRole = consumersByAgent.get(agentStem);
      if (priorRole && priorRole !== roleName) {
        errors.push(`agent "${agentStem}" appears in consumers for both "${priorRole}" and "${roleName}"`);
        continue;
      }
      consumersByAgent.set(agentStem, roleName);
    }
  }

  for (const [agentStem, roleName] of Object.entries(agentRoleIndex)) {
    if (!Object.hasOwn(roles, roleName)) {
      errors.push(`agent_role_index maps "${agentStem}" to unknown role "${roleName}"`);
      continue;
    }

    const consumerFile = `${agentStem}.agent.md`;
    const consumers = Array.isArray(roles[roleName]?.consumers) ? roles[roleName].consumers : [];
    if (!consumers.includes(consumerFile)) {
      errors.push(`agent_role_index maps "${agentStem}" to role "${roleName}" but roles["${roleName}"].consumers does not include "${consumerFile}"`);
    }
  }

  for (const [agentStem, roleName] of consumersByAgent.entries()) {
    if (!Object.hasOwn(agentRoleIndex, agentStem)) {
      errors.push(`roles["${roleName}"].consumers includes "${agentStem}.agent.md" but agent_role_index is missing "${agentStem}"`);
      continue;
    }

    if (agentRoleIndex[agentStem] !== roleName) {
      errors.push(`roles["${roleName}"].consumers includes "${agentStem}.agent.md" but agent_role_index maps "${agentStem}" to "${agentRoleIndex[agentStem]}"`);
    }
  }

  return { ok: errors.length === 0, errors };
}

// ── Check #2: Roster ↔ enum bidirectional alignment ──────────────────────────
export function parseRosterFromProjectContext(content) {
  const lines = content.split('\n');
  const startIdx = lines.findIndex(l => l.trim() === '## Phase Executor Agents');
  if (startIdx === -1) return [];
  const agents = [];
  for (let i = startIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (/^##\s/.test(line)) break;
    // Only consume real table data rows: leading '|', first cell is an agent name,
    // skip the header row ("Agent") and the separator row ("---").
    const m = line.match(/^\|\s*([A-Za-z][\w-]+)\s*\|/);
    if (!m) continue;
    const name = m[1];
    if (name === 'Agent') continue;
    if (/^\|\s*-+\s*\|/.test(line)) continue;
    agents.push(name);
  }
  return agents;
}

export function compareRosterEnum(rosterAgents, enumValues) {
  const rosterSet = new Set(rosterAgents);
  const enumSet = new Set(enumValues);
  const extraInRoster = [...rosterSet].filter(a => !enumSet.has(a));
  const extraInEnum = [...enumSet].filter(a => !rosterSet.has(a));
  return {
    equal: extraInRoster.length === 0 && extraInEnum.length === 0,
    extraInRoster,
    extraInEnum,
  };
}

// ── Check #3: Agent Resources ↔ schemas existence ────────────────────────────
export function parseResourcesRepoPaths(agentContent) {
  const lines = agentContent.split('\n');
  const startIdx = lines.findIndex(l => l.trim() === '## Resources');
  if (startIdx === -1) return [];
  const paths = [];
  for (let i = startIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (/^##\s/.test(line)) break;
    for (const m of line.matchAll(/`([^`]+)`/g)) {
      const raw = m[1].trim();
      if (!raw || /\s/.test(raw)) continue;
      if (/[<>]/.test(raw)) continue;
      if (/^(https?:|file:|vscode:)/i.test(raw)) continue;
      if (raw.includes('*')) continue;
      if (
        raw.startsWith('.github/') ||
        raw.startsWith('docs/') ||
        raw.startsWith('governance/') ||
        raw.startsWith('plans/') ||
        raw.startsWith('schemas/') ||
        raw.startsWith('skills/') ||
        /^[A-Za-z0-9._-]+\.agent\.md$/.test(raw)
      ) {
        paths.push(raw);
      }
    }
  }
  return paths;
}

export function parseResourcesSchemaPaths(agentContent) {
  return parseResourcesRepoPaths(agentContent).filter(p => /^schemas\/[^`]+\.json$/.test(p));
}

// ── Check #4: Cross-plan file-overlap ────────────────────────────────────────
const ANNOTATION_RX = /\s*\([^)]*\)\s*$/;
const TOOL_PATH_RX = /^(agent|edit|execute|read|search|vscode)\//;

export function stripAnnotations(path) {
  return path.replace(ANNOTATION_RX, '').trim();
}

// Parse the `Files:` section of a plan document.
// Parser contract (see Phase 9 of controlflow-comprehensive-revision-plan.md):
//   - Only bullet lines starting with "- **Files:**" (or following indented
//     sub-bullets) contribute.
//   - Extract backtick-quoted tokens that look like file paths (contain a slash
//     or dot, no whitespace).
//   - Strip trailing parenthetical annotations ("(new)", "(spike)", etc.).
//   - Ignore lines without a backtick-quoted path.
export function parsePlanFilesSection(content) {
  const lines = content.split('\n');
  const files = [];
  const collectFrom = (ln) => {
    for (const m of ln.matchAll(/`([^`]+)`/g)) {
      const raw = m[1].trim();
      if (!raw) continue;
      if (/\s/.test(raw)) continue;
      if (TOOL_PATH_RX.test(raw)) continue;
      if (!/[./]/.test(raw)) continue;
      files.push(stripAnnotations(raw));
    }
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!/^\s*-\s*\*\*Files:\*\*/.test(line)) continue;
    collectFrom(line);
    for (let j = i + 1; j < lines.length; j++) {
      const sub = lines[j];
      if (/^\s{2,}-\s+/.test(sub)) {
        collectFrom(sub);
      } else if (sub.trim() === '') {
        continue;
      } else {
        break;
      }
    }
  }
  return files;
}

export function isGlob(p) { return p.includes('*'); }

export function expandGlob(pattern, rootDir) {
  if (!isGlob(pattern)) return [pattern];
  const idx = pattern.lastIndexOf('/');
  const dir = idx >= 0 ? pattern.slice(0, idx) : '.';
  const base = idx >= 0 ? pattern.slice(idx + 1) : pattern;
  if (!base.includes('*') || base.includes('**')) return [];
  const rx = new RegExp('^' + base.replace(/\./g, '\\.').replace(/\*/g, '[^/]*') + '$');
  let entries = [];
  try {
    entries = readdirSync(join(rootDir, dir));
  } catch { return []; }
  return entries
    .filter(f => rx.test(f))
    .map(f => (dir === '.' ? f : `${dir}/${f}`));
}

export function buildPlanFileMap(planPathsRelative, rootDir, opts = {}) {
  const { readFile = (p) => readFileSync(p, 'utf8') } = opts;
  const map = new Map();
  for (const planPath of planPathsRelative) {
    const absPath = join(rootDir, planPath);
    if (!existsSync(absPath)) continue;
    const content = readFile(absPath);
    const rawFiles = parsePlanFilesSection(content);
    const expanded = new Set();
    for (const f of rawFiles) {
      if (isGlob(f)) {
        for (const e of expandGlob(f, rootDir)) expanded.add(e);
      } else {
        expanded.add(f);
      }
    }
    for (const f of expanded) {
      if (!map.has(f)) map.set(f, new Set());
      map.get(f).add(planPath);
    }
  }
  return map;
}

function parseTopLevelYamlList(text, key) {
  const keyRx = new RegExp(`^${key}:\\s*$`);
  const values = [];
  const lines = text.split('\n');
  let inBlock = false;
  for (const line of lines) {
    if (!inBlock && keyRx.test(line)) { inBlock = true; continue; }
    if (!inBlock) continue;
    if (/^\S/.test(line)) break; // next top-level key
    const m = line.match(/^\s+-\s+["']?([^"'\s#]+)["']?\s*(?:#.*)?$/);
    if (m) values.push(m[1]);
  }
  return values;
}

// Minimal YAML line-parser: extract explicit file-level coverage lists.
export function parseYamlSharedFiles(text) {
  return [
    ...parseTopLevelYamlList(text, 'shared_files'),
    ...parseTopLevelYamlList(text, 'shared_surfaces'),
  ];
}

// Minimal YAML line-parser: extract a top-level list under "consumers:".
export function parseYamlConsumers(text) {
  return parseTopLevelYamlList(text, 'consumers');
}

export function hasSharedAnchorMapFlag(text) {
  return /^\s*shared_anchor_map:\s*true\s*$/m.test(text);
}

export function findSharedAnchorMaps(rootDir, artifactsDir = 'plans/artifacts') {
  const anchorMaps = [];
  const base = join(rootDir, artifactsDir);
  let subdirs = [];
  try {
    subdirs = readdirSync(base, { withFileTypes: true }).filter(d => d.isDirectory());
  } catch { return anchorMaps; }
  for (const sub of subdirs) {
    const subPath = join(base, sub.name);
    let files = [];
    try {
      files = readdirSync(subPath).filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));
    } catch { continue; }
    for (const f of files) {
      const text = readFileSync(join(subPath, f), 'utf8');
      if (!hasSharedAnchorMapFlag(text)) continue;
      const consumers = parseYamlConsumers(text);
      anchorMaps.push({
        path: `${artifactsDir}/${sub.name}/${f}`.replace(/\\/g, '/'),
        consumers,
        sharedFiles: parseYamlSharedFiles(text),
      });
    }
  }
  return anchorMaps;
}

export function findUnresolvedOverlaps(planFileMap, anchorMaps) {
  const unresolved = [];
  for (const [file, planSet] of planFileMap.entries()) {
    if (planSet.size < 2) continue;
    const plans = [...planSet].sort();
    for (let i = 0; i < plans.length; i++) {
      for (let j = i + 1; j < plans.length; j++) {
        const a = plans[i], b = plans[j];
        const covered = anchorMaps.some(am =>
          am.consumers.includes(a) && am.consumers.includes(b) &&
          Array.isArray(am.sharedFiles) && am.sharedFiles.some(sharedFile =>
            sharedFile === file || (sharedFile.endsWith('/') && file.startsWith(sharedFile))
          ));
        if (!covered) unresolved.push({ file, planA: a, planB: b });
      }
    }
  }
  return unresolved;
}

// ── Check #6: by_tier matrix shape ───────────────────────────────────────────
const VALID_COMPLEXITY_TIERS = ['TRIVIAL', 'SMALL', 'MEDIUM', 'LARGE'];
const VALID_COST_TIER_VALUES = ['low', 'medium', 'high'];
const VALID_LATENCY_TIER_VALUES = ['fast', 'medium', 'slow'];

/**
 * Validate that every role in governance/model-routing.json carries a by_tier
 * object with all four complexity tiers present. Each tier entry must be either
 * a full override ({ primary, fallbacks, cost_tier, latency_tier }) or a
 * delegation ({ inherit_from: "default" }).
 * @param {object} routingJson - Parsed governance/model-routing.json
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validateByTierShape(routingJson) {
  const errors = [];
  const roles = routingJson.roles || {};
  for (const [roleName, role] of Object.entries(roles)) {
    const byTier = role.by_tier;
    if (!byTier || typeof byTier !== 'object') {
      errors.push(`role "${roleName}": missing by_tier object`);
      continue;
    }
    const unknownKeys = Object.keys(byTier).filter(k => !VALID_COMPLEXITY_TIERS.includes(k));
    if (unknownKeys.length > 0) {
      errors.push(`role "${roleName}": by_tier contains unknown tier(s): ${unknownKeys.join(', ')} (valid: ${VALID_COMPLEXITY_TIERS.join(', ')})`);
    }
    for (const tier of VALID_COMPLEXITY_TIERS) {
      const entry = byTier[tier];
      if (!entry || typeof entry !== 'object') {
        errors.push(`role "${roleName}": by_tier missing tier "${tier}"`);
        continue;
      }
      if ('inherit_from' in entry) {
        if (entry.inherit_from !== 'default') {
          errors.push(`role "${roleName}" tier "${tier}": inherit_from must be "default", got "${entry.inherit_from}"`);
        }
      } else {
        if (!entry.primary) {
          errors.push(`role "${roleName}" tier "${tier}": missing primary`);
        }
        if (!Array.isArray(entry.fallbacks)) {
          errors.push(`role "${roleName}" tier "${tier}": fallbacks must be an array`);
        }
        if (!VALID_COST_TIER_VALUES.includes(entry.cost_tier)) {
          errors.push(`role "${roleName}" tier "${tier}": invalid cost_tier "${entry.cost_tier}" (valid: ${VALID_COST_TIER_VALUES.join(', ')})`);
        }
        if (!VALID_LATENCY_TIER_VALUES.includes(entry.latency_tier)) {
          errors.push(`role "${roleName}" tier "${tier}": invalid latency_tier "${entry.latency_tier}" (valid: ${VALID_LATENCY_TIER_VALUES.join(', ')})`);
        }
      }
    }
  }
  return { ok: errors.length === 0, errors };
}

// ── Check #10: review_scope=final bidirectional coupling ──────────────────────
/**
 * Validates that CodeReviewer-subagent.agent.md references `review_scope=final`
 * if and only if `code-reviewer.verdict.schema.json` review_scope enum contains "final".
 * This is a bidirectional coupling check: if one side drifts the other becomes stale.
 * @param {string} agentContent - Content of CodeReviewer-subagent.agent.md
 * @param {object} schemaJson - Parsed code-reviewer.verdict.schema.json
 * @returns {{ ok: boolean, agentReferencesFinal: boolean, schemaHasFinal: boolean, errors: string[] }}
 */
export function validateReviewScopeFinalCoupling(agentContent, schemaJson) {
  const agentReferencesFinal =
    /review_scope[=:]\s*"?final"?/.test(agentContent) ||
    /review_scope=final/.test(agentContent);
  const schemaHasFinal =
    (schemaJson?.properties?.review_scope?.enum ?? []).includes('final');

  const errors = [];
  if (agentReferencesFinal && !schemaHasFinal) {
    errors.push(
      'CodeReviewer-subagent.agent.md references review_scope=final but code-reviewer.verdict.schema.json review_scope enum lacks "final"'
    );
  }
  if (schemaHasFinal && !agentReferencesFinal) {
    errors.push(
      'code-reviewer.verdict.schema.json review_scope enum contains "final" but CodeReviewer-subagent.agent.md does not reference review_scope=final'
    );
  }
  return { ok: errors.length === 0, agentReferencesFinal, schemaHasFinal, errors };
}

// ── Check #11: NOTES.md style anti-pattern detection ─────────────────────────
/**
 * Validates that NOTES.md does not contain task-history anti-patterns that
 * indicate memory pollution (content that belongs in task-episodic memory, not
 * repo-persistent active-objective state).
 *
 * Anti-patterns detected:
 *   - Lines containing the word "iteration" (task-history leakage)
 *   - Lines containing the word "verdict" (audit-result leakage)
 *   - Lines containing an artifact path fragment matching /phase-\d+-/ (phase reference)
 *   - More than 3 consecutive bullet items under a single heading
 *   - A fenced code block (triple backtick)
 *
 * @param {string} content - Full text content of NOTES.md
 * @returns {{ ok: boolean, violations: string[] }}
 */
export function validateNotesMdStyle(content) {
  const violations = [];
  const lines = content.split('\n');

  let consecutiveBullets = 0;
  let currentHeading = '(top)';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Track heading boundaries to reset bullet counter
    if (/^#{1,6}\s/.test(line)) {
      consecutiveBullets = 0;
      currentHeading = line.trim();
      continue;
    }

    // Fenced code block
    if (/^```/.test(line.trim())) {
      violations.push(`Line ${lineNum}: fenced code block not allowed in NOTES.md (task-episodic content)`);
    }

    // "iteration" keyword (case-insensitive)
    if (/\biteration\b/i.test(line)) {
      violations.push(`Line ${lineNum}: contains "iteration" — task-history content belongs in plans/artifacts/, not NOTES.md`);
    }

    // "verdict" keyword (case-insensitive)
    if (/\bverdict\b/i.test(line)) {
      violations.push(`Line ${lineNum}: contains "verdict" — audit result belongs in plans/artifacts/, not NOTES.md`);
    }

    // phase-N- artifact path fragment
    if (/phase-\d+-/.test(line)) {
      violations.push(`Line ${lineNum}: contains phase artifact path fragment (phase-N-) — task-episodic content`);
    }

    // Consecutive bullet counting
    if (/^\s*[-*+]\s/.test(line) || /^\s*\d+\.\s/.test(line)) {
      consecutiveBullets++;
      if (consecutiveBullets > 3) {
        violations.push(`Line ${lineNum}: more than 3 consecutive bullet items under heading "${currentHeading}" — NOTES.md must stay concise`);
      }
    } else if (line.trim() !== '') {
      consecutiveBullets = 0;
    }
  }

  return { ok: violations.length === 0, violations };
}

// ── Memory Content Taxonomy drift checks (free-code-memory-features Phase 4) ─

/**
 * Validate that MEMORY-ARCHITECTURE.md contains the ## Memory Content Taxonomy
 * heading and all expected memory_content_types from runtime-policy.json.
 * @param {string} memoryArchitectureContent - Full text of MEMORY-ARCHITECTURE.md
 * @param {object} runtimePolicy - Parsed governance/runtime-policy.json
 * @returns {{ pass: boolean, reason?: string }}
 */
export function validateMemoryContentTaxonomy(memoryArchitectureContent, runtimePolicy) {
  if (!memoryArchitectureContent.includes('## Memory Content Taxonomy')) {
    return { pass: false, reason: 'MEMORY-ARCHITECTURE.md is missing heading "## Memory Content Taxonomy"' };
  }
  const types = runtimePolicy?.memory_hygiene?.memory_content_types ?? [];
  for (const type of types) {
    if (!memoryArchitectureContent.includes(type)) {
      return { pass: false, reason: `MEMORY-ARCHITECTURE.md does not mention memory_content_type "${type}"` };
    }
  }
  return { pass: true };
}

/**
 * Validate that PROMPT-BEHAVIOR-CONTRACT.md contains the § 7 Memory Use
 * Discipline heading and both required invariant strings.
 * @param {string} promptBehaviorContent - Full text of PROMPT-BEHAVIOR-CONTRACT.md
 * @param {object} scenario - Parsed memory-content-taxonomy.json scenario fixture
 * @returns {{ pass: boolean, reason?: string }}
 */
export function validateMemoryUseDiscipline(promptBehaviorContent, scenario) {
  const heading = scenario?.expected?.memory_use_discipline_heading ?? '### 7. Memory Use Discipline';
  if (!promptBehaviorContent.includes(heading)) {
    return { pass: false, reason: `PROMPT-BEHAVIOR-CONTRACT.md is missing heading "${heading}"` };
  }
  if (!promptBehaviorContent.includes('Verify before use')) {
    return { pass: false, reason: 'PROMPT-BEHAVIOR-CONTRACT.md is missing invariant "Verify before use"' };
  }
  if (!promptBehaviorContent.includes('Ignore memory on request')) {
    return { pass: false, reason: 'PROMPT-BEHAVIOR-CONTRACT.md is missing invariant "Ignore memory on request"' };
  }
  return { pass: true };
}

/**
 * Validate that the session-notes template contains all required sections.
 * @param {string} templateContent - Full text of the session-notes template
 * @param {object} scenario - Parsed memory-content-taxonomy.json scenario fixture
 * @returns {{ pass: boolean, reason?: string }}
 */
export function validateSessionNotesTemplate(templateContent, scenario) {
  const sections = scenario?.expected?.session_notes_sections ?? [];
  for (const section of sections) {
    if (!templateContent.includes(section)) {
      return { pass: false, reason: `Session-notes template is missing section "${section}"` };
    }
  }
  return { pass: true };
}

/**
 * Validate that repo-memory-hygiene.md contains the Checklist C heading.
 * @param {string} hygieneContent - Full text of skills/patterns/repo-memory-hygiene.md
 * @param {object} scenario - Parsed memory-content-taxonomy.json scenario fixture
 * @returns {{ pass: boolean, reason?: string }}
 */
export function validateRepoMemoryHygieneChecklistC(hygieneContent, scenario) {
  const heading = scenario?.expected?.repo_memory_hygiene_checklist_c_heading ?? '## Checklist C';
  if (!hygieneContent.includes(heading)) {
    return { pass: false, reason: `skills/patterns/repo-memory-hygiene.md is missing "${heading}"` };
  }
  return { pass: true };
}

/**
 * Validate that repo-memory-hygiene.md contains the Checklist D heading.
 * @param {string} hygieneContent - Full text of skills/patterns/repo-memory-hygiene.md
 * @param {object} scenario - Parsed memory-content-taxonomy.json scenario fixture
 * @returns {{ pass: boolean, reason?: string }}
 */
export function validateRepoMemoryHygieneChecklistD(hygieneContent, scenario) {
  const heading = scenario?.expected?.repo_memory_hygiene_checklist_d_heading ?? '## Checklist D';
  if (!hygieneContent.includes(heading)) {
    return { pass: false, reason: `skills/patterns/repo-memory-hygiene.md is missing "${heading}"` };
  }
  return { pass: true };
}

// ── Subsection Extractor ──────────────────────────────────────────────────────

/**
 * Given a Markdown string and a heading text, return the substring from that
 * heading line up to (but not including) the next heading at the same or
 * shallower depth. Returns an empty string if the heading is not found.
 * @param {string} content - Full markdown document text
 * @param {string} headingText - The heading text to find (e.g. "Context Compaction Policy")
 * @returns {string}
 */
export function extractSubsection(content, headingText) {
  const lines = content.split(/\r?\n/);
  let startIdx = -1;
  let headingDepth = 0;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(#{1,6})\s+(.+)$/);
    if (m && m[2].trim() === headingText.trim()) {
      startIdx = i;
      headingDepth = m[1].length;
      break;
    }
  }
  if (startIdx === -1) return '';
  const resultLines = [lines[startIdx]];
  for (let i = startIdx + 1; i < lines.length; i++) {
    const m = lines[i].match(/^(#{1,6})\s/);
    if (m && m[1].length <= headingDepth) break;
    resultLines.push(lines[i]);
  }
  return resultLines.join('\n');
}

// ── Tutorial Parity Validator ─────────────────────────────────────────────────

/**
 * Validate heading parity between EN and RU tutorial directories.
 * Pairs .md files by basename, extracts level-2 heading sets, and applies
 * an allowlist for known asymmetric headings.
 *
 * If `allowlist._chapters_in_scope` is set (array of basenames), only those
 * files are checked. All other chapter pairs are skipped. This lets Phase 5
 * activate parity checking incrementally without requiring all chapters to
 * be fully translated or aliased up-front.
 *
 * @param {string} enDir - Absolute path to the EN tutorial directory
 * @param {string} ruDir - Absolute path to the RU tutorial directory
 * @param {object} allowlist - Allowlist object with en_only, ru_only, heading_aliases, _chapters_in_scope
 * @returns {{ pass: boolean, reason?: string, missingPairs: string[], headingMismatches: Array<{file: string, en_only: string[], ru_only: string[]}> }}
 */
export function validateTutorialParity(enDir, ruDir, allowlist) {
  const enOnlyAllowed = new Set(allowlist.en_only || []);
  const ruOnlyAllowed = new Set(allowlist.ru_only || []);
  const headingAliases = allowlist.heading_aliases || {};
  const chaptersInScope = allowlist._chapters_in_scope || null;

  let enFiles = [];
  let ruFiles = [];
  try { enFiles = readdirSync(enDir).filter(f => f.endsWith('.md')).sort(); } catch { /* dir missing */ }
  try { ruFiles = readdirSync(ruDir).filter(f => f.endsWith('.md')).sort(); } catch { /* dir missing */ }

  const enSet = new Set(enFiles);
  const ruSet = new Set(ruFiles);
  const allFiles = new Set([...enFiles, ...ruFiles]);

  // When _chapters_in_scope is set, restrict validation to those files only.
  const effectiveFiles = chaptersInScope
    ? new Set([...allFiles].filter(f => chaptersInScope.includes(f)))
    : allFiles;

  const missingPairs = [];
  for (const f of effectiveFiles) {
    if (!enSet.has(f) || !ruSet.has(f)) missingPairs.push(f);
  }

  function extractLevel2Headings(filePath) {
    try {
      const text = readFileSync(filePath, 'utf8');
      const headings = new Set();
      for (const line of text.split('\n')) {
        const m = line.match(/^##\s+(.+)$/);
        if (m) headings.add(m[1].trim());
      }
      return headings;
    } catch {
      return new Set();
    }
  }

  function applyAliases(heading) {
    return headingAliases[heading] ?? heading;
  }

  const headingMismatches = [];
  for (const f of effectiveFiles) {
    if (!enSet.has(f) || !ruSet.has(f)) continue;
    const enHeadings = extractLevel2Headings(join(enDir, f));
    const ruHeadings = extractLevel2Headings(join(ruDir, f));
    const enNorm = new Set([...enHeadings].map(applyAliases));
    const ruNorm = new Set([...ruHeadings].map(applyAliases));
    const enOnlyMismatches = [...enNorm].filter(h => !ruNorm.has(h) && !enOnlyAllowed.has(h));
    const ruOnlyMismatches = [...ruNorm].filter(h => !enNorm.has(h) && !ruOnlyAllowed.has(h));
    if (enOnlyMismatches.length > 0 || ruOnlyMismatches.length > 0) {
      headingMismatches.push({ file: f, en_only: enOnlyMismatches, ru_only: ruOnlyMismatches });
    }
  }

  const ok = missingPairs.length === 0 && headingMismatches.length === 0;
  if (!ok) {
    const reasons = [];
    if (missingPairs.length > 0) reasons.push(`missing pairs: ${missingPairs.join(', ')}`);
    if (headingMismatches.length > 0) reasons.push(`${headingMismatches.length} file(s) with heading mismatches`);
    return { pass: false, reason: reasons.join('; '), missingPairs, headingMismatches };
  }
  return { pass: true, missingPairs: [], headingMismatches: [] };
}

// ── Structural Fingerprint (cache invalidation) ───────────────────────────────

/**
 * Compute a SHA-256 fingerprint over all structural inputs consumed by the
 * eval harness. When this value changes, the warm-cache pass is invalidated.
 *
 * Exported here (rather than kept private in validate.mjs) so fingerprint
 * regression tests can import it without triggering validate.mjs side effects
 * (process.exit calls, pass output, cache writes).
 *
 * Hashes: both harness files, evals package manifests, all schemas, all scenario
 * JSON files, all Cursor .mdc rule files, all agent prompt files, key governance
 * and artifact files, and the skills library.
 *
 * @returns {string} hex SHA-256 digest
 */
export function computeStructuralFingerprint() {
  const h = createHash('sha256');
  function hashFile(filePath) {
    try {
      h.update(filePath + '\x00');
      h.update(readFileSync(filePath));
    } catch {
      h.update(filePath + '\x00<missing>');
    }
  }
  // Both harness files (cache invalidates when either changes)
  hashFile(__cfFilename); // drift-checks.mjs
  hashFile(join(__cfDir, 'validate.mjs'));
  // evals package manifests
  hashFile(join(__cfDir, 'package.json'));
  hashFile(join(__cfDir, 'package-lock.json'));
  // schemas
  try {
    for (const f of readdirSync(CF_SCHEMAS_DIR).sort()) {
      if (f.endsWith('.schema.json')) hashFile(join(CF_SCHEMAS_DIR, f));
    }
  } catch { /* cold */ }
  // scenarios — full recursive walk of all JSON files under evals/scenarios/
  function walkJson(dir) {
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const ent of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const full = join(dir, ent.name);
      if (ent.isDirectory()) walkJson(full);
      else if (ent.isFile() && ent.name.endsWith('.json')) hashFile(full);
    }
  }
  walkJson(CF_SCENARIOS_DIR);
  // Cursor project rules — deterministic sorted recursive walk of .mdc content.
  function walkCursorRules(dir) {
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const ent of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const full = join(dir, ent.name);
      if (ent.isDirectory()) walkCursorRules(full);
      else if (ent.isFile() && ent.name.endsWith('.mdc')) hashFile(full);
    }
  }
  walkCursorRules(CF_CURSOR_RULES_DIR);
  // Cursor project skills and agents
  function walkCursorPluginTree(dir) {
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const ent of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const full = join(dir, ent.name);
      if (ent.isDirectory()) walkCursorPluginTree(full);
      else if (ent.isFile() && (ent.name === 'SKILL.md' || ent.name.endsWith('.md'))) hashFile(full);
    }
  }
  walkCursorPluginTree(join(CF_REPO_ROOT, '.cursor', 'skills'));
  walkCursorPluginTree(join(CF_REPO_ROOT, '.cursor', 'agents'));
  walkCursorPluginTree(join(CF_REPO_ROOT, 'plugins', 'controlflow-cursor', 'skills'));
  walkCursorPluginTree(join(CF_REPO_ROOT, 'plugins', 'controlflow-cursor', 'agents'));
  // root agent prompt files
  try {
    for (const f of readdirSync(CF_REPO_ROOT).sort()) {
      if (f.endsWith('.agent.md')) hashFile(join(CF_REPO_ROOT, f));
    }
  } catch { /* cold */ }
  // required governance and artifact files consumed by the harness
  for (const rel of [
    '.github/copilot-instructions.md',
    'plans/project-context.md',
    'docs/agent-engineering/PART-SPEC.md',
    'docs/agent-engineering/RELIABILITY-GATES.md',
    'docs/agent-engineering/CLARIFICATION-POLICY.md',
    'docs/agent-engineering/TOOL-ROUTING.md',
    'governance/tool-grants.json',
    'governance/runtime-policy.json',
    'governance/rename-allowlist.json',
    'governance/agent-grants.json',
    'governance/model-routing.json',
    'governance/canonical-source-matrix.json',
    'governance/project-context-registry.json',
  ]) hashFile(join(CF_REPO_ROOT, rel));
  // skills index and patterns
  hashFile(join(CF_REPO_ROOT, 'skills', 'index.md'));
  try {
    for (const f of readdirSync(join(CF_REPO_ROOT, 'skills', 'patterns')).sort()) {
      if (f.endsWith('.md')) hashFile(join(CF_REPO_ROOT, 'skills', 'patterns', f));
    }
  } catch { /* cold */ }
  // Selective plugin portability contract plus every evidence file it declares.
  const portabilityMatrixPath = join(
    CF_REPO_ROOT,
    'plugins',
    'controlflow-shared-source',
    'core-portability-matrix.json'
  );
  hashFile(portabilityMatrixPath);
  try {
    const matrix = JSON.parse(readFileSync(portabilityMatrixPath, 'utf8'));
    const evidencePaths = new Set();
    for (const invariant of matrix.invariants || []) {
      for (const rel of invariant.core_evidence || []) evidencePaths.add(rel);
      for (const rel of invariant.plugin_evidence || []) evidencePaths.add(rel);
      for (const requirement of invariant.required_anchors || []) {
        if (requirement && typeof requirement.path === 'string') evidencePaths.add(requirement.path);
      }
    }
    for (const rel of [...evidencePaths].sort()) {
      if (isSafeRepoRelativePath(rel)) hashFile(join(CF_REPO_ROOT, rel));
    }
  } catch { /* Pass 16 reports malformed matrix details. */ }
  return h.digest('hex');
}

// ── Phase 5: Behavioral Assertions ──────────────────────────────────────────

/**
 * Assert that the Orchestrator's Context Compaction Policy subsection contains
 * both required invariant substrings: `compaction.max_consecutive_failures` and
 * `WAITING_APPROVAL`.
 * @param {string} orchestratorContent - Full content of Orchestrator.agent.md
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validateOrchestratorCompactionInvariant(orchestratorContent) {
  const slice = extractSubsection(orchestratorContent, 'Context Compaction Policy');
  if (!slice) {
    return { ok: false, errors: ['Context Compaction Policy subsection not found in Orchestrator content'] };
  }
  const errors = [];
  if (!slice.includes('compaction.max_consecutive_failures')) {
    errors.push('Context Compaction Policy: missing substring "compaction.max_consecutive_failures"');
  }
  if (!slice.includes('WAITING_APPROVAL')) {
    errors.push('Context Compaction Policy: missing substring "WAITING_APPROVAL"');
  }
  return { ok: errors.length === 0, errors };
}

/**
 * Assert that within the Orchestrator's Agentic Memory Policy subsection,
 * the memory-promotion-candidates.md bullet appears STRICTLY BEFORE the
 * Checklist C bullet (by line index within the extracted slice).
 * @param {string} orchestratorContent - Full content of Orchestrator.agent.md
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validateOrchestratorMemoryPromotionOrder(orchestratorContent) {
  const slice = extractSubsection(orchestratorContent, 'Agentic Memory Policy');
  if (!slice) {
    return { ok: false, errors: ['Agentic Memory Policy subsection not found in Orchestrator content'] };
  }
  const lines = slice.split('\n');
  const promotionIdx = lines.findIndex(l => l.includes('memory-promotion-candidates.md'));
  const checklistCIdx = lines.findIndex((l, i) => i !== promotionIdx && l.includes('Checklist C'));
  const errors = [];
  if (promotionIdx === -1) {
    errors.push('Agentic Memory Policy: memory-promotion-candidates.md bullet not found');
  }
  if (checklistCIdx === -1) {
    errors.push('Agentic Memory Policy: Checklist C bullet not found');
  }
  if (promotionIdx !== -1 && checklistCIdx !== -1 && promotionIdx >= checklistCIdx) {
    errors.push(
      `Agentic Memory Policy: memory-promotion-candidates.md (line ${promotionIdx}) must appear BEFORE Checklist C (line ${checklistCIdx})`
    );
  }
  return { ok: errors.length === 0, errors };
}

/**
 * Assert that at least one line in the CodeReviewer Prompt section contains
 * BOTH `review_mode: "security"` AND `skills/patterns/security-review-discipline.md`
 * on the SAME line.
 * @param {string} codeReviewerContent - Full content of CodeReviewer-subagent.agent.md
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validateCodeReviewerSecurityModeSameLine(codeReviewerContent) {
  const promptSlice = extractSubsection(codeReviewerContent, 'Prompt');
  const searchContent = promptSlice || codeReviewerContent;
  const hasMatchingLine = searchContent.split('\n').some(
    line =>
      line.includes('review_mode: "security"') &&
      line.includes('skills/patterns/security-review-discipline.md')
  );
  if (!hasMatchingLine) {
    return {
      ok: false,
      errors: [
        'No single line in the Prompt section contains both review_mode: "security" and skills/patterns/security-review-discipline.md',
      ],
    };
  }
  return { ok: true, errors: [] };
}

// ── Check #PW-F1: Canonical Source Matrix heading ─────────────────────────────

/**
 * Validate that plans/project-context.md contains the ## Canonical Source Matrix
 * heading (anchor added in Phase 1 of the planner-orchestrator optimization wave).
 * This check fails if the heading is removed or renamed, preventing silent regression.
 * @param {string} projectContextContent - Full text of plans/project-context.md
 * @returns {{ pass: boolean, reason?: string }}
 */
export function validateCanonicalSourceMatrixHeading(projectContextContent) {
  if (!projectContextContent.includes('## Canonical Source Matrix')) {
    return {
      pass: false,
      reason: 'plans/project-context.md is missing heading "## Canonical Source Matrix"',
    };
  }
  return { pass: true };
}

function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Validate that canonical ownership entries declared in governance/canonical-source-matrix.json
 * are present in the markdown Canonical Source Matrix table.
 * @param {string} projectContextContent - Full text of plans/project-context.md
 * @param {object} canonicalMatrixJson - Parsed governance/canonical-source-matrix.json
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validateCanonicalSourceMatrixContract(projectContextContent, canonicalMatrixJson) {
  const errors = [];
  const entries = canonicalMatrixJson?.entries;

  if (!canonicalMatrixJson || typeof canonicalMatrixJson !== 'object') {
    return { ok: false, errors: ['canonical-source-matrix: JSON object missing'] };
  }
  if (!Array.isArray(entries) || entries.length === 0) {
    return { ok: false, errors: ['canonical-source-matrix: entries[] missing or empty'] };
  }

  const seenConcerns = new Set();
  for (const [idx, entry] of entries.entries()) {
    if (!entry || typeof entry !== 'object') {
      errors.push(`canonical-source-matrix: entries[${idx}] must be an object`);
      continue;
    }

    const concern = entry.concern;
    const authoritativeFile = entry.authoritative_file;

    if (typeof concern !== 'string' || concern.trim().length === 0) {
      errors.push(`canonical-source-matrix: entries[${idx}].concern must be a non-empty string`);
      continue;
    }
    if (typeof authoritativeFile !== 'string' || authoritativeFile.trim().length === 0) {
      errors.push(`canonical-source-matrix: entries[${idx}].authoritative_file must be a non-empty string`);
      continue;
    }

    if (seenConcerns.has(concern)) {
      errors.push(`canonical-source-matrix: duplicate concern "${concern}"`);
    }
    seenConcerns.add(concern);

    const rowPattern = '^\\|\\s*' +
      escapeRegex(concern) +
      '\\s*\\|\\s*`' +
      escapeRegex(authoritativeFile) +
      '`\\s*\\|';
    const rowRegex = new RegExp(rowPattern, 'm');
    if (!rowRegex.test(projectContextContent)) {
      errors.push(
        `Canonical Source Matrix row missing or drifted for concern "${concern}" with authoritative file "${authoritativeFile}"`
      );
    }
  }

  return { ok: errors.length === 0, errors };
}

function normalizeMarkdownCell(value) {
  return String(value).trim().replace(/^`(.+)`$/, '$1');
}

function extractMarkdownTableRowsByHeading(content, heading) {
  const lines = String(content).split('\n');
  const startIdx = lines.findIndex(line => line.trim() === heading);
  if (startIdx === -1) {
    return null;
  }

  const tableLines = [];
  for (let i = startIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (/^##\s/.test(line)) {
      break;
    }
    if (line.trim().startsWith('|')) {
      tableLines.push(line);
    }
  }

  if (tableLines.length === 0) {
    return [];
  }

  const parsedRows = tableLines
    .map(line => line.split('|').slice(1, -1).map(cell => normalizeMarkdownCell(cell)))
    .filter(cells => cells.length > 0);

  if (parsedRows.length === 0) {
    return [];
  }

  const dataRows = parsedRows.filter((cells, idx) => {
    if (idx === 0) {
      return false;
    }
    return !cells.every(cell => /^:?-{3,}:?$/.test(cell));
  });

  return dataRows;
}

/**
 * Validate that selected project-context markdown tables mirror the machine-readable
 * governance/project-context-registry.json entries row-for-row.
 * @param {string} projectContextContent - Full text of plans/project-context.md
 * @param {object} registryJson - Parsed governance/project-context-registry.json
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validateProjectContextRegistryMirror(projectContextContent, registryJson) {
  const errors = [];
  const sectionSpecs = [
    {
      name: 'Phase Executor Agents',
      heading: '## Phase Executor Agents',
      registryKey: 'phase_executor_agents',
      fields: ['agent', 'role', 'primary_use_case', 'model_routing_role'],
    },
    {
      name: 'Review Pipeline Agents',
      heading: '## Review Pipeline Agents',
      registryKey: 'review_pipeline_agents',
      fields: ['agent', 'role', 'primary_use_case', 'model_routing_role'],
    },
    {
      name: 'Agent Role Matrix',
      heading: '## Agent Role Matrix',
      registryKey: 'agent_role_matrix',
      fields: ['agent', 'schema_output', 'tools_profile', 'delegation_source'],
    },
  ];

  if (!registryJson || typeof registryJson !== 'object') {
    return { ok: false, errors: ['project-context-registry: JSON object missing'] };
  }

  for (const spec of sectionSpecs) {
    const entries = registryJson?.[spec.registryKey];
    if (!Array.isArray(entries) || entries.length === 0) {
      errors.push(`project-context-registry: ${spec.registryKey}[] missing or empty`);
      continue;
    }

    const seenAgents = new Set();
    const expectedRows = [];
    for (const [idx, entry] of entries.entries()) {
      if (!entry || typeof entry !== 'object') {
        errors.push(`${spec.name}: registry entry ${idx + 1} must be an object`);
        continue;
      }
      if (typeof entry.agent !== 'string' || entry.agent.trim().length === 0) {
        errors.push(`${spec.name}: registry entry ${idx + 1} missing non-empty agent`);
      } else if (seenAgents.has(entry.agent)) {
        errors.push(`${spec.name}: duplicate agent "${entry.agent}" in registry`);
      } else {
        seenAgents.add(entry.agent);
      }

      const expectedRow = spec.fields.map(field => {
        const value = entry?.[field];
        if (typeof value !== 'string' || value.trim().length === 0) {
          errors.push(`${spec.name}: registry entry ${idx + 1} missing non-empty ${field}`);
          return '';
        }
        return normalizeMarkdownCell(value);
      });
      expectedRows.push(expectedRow);
    }

    const actualRows = extractMarkdownTableRowsByHeading(projectContextContent, spec.heading);
    if (actualRows === null) {
      errors.push(`${spec.name}: heading "${spec.heading}" missing in plans/project-context.md`);
      continue;
    }

    if (actualRows.length !== expectedRows.length) {
      errors.push(`${spec.name}: expected ${expectedRows.length} row(s) but found ${actualRows.length}`);
    }

    const rowCount = Math.min(actualRows.length, expectedRows.length);
    for (let i = 0; i < rowCount; i++) {
      const actual = actualRows[i].map(normalizeMarkdownCell);
      const expected = expectedRows[i];
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        errors.push(
          `${spec.name}: row ${i + 1} mismatch — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
        );
      }
    }
  }

  return { ok: errors.length === 0, errors };
}

/**
 * Validate that every "(N tools)" integer label declared in a registry agent's
 * tools_profile equals the actual length of that agent's tool array in
 * governance/tool-grants.json. Agents whose tools_profile carries no "(N tools)"
 * label are skipped. This catches drift like a label saying "(6 tools)" while
 * the grant array holds 7 entries.
 * @param {object} registryJson - Parsed governance/project-context-registry.json
 * @param {object} toolGrantsJson - Parsed governance/tool-grants.json
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validateToolCountLabelConsistency(registryJson, toolGrantsJson) {
  const errors = [];

  if (!registryJson || typeof registryJson !== 'object') {
    return { ok: false, errors: ['tool-count-label: project-context-registry JSON object missing'] };
  }
  if (!toolGrantsJson || typeof toolGrantsJson !== 'object') {
    return { ok: false, errors: ['tool-count-label: tool-grants JSON object missing'] };
  }

  const entries = registryJson.agent_role_matrix;
  if (!Array.isArray(entries) || entries.length === 0) {
    return { ok: false, errors: ['tool-count-label: agent_role_matrix[] missing or empty'] };
  }

  for (const [idx, entry] of entries.entries()) {
    if (!entry || typeof entry !== 'object') {
      errors.push(`tool-count-label: agent_role_matrix entry ${idx + 1} must be an object`);
      continue;
    }
    const agent = entry.agent;
    const toolsProfile = entry.tools_profile;
    if (typeof agent !== 'string' || agent.trim().length === 0) {
      errors.push(`tool-count-label: agent_role_matrix entry ${idx + 1} missing non-empty agent`);
      continue;
    }
    if (typeof toolsProfile !== 'string') {
      errors.push(`tool-count-label: "${agent}" tools_profile must be a string`);
      continue;
    }

    const labelMatch = toolsProfile.match(/\((\d+)\s+tools\)/);
    if (!labelMatch) {
      // No "(N tools)" label — skip per spec.
      continue;
    }
    const declaredCount = Number(labelMatch[1]);

    const grantKey = `${agent}.agent.md`;
    const grantArray = toolGrantsJson[grantKey];
    if (!Array.isArray(grantArray)) {
      errors.push(`tool-count-label: "${agent}" labels "(${declaredCount} tools)" but tool-grants has no array under "${grantKey}"`);
      continue;
    }
    if (grantArray.length !== declaredCount) {
      errors.push(`tool-count-label: "${agent}" labels "(${declaredCount} tools)" but tool-grants "${grantKey}" has ${grantArray.length} tool(s)`);
    }
  }

  return { ok: errors.length === 0, errors };
}

/**
 * Count the lines of text in a string using wc(1)-style semantics: a single
 * trailing newline does not add a phantom empty line.
 * @param {string} content
 * @returns {number}
 */
export function countTextLines(content) {
  if (typeof content !== 'string' || content.length === 0) return 0;
  const segments = content.split('\n');
  // A trailing newline yields a final empty segment that is not a real line.
  if (segments[segments.length - 1] === '') segments.pop();
  return segments.length;
}

/**
 * Enforce the skills library hard rule documented in skills/README.md and
 * skills/index.md: every skill pattern file (skills/patterns/*.md) must be
 * ≤100 lines. Reports each offending file with its actual line count so the
 * failure message is actionable. Line counting uses wc(1)-style semantics
 * (a single trailing newline is not counted as an extra line).
 * @param {string} patternsDir - Absolute path to the skills/patterns directory
 * @param {number} [maxLines=100] - Inclusive upper bound on lines per file
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validatePatternFileLineBudget(patternsDir, maxLines = 100) {
  const errors = [];

  let files = [];
  try {
    files = readdirSync(patternsDir).filter(f => f.endsWith('.md')).sort();
  } catch {
    return { ok: false, errors: [`pattern-line-budget: cannot read patterns directory "${patternsDir}"`] };
  }

  if (files.length === 0) {
    return { ok: false, errors: [`pattern-line-budget: no *.md pattern files found in "${patternsDir}"`] };
  }

  for (const file of files) {
    let content;
    try {
      content = readFileSync(join(patternsDir, file), 'utf8');
    } catch {
      errors.push(`pattern-line-budget: cannot read "${file}"`);
      continue;
    }
    const lineCount = countTextLines(content);
    if (lineCount > maxLines) {
      errors.push(`pattern-line-budget: "${file}" has ${lineCount} lines (limit ${maxLines})`);
    }
  }

  return { ok: errors.length === 0, errors };
}

// ── Check: doc-count-consistency ───────────────────────────────────────────────
// Assert that canonical hardcoded counts stated in docs match the REAL number of
// files on disk, so adding a schema/skill/governance/agent file forces the docs
// to be updated rather than silently drifting.
//
// Design constraints (deliberate, to keep this maintainable and false-positive free):
//   • Ground-truth counts are resolved at runtime from disk (no hardcoded truth).
//   • Only a SMALL, explicit allowlist of docs is scanned — the README plus the
//     tutorial index/quickstart/glossary files that state repo-wide totals.
//   • Only a TIGHT, explicit set of canonical phrase patterns is matched. We do
//     NOT build a general number extractor. Each pattern below is anchored to
//     avoid known collisions, in particular:
//       - "17 mirage patterns" / "17 patterns" / "17 паттернов" (AssumptionVerifier
//         mirage count) must NOT be read as the skills-pattern count.
//       - "10 portable skills, 6 agents" (claude-code plugin line in README) must
//         NOT be read as the repo skills/agents totals.
//     When a phrasing is ambiguous we prefer NOT matching it over guessing.
const DOC_COUNT_ALLOWLIST_FILES = [
  'README.md',
  'docs/tutorial-en/README.md',
  'docs/tutorial-ru/README.md',
  'docs/tutorial-en/01-quickstart.md',
  'docs/tutorial-ru/01-quickstart.md',
  'docs/tutorial-en/17-glossary.md',
  'docs/tutorial-ru/17-glossary.md',
];

// Each pattern's capture group 1 is the count asserted to equal truth[kind].
// Patterns are intentionally narrow; see the collision notes above.
const DOC_COUNT_PHRASE_PATTERNS = [
  // schemas → schemas/*.json
  { kind: 'schemas', re: /(\d+)\s+schemas\b/gi },                 // EN "17 schemas" / "17 schemas total"
  { kind: 'schemas', re: /(\d+)\s+JSON-схем/gi },                 // RU "17 JSON-схем"
  { kind: 'schemas', re: /(\d+)\s+схем\b/gi },                    // RU "17 схем" (\b excludes "схемы"/"схема")
  // governance → governance/*.json
  { kind: 'governance', re: /(\d+)\s+governance\b/gi },           // EN "7 governance files", RU "7 governance(-файлов)"
  // skills → skills/patterns/*.md
  { kind: 'skills', re: /(?<![≤<])(\d+)\s+skills\b(?!\s+per\b)/gi },// EN repo skills total (NOT "10 portable skills", NOT "≤3 skills per phase")
  { kind: 'skills', re: /pattern library \((\d+)\s+patterns\)/gi },// EN README pattern-library total
  // RU skills total: anchored (mirrors EN) to a same-line skill-library marker —
  // "Skill library ... N паттернов" (tutorial README) and "patterns/ ... N паттернов"
  // (quickstart tree). The Latin "skill"/"patterns/" anchor excludes a bare genitive
  // mirage like "17 паттернов" (AssumptionVerifier taxonomy) from being misread as 18.
  // Trailing (?![а-яё]) is the Cyrillic word boundary (JS \b is ASCII-only, so it never
  // matches after Cyrillic) — prevents matching longer forms like "паттерновых".
  { kind: 'skills', re: /(?:skill|patterns\/).*?(\d+)\s+паттернов(?![а-яё])/gi },
  // agents → root *.agent.md
  { kind: 'agents', re: /ControlFlow\s+\((\d+)\s+agents\)/gi },   // README "ControlFlow (13 agents)"
  { kind: 'agents', re: /All\s+(\d+)\s+agents\b/gi },             // "All 13 agents"
  { kind: 'agents', re: /(\d+)\s+agents in the ControlFlow system/gi },
  { kind: 'agents', re: /(\d+)\s+agents,/g },                     // glossary "13 agents, 17 schemas, ..."
  { kind: 'agents', re: /(\d+)\s+агентов\b/gi },                  // RU "13 агентов"
];

/**
 * Pure helper: scan a doc's text for canonical count phrases and report any that
 * disagree with the resolved ground-truth counts. Reports file:line + the matched
 * phrase + expected vs found. Used by validateDocCountConsistency and exercised
 * directly by the negative-path test with fabricated text.
 * @param {string} fileLabel - Display label (workspace-relative path) for diagnostics.
 * @param {string} text - Full file contents.
 * @param {{schemas:number, skills:number, governance:number, agents:number}} truthCounts
 * @returns {string[]} mismatch messages (empty when consistent)
 */
export function scanDocCountMismatches(fileLabel, text, truthCounts) {
  const mismatches = [];
  const lines = text.split('\n');
  for (const { kind, re } of DOC_COUNT_PHRASE_PATTERNS) {
    const truth = truthCounts[kind];
    if (typeof truth !== 'number') continue;
    for (let i = 0; i < lines.length; i++) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(lines[i])) !== null) {
        const found = Number(m[1]);
        if (found !== truth) {
          mismatches.push(
            `doc-count: ${fileLabel}:${i + 1} "${m[0].trim()}" states ${found} ${kind} but actual is ${truth}`
          );
        }
      }
    }
  }
  return mismatches;
}

/**
 * Assert that canonical hardcoded counts in the allowlisted docs match the real
 * number of files on disk. Ground-truth counts are resolved at runtime.
 * @param {string} repoRoot - Absolute path to the repository root.
 * @returns {{ ok: boolean, errors: string[], truth?: object }}
 */
export function validateDocCountConsistency(repoRoot) {
  const errors = [];
  let truth;
  try {
    truth = {
      schemas: readdirSync(join(repoRoot, 'schemas')).filter(f => f.endsWith('.json')).length,
      skills: readdirSync(join(repoRoot, 'skills', 'patterns')).filter(f => f.endsWith('.md')).length,
      governance: readdirSync(join(repoRoot, 'governance')).filter(f => f.endsWith('.json')).length,
      agents: readdirSync(repoRoot).filter(f => f.endsWith('.agent.md')).length,
    };
  } catch (e) {
    return { ok: false, errors: [`doc-count: cannot resolve ground-truth counts — ${e.message}`] };
  }

  for (const rel of DOC_COUNT_ALLOWLIST_FILES) {
    const abs = join(repoRoot, ...rel.split('/'));
    let content;
    try {
      content = readFileSync(abs, 'utf8');
    } catch {
      errors.push(`doc-count: allowlisted doc not found: ${rel}`);
      continue;
    }
    errors.push(...scanDocCountMismatches(rel, content, truth));
  }

  return { ok: errors.length === 0, errors, truth };
}

// ── Check: plugin-generation-parity ────────────────────────────────────────────
// Enforce that the controlflow-codex generated output matches its generation
// source (plugins/controlflow-shared-source) for every target the manifest marks
// as verbatim/no-delta (codex => allowed_deltas:false). This is a cross-platform
// Node mirror of plugins/controlflow-shared-source/scripts/sync-plugin-assets.ps1.
//
// Scope decisions (to avoid false drift):
//   • Only the codex host is verified. claude_code declares allowed_deltas:true
//     (legitimate divergence) and is intentionally NOT checked here.
//   • The "managed" file set is derived from the manifest source_path directories
//     in shared-source. Host-specific files that exist only in codex (e.g.
//     skills/<id>/agents/openai.yaml) are NOT part of the shared-source managed
//     set and are intentionally out of scope — exactly as the PowerShell validator
//     iterates only the manifest-declared expected files.
//   • If a target declares allowed_deltas:true or an override_path for codex, the
//     manifest legitimately permits divergence, so that target is skipped.
//   • Content hashes normalize line endings to \n before hashing to avoid CRLF
//     false-positives across platforms / git autocrlf checkouts.

function sha256Normalized(content) {
  const normalized = String(content).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  return createHash('sha256').update(normalized, 'utf8').digest('hex');
}

function walkFilesRelPosix(dir) {
  const out = [];
  const rec = (cur, prefix) => {
    for (const entry of readdirSync(cur, { withFileTypes: true })) {
      const abs = join(cur, entry.name);
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) rec(abs, rel);
      else out.push(rel);
    }
  };
  rec(dir, '');
  return out.sort();
}

/**
 * Verify codex generated-output parity against the shared-source generation source.
 * @param {string} pluginsRoot - Absolute path to the plugins/ directory.
 * @returns {{ ok: boolean, errors: string[], checked: number }}
 */
export function validatePluginGenerationParity(pluginsRoot) {
  const errors = [];
  const sharedRoot = join(pluginsRoot, 'controlflow-shared-source');
  const codexRoot = join(pluginsRoot, 'controlflow-codex');
  const manifestPath = join(sharedRoot, 'generation-manifest.json');

  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  } catch (e) {
    return { ok: false, errors: [`plugin-parity: cannot read generation-manifest.json — ${e.message}`], checked: 0 };
  }
  if (!Array.isArray(manifest.targets) || manifest.targets.length === 0) {
    return { ok: false, errors: ['plugin-parity: manifest.targets[] missing or empty'], checked: 0 };
  }

  let checked = 0;
  for (const target of manifest.targets) {
    const codexOut = target && target.host_outputs && target.host_outputs.codex;
    if (!codexOut) {
      errors.push(`plugin-parity: target "${target && target.source_path}" missing codex host output`);
      continue;
    }
    // Only verify verbatim (no-delta) codex outputs.
    if (codexOut.allowed_deltas !== false) continue;
    if (codexOut.override_path) continue;
    if (typeof target.source_path !== 'string' || typeof codexOut.dest_path !== 'string') {
      errors.push(`plugin-parity: target missing source_path/dest_path string`);
      continue;
    }

    const srcDir = join(sharedRoot, ...target.source_path.split('/'));
    const destDir = join(codexRoot, ...codexOut.dest_path.split('/'));
    if (!existsSync(srcDir)) {
      errors.push(`plugin-parity: shared-source dir missing: ${target.source_path}`);
      continue;
    }

    const managed = walkFilesRelPosix(srcDir);
    for (const rel of managed) {
      checked++;
      const destFile = join(destDir, ...rel.split('/'));
      if (!existsSync(destFile)) {
        errors.push(`plugin-parity: codex missing managed file ${codexOut.dest_path}/${rel}`);
        continue;
      }
      const srcHash = sha256Normalized(readFileSync(join(srcDir, ...rel.split('/')), 'utf8'));
      const destHash = sha256Normalized(readFileSync(destFile, 'utf8'));
      if (srcHash !== destHash) {
        errors.push(
          `plugin-parity: codex drift at ${codexOut.dest_path}/${rel} (content hash mismatch vs shared-source ${target.source_path}/${rel})`
        );
      }
    }
  }

  return { ok: errors.length === 0, errors, checked };
}

const PORTABILITY_DISPOSITIONS = new Set(['adopt', 'adapt', 'intentional_divergence']);

function isSafeRepoRelativePath(rel) {
  return typeof rel === 'string'
    && rel.length > 0
    && !/^[A-Za-z]:[\\/]/.test(rel)
    && !rel.startsWith('/')
    && !rel.startsWith('\\')
    && !rel.split(/[\\/]/).includes('..');
}

/**
 * Validate the selective core-to-plugin portability contract.
 * The matrix stores dispositions and evidence pointers; semantic anchors prove
 * that declared portable behavior or intentional divergence remains visible.
 * @param {string} repoRoot - Absolute or relative repository root.
 * @param {string} matrixRelativePath - Repo-relative matrix path.
 * @returns {{ ok: boolean, errors: string[], checked: number }}
 */
export function validatePluginCorePortability(
  repoRoot,
  matrixRelativePath = 'plugins/controlflow-shared-source/core-portability-matrix.json'
) {
  const errors = [];
  if (!isSafeRepoRelativePath(matrixRelativePath)) {
    return { ok: false, errors: [`core-portability: unsafe matrix path "${matrixRelativePath}"`], checked: 0 };
  }

  let matrix;
  try {
    matrix = JSON.parse(readFileSync(join(repoRoot, matrixRelativePath), 'utf8'));
  } catch (e) {
    return { ok: false, errors: [`core-portability: cannot read matrix — ${e.message}`], checked: 0 };
  }

  if (matrix.schema_version !== '1.0.0') {
    errors.push(`core-portability: unsupported schema_version "${matrix.schema_version}"`);
  }
  if (!Array.isArray(matrix.invariants) || matrix.invariants.length === 0) {
    return { ok: false, errors: [...errors, 'core-portability: invariants[] missing or empty'], checked: 0 };
  }

  const ids = new Set();
  const contentCache = new Map();
  const readEvidence = (rel, label) => {
    if (!isSafeRepoRelativePath(rel)) {
      errors.push(`core-portability: ${label} has unsafe repo-relative path "${rel}"`);
      return null;
    }
    if (contentCache.has(rel)) return contentCache.get(rel);
    try {
      const content = readFileSync(join(repoRoot, rel), 'utf8');
      contentCache.set(rel, content);
      return content;
    } catch {
      errors.push(`core-portability: ${label} missing evidence file "${rel}"`);
      return null;
    }
  };

  for (const invariant of matrix.invariants) {
    const id = invariant && invariant.id;
    if (typeof id !== 'string' || id.trim() === '') {
      errors.push('core-portability: invariant missing non-empty id');
      continue;
    }
    if (ids.has(id)) errors.push(`core-portability: duplicate invariant id "${id}"`);
    ids.add(id);

    if (!PORTABILITY_DISPOSITIONS.has(invariant.disposition)) {
      errors.push(`core-portability: "${id}" has invalid disposition "${invariant.disposition}"`);
    }
    if (typeof invariant.rationale !== 'string' || invariant.rationale.trim() === '') {
      errors.push(`core-portability: "${id}" missing rationale`);
    }

    const coreEvidence = Array.isArray(invariant.core_evidence) ? invariant.core_evidence : [];
    const pluginEvidence = Array.isArray(invariant.plugin_evidence) ? invariant.plugin_evidence : [];
    const evidenceSet = new Set([...coreEvidence, ...pluginEvidence]);
    if (coreEvidence.length === 0) errors.push(`core-portability: "${id}" missing core_evidence[]`);
    if (pluginEvidence.length === 0) errors.push(`core-portability: "${id}" missing plugin_evidence[]`);
    for (const rel of coreEvidence) readEvidence(rel, `"${id}" core_evidence`);
    for (const rel of pluginEvidence) readEvidence(rel, `"${id}" plugin_evidence`);

    const requirements = Array.isArray(invariant.required_anchors) ? invariant.required_anchors : [];
    if (requirements.length === 0) errors.push(`core-portability: "${id}" missing required_anchors[]`);
    for (const requirement of requirements) {
      const rel = requirement && requirement.path;
      const anchors = requirement && Array.isArray(requirement.anchors) ? requirement.anchors : [];
      if (!evidenceSet.has(rel)) {
        errors.push(`core-portability: "${id}" anchor path "${rel}" is not declared as evidence`);
      }
      if (anchors.length === 0 || anchors.some(anchor => typeof anchor !== 'string' || anchor.length === 0)) {
        errors.push(`core-portability: "${id}" anchor requirement for "${rel}" has no valid anchors`);
        continue;
      }
      const content = readEvidence(rel, `"${id}" required_anchors`);
      if (content === null) continue;
      for (const anchor of anchors) {
        if (!content.includes(anchor)) {
          errors.push(`core-portability: "${id}" missing semantic anchor "${anchor}" in "${rel}"`);
        }
      }
    }
  }

  return { ok: errors.length === 0, errors, checked: matrix.invariants.length };
}

// ── Check #N: CLAUDE.md ↔ planner plan contract drift ─────────────────────────
// Remediation Phase 4 — ensures the human-facing control doc (CLAUDE.md) never
// drifts from the machine-enforced plan contract in schemas/planner.plan.schema.json,
// governance/project-context-registry.json, and governance/runtime-policy.json.

function extractYamlHeaderField(content, key) {
  const fenceMatch = content.match(/^```yaml\r?\n([\s\S]*?)\r?\n```/m);
  if (!fenceMatch) return null;
  const match = fenceMatch[1].match(new RegExp(`^${key}:\\s*(.+?)\\s*$`, 'm'));
  return match ? match[1].trim() : null;
}

function extractConfidenceThreshold(content) {
  const match = content.match(/below\s+([0-9]+(?:\.[0-9]+)?)/i);
  return match ? parseFloat(match[1]) : null;
}

function extractExecutorEnumFromClaude(content) {
  // Matches a sentence like:
  // Every phase declares exactly one `executor_agent` from: `A`, `B`, `C`
  const match = content.match(/executor_agent[^\n]*from:\s*(`[A-Za-z-]+-subagent`(?:\s*,\s*`[A-Za-z-]+-subagent`)*)/);
  if (!match) return [];
  return [...match[1].matchAll(/`([A-Za-z-]+-subagent)`/g)].map(m => m[1]);
}

/**
 * Validate that a CLAUDE.md-shaped control document matches the canonical plan
 * contract declared in the planner schema, project-context registry, and runtime
 * policy.
 * @param {string} claudeMdContent - Full CLAUDE.md text.
 * @param {object} plannerSchema - Parsed schemas/planner.plan.schema.json.
 * @param {object} projectContextRegistry - Parsed governance/project-context-registry.json.
 * @param {object} runtimePolicy - Parsed governance/runtime-policy.json.
 * @returns {{ ok: boolean, errors: string[], checked: number }}
 */
export function checkControlFlowContractDrift(claudeMdContent, plannerSchema, projectContextRegistry, runtimePolicy) {
  const errors = [];
  let checked = 0;

  const expectedAgent = plannerSchema?.properties?.agent?.const;
  const expectedSchemaVersion = plannerSchema?.properties?.schema_version?.const;
  const expectedExecutors = Array.isArray(projectContextRegistry?.phase_executor_agents)
    ? projectContextRegistry.phase_executor_agents.map(a => a.agent).filter(Boolean)
    : [];
  const expectedConfidence = runtimePolicy?.plan_review_gate_trigger_conditions?.confidence_threshold;

  if (typeof expectedAgent !== 'string') {
    errors.push('contract-drift: planner schema missing properties.agent.const');
  }
  if (typeof expectedSchemaVersion !== 'string') {
    errors.push('contract-drift: planner schema missing properties.schema_version.const');
  }
  if (expectedExecutors.length === 0) {
    errors.push('contract-drift: project-context registry missing phase_executor_agents');
  }
  if (typeof expectedConfidence !== 'number') {
    errors.push('contract-drift: runtime-policy missing plan_review_gate_trigger_conditions.confidence_threshold');
  }
  if (errors.length > 0) {
    return { ok: false, errors, checked: 0 };
  }

  // Agent
  checked++;
  const agent = extractYamlHeaderField(claudeMdContent, 'Agent');
  if (agent === null) {
    errors.push('contract-drift: CLAUDE.md header missing Agent field');
  } else if (agent !== expectedAgent) {
    errors.push(`contract-drift: CLAUDE.md Agent "${agent}" does not match planner schema const "${expectedAgent}"`);
  }

  // Schema Version
  checked++;
  const schemaVersion = extractYamlHeaderField(claudeMdContent, 'Schema Version');
  if (schemaVersion === null) {
    errors.push('contract-drift: CLAUDE.md header missing Schema Version field');
  } else if (schemaVersion !== expectedSchemaVersion) {
    errors.push(`contract-drift: CLAUDE.md Schema Version "${schemaVersion}" does not match planner schema const "${expectedSchemaVersion}"`);
  }

  // Confidence threshold
  checked++;
  const confidence = extractConfidenceThreshold(claudeMdContent);
  if (confidence === null) {
    errors.push('contract-drift: CLAUDE.md missing confidence threshold phrase (e.g. "below 0.9")');
  } else if (confidence !== expectedConfidence) {
    errors.push(`contract-drift: CLAUDE.md confidence threshold ${confidence} does not match runtime-policy ${expectedConfidence}`);
  }

  // Executor enum
  checked++;
  const executors = extractExecutorEnumFromClaude(claudeMdContent);
  const executorSet = new Set(executors);
  const expectedSet = new Set(expectedExecutors);
  const missing = expectedExecutors.filter(a => !executorSet.has(a));
  const extra = executors.filter(a => !expectedSet.has(a));
  if (executors.length === 0) {
    errors.push('contract-drift: CLAUDE.md missing executor_agent enum sentence');
  } else {
    if (missing.length > 0) {
      errors.push(`contract-drift: CLAUDE.md executor enum missing [${missing.join(', ')}]`);
    }
    if (extra.length > 0) {
      errors.push(`contract-drift: CLAUDE.md executor enum has unexpected [${extra.join(', ')}]`);
    }
  }

  return { ok: errors.length === 0, errors, checked };
}
