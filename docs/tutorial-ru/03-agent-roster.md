# Глава 03 — Taxonomy ролей

## Зачем эта глава

Дать **карточку для каждой концептуальной роли** в пайплайне ControlFlow: что она делает, когда Planner её назначает, и как нативный Copilot её исполняет. После этой главы вы сможете для любой задачи сказать: «Planner назначит эту роль, потому что…» — и поймёте, что ни одна из этих ролей не является поставляемым файлом агента.

Это _taxonomy_, а не реестр поставляемых агентов. Slim-модель поставляет один агент (`@controlflow-planner`) и три skill'а. Имена ниже — концептуальные метки, которые Planner записывает в поле `executor_agent` фазы плана, или метки, которые `controlflow-verify` использует для своих трёх inline-фаз. Исполнение — задача нативного Copilot.

## Сводная таблица

### Роли исполнителей фаз (8) — enum `executor_agent`

Поле `executor_agent` в фазе плана должно использовать одно из этих точных имён. Enum enforced by `schemas/planner.plan.schema.json` и mirrored в `plans/project-context.md` и `governance/project-context-registry.json`.

| № | Роль | Что делает | Model Routing Role (концептуально) |
|---|------|-----------|-----------------------------------|
| 1 | `CodeMapper-subagent` | Read-only разведка кодовой базы, mapping файлов | `fast-readonly` |
| 2 | `Researcher-subagent` | Исследование и evidence с цитированиями | `research-capable` |
| 3 | `CoreImplementer-subagent` | Бэкенд-имплементация — код, тесты, рефакторинг. Канонический backbone. | `capable-implementer` |
| 4 | `UIImplementer-subagent` | UI-имплементация — компоненты, стили, accessibility | `ui-implementer` |
| 5 | `PlatformEngineer-subagent` | Инфраструктура — CI/CD, контейнеры, deployment | `capable-implementer` |
| 6 | `TechnicalWriter-subagent` | Документация, диаграммы, code–doc parity | `documentation` |
| 7 | `BrowserTester-subagent` | E2E браузерные тесты, accessibility-аудит | `browser-testing` |
| 8 | `CodeReviewer-subagent` | Пост-имплементационное ревью (persona review-роли; `controlflow-review` layer'ит это поверх нативного code review) | `capable-reviewer` |

### Inline verify-роли (3) — выполняются `controlflow-verify`, никогда `executor_agent`

Эти три имени метят три фазы skill'а `controlflow-verify`. Они строго read-only и **не должны** появляться как значения `executor_agent` в фазах плана.

| № | Роль | Verify-фаза | Что ищет | Model Routing Role (концептуально) |
|---|------|-------------|----------|-----------------------------------|
| 9 | `PlanAuditor-subagent` | Фаза 1 — structural audit | Соответствие schema/template; конфликты архитектуры, безопасности, rollback, зависимостей | `capable-reviewer` |
| 10 | `AssumptionVerifier-subagent` | Фаза 2 — mirage detection | Утверждения плана, не подтверждённые кодовой базой (taxonomy миражей P1–P10, A11–A17) | `capable-reviewer` |
| 11 | `ExecutabilityVerifier-subagent` | Фаза 3 — executability cold-start | Может ли свежий исполнитель начать Phase 1 из одного только плана, не спрашивая пользователя? | `review-readonly` |

### Не-исполнительные роли (2)

| Роль | Статус | Заметки |
|------|--------|---------|
| `Orchestrator` | **Retired** — только концептуальный дирижёр | Упоминается исторически. В slim-модели нет поставляемого агента. Planner + нативный Copilot покрывают оркестрацию. Legacy state machine, dispatch, waves и gates ушли. |
| `Planner` | Поставляется как `@controlflow-planner` | Единственный поставляемый entry point. Производит планы; назначает `executor_agent` на фазу; передаёт исполнение нативному Copilot. |

**Single source of truth:** таблицы выше mirror'ят `governance/project-context-registry.json` и `plans/project-context.md`. Pass 14 drift-проверка (`validateProjectContextRegistryMirror`) верифицирует их строка-за-строкой. Не правьте эти таблицы независимо от registry.

## Карточки ролей — исполнители фаз

Для каждой роли: что делает, когда Planner назначает, и факт исполнения нативным Copilot.

### 1. CodeMapper-subagent

**Роль:** Read-only разведка. «Где логика для X?», «Кто использует функцию Y?», «Какие файлы относятся к подсистеме Z?»

**Когда Planner назначает:** Фазе нужна разведка кодовой базы до того, как имплементацию можно спланировать конкретно. Часто первая фаза MEDIUM/LARGE плана.

**Исполнение:** Нативный Copilot запускает фазу inline (read + search tools). Дисциплина роли живёт в `skills/patterns/completeness-traceability.md` и `skills/patterns/code-simplification.md`; Planner может инжектить ≤3 паттерна через `skill_references`.

**Форма выхода (контракт-док):** `schemas/code-mapper.discovery.schema.json` — список файлов с типами и аннотациями.

### 2. Researcher-subagent

**Роль:** Исследование и evidence. «Как X работает в библиотеке Y?», «Какие подходы существуют для Z?» Отличается от CodeMapper: CodeMapper находит файлы; Researcher объясняет с cited evidence.

**Когда Planner назначает:** Фазе нужно внешнее исследование или grounded-в-evidence объяснение, которое кодовая база дать не может.

**Исполнение:** Нативный Copilot (read + fetch). Дисциплина в `skills/patterns/source-grounding.md` и `skills/patterns/completeness-traceability.md`.

**Форма выхода:** `schemas/researcher.research-findings.schema.json` — структурированные находки с цитированиями.

### 3. CoreImplementer-subagent

**Роль:** Бэкенд-имплементация — код, тесты, рефакторинг. **Канонический backbone** для исполнителей. UIImplementer и PlatformEngineer расширяют его ритм домен-специфичными гейтами (см. `docs/agent-engineering/MIGRATION-CORE-FIRST.md`).

**Рабочий ритм (унаследован):** прочитать применимые паттерны → PreFlect (4 risk classes, `skills/patterns/preflect-core.md`) → доменная работа test-first → gate verification (tests/build/lint) → структурированный отчёт.

**Когда Planner назначает:** Любая бэкенд / не-UI имплементация. Исполнитель по умолчанию.

**Исполнение:** Нативный Copilot (полный implementation toolset). Дисциплина в `skills/patterns/tdd-patterns.md`, `skills/patterns/debugging-discipline.md`, `skills/patterns/error-handling-patterns.md`.

**Форма выхода:** `schemas/core-implementer.execution-report.schema.json` — changes / tests / build / lint / DoD evidence.

### 4. UIImplementer-subagent

**Роль:** Фронтенд — компоненты, стили, accessibility, responsive design.

**Что добавляет поверх backbone:** accessibility (a11y) gate, responsive gate, design-system gate.

**Когда Planner назначает:** Любое UI-facing изменение.

**Исполнение:** Нативный Copilot (полный implementation toolset). Дисциплина в `skills/patterns/tdd-patterns.md`, `skills/patterns/code-simplification.md`, `skills/patterns/error-handling-patterns.md`.

**Форма выхода:** `schemas/ui-implementer.execution-report.schema.json` — `ui_changes`, accessibility/responsive report.

### 5. PlatformEngineer-subagent

**Роль:** Инфраструктура — CI/CD, контейнеры, deployments.

**Что добавляет поверх backbone:** approval gate (deployment требует явного одобрения), idempotency gate, rollback plan, health checks, environment preconditions.

**Когда Planner назначает:** Инфраструктурные или deployment-изменения.

**Исполнение:** Нативный Copilot (полный implementation toolset). Дисциплина в `skills/patterns/error-handling-patterns.md`, `skills/patterns/debugging-discipline.md`, `skills/patterns/integration-validator.md`.

**Форма выхода:** `schemas/platform-engineer.execution-report.schema.json` — approvals, health checks, rollback plan.

### 6. TechnicalWriter-subagent

**Роль:** Документация, диаграммы, синхронизация code ↔ docs.

**Когда Planner назначает:** Фаза производит user-visible доки, диаграммы или требует работы над code–doc parity.

**Исполнение:** Нативный Copilot (edit + search). Дисциплина в `skills/patterns/completeness-traceability.md` и `skills/patterns/llm-behavior-guidelines.md`.

**Форма выхода:** `schemas/technical-writer.execution-report.schema.json` — `docs_created`, `docs_updated`, parity check, diagrams.

### 7. BrowserTester-subagent

**Роль:** E2E браузерные тесты, UI accessibility-аудит.

**Гейт (health-first):** убедиться, что приложение запускается до прогона сценариев.

**Когда Planner назначает:** Фазе нужно E2E браузерное покрытие или accessibility-аудит.

**Исполнение:** Нативный Copilot (search + edit evidence). Дисциплина в `skills/patterns/tdd-patterns.md`, `skills/patterns/debugging-discipline.md`, `skills/patterns/error-handling-patterns.md`.

**Форма выхода:** `schemas/browser-tester.execution-report.schema.json` — scenarios, console/network failures, accessibility findings.

### 8. CodeReviewer-subagent

**Роль:** Пост-имплементационное ревью. Persona review-роли.

**Когда Planner назначает:** Опционально на финальном гейте для LARGE-задач. В slim-модели `controlflow-review` уже layer'ит ревью поверх нативного Copilot code review, так что выделенная _фаза_ ревью опциональна — воссоздавайте dedicated review persona только если хотите (см. `NATIVE-DELEGATION-BOUNDARY.md §5`).

**Что проверяет:** корректность vs scope фазы, безопасность, качество кода, compliance quality-gate (`tests_pass`, `lint_clean`, `schema_valid`, `safety_clear`), scope drift.

**Исполнение:** Нативный Copilot (search + run). Дисциплина в `skills/patterns/security-review-discipline.md`, `skills/patterns/decision-challenge.md`, `skills/patterns/llm-behavior-guidelines.md`.

**Форма выхода:** `schemas/code-reviewer.verdict.schema.json` — `APPROVED` / `NEEDS_REVISION` / `REJECTED`.

## Карточки ролей — inline verify-роли

Они не назначаются через `executor_agent`. Это три фазы `controlflow-verify`, выполняемые inline в главном контексте (ноль сабагентов).

### 9. PlanAuditor-subagent — verify фаза 1 (structural audit)

Подтвердить, что артефакт соответствует `schemas/planner.plan.schema.json` и `plans/templates/plan-document-template.md`:

- YAML header присутствует; `Status`, `Agent: Planner`, `Schema Version: 1.2.0`, числовой `Confidence`.
- Все 10 секций присутствуют по порядку; 5 lifecycle-секций присутствуют и упорядочены для SMALL+.
- Секция 7 содержит ровно семь категорий риска, каждая один раз.
- Каждая фаза объявляет один `executor_agent` из schema enum; quality gates используют только пять стандартных значений.
- Acceptance criteria включают как минимум один измеримый observable outcome на фазу.
- Tier LARGE включает `flowchart TD` + `sequenceDiagram`; каждый ≤30 строк.

Структурный сбой → `NEEDS_REVISION` немедленно. Classification сбоев исключает `transient`.

### 10. AssumptionVerifier-subagent — verify фаза 2 (mirage detection)

Попытаться опровергнуть фактические утверждения плана. Каждый указанный file/path/symbol должен быть реальным (open или grep для него). Каждое предположение должно быть bounded. Никакого «should be safe» hand-waving про concurrency или shared mutable state. Полная taxonomy миражей — в `.github/skills/controlflow-verify/references/mirage-patterns.md` (presence mirages P1–P10, absence mirages A11–A17).

Почему дополняет PlanAuditor: PlanAuditor ревьюит _дизайн_; AssumptionVerifier ревьюит _фактическую точность утверждений плана_. Разные оси валидации.

### 11. ExecutabilityVerifier-subagent — verify фаза 3 (executability cold-start)

Симулировать свежего исполнителя, начинающего Phase 1 только с планом в руках:

- Может ли Phase 1 выполниться без вопроса пользователю? Если да — ок; если нет — пометить ambiguity как Phase 1 blocker.
- Достаточно ли concrete verification-команды, чтобы запустить as-is?
- Есть ли у каждой деструктивной или migration-heavy фазы rollback/recovery guidance? HIGH blast radius → требовать `human_approved_if_required`; MEDIUM → `safety_clear`.
- Явно ли указан формат inter-phase contract deliverable?

Tier gating: SMALL → фаза 1; MEDIUM → фазы 1–2; LARGE → фазы 1–3. Любой неразрешённый HIGH-impact semantic risk форсит все три фазы независимо от тира.

## Воссоздание специализированного агента как native Copilot custom agent

Рефактор retiring'ит legacy специализированные `*.agent.md` файлы. Их _персоны_ не потеряны — value-add паттерны, которые они воплощали, остаются в `skills/patterns/`. Если хотите вернуть специализированную персону как поставляемого агента, воссоздайте её как **native Copilot custom agent** (новый файл под `.github/agents/`) и пусть `controlflow-planner` назначает её как phase `executor_agent`. Planner трактует любой файл агента под `.github/agents/` как валидную концептуальную роль исполнителя.

**Рецепт (кратко):**

1. Создайте новый файл агента под `.github/agents/` с Copilot agent frontmatter (`name`, `description`, `tools`). **Не** добавляйте `model:` — пусть Copilot Auto picker выбирает, или pin'ьте модель только если роль требует.
2. В теле промпта cite'ните файлы `skills/patterns/`, которые персона должна загружать (бывшее static binding).
3. Напишите дисциплину персоны как prose (abstain когда нет executable harness; evidence over assertion; stop-the-line on regression). Файлы паттернов несут переиспользуемую дисциплину; файл агента — персону.
4. Planner теперь может назначать эту роль как phase `executor_agent`. Исполнение — нативный Copilot.

См. `docs/agent-engineering/NATIVE-DELEGATION-BOUNDARY.md §5` для полного рецепта и worked examples (BrowserTester, UIImplementer, PlatformEngineer, Researcher, CodeMapper, TechnicalWriter, CodeReviewer). Три verify-роли **не** воссоздаются как агенты — это inline-фазы `controlflow-verify`, non-native value-add.

## Принцип единственной ответственности

У каждой роли **узкая** область ответственности. Это намеренно:

- Узкий контекст → меньше галлюцинаций.
- Чёткая граница → проще Planner'у назначать, а нативному Copilot — исполнять.
- Композиция → сложные workflow строятся из простых фаз плана.
- Безопасность → доступ к инструментам делегирован нативному Copilot, scoped через `tools:` frontmatter агента при воссоздании как custom agent.

## Типичные ошибки

- **Использовать CoreImplementer для UI-задачи.** Используйте `UIImplementer-subagent` — добавляет a11y/responsive gates.
- **Использовать CodeMapper, когда нужно понимание.** Используйте `Researcher-subagent` — производит evidence-based объяснения.
- **Назначать verify-роль как `executor_agent`.** Запрещено. `PlanAuditor-subagent`, `AssumptionVerifier-subagent` и `ExecutabilityVerifier-subagent` — read-only verify-фазы, выполняемые `controlflow-verify`.
- **Трактовать имена ролей как поставляемые файлы агентов.** Это концептуальные метки. Единственный поставляемый агент — `@controlflow-planner`. Если хотите персону как поставляемого агента, воссоздайте её под `.github/agents/` (см. выше).
- **Искать legacy `*-subagent.agent.md` файлы.** Они retired (удалены). Дисциплина живёт в `skills/patterns/`.

## Упражнения

1. **(новичок)** Сопоставьте каждой задаче роль: `(a)` «Найти все использования API X», `(b)` «Добавить CSV export», `(c)` «Проверить план на миражи», `(d)` «Написать доки для нового endpoint», `(e)` «Задеплоить в staging».
2. **(новичок)** Откройте `plans/project-context.md` и таблицу Phase Executor Agents. Подтвердите, что все восемь имён совпадают с таблицей в этой главе.
3. **(средний)** Какие три роли **никогда не могут** появиться в `executor_agent`? Почему?
4. **(средний)** Чем `PlanAuditor-subagent` отличается от `AssumptionVerifier-subagent` по тому, что каждый ревьюит? (Ось дизайна vs ось фактической точности.)
5. **(продвинутый)** Выберите retired персону (например, BrowserTester). Какие файлы `skills/patterns/` несут её дисциплину? Набросайте frontmatter для воссоздания её как native Copilot custom agent под `.github/agents/`.

## Контрольные вопросы

1. Сколько концептуальных ролей исполнителей в enum `executor_agent` и сколько inline verify-ролей?
2. Какая роль — «канонический backbone» для исполнителей?
3. Какая роль использует taxonomy миражей и какой verify-фазе она соответствует?
4. Что значит, что роль — _концептуальная метка_, а не поставляемый файл агента?
5. Где искать дисциплину, которую раньше нёс retired специализированный агент?

## См. также

- [Глава 02 — Архитектурный обзор](02-architecture-overview.md)
- [Глава 04 — Структура промпта агента (guidance)](04-part-spec.md)
- [Глава 07 — Ревью-пайплайн](07-review-pipeline.md)
- [Глава 09 — Схемы (контракты)](09-schemas.md)
- [plans/project-context.md](../../plans/project-context.md)
- [docs/agent-engineering/NATIVE-DELEGATION-BOUNDARY.md](../agent-engineering/NATIVE-DELEGATION-BOUNDARY.md)