# Глава 16 — Упражнения

## Как использовать главу

Упражнения сгруппированы по уровням: **🟢 новичок** / **🟡 средний** / **🔴 продвинутый**. Каждое имеет:
- **Цель** — что должно стать понятно.
- **Шаги** — что делать.
- **Подсказка** — где смотреть.
- **Критерий** — как понять, что сделано.

Большинство упражнений **read-only**: открываете файлы, отвечаете на вопросы. Несколько требуют запуска `cd evals && npm test`.

---

## 🟢 Упражнение 1 — Карта репо

**Цель:** ориентироваться в структуре.

**Шаги:**
1. Откройте корень репо.
2. Выпишите все агентские файлы (паттерн `*.agent.md`).
3. Откройте `governance/` — выпишите 7 файлов.
4. Откройте `schemas/` — посчитайте JSON-файлы.

**Подсказка:** [Глава 02](02-architecture-overview.md), [Глава 03](03-agent-roster.md).

**Критерий:** 13 агентов, 7 governance, 17 схем.

---

## 🟢 Упражнение 2 — P.A.R.T. на одном агенте

**Цель:** убедиться, что P.A.R.T. — обязательный порядок.

**Шаги:**
1. Откройте `Researcher-subagent.agent.md`.
2. Найдите 4 заголовка: Prompt → Archive → Resources → Tools.
3. Проверьте порядок.

**Подсказка:** [Глава 04](04-part-spec.md).

**Критерий:** Порядок строго P → A → R → T.

---

## 🟢 Упражнение 3 — Запуск eval

**Цель:** убедиться, что харнесс работает.

**Шаги:**
1. `cd evals`.
2. `npm install` (один раз).
3. `npm test`.
4. Прочитать сводку.

**Подсказка:** [Глава 14](14-evals.md).

**Критерий:** Все тесты passed. Знаете время прогона.

---

## 🟢 Упражнение 4 — NOTES.md

**Цель:** понять, что в нём.

**Шаги:**
1. Откройте `NOTES.md`.
2. Найдите active objective и current phase.
3. Сравните с реальным состоянием репо.

**Подсказка:** [Глава 12](12-memory.md).

**Критерий:** Можете сказать, что сейчас «активная цель» проекта.

---

## 🟡 Упражнение 5 — Тиры и ревью-pipeline

**Цель:** понять mapping тира на ревьюеров.

**Шаги:**
1. Откройте `governance/runtime-policy.json`.
2. Найдите `review_pipeline_by_tier`.
3. Заполните таблицу:

| Tier | Активные ревьюеры | Max iterations |
|------|-------------------|----------------|
| TRIVIAL | ? | ? |
| SMALL | ? | ? |
| MEDIUM | ? | ? |
| LARGE | ? | ? |

**Подсказка:** [Глава 07](07-review-pipeline.md), [Глава 10](10-governance.md).

**Критерий:** Таблица сходится с governance.

---

## 🟡 Упражнение 6 — Failure routing

**Цель:** определить классификацию.

**Шаги:** для каждой ситуации выберите класс (transient / fixable / needs_replan / escalate):

| # | Ситуация | Класс |
|---|----------|-------|
| 1 | Тест упал по network timeout | ? |
| 2 | Build fails: typo в имени переменной | ? |
| 3 | Endpoint требует middleware, которого нет | ? |
| 4 | Найдена SQL injection | ? |
| 5 | HTTP 429 от тулзы | ? |
| 6 | Архитектурная зависимость оказалась циклической | ? |
| 7 | Бюджет токенов исчерпан | ? |

**Подсказка:** [Глава 13](13-failure-taxonomy.md).

**Критерий:** transient / fixable / needs_replan / escalate / transient / needs_replan / escalate.

---

## 🟡 Упражнение 7 — Schema reading

**Цель:** прочитать ключевую схему.

**Шаги:**
1. Откройте `schemas/planner.plan.schema.json`.
2. Найдите все required-поля верхнего уровня.
3. Найдите enum для `complexity_tier`.
4. Найдите enum для `executor_agent` в phases.

