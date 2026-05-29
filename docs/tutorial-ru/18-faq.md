# Глава 18 — FAQ

> Сложные вопросы, которые задают чаще всего. Ответы со ссылками на главы и файлы.

---

## Концептуальные

### 1. Зачем нужен AssumptionVerifier, если есть PlanAuditor?

Они смотрят план под **разными углами** и часто находят разные дефекты:

- **PlanAuditor** — adversarial reviewer для **архитектуры, безопасности, риска и completeness**. Спрашивает: «А не проявил ли план слепых пятен в дизайне? Не пропустил ли security-гайдлайн? Покрыты ли все требования?».
- **AssumptionVerifier** — mirage detector для **assumption-fact confusion**. Спрашивает: «А не выдал ли Planner предположение за установленный факт? Где evidence для этого утверждения?».

Они **дополняют** друг друга. PlanAuditor может одобрить план, в котором есть скрытое предположение, что библиотека X поддерживает feature Y — а AssumptionVerifier именно эту mirage-эту найдёт. Поэтому на тире MEDIUM/LARGE они работают **параллельно**.

→ [Глава 07](07-review-pipeline.md).

---

### 2. Когда использовать ABSTAIN, а когда REPLAN_REQUIRED?

Оба — терминальные статусы Planner-а, но **смысл разный**:

- **ABSTAIN** = «я не могу безопасно дать план». Уточнения исчерпаны, но всё равно слишком много неизвестного. Обычно идёт назад к пользователю.
- **REPLAN_REQUIRED** = «план явно нужно переработать». Обычно эмиттится **во время уже исполняющегося плана** (например, после `failure_classification: needs_replan`). Сигнал Planner-у вернуться к фазе с конкретным fix-hint-ом.

Простое правило: ABSTAIN — «не знаю как делать», REPLAN_REQUIRED — «знаю, что переделать».

→ [Глава 06](06-planning.md), [Глава 13](13-failure-taxonomy.md).

---

### 3. Почему Planner не вызывает ревьюеров сам?

**Разделение ответственности:**

- Planner — **автор**. Его работа — написать лучший возможный план.
- Orchestrator — **координатор**. Его работа — решать, нужно ли ревью, кому делегировать, как маршрутизировать findings.

Если бы Planner сам вызывал PlanAuditor, он стал бы судьёй своих собственных плановых решений. Это нарушает принцип independence. Также Orchestrator имеет глобальный контекст (тиры, governance, retry-budgets) — Planner не должен дублировать эту логику.

Принципиально: **Planner authors plans; Orchestrator governs their review and execution**.

→ [.github/copilot-instructions.md](../../.github/copilot-instructions.md), [Глава 05](05-orchestration.md).

---

### 4. Почему PLAN_REVIEW нет в `workflow_state` enum?

**PLAN_REVIEW — это лейбл стадии в промпте Orchestrator-а**, а не самостоятельное состояние state machine. Его операционный wire-эквивалент — это серия событий с `event_type: PHASE_REVIEW_GATE`, эмитящихся **во время** `workflow_state: WAITING_APPROVAL` (или промежуточно).

Иными словами: «PLAN_REVIEW» — это **что мы делаем**, а `workflow_state` — это **в каком статусе machine находится**. Schema enum зафиксирован как 5 значений (PLANNING/WAITING_APPROVAL/ACTING/REVIEWING/COMPLETE) и это часть стабильного контракта.

→ [Глава 09](09-schemas.md), [`schemas/orchestrator.gate-event.schema.json`](../../schemas/orchestrator.gate-event.schema.json).

---

### 5. Чем `failure_classification` отличается от `clarification_request`?

Это **разные routing paths**, не варианты одного:

- **`failure_classification`** возникает, когда subagent **не смог завершить** (FAILED/NEEDS_REVISION/REJECTED). Routing — через таблицу retry/escalate.
- **`clarification_request`** возникает, когда subagent **успешно дошёл до развилки и хочет user input** (NEEDS_INPUT). Routing — всегда через `vscode/askQuestions`.

Даже если одновременно присутствует и `failure_classification`, и `clarification_request` — clarification path **первичен**: сначала спросить пользователя, потом смотреть, что делать с failure.

→ [Глава 13](13-failure-taxonomy.md), [Глава 15](15-case-studies.md).

---

### 6. Что такое «governance побеждает промпт»?

Если в `*.agent.md` написано одно, а в `governance/runtime-policy.json` — другое (по operational параметрам), authoritative — **governance**. Это нужно, потому что:
- Governance можно менять без переписывания промптов.
- Промпты могут отстать от обновлённой политики.
- Eval-харнесс синхронизирует governance с реальным поведением.

Из `Orchestrator.agent.md`: «governance/runtime-policy.json is the authoritative source for trigger thresholds, tier routing, max_iterations, and retry budgets».

→ [Глава 10](10-governance.md).

---

### 7. Почему skill — это не пример кода?

