# Глава 16 — Упражнения

## Зачем эта глава

Практические задания, закрепляющие ключевые концепции из всех предыдущих глав. Сгруппированы по уровню: 🟢 новичок, 🟡 средний, 🔴 продвинутый. Упражнения отражают тонкую ControlFlow-поверхность: один агент (`@controlflow-planner`), три skill'а (`controlflow-plan` / `controlflow-verify` / `controlflow-review`), а нативный Copilot исполняет фазы.

---

## 🟢 Упражнение 1 — Карта тонкой поверхности

**Цель:** Сориентироваться в поставляемой структуре репозитория.

1. Откройте репозиторий в редакторе.
2. Перечислите файлы под `.github/agents/` и `.github/skills/`. Подтвердите, что поставляемая поверхность — один агент плюс три skill'а.
3. Заполните таблицу:

| Категория | Путь | Назначение |
|----------|------|-----------|
| Агент Planner'а | `.github/agents/…` | ? |
| Plan skill | `.github/skills/…` | ? |
| Verify skill | `.github/skills/…` | ? |
| Review skill | `.github/skills/…` | ? |
| Routing stub | `.github/…` | ? |

4. Откройте `.github/copilot-instructions.md` и найдите таблицу тиров. Какой tier пропускает пайплайн целиком?

---

## 🟢 Упражнение 2 — Чтение агента Planner'а + skill'а

**Цель:** Научиться читать агент Planner'а и skill.

1. Откройте `.github/agents/controlflow-planner.agent.md`.
2. Найдите поля frontmatter (`description`, `name`, `tools`). Подтвердите, что строки `model:` нет.
3. Определите секции в теле (например, «Load the planning skill», «Idea Interview», «Write the plan artifact», «Hand off to native Copilot»).
4. Откройте `.github/skills/controlflow-plan/SKILL.md` и прочитайте, что делает plan skill.
5. Перечислите `skill_references` (value-add паттерны), которые Planner может инжектить на фазу. Каков максимум на фазу?

---

## 🟢 Упражнение 3 — Запуск evals

**Цель:** Запомнить каноническую команду верификации.

1. Откройте терминал.
2. Выполните `cd evals && npm test`.
3. Подсчитайте общее количество проверок по всем проходам.
4. Какой проход запускает больше всего проверок?
5. По желанию направьте вывод в локальный файл (`cd evals && npm test > out.txt`, он gitignored) — каким был результат?

---

## 🟢 Упражнение 4 — NOTES.md

**Цель:** Понять repo-persistent-память.

1. Откройте `NOTES.md`.
2. Какова текущая активная цель?
3. Есть ли неразрешённые блокеры?
4. Когда файл последний раз обновлялся (по содержимому)?
5. Содержит ли файл устаревшие (superseded) записи? Что предлагает делать паттерн memory-hygiene по адресу `skills/patterns/repo-memory-hygiene.md` с ними?

---

## 🟡 Упражнение 5 — Тиры и пайплайн

**Цель:** Применить tier-gated политику.

Для каждого сценария определите: **complexity tier** + **какие verify-фазы запускаются**.

| Сценарий | Tier | Verify-фазы |
|----------|------|-------------|
| Добавить ключ локализации (1 файл, низкий риск) | ? | ? |
| Рефакторинг service-класса (4 файла, без HIGH-риска) | ? | ? |
| Миграция БД (8 файлов, `data_volume: HIGH`, неразрешён) | ? | ? |
| Добавить админ-панель (10 файлов, `access_control: HIGH`, неразрешён) | ? | ? |

Подсказка: проверьте `governance/runtime-policy.json` → `review_pipeline_by_tier` и вспомните override-правило HIGH-risk.

---

## 🟡 Упражнение 6 — Маршрутизация сбоев

**Цель:** Применить taxonomy сбоев и определить, кто маршрутизирует.

Для каждого сценария сбоя укажите: **classification** + **кто маршрутизирует** (нативный Copilot или re-invoke `@controlflow-planner`).

| Сценарий | Classification | Маршрутизатор |
|----------|---------------|--------------|
| 1. CoreImplementer: TypeScript-компилятор не отвечает (timeout) | ? | ? |
| 2. UIImplementer: забыл импортировать компонент | ? | ? |
| 3. Mid-execution: phase 3 зависит от функции, которой нет в кодовой базе | ? | ? |
| 4. PlatformEngineer: деплой перезапишет production-данные без backup | ? | ? |
| 5. BrowserTester: Playwright падает (rate limit) | ? | ? |
| 6. CoreImplementer: всю архитектуру нужно переделать | ? | ? |
| 7. Researcher: routed/primary модель unreachable | ? | ? |

**Ответы:**
1. `transient` → нативный Copilot retry.
2. `fixable` → нативный Copilot retry с fix hint.
3. `needs_replan` → re-invoke `@controlflow-planner` для targeted replan.
4. `escalate` → нативный Copilot останавливается; требуется user approval.
5. `transient` → нативный Copilot retry.
6. `needs_replan` → re-invoke `@controlflow-planner`.
7. `model_unavailable` → нативный Copilot подменяет модель, затем escalate при исчерпании.

---

## 🟡 Упражнение 7 — Чтение схем

**Цель:** Научиться ориентироваться в JSON-схемах.

1. Откройте `schemas/planner.plan.schema.json`.
2. Найдите `risk_review.items.properties.category.enum` — перечислите все семь значений.
3. Найдите `phases.items.properties.executor_agent.enum` — перечислите все восемь имён ролей исполнителей.
4. Каково минимальное число элементов в `acceptance_criteria`?
5. Какие три имени verify-ролей **исключены** из enum `executor_agent` и почему?

---

## 🟡 Упражнение 8 — Выбор skill-паттерна