**Подсказка:** [Глава 09](09-schemas.md).

**Критерий:** Можете перечислить required-поля и оба enum-а.

---

## 🟡 Упражнение 8 — Skill selection

**Цель:** научиться выбирать skill-references.

**Шаги:** для каждой задачи выберите 1–3 skills из `skills/index.md`:

| # | Задача | Skills |
|---|--------|--------|
| 1 | Добавить пагинацию в /v1/orders (CoreImplementer) | ? |
| 2 | Сделать форму регистрации accessible (UIImplementer) | ? |
| 3 | Развернуть pgvector через Helm (PlatformEngineer) | ? |
| 4 | Написать FAQ-секцию документации (TechnicalWriter) | ? |
| 5 | Спланировать API-рефакторинг (Planner) | ? |

**Подсказка:** [Глава 11](11-skills.md), Domain Mapping в [skills/index.md](../../skills/index.md).

**Критерий:** Каждый выбор аргументируется доменом.

---

## 🟡 Упражнение 9 — Memory placement

**Цель:** определить слой памяти.

**Шаги:** куда писать каждый факт?

| # | Факт | Слой |
|---|------|------|
| 1 | «Сейчас работаем над фазой 4 plan X» | ? |
| 2 | «Verdict PA для итерации 1: APPROVED» | ? |
| 3 | «Гипотеза: возможно, использовать SSE вместо WebSocket» | ? |
| 4 | «Каноническая верификация — `cd evals && npm test`» | ? |
| 5 | «P.A.R.T. order is mandatory and enforced» | ? |

**Подсказка:** [Глава 12](12-memory.md).

**Критерий:** NOTES.md / task-episodic / session / repo-persistent / repo-persistent.

---

## 🔴 Упражнение 10 — Спроектировать flow

**Цель:** end-to-end дизайн.

**Шаги:**
1. Задача: «Добавить экспорт /v1/orders в CSV».
2. Опишите шаги от первого ввода пользователя до commit:
   - Кто отвечает на input? (Planner или Orchestrator)
   - Какой `complexity_tier`? Почему?
   - Какие триггеры PLAN_REVIEW? Какой pipeline?
   - Какие фазы (≥3, ≤10)?
   - Какие executor_agent для каждой?
   - Какие skill_references?
   - Какие quality_gates?

**Подсказка:** [Главы 05–08](05-orchestration.md).

**Критерий:** Согласованный план; sanity-проверка через схему `planner.plan.schema.json`.

---

## 🔴 Упражнение 11 — Adversarial mindset

**Цель:** мыслить как PlanAuditor.

**Шаги:**
1. Откройте любой план в `plans/` (например, `subagent-routing-guardrails-plan.md`).
2. Применить 4-perspective check (Architecture / Security / Risk / Completeness).
3. Найти ≥1 потенциальную проблему в каждой перспективе.

**Подсказка:** [Глава 07](07-review-pipeline.md), `PlanAuditor-subagent.agent.md`.

**Критерий:** ≥4 содержательных findings.

---

## 🔴 Упражнение 12 — Mirage hunting

**Цель:** мыслить как AssumptionVerifier.

**Шаги:**
1. Возьмите тот же план.
2. Найти ≥3 «assumption-fact confusion» (предположения, выданные за факты без evidence).
3. Для каждого: указать местоположение и предложить evidence для resolution.

**Подсказка:** `AssumptionVerifier-subagent.agent.md`, 17 mirage patterns.

**Критерий:** ≥3 mirage с evidence.

---

## 🔴 Упражнение 13 — Cold-start simulation

**Цель:** мыслить как ExecutabilityVerifier.

**Шаги:**
1. Возьмите 3 первые задачи из первой фазы того же плана.
2. Для каждой проверьте:
   - Есть ли ссылки на файлы?
   - Есть ли точные команды (exact strings)?
   - Все ли термины определены?
   - Нет ли implicit assumptions о состоянии?