Skill в ControlFlow — это **инструкция для агента**, как правильно действовать в домене. Если бы skill был примером кода, он бы:
- Приводил к слепому копированию.
- Устаревал быстрее.
- Не объяснял **почему**.

Skill объясняет **принципы и паттерны**, чтобы агент мог их применить к **своему** контексту. Например, `tdd-patterns.md` не показывает «вот так выглядит unit test», а описывает «вот как организуется red-green-refactor цикл, что тестировать, а что нет».

→ [Глава 11](11-skills.md).

---

### 8. Почему ≤3 skills на фазу?

Эмпирический лимит. Если фаза требует >3 skills — это сигнал, что:
- Фаза слишком широкая (нужно разделить).
- Или skill слишком общий (нужно конкретизировать).
- Или контекст-окно агента будет перегружено.

3 skill-паттерна — это уже значительный объём чтения для имплементера. Больше — превращает инструктаж в шум.

→ [Глава 11](11-skills.md).

---

### 9. Почему PA и AV не возвращают `transient`?

Их работа — **содержательный** анализ плана. Если PA «упал по timeout-у» — это не классифицируется как «flaky review». Либо PA нашёл проблему, либо нет. Statistically-flaky review подорвал бы всю надёжность ревью-пайплайна.

Поэтому governance запрещает им возвращать transient. Если PA реально не смог выполниться (например, infrastructure issue) — это уже escalate.

→ [Глава 13](13-failure-taxonomy.md).

---

### 10. Что такое «reviewable input vs implicit approval»?

Когда Planner передаёт план через `plan_path`, Orchestrator получает **указание на артефакт**, а не **разрешение на исполнение**. Orchestrator всё равно:
- Прочитает план.
- Проверит триггеры PLAN_REVIEW.
- Соблюдёт complexity-routing.
- Запросит approval у пользователя.

Если бы plan_path считался implicit approval, LARGE-планы пропустили бы PLAN_REVIEW — что было бы серьёзной дырой.

→ [Глава 05](05-orchestration.md), [Глава 15](15-case-studies.md).

---

## Технические

### 11. Какая каноническая команда верификации?

```sh
cd evals && npm test
```

Запускает полный оффлайн набор проверок: schemas + behavior + handoff + drift. CI выполняет ровно её. → [Глава 14](14-evals.md).

---

### 12. Что произойдёт, если `executor_agent` не указан в фазе?

Orchestrator **не угадывает**. Из политики: «If a legacy phase omits `executor_agent`, do not infer silently. Route the plan back through `REPLAN` to Planner and stop the implementation batch until the phase is reissued with an explicit executor».

→ [Глава 06](06-planning.md), [Глава 08](08-execution-pipeline.md).

---

### 13. Что такое regression tracking в Plan Review?

На итерации 1 PA verifies некоторые items как «fine». На итерации 2 PA получает этот список как контекст. Если **ранее verified** item теперь fails — это автоматический BLOCKING regression.

Профилактика: Planner не должен «ломать» уже одобренные части плана при revision.

→ [Глава 07](07-review-pipeline.md).

---

### 14. Что происходит после `escalate`?

1. Orchestrator транзит в `WAITING_APPROVAL`.
2. Эмитит `HIGH_RISK_APPROVAL_GATE` event с findings.
3. Показывает пользователю накопленные evidence.
4. Ждёт явного решения. Никаких retry.

→ [Глава 05](05-orchestration.md), [Глава 13](13-failure-taxonomy.md).

---

### 15. Где живут per-task артефакты vs повторно-используемые знания?

| Тип | Где |
|-----|-----|
| Plan artifact | `plans/<task-slug>-plan.md` |
| Plan artifacts (history, observability) | `plans/artifacts/<task-slug>/` |
| Active objective | `NOTES.md` |
| Repo conventions, commands | `/memories/repo/` |
| Skill patterns | `skills/patterns/` |

→ [Глава 12](12-memory.md).

---

### 16. Что такое 4 risk-класса PreFlect?

1. **Scope drift** — выходим ли за рамки задачи?
2. **Schema/contract drift** — нарушим ли контракт между агентами?
3. **Missing evidence** — есть ли доказательства для GO?
4. **Safety/destructive** — нужна ли авторизация для irreversible действий?

Decision output: GO / REPLAN / ABSTAIN.

→ [Глава 11](11-skills.md), [skills/patterns/preflect-core.md](../../skills/patterns/preflect-core.md).

---

### 17. Когда `final_review_gate` активируется автоматически?

Когда:
- `enabled_by_default: true` в `governance/runtime-policy.json` **или**
- `complexity_tier` плана входит в `auto_trigger_tiers` (по умолчанию — LARGE) **или**
- Пользователь явно запросил.

Активация даёт CodeReviewer-у в `review_scope: "final"` агрегированный список изменённых файлов и snapshot фаз.

→ [Глава 08](08-execution-pipeline.md).

---