**Цель:** Потренироваться в Planner-injected выборе паттернов.

Для каждой фазы выберите до трёх паттернов из `skills/index.md`.

| Фаза | Рекомендуемые паттерны |
|-------|------------------------|
| «Написать интеграционные тесты для payment API» | ? |
| «Реализовать export-handler (backend)» | ? |
| «Написать документацию к новому API (с Mermaid-диаграммами)» | ? |
| «Деплой сервиса в staging (с rollback)» | ? |
| «Исследовать альтернативы для Redis-кэширования» | ? |

---

## 🟡 Упражнение 9 — Размещение в памяти

**Цель:** Определить правильный слой памяти для каждого факта.

Для каждого факта укажите: **слой памяти** + **файл/путь**.

| Факт | Слой | Расположение |
|------|------|--------------|
| «Команда верификации — `cd evals && npm test`» | ? | ? |
| «Phase 3 завершена, phase 4 в работе» | ? | ? |
| «PlanAuditor нашёл 2 BLOCKING-проблемы в итерации 1» | ? | ? |
| «Пользователь предпочитает flat CSV-формат» | ? | ? |
| «Slim-модель поставляет одного агента planner'а и три skill'а» | ? | ? |

---

## 🔴 Упражнение 10 — Полный трейс пайплайна

**Цель:** Симулировать полный пайплайн plan → verify → review.

**Вход:** Пользователь просит «Генератор отчётов, экспортирующий пользовательскую активность по диапазону дат».

1. Какие clarification-вопросы Planner должен задать в Idea Interview (минимум 3)?
2. Какие категории `risk_review` применимы, а какие `not_applicable` с обоснованием?
3. Каким должен быть `complexity_tier`? Срабатывает ли HIGH-risk override?
4. Перечислите 5–6 фаз с `executor_agent` и однострочной целью.
5. Какие verify-фазы запускаются и каким inline verify-роли соответствуют?
6. Какие `skills/patterns/` вы инжектнули бы (≤3) в фазу имплементации?

---

## 🔴 Упражнение 11 — Адверсариальный майндсет

**Цель:** Думать как `AssumptionVerifier-subagent` (verify фаза 2).

**Дан фрагмент плана:**
```
Phase 3: "Implement export
  - Use the existing UserExportService class
  - Call the method getActivityByDateRange(userId, from, to)
  - The results are already paginated"
```

1. Перечислите все **предположения** в этом фрагменте.
2. Какие предположения можно проверить в кодовой базе?
3. Какие BLOCKING, если ложны?
4. Сформулируйте mirage для каждого BLOCKING-предположения (используя taxonomy P1–P10 / A11–A17 в `.github/skills/controlflow-verify/references/mirage-patterns.md`).

---

## 🔴 Упражнение 12 — Охота на mirages

**Цель:** Применить taxonomy mirages.

Откройте `.github/skills/controlflow-verify/references/mirage-patterns.md` и прочитайте паттерны presence (P1–P10) и absence (A11–A17).

Для утверждения плана: *"Auth-модуль кэширует токены в Redis с 15-минутным TTL, поэтому rate limiter может на это опираться."*

1. Какие паттерны применимы?
2. Перечислите все проверяемые факты.
3. Как бы вы назвали mirage, если Redis-кэширование оказалось фичей в разработке, а не production-кодом?

---

## 🔴 Упражнение 13 — Симуляция cold start

**Цель:** Думать как `ExecutabilityVerifier-subagent` (verify фаза 3).

**Дано Phase 2, Task 1:**
```
"Add an endpoint for export:
  - Use Express.js
  - Return CSV in the response"
```

Вы — свежий исполнитель, пришедший только с репозиторием и этим описанием плана.

1. Чего не хватает, чтобы вы могли начать сразу без вопросов к пользователю?
2. Перечислите минимум пять concreteness-пробелов (file path, route, auth, validation, verification-команда, rollback если деструктивно).
3. Предложите исправленное описание задачи, закрывающее эти пробелы.

---

## 🔴 Упражнение 14 — Воссоздать специализированного агента

**Цель:** Воссоздать retired-персону как native Copilot custom agent.

Согласно `docs/agent-engineering/NATIVE-DELEGATION-BOUNDARY.md §5`:

1. Выберите retired-персону (например, `BrowserTester-subagent`).
2. Перечислите файлы `skills/patterns/`, несущие её дисциплину (см. таблицу worked-examples в §5).
3. Набросайте stub `browser-tester.agent.md` под `.github/agents/`:
   - Frontmatter: `name`, `description`, `tools` (без строки `model:`).
   - Тело: процитируйте паттерны в секции `## Resources`; напишите правило abstain («abstain when no executable harness is supplied»).
4. Как Planner назначил бы этого воссозданного агента как `executor_agent` фазы? Что сделал бы нативный Copilot, когда фаза запускается?

---

## Итог

| Уровень | Упражнения | Ключевые навыки |
|---------|-----------|-----------------|
| 🟢 Новичок | 1–4 | Навигация по тонкой поверхности, чтение planner/skill, запуск харнесса, repo-память |
| 🟡 Средний | 5–9 | Tier-routing, failure classification, чтение схем, выбор паттернов, слои памяти |
| 🔴 Продвинутый | 10–14 | Полный трейс пайплайна, адверсариальное мышление, cold-start-анализ, воссоздание специализированного агента |

## См. также

- [Глава 15 — Разборы кейсов](15-case-studies.md)
- [Глава 17 — Глоссарий](17-glossary.md)
- [Глава 18 — FAQ](18-faq.md)
- [docs/agent-engineering/NATIVE-DELEGATION-BOUNDARY.md](../agent-engineering/NATIVE-DELEGATION-BOUNDARY.md)