3. Заполните: PASS / WARN / FAIL для каждой.

**Подсказка:** [Глава 07](07-review-pipeline.md), `ExecutabilityVerifier-subagent.agent.md`.

**Критерий:** 3 task verdicts с обоснованием.

---

## 🔴 Упражнение 14 — Code review final mode

**Цель:** обнаружить scope drift.

**Шаги:**
1. Возьмите завершённый plan (любой в `plans/archive/`).
2. Симулируйте changed_files как union всех файлов из всех фаз + 1 «лишний».
3. Постройте `plan_phases_snapshot[]`.
4. Найдите scope drift.
5. Определите fix executor по правилу «highest phase_id with файл в `files[]`».

**Подсказка:** [Глава 08](08-execution-pipeline.md), `code-reviewer.verdict.schema.json`.

**Критерий:** Корректный fix routing.

---

## 🔴 Упражнение 15 — Создать skill

**Цель:** добавить skill корректно.

**Шаги:**
1. Идея: «sql-injection-prevention.md» pattern.
2. Создать pattern-файл (3–5 sections, инструктивный стиль).
3. Зарегистрировать в `skills/index.md` Domain Mapping.
4. Обновить применимых агентов (CoreImplementer, CodeReviewer, PlanAuditor).
5. Запустить `cd evals && npm test`.

**Подсказка:** [Глава 11](11-skills.md), [skills/README.md](../../skills/README.md).

**Критерий:** Eval проходит. Skill читается естественно.

---

## 🔴 Упражнение 16 — Trace correlation

**Цель:** понять observability.

**Шаги:**
1. Прочитать [docs/agent-engineering/OBSERVABILITY.md](../agent-engineering/OBSERVABILITY.md).
2. Сделать диаграмму: какие поля переходят между gate-event и delegation-protocol для корреляции?
3. Описать, как восстановить полный flow из NDJSON-лога.

**Критерий:** Диаграмма содержит trace_id и iteration_index с источниками/потребителями.

---

## 🔴 Упражнение 17 — Изменить тир-routing

**Цель:** governance change по правилам.

**Шаги:**
1. Гипотеза: «MEDIUM тоже должен запускать ExecutabilityVerifier».
2. Какие файлы поменять?
3. Какие тесты могут упасть?
4. Что обновить в Orchestrator-промпте, если что?

**Подсказка:** [Глава 10](10-governance.md), `governance/runtime-policy.json`.

**Критерий:** Список изменений согласован с правилом «governance побеждает промпт».

---

## 🔴 Упражнение 18 — Ответить на сложные вопросы

**Цель:** проверить, готовы ли отвечать другим людям.

**Вопросы:**

1. **«Зачем нужен AssumptionVerifier, если есть PlanAuditor?»** — обоснуйте через разные перспективы.
2. **«Когда использовать ABSTAIN, а когда REPLAN_REQUIRED?»** — объясните разницу.
3. **«Почему Planner не вызывает ревьюеров сам?»** — объясните разделение ответственности.
4. **«Почему PLAN_REVIEW нет в `workflow_state` enum?»** — объясните различие промпт-стадий и schema-states.
5. **«Чем `failure_classification` отличается от `clarification_request`?»** — объясните разные routing paths.

**Подсказка:** все главы пособия.

**Критерий:** На каждый вопрос — связный ответ ≥3 предложения с цитатами/файлами.

---

## Бонус: упражнения «учитель»

Для самопроверки овладения. Выберите 3:

A. Объясните P.A.R.T. человеку, который никогда не работал с агентами.
B. Объясните разницу между skill и documentation.
C. Объясните, почему eval-харнесс не вызывает реальные LLM.
D. Объясните, как Orchestrator выбирает executor для фазы.
E. Объясните, что такое «backbone pattern» (см. MIGRATION-CORE-FIRST.md).

## См. также

- [Глава 17 — Глоссарий](17-glossary.md)
- [Глава 18 — FAQ](18-faq.md)
- [Глава 15 — Кейсы](15-case-studies.md)
