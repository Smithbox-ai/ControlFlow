# Глава 04 — Структура P.A.R.T.

## Зачем эта глава

Понять обязательную структуру **любого** агентского файла в ControlFlow. После этой главы вы сможете прочитать новый `*.agent.md` и моментально найти ответ на любой вопрос о его поведении, правах и контрактах.

## Что такое P.A.R.T.

**P.A.R.T.** — это аббревиатура из четырёх обязательных секций агентского файла, идущих в строго фиксированном порядке:

| Буква | Секция | Содержит |
|-------|--------|---------|
| **P** | **Prompt** | Миссия, scope, контракты, правила, abstention |
| **A** | **Archive** | Continuity, compaction, memory, PreFlect |
| **R** | **Resources** | Канонические доки и схемы |
| **T** | **Tools** | Allowed/disallowed tools, правила выбора |

Источник: [docs/agent-engineering/PART-SPEC.md](../agent-engineering/PART-SPEC.md).

> **Цитата из спецификации:** «Agents must keep this exact order. Missing or reordered sections are non-compliant.»

Несоблюдение порядка приводит к **провалу drift-проверки** в eval-харнессе (`evals/drift-detection.test.mjs`).

## Зачем фиксированный порядок

- **Предсказуемость** — вы открываете файл и сразу знаете, где искать миссию, где tools, где skills.
- **Автоматизация** — drift-чекер парсит структуру и валидирует наличие/порядок секций.
- **Безопасность** — раздел Tools всегда последний, что облегчает аудит привилегий.
- **Согласованность с governance** — поля frontmatter и секции жёстко связаны с `governance/agent-grants.json` и `governance/tool-grants.json`.

## Структура каждой секции

### P — Prompt

Сердце агентского файла. Содержит:

- **Mission** — одно предложение, фиксирующее назначение агента.
- **Scope IN / Scope OUT** — что агент делает / **не** делает.
- **Deterministic Contracts** — ссылки на схемы выхода.
- **State Machine** (опционально для дирижёров) — диаграмма состояний.
- **Planning vs Acting Split** — жёсткое правило, нельзя смешивать дизайн и исполнение.
- **PreFlect** — обязательный pre-action гейт (см. ниже).
- **Approval Gate** — когда требуется человеческое одобрение.
- **Clarification Triggers** — когда вызывать `vscode/askQuestions`.
- **Delegation Heuristics** (для дирижёров) — кому делегировать.
- **Abstention Rule** — когда возвращать ABSTAIN вместо угадывания.
- **Output Discipline** — структурированный текст, не raw JSON.

### A — Archive

Политики, обеспечивающие устойчивость агента в долгих сессиях:

- **Context Compaction Policy** — что сохранять, что отбрасывать при приближении к лимиту контекста.
- **Agentic Memory Policy** — куда писать (session / task-episodic / repo-persistent).
- **State Tracking** (для Orchestrator) — какие поля удерживать в памяти.
- **Observability Sink** — куда сливать gate-events для трассировки.

### R — Resources

Список **канонических** документов и схем, которые агент должен знать:

- Schemas, которые агент эмитирует или читает.
- Governance-доки, релевантные его роли.
- Plan / project context файлы.
- Skills, которые он гарантированно использует.

Этот раздел — **не** индекс всего репозитория. Только то, что агент использует напрямую.

### T — Tools

- **Allowed** — какие тулзы агенту разрешены.
- **Disallowed** — что явно запрещено.
- **Tool Selection Rules** — порядок предпочтения (например, «сначала локальный поиск, потом fetch»).
- **External Tool Routing** — правила для `web/fetch`, `vscode/askQuestions` и т.п.

Должен быть **синхронизирован** с `governance/tool-grants.json` и `governance/agent-grants.json`. Drift-чекер ловит расхождения.

## Frontmatter

Перед секциями P.A.R.T. всегда идёт YAML-frontmatter. Обязательные поля:

```yaml
---
description: Краткое описание роли агента
agents: [список агентов, к которым этот может делегировать; для не-orchestrator — пустой]
tools: [список MCP-тулз]
model: GPT-5.5 (copilot)
model_role: capable-planner
---
```

- **`description`** — попадает в UI VS Code Copilot Chat.
- **`tools`** — должен соответствовать `governance/tool-grants.json` для этого агента.
- **`model_role`** — логическая роль из `governance/model-routing.json` (см. [главу 10](10-governance.md)).
- **`model`** — требуется ТОЛЬКО для закреплённых (pinned) агентов (Orchestrator, Planner, PlanAuditor, AssumptionVerifier); для auto-агентов (по умолчанию) он ОПУСКАЕТСЯ, и модель выбирает picker Copilot. Если поле присутствует, оно должно совпадать с `primary` роли. Пример выше — закреплённый случай `capable-planner`; auto-агент опускает `model:` и оставляет только свой `model_role:` (например, `model_role: research-capable`).

