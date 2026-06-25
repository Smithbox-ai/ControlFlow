# Глава 03 — Реестр агентов

## Зачем эта глава

Дать **карточку на каждый из 13 агентов**: его роль, входы, выходы, типичные сценарии, схема выхода и ключевые ограничения. После этой главы вы сможете для любой задачи моментально сказать: «здесь нужен такой-то агент, потому что…».

## Сводная таблица

| # | Агент | Группа | Схема выхода | Тулзы | Кто вызывает |
|---|-------|--------|--------------|-------|--------------|
| 1 | Orchestrator | Дирижёр | `orchestrator.gate-event.schema.json` | Координация | Пользователь |
| 2 | Planner | Планирование | `planner.plan.schema.json` | Read+search+ask | Пользователь |
| 3 | CodeMapper-subagent | Разведка | `code-mapper.discovery.schema.json` | Read-only (5) | Все entry-points |
| 4 | Researcher-subagent | Исследование | `researcher.research-findings.schema.json` | Read+fetch (6) | Orchestrator, Planner |
| 5 | PlanAuditor-subagent | Ревью плана | `plan-auditor.plan-audit.schema.json` | Read-only (7) | Orchestrator |
| 6 | AssumptionVerifier-subagent | Ревью плана | `assumption-verifier.plan-audit.schema.json` | Read-only (6) | Orchestrator |
| 7 | ExecutabilityVerifier-subagent | Ревью плана | `executability-verifier.execution-report.schema.json` | Read-only (5) | Orchestrator |
| 8 | CoreImplementer-subagent | Исполнение | `core-implementer.execution-report.schema.json` | Full impl (11) | Orchestrator |
| 9 | UIImplementer-subagent | Исполнение | `ui-implementer.execution-report.schema.json` | Full impl (10) | Orchestrator |
| 10 | PlatformEngineer-subagent | Исполнение | `platform-engineer.execution-report.schema.json` | Full impl (10) | Orchestrator |
| 11 | TechnicalWriter-subagent | Исполнение | `technical-writer.execution-report.schema.json` | Edit+search (6) | Orchestrator |
| 12 | BrowserTester-subagent | Исполнение | `browser-tester.execution-report.schema.json` | Search+edit (6) | Orchestrator |
| 13 | CodeReviewer-subagent | Пост-ревью | `code-reviewer.verdict.schema.json` | Search+run (6) | Orchestrator |

---

## Карточки агентов

### 1. Orchestrator

**Файл:** [Orchestrator.agent.md](../../Orchestrator.agent.md)
**Группа:** Дирижёр
**Когда вызывать:** Когда у вас есть конкретная задача с понятными требованиями или готовый план от Planner.

**Что делает:**
- Управляет жизненным циклом `PLANNING → WAITING_APPROVAL → PLAN_REVIEW → ACTING → REVIEWING → COMPLETE`.
- Делегирует фазы исполнителям по полю `executor_agent`.
- Дирижирует PLAN_REVIEW-пайплайном (PlanAuditor, AssumptionVerifier, ExecutabilityVerifier).
- Маршрутизирует сбои по taxonomy (transient/fixable/needs_replan/escalate).
- Эскалирует к пользователю через approval gates на границах фаз и волн.

**Что НЕ делает:**
- Не пишет код напрямую (если есть подходящий исполнитель).
- Не пропускает гейты ради скорости.
- Не делегирует внешним (не указанным в `plans/project-context.md`) агентам.

**Типичный выход:** Структурированный текст с полями Status / Decision / Confidence / Requires Human Approval / Reason / Next Action. Контракт — `orchestrator.gate-event.schema.json`.

---

### 2. Planner

**Файл:** [Planner.agent.md](../../Planner.agent.md)
**Группа:** Планирование
**Когда вызывать:** Задача расплывчата, нужен план, требуется разбиение на фазы.

**Что делает:**
- Проводит **idea interview** при расплывчатой задаче.
- Применяет **clarification gate** (5 классов уточнений).
- Делает **semantic risk review** (7 категорий).
- Классифицирует задачу по **complexity tier** (TRIVIAL/SMALL/MEDIUM/LARGE).
- Выбирает ≤3 **skills** для каждой фазы.
- Делегирует **research** (Researcher, CodeMapper) при необходимости.
- Производит **дизайн** и **декомпозицию на фазы** (3–10 фаз, иначе глубже).
- Передаёт план в Orchestrator через `handoff`.

**Что НЕ делает:** не пишет код, не вызывает исполнителей, не вызывает ревьюеров.

**Типичный выход:** План в формате `planner.plan.schema.json`, сохранённый в `plans/<task>-plan.md`.

---

### 3. CodeMapper-subagent

**Файл:** [CodeMapper-subagent.agent.md](../../CodeMapper-subagent.agent.md)
**Группа:** Разведка
**Когда вызывать:** «Где в коде логика X?», «Кто использует функцию Y?», «Какие файлы относятся к подсистеме Z?»