### 18. Кто owns fix-cycle при final review BLOCKING?

CodeReviewer **никогда** не fix-ит. Owner определяется правилом:

> **highest phase_id wins**: фаза с наибольшим `phase_id`, в чьём `files[]` встречается affected file, — это executor для fix.

Orchestrator dispatchит этого executor-а с targeted scope. Re-run CodeReviewer (final mode), max 1 fix cycle. Если опять blocking — escalate.

→ [Глава 08](08-execution-pipeline.md), [Глава 15](15-case-studies.md).

---

### 19. Почему trace_id — UUIDv4?

Стандартизованный формат для:
- Корреляции логов между агентами в одной задаче.
- Уникальности без центрального генератора.
- Совместимости с observability-стек tools.

Trace_id создаётся Orchestrator-ом в начале и пробрасывается во **все** gate-events и delegation payloads.

→ [Глава 05](05-orchestration.md), [Глава 12](12-memory.md).

---

### 20. Почему `additionalProperties: false` во всех schemas?

Защита от silent контрактных drift. Если агент A начнёт эмиттить лишнее поле X, валидация упадёт — и проблема будет поймана **до** того, как агент B начнёт неявно полагаться на X.

→ [Глава 09](09-schemas.md).

---

## Операционные

### 21. Что делать, если CI упал?

1. Сначала запустить `cd evals && npm test` локально.
2. Прочитать failure: какой pass / какой файл / какое правило.
3. Чаще всего — пропущено обновление `tool-grants.json`, `rename-allowlist.json` или дрейф P.A.R.T.
4. Поправить, перезапустить локально, push.

→ [Глава 14](14-evals.md).

---

### 22. Можно ли поменять модель агента?

Да, но через governance:
1. Обновить `model:` в frontmatter агента (литеральная строка).
2. Обновить `model_role:` если меняется логическая роль.
3. Обновить `governance/model-routing.json` если меняется mapping.
4. `cd evals && npm test`.

→ [Глава 10](10-governance.md).

---

### 23. Можно ли пропустить approval gate?

**Нет**. Approval gate — non-negotiable правило. Из политики: «No gate skipping». Это включает:
- Approval после plan.
- Approval после каждого phase review.
- Approval перед completion.
- Approval перед любой destructive операцией.

→ [Глава 05](05-orchestration.md).

---

### 24. Что такое 7 категорий semantic risk?

Из `plans/project-context.md` — Semantic Risk Taxonomy:

1. Cross-cutting consistency
2. Data integrity / migration
3. Backward compatibility
4. Security / authentication / authorization
5. Performance / scalability
6. Operational / observability
7. UX / accessibility

Каждый план в `risk_review[]` явно адресует все 7 со статусом (`addressed` / `not_applicable` / `LOW` / `MEDIUM` / `HIGH`).

→ [Глава 06](06-planning.md), [plans/project-context.md](../../plans/project-context.md).

---

### 25. Можно ли добавить нового агента?

Да, по процессу добавления агента из `CONTRIBUTING.md`. Кратко:
1. Создать `<NewAgent>.agent.md` с P.A.R.T. структурой.
2. Создать `schemas/<new-agent>.<output>.schema.json`.
3. Зарегистрировать в `plans/project-context.md` (если не review-only).
4. Добавить в governance grants и сценарии в `evals/scenarios/`.

→ [CONTRIBUTING.md](../../CONTRIBUTING.md), [Глава 14](14-evals.md).

---

## Философские

### 26. Почему такой строгий процесс?

Главная цель ControlFlow — **детерминизм и надёжность** multi-agent оркестрации. Хаотичный flow = плохие результаты, дорогие undo, потерянное доверие. Жёсткие гейты, контракты, валидация — всё это плата за **повторяемость**.

→ [Глава 00](00-introduction.md).

---

### 27. Почему нет «авто-merge» или «авто-deploy»?

Approval gate перед completion. Принципы:
- Никаких silent destructive действий.
- Никаких speculative success claims.
- User всегда last gatekeeper.

ControlFlow — **engineering acceleration**, не automation-без-надзора.

→ [Глава 05](05-orchestration.md).

---

### 28. Это можно использовать вне ControlFlow-репо?

ControlFlow сейчас — **prompts/governance/eval репо**, не runtime engine. Чтобы применить к другому проекту, нужно:
- Скопировать агентские файлы (`*.agent.md`) и схемы.
- Адаптировать governance под свои тулзы.
- Настроить eval-харнесс под свой контент.

См. [docs/agent-engineering/AGENT-AS-TOOL.md](../agent-engineering/AGENT-AS-TOOL.md) для будущей MCP-style экспозиции.

→ [Глава 00](00-introduction.md).

---

## См. также

- [Глава 17 — Глоссарий](17-glossary.md)
- [Глава 16 — Упражнения](16-exercises.md)
- [README пособия](README.md)
- [docs/agent-engineering/](../agent-engineering/)