## Полный мини-пример

```markdown
---
description: Demo agent that does nothing useful
agents: []
tools: [search/codebase, read/file]
model_role: research-capable
---

You are DemoAgent, a minimal example for tutorial purposes.

<!-- DemoAgent — auto-агент (по умолчанию): он опускает `model:`, и модель выбирает picker Copilot. Закреплённый агент вместо этого добавил бы совпадающую строку `model:`, например `model: GPT-5.5 (copilot)` с `model_role: capable-planner`. -->

## Prompt

### Mission
Read a file and return a one-line summary.

### Scope IN
- File reading.
- Single-line summarization.

### Scope OUT
- Writing files.
- Multi-file analysis.

### Abstention Rule
If the file is binary or empty, return ABSTAIN.

### Output Discipline
Return structured text with fields: file_path, summary, status.

## Archive

### Context Compaction Policy
Drop file content after summarization; keep only the summary.

### Agentic Memory Policy
- Session: store the request.
- Task-episodic: not used.
- Repo-persistent: not used.

## Resources

- `schemas/demo.schema.json` (hypothetical)

## Tools

### Allowed
- `search/codebase`
- `read/file`

### Disallowed
- Any write operation.

### Tool Selection Rules
1. Prefer `search/codebase` for finding the file.
2. Use `read/file` only on resolved paths.
```

## Drift-проверки eval-харнесса

`evals/drift-detection.test.mjs` проверяет следующее на **каждом** агентском файле:

| Проверка | Что ловит |
|----------|----------|
| Section order | Секции P → A → R → T в правильном порядке. |
| Section presence | Все 4 секции присутствуют. |
| Frontmatter completeness | Поля `description`, `tools`, `model_role` заполнены; `model` присутствует только у закреплённых агентов и отсутствует у auto-агентов (по умолчанию). |
| Tools sync | `tools:` frontmatter ↔ `governance/tool-grants.json`. |
| Schema references | Каждая упомянутая схема существует. |
| PreFlect presence | Каждый агент содержит ссылку на `skills/patterns/preflect-core.md`. |

Это значит: добавив новый агент или поменяв старый, **всегда** запускайте `cd evals && npm test`.

## Принцип «just-in-time loading»

Заметьте: раздел Resources не загружается в контекст автоматически. Агент **сам** решает, какой документ прочитать в нужный момент через `read/file`. Это существенно экономит контекст-бюджет.

Аналогично — schema из Resources цитируется как контракт, но не подгружается целиком в каждый запрос. Агент знает, что такой-то контракт существует, и читает его по необходимости.

## Типичные ошибки

- **Перепутать порядок** (например, Resources перед Archive) → drift fail.
- **Забыть PreFlect-ссылку** → нарушение [skills/patterns/preflect-core.md](../../skills/patterns/preflect-core.md).
- **Описать tool в `tools:` frontmatter, но не зарегистрировать в `governance/tool-grants.json`** → desync.
- **Раздуть Resources списком всего репозитория** → пустая трата токенов; держите минимум.
- **Дублировать каноническую спеку** в Archive вместо ссылки → расхождение при изменениях.

## Упражнения

1. **(новичок)** Откройте `Researcher-subagent.agent.md`. Найдите границы каждой из 4 секций. Запишите номера строк.
2. **(новичок)** Найдите в `Orchestrator.agent.md` раздел `State Machine`. В какой секции он находится?
3. **(средний)** Откройте `governance/tool-grants.json` и сравните `Researcher-subagent` с frontmatter-полем `tools` в `Researcher-subagent.agent.md`. Совпадает?
4. **(средний)** Прочитайте [docs/agent-engineering/PART-SPEC.md](../agent-engineering/PART-SPEC.md) → раздел «Compliance Checklist». Сколько пунктов?
5. **(продвинутый)** Создайте на бумаге заглушку нового агента «LinkChecker-subagent», который проверяет ссылки в Markdown. Какие тулзы ему нужны? Какие схемы? Какой PreFlect-риск-класс важнее всего?

## Контрольные вопросы

1. Расшифруйте P.A.R.T. и приведите порядок секций.
2. Что произойдёт, если вы поменяете местами Archive и Resources?
3. Где описан обязательный pre-action гейт PreFlect?
4. Почему Resources — короткий список, а не полный индекс репозитория?
5. Какой файл governance синхронизирован с frontmatter-полем `tools`?

## См. также

- [Глава 03 — Реестр агентов](03-agent-roster.md)
- [Глава 09 — Схемы](09-schemas.md)
- [Глава 10 — Governance](10-governance.md)
- [docs/agent-engineering/PART-SPEC.md](../agent-engineering/PART-SPEC.md)