**Что делает:** Read-only исследование структуры репозитория с возвратом списка релевантных файлов, usages, зависимостей.

**Тулзы (5):** только чтение и поиск.

**Типичный выход:** `code-mapper.discovery.schema.json` — список файлов с типами и аннотациями.

---

### 4. Researcher-subagent

**Файл:** [Researcher-subagent.agent.md](../../Researcher-subagent.agent.md)
**Группа:** Исследование
**Когда вызывать:** Нужен глубокий ответ с цитированием источников. Например: «Как работает X в библиотеке Y?», «Какие подходы существуют для Z?»

**Отличие от CodeMapper:** CodeMapper — это «найти файлы». Researcher — это «понять и объяснить со ссылками на доказательства».

**Тулзы (6):** read + fetch (доступ во внешние URL).

**Типичный выход:** `researcher.research-findings.schema.json` — структурированные findings с цитатами.

---

### 5. PlanAuditor-subagent

**Файл:** [PlanAuditor-subagent.agent.md](../../PlanAuditor-subagent.agent.md)
**Группа:** Ревью плана
**Когда вызывать:** Только Orchestrator, только во время PLAN_REVIEW.

**Что ищет:**
- Проблемы архитектуры (несогласованность модулей, нарушение границ).
- Уязвимости безопасности.
- Отсутствие отката (rollback) для деструктивных операций.
- Конфликты зависимостей между фазами.
- Пропуски в покрытии скоупа.

**Что НЕ делает:** не пишет код, не появляется как `executor_agent`. Failure-классификация исключает `transient`.

**Типичный выход:** `plan-auditor.plan-audit.schema.json` со статусом `APPROVED` / `NEEDS_REVISION` / `REJECTED` / `ABSTAIN`.

---

### 6. AssumptionVerifier-subagent

**Файл:** [AssumptionVerifier-subagent.agent.md](../../AssumptionVerifier-subagent.agent.md)
**Группа:** Ревью плана
**Когда вызывать:** Orchestrator на тирах MEDIUM и LARGE.

**Что ищет:** «**Миражи**» — утверждения в плане, не подтверждённые кодовой базой. Использует **17 паттернов** обнаружения (например, «упоминается несуществующий файл», «функция якобы возвращает X, на самом деле Y», «упоминание устаревшего API»).

**Зачем нужен в дополнение к PlanAuditor:** PlanAuditor смотрит на дизайн, AssumptionVerifier — на фактическую достоверность утверждений. Это разные оси проверки.

**Типичный выход:** `assumption-verifier.plan-audit.schema.json` со списком mirages и `severity` (BLOCKING / WARNING / INFO).

---

### 7. ExecutabilityVerifier-subagent

**Файл:** [ExecutabilityVerifier-subagent.agent.md](../../ExecutabilityVerifier-subagent.agent.md)
**Группа:** Ревью плана
**Когда вызывать:** Orchestrator на тире LARGE (или при HIGH-risk override).

**Что ищет:** Симулирует **холодный старт** первых 3 задач плана. Может ли исполнитель, видя только эти задачи и репозиторий, начать работу без дополнительных вопросов?

**Что проверяет:**
- Конкретны ли пути файлов?
- Указаны ли input/output контракты?
- Есть ли verification commands (как проверить, что фаза завершена)?

**Типичный выход:** `executability-verifier.execution-report.schema.json` со статусом `PASS` / `WARN` / `FAIL`.

---

### 8. CoreImplementer-subagent

**Файл:** [CoreImplementer-subagent.agent.md](../../CoreImplementer-subagent.agent.md)
**Группа:** Исполнение
**Когда вызывать:** Любая бэкенд/нон-UI имплементация — код, тесты, рефакторинг.

**Особый статус:** Это **канонический backbone** для всех исполнителей. UIImplementer и PlatformEngineer наследуют его рабочий ритм и расширяют доменными гейтами. См. [docs/agent-engineering/MIGRATION-CORE-FIRST.md](../agent-engineering/MIGRATION-CORE-FIRST.md).

**Рабочий ритм:**
1. Прочитать применимые стандарты и skill-паттерны.
2. PreFlect (4 risk-класса).
3. Доменная работа (test-first).
4. Верификация гейтов (tests/build/lint).
5. Структурированный отчёт.

**Тулзы (11):** полный набор для имплементации, включая `replace_string_in_file`, `create_file`, `runInTerminal` и т.д.

**Типичный выход:** `core-implementer.execution-report.schema.json` с changes / tests / build / lint / DoD evidence.

---

### 9. UIImplementer-subagent

**Файл:** [UIImplementer-subagent.agent.md](../../UIImplementer-subagent.agent.md)
**Группа:** Исполнение
**Когда вызывать:** Фронтенд-задачи — компоненты, стили, accessibility, responsive.

**Что добавляет поверх backbone:** гейт доступности (accessibility), гейт адаптивной вёрстки (responsive), гейт дизайн-системы.

**Типичный выход:** `ui-implementer.execution-report.schema.json` с `ui_changes`, отчётами о доступности и адаптивной вёрстке.

