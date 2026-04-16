# Observability — Cross-Agent Trace Correlation

## Purpose

ControlFlow delegates a single user task across up to 13 agents. Without a shared correlation identifier, reconstructing end-to-end execution requires joining disparate log formats by timestamp heuristics. `trace_id` is the single field that threads every delegation, gate event, and execution report for one task.

## Generation

- The **Orchestrator** generates exactly one `trace_id` per top-level task.
- Format: **UUIDv4** (lowercase, canonical 8-4-4-4-12 form).
- Generated at task intake, before the first subagent dispatch.
- A `trace_id` is never reused across tasks, and never regenerated mid-task.

## Propagation

1. Orchestrator writes `trace_id` into every delegation payload.
2. Each subagent copies the received `trace_id` into its return report (optional but recommended).
3. Orchestrator writes `trace_id` into every emitted gate event.
4. Planner carries `trace_id` forward when authoring a plan for a traced task.

## Schema Surface

### Required

- `schemas/orchestrator.delegation-protocol.schema.json` — `trace_id` required in every delegation branch.
- `schemas/orchestrator.gate-event.schema.json` — `trace_id` required on every gate event.

### Optional (additive, no fixture breakage)

The following 13 schemas accept `trace_id` as an optional `string` with `format: uuid`:

- `core-implementer.execution-report`
- `ui-implementer.execution-report`
- `platform-engineer.execution-report`
- `technical-writer.execution-report`
- `browser-tester.execution-report`
- `executability-verifier.execution-report`
- `code-reviewer.verdict`
- `plan-auditor.plan-audit`
- `assumption-verifier.plan-audit`
- `code-mapper.discovery`
- `researcher.research-findings`
- `clarification-request`
- `planner.plan`

Optional means: agents **may** include `trace_id` for correlation, but legacy reports without it remain schema-valid. `required` arrays were not modified.

## Event Sink Convention

Observability events are appended to a per-task NDJSON file under the directory `plans/artifacts/observability/`. The filename convention is `<task-id>.ndjson` (one file per task).

One JSON object per line. Each line conforms to this shape:

```json
{
  "trace_id": "550e8400-e29b-41d4-a716-446655440000",
  "ts": "2026-04-16T12:34:56.789Z",
  "agent": "CoreImplementer-subagent",
  "phase": 5,
  "event_type": "execution_report",
  "payload": { "status": "COMPLETE", "confidence": 0.95 }
}
```

Field conventions:

- `trace_id` — UUIDv4, matches the task's single generated identifier.
- `ts` — ISO-8601 UTC timestamp with millisecond precision.
- `agent` — the emitting agent's canonical name (matches `agent` field in schemas).
- `phase` — integer phase index from the active plan, or `null` if not phase-scoped.
- `event_type` — one of `delegation`, `gate_event`, `execution_report`, `clarification_request`, `plan_audit`, `verdict`, `discovery`, `research_findings`.
- `payload` — the structured event body (typically the schema-validated object).

The NDJSON sink is **write-append only**. Agents never read from it for control flow; it exists for post-hoc analysis and external forwarding.

## Future Hook: OpenTelemetry

The NDJSON format is a forward-compatible superset of OpenTelemetry span attributes:

- `trace_id` maps directly to OTel `trace_id` (UUIDv4 is accepted as a 128-bit trace id representation).
- `ts` maps to OTel `start_time_unix_nano` after format conversion.
- `agent` + `event_type` compose OTel `span.name`.
- `payload` maps to OTel span `attributes`.

A future runtime can tee each NDJSON line to an OTel collector without modifying any schema or agent contract. No migration is required for existing artifacts; pre-OTel NDJSON remains valid task history.

## Non-Goals

- No synchronous tracing backend is required in the current repo.
- No agent is required to emit NDJSON today; the sink is a convention, not a gate.
- `trace_id` is not a security boundary. Do not use it for authorization or access control.