---

### 10. PlatformEngineer-subagent

**Файл:** [PlatformEngineer-subagent.agent.md](../../PlatformEngineer-subagent.agent.md)
**Группа:** Исполнение
**Когда вызывать:** CI/CD, контейнеры, deployment, инфраструктурные изменения.

**Что добавляет поверх backbone:** approval-гейт (deployment requires explicit approval), idempotency-гейт, rollback-план, health-check, environment preconditions.

**Типичный выход:** `platform-engineer.execution-report.schema.json` с approvals, health checks, rollback plan.

---

### 11. TechnicalWriter-subagent

**Файл:** [TechnicalWriter-subagent.agent.md](../../TechnicalWriter-subagent.agent.md)
**Группа:** Исполнение
**Когда вызывать:** Документация, диаграммы, синхронизация код ↔ доки.

**Тулзы (6):** edit + search.

**Типичный выход:** `technical-writer.execution-report.schema.json` с docs_created, docs_updated, parity-чеком, diagrams.

---

### 12. BrowserTester-subagent

**Файл:** [BrowserTester-subagent.agent.md](../../BrowserTester-subagent.agent.md)
**Группа:** Исполнение
**Когда вызывать:** E2E браузерные тесты, accessibility-аудит UI.

**Гейт:** Health-first — проверка, что приложение вообще запускается, до выполнения сценариев.

**Типичный выход:** `browser-tester.execution-report.schema.json` с scenarios, console/network failures, accessibility findings.

---

### 13. CodeReviewer-subagent

**Файл:** [CodeReviewer-subagent.agent.md](../../CodeReviewer-subagent.agent.md)
**Группа:** Пост-ревью
**Когда вызывать:** **Обязательно** после каждой фазы исполнения. Опционально на финальном этапе для LARGE-задач (`final_review_gate`).

**Что проверяет:**
- Корректность реализации относительно скоупа фазы.
- Безопасность.
- Качество кода.
- Соответствие quality gates (tests_pass, lint_clean, schema_valid, safety_clear).
- Отсутствие scope drift (особенно в final-режиме).

**Особый механизм:** `validated_blocking_issues` — Orchestrator блокирует продолжение **только** на этих, а не на raw CRITICAL/MAJOR.

**Что НЕ делает:** Никогда не владеет fix-cycle. Если найдены blocking issues, fix отдаётся подходящему исполнителю.

**Типичный выход:** `code-reviewer.verdict.schema.json` со статусом `APPROVED` / `NEEDS_REVISION` / `REJECTED`.

## Принцип «один агент — одна ответственность»

Заметьте: каждый агент имеет **узкую** сферу ответственности. Это сделано намеренно:

- Узкий контекст → меньше галлюцинаций.
- Чёткая граница → проще писать промпт и проверять выход.
- Композиция → можно собрать сложный workflow из простых блоков.
- Безопасность → каждый агент имеет минимум необходимых тулз.

## Типичные ошибки

- **Вызывать CoreImplementer для UI-задачи**. Используйте UIImplementer — у него гейты доступности и адаптивной вёрстки.
- **Использовать CodeMapper, когда нужно понимание**. Берите Researcher — он умеет в evidence-based объяснения.
- **Назначать PlanAuditor как `executor_agent`**. Запрещено схемой; это read-only ревьюер.
- **Вызывать исполнителя напрямую без Orchestrator**. Технически возможно, но без gates и ревью результат рискован.

## Упражнения

1. **(новичок)** Сопоставьте задачу и агента: `(а)` «Найди все места использования API X», `(б)` «Добавь экспорт CSV», `(в)` «Проверь план на mirages», `(г)` «Напиши доку по новому endpoint-у», `(д)` «Деплой в staging».
2. **(новичок)** Откройте `governance/tool-grants.json` и сравните, какие тулзы доступны Researcher и CoreImplementer. В чём принципиальная разница?
3. **(средний)** Какие 3 агента **никогда** не могут появиться в `executor_agent` фазы? Почему?
4. **(средний)** Чем PlanAuditor отличается от AssumptionVerifier по предмету проверки?
5. **(продвинутый)** Прочитайте [docs/agent-engineering/MIGRATION-CORE-FIRST.md](../agent-engineering/MIGRATION-CORE-FIRST.md). Какие гейты UIImplementer добавляет поверх CoreImplementer-backbone?

## Контрольные вопросы

1. Сколько всего агентов в системе и сколько из них — исполнители?
2. Кто единственный «дирижёр»?
3. Какой агент использует «17 паттернов миражей»?
4. Что такое `validated_blocking_issues` и почему это важно?
5. Кто может быть точкой входа кроме Orchestrator и Planner?

## См. также

- [Глава 02 — Архитектурный обзор](02-architecture-overview.md)
- [Глава 04 — P.A.R.T.](04-part-spec.md)
- [Глава 09 — Схемы](09-schemas.md)
- [plans/project-context.md](../../plans/project-context.md)
