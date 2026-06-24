# Глава 08 — Исполнение + ревью поверх нативного Copilot

## Зачем эта глава

Понять, **что происходит после того, как `controlflow-verify` вернёт `APPROVED`**: нативный Copilot исполняет фазы плана (роли исполнителей, которые назначил Planner), а `controlflow-review` гейтит результат. Эта глава покрывает обе половины — исполнение и post-execution ревью — потому что в slim-модели обе «поверх нативного Copilot»: нативный Copilot исполняет фазы; `controlflow-review` накладывает тонкий слой scope-drift + evidence дисциплины поверх нативного Copilot code review.

Главное изменение: legacy **Orchestrator-driven wave dispatch retired**. Нет dispatch state machine, нет wave scheduler, нет потока gate-events на фазу. План объявляет фазы с per-phase acceptance criteria; нативный Copilot исполняет их; `controlflow-verify` гейтит до (глава 07); `controlflow-review` гейтит после.

## Ключевые понятия

- **Исполнение** — нативный Copilot исполняет фазы плана. `executor_agent` на фазу — это **метка концептуальной роли** (глава 03), которую нативный Copilot исполняет inline; это не поставляемый файл агента.
- **Фаза** — единица плана с фиксированным `executor_agent`, конкретными files, tests, acceptance criteria, quality gates и failure expectations.
- **Quality gates** — per-phase acceptance criteria плана плюс два гейта пайплайна: `controlflow-verify` (pre-execution) и `controlflow-review` (post-execution). Enum per-phase гейтов — `tests_pass` / `lint_clean` / `schema_valid` / `safety_clear` / `human_approved_if_required`.
- **`controlflow-review`** — post-execution гейт. **Слой поверх** нативного Copilot code review, не замена. Добавляет сравнение plan-vs-implementation на scope drift, дисциплину evidence и проактивный поиск уязвимостей/ошибок.
- **Scope drift** — всё, что имплементировано, но не запланировано, или запланировано, но не имплементировано — это review finding.
- **Classification сбоев** — один из `transient`, `fixable`, `needs_replan`, `escalate`, `model_unavailable`. Записывается в lifecycle-секциях плана; retry routing и parallelism — задача нативного Copilot.
- **Mid-execution clarification** — нативный Copilot surfaces ambiguity пользователю напрямую (через свою нативную поверхность approvals / ask-questions). Если ambiguity меняет file scope, user-visible поведение, архитектуру или обработку destructive-risk, re-invoke `@controlflow-planner` для targeted replan.
- **Orchestrator (retired)** — концептуальная роль дирижёра. Упоминается здесь только как история: в slim-модели Planner + нативный Copilot покрывают оркестрацию. Legacy state machine (`PLANNING` → `WAITING_APPROVAL` → `PLAN_REVIEW` → `ACTING` → `REVIEWING` → `COMPLETE`), dispatch, waves и batch gates ушли.

## Пайплайн исполнения + ревью

```mermaid
sequenceDiagram
    participant U as Пользователь
    participant V as controlflow-verify
    participant N as Нативный Copilot
    participant R as controlflow-review

    U->>V: /controlflow-verify (план одобрен Planner'ом)
    V-->>U: APPROVED
    U->>N: исполнение фаз (роли executor_agent из плана)
    Note over N: per-phase: run steps → достичь acceptance criteria → quality gates
    N-->>U: имплементация
    U->>R: /controlflow-review
    R->>R: читает план; делегирует механический проход нативному code review
    R-->>U: findings + verdict (scope drift, уязвимости, evidence)
    alt NEEDS_REVISION
        U->>N: исправить по findings (нативный Copilot)
    else clean
        U->>U: ship
    end
    alt mid-execution ambiguity меняет scope
        U->>U: re-invoke @controlflow-planner для targeted replan
    end
```

В пайплайне два гейта вокруг исполнения: verify до, review после. Между гейтами нативный Copilot управляет процессом.

## Исполнение — нативный Copilot исполняет фазы

На `APPROVED` пользователь направляет нативный Copilot на артефакт плана. Нативный Copilot исполняет фазы:

- `executor_agent` на фазу — это **метка концептуальной роли**, которую назначил Planner (`CoreImplementer-subagent`, `UIImplementer-subagent`, `PlatformEngineer-subagent`, `TechnicalWriter-subagent`, `BrowserTester-subagent`, `CodeMapper-subagent`, `Researcher-subagent`, `CodeReviewer-subagent`). Нативный Copilot исполняет фазу inline, используя дисциплину роли — value-add паттерны, которые Planner инжектирует через `skill_references` (≤3 на фазу, из `skills/patterns/`).
- `steps` каждой фазы — нумерованная проза **без code-блоков**. Verification-команды должны быть достаточно concrete, чтобы запустить as-is (это проверила фаза 3 verify).
- Каждая фаза объявляет `quality_gates` из enum — это per-phase acceptance-сигналы, которые нативный Copilot должен удовлетворить до завершения фазы.
- Каждая фаза объявляет `acceptance_criteria` — минимум один измеримый observable outcome. Это то, с чем `controlflow-review` позже сравнивает diff.

Нативный Copilot владеет retry routing, retry budgets и parallelism. ControlFlow не поставляет dispatch state machine, wave scheduler или retry-таблицу — они retired (legacy поверхность Orchestrator'а). Если фаза сбоит, сбой классифицируется по taxonomy ниже, а нативный Copilot маршрутизирует retry.

### Воссоздание специализированной персоны как native Copilot custom agent

Имена `executor_agent` — концептуальные метки, не поставляемые файлы. Если вы хотите вернуть специализированную персону как поставляемого агента — например, dedicated `BrowserTester` или `UIImplementer` — воссоздайте её как **native Copilot custom agent** в `.github/agents/` и имейте `controlflow-planner` назначать её как `executor_agent` фазы. Рецепт и worked examples — в `docs/agent-engineering/NATIVE-DELEGATION-BOUNDARY.md §5`. Три verify-роли **не** воссоздаются как агенты — они inline-фазы `controlflow-verify`.

## Quality Gates

«Quality gates» в slim-модели означает вместе две вещи:

1. **Per-phase acceptance criteria плана + enum `quality_gates`** — что нативный Copilot должен удовлетворить, чтобы считать фазу завершённой. Enum:

| Gate | Значение |
|------|----------|
| `tests_pass` | Все тесты в целевом scope проходят. |
| `lint_clean` | Lint чистый. |
| `schema_valid` | Все произведённые schema валидны. |
| `safety_clear` | Нет неразрешённого safety-risk для фазы. |
| `human_approved_if_required` | Если требуется approval, он получен. |

2. **Два гейта пайплайна** — `controlflow-verify` (pre-execution, глава 07) и `controlflow-review` (post-execution, эта глава).

Legacy **Verification Build Gate** — отдельный Orchestrator-owned чек, который перезапускал build после каждой фазы — retired. Нативный Copilot сам верифицирует завершение фазы; `controlflow-review` — post-execution гейт, который ловит то, что пропускает нативное ревью.

## Ревью — `controlflow-review` (post-execution, слой поверх нативного)

`/controlflow-review` запускается после имплементации. Это **слой поверх** нативного Copilot code review, не замена. Механический / style-проход (lint-class проблемы, форматирование, rote pattern checks) принадлежит нативному Copilot code review и `security-review`. ControlFlow добавляет только то, чего нет в нативном ревью:

- **Сравнение с планом** — соответствует ли diff фазам, файлам и acceptance criteria плана? Пометить scope drift, пропущенные фазы, extra-phased работу, невыполненные acceptance criteria.
- **Проактивный поиск уязвимостей / ошибок** — отследить новые потоки данных до их эндпоинтов; проверить validation на каждой границе; найти error-пути, которые имплементация пропустила (absence mirages A11–A13); проверить отсутствие миграций или rollback (A16); проверить отсутствие security boundaries на чувствительных операциях (A17); где план объявил failure expectations, подтвердить, что имплементация их обрабатывает.
- **Дисциплина evidence** — пометить каждый finding severity, confidence, file, line, user impact и validation method. Различать **validated blockers** и **hypotheses**; явно указывать validation gaps.

Findings предъявляются первыми, упорядоченными по severity. Если их нет, skill так и говорит и называет residual risks или test gaps. Soft-метки (`Nit`, `Optional`, `FYI`) идут только **после** blocking findings — они не уровни severity и не должны прятать correctness-, security- или test-coverage-дефект.

### Оси ревью

Приоритизируйте correctness/functionality, security, data integrity, regression risk и contract drift **до** style. Maintainability / style-комментарии должны поддерживать поведенческий риск, а не хоронить его — и механическая сторона style — это задача нативного Copilot code review.

### Осторожность с размером изменения

Большие ревью теряют сигнал. Когда diff значительно больше примерно 100 изменённых строк или смешивает несвязанные concerns, `controlflow-review` просит split или ревьюит по файлам/областям риска с явным confidence limit.

### Review-Specific Failure Checks

- Не вести с nit'ов перед behavior-проверками.
- Не помечать missing tests как `FYI`, когда непротестированное поведение может регрессировать.
- Не заявлять blocker без validation evidence или явной метки unconfirmed-risk.
- Не дублировать механический проход нативного Copilot code review — делегируйте его.
- Не пропускать сравнение с планом, когда существует артефакт плана.

## Classification сбоев во время исполнения

Каждый сбой, записанный в lifecycle-секции плана (`## Progress`, `## Discoveries`, `## Idempotence & Recovery`), получает `failure_classification`:

| Класс | Значение | Кто маршрутизирует |
|-------|----------|---------------------|
| `transient` | Flaky тест, network timeout, временная недоступность tool; retry с тем же scope | Нативный Copilot |
| `fixable` | Мелкая исправимая проблема (опечатка, missing import, значение config); retry с fix hint | Нативный Copilot |
| `needs_replan` | Архитектурное несоответствие или missing dependency; делегировать Planner'у на targeted replan | Re-invoke `@controlflow-planner` |
| `escalate` | Уязвимость безопасности, риск целостности данных, неразрешимый blocker; остановиться и ждать human approval | Нативный Copilot останавливается; пользователь решает |
| `model_unavailable` | Routed/primary модель недоступна или unreachable; retry через нативную Copilot подмену модели, затем escalate при исчерпании | Нативный Copilot |

Retry routing, retry budgets и parallelism — задача нативного Copilot, не ControlFlow. `needs_replan` — единственный класс, который re-входит в пайплайн ControlFlow — он re-invoke'ит Planner для targeted replan, затем re-run'ит `controlflow-verify` до возобновления исполнения. См. главу 13 для полной taxonomy.

## Mid-Execution Clarification

Нативный Copilot обрабатывает mid-execution ambiguity. Если фазе нужно clarification, нативный Copilot surfaces его пользователю напрямую (через свою нативную поверхность approvals / ask-questions) и продолжает. Никакой `NEEDS_INPUT` routing-таблицы нет — это было концепцией Orchestrator'а.

Если ambiguity меняет **file scope, user-visible поведение, архитектуру или обработку destructive-risk**, пользователь re-invoke'ит `@controlflow-planner` для targeted replan, а не разрешает её inline. Planner читает существующий артефакт в `plans/`, обновляет затронутые фазы и re-run'ит `controlflow-verify` до возобновления исполнения.

## Завершение

После того как все фазы и `controlflow-review` вернут clean:

1. Верифицировать, что все acceptance criteria фаз выполнены (review уже сравнил diff с планом).
2. Добавить session-outcome запись в `plans/session-outcomes.md` через `plans/templates/session-outcome-template.md`.
3. Произвести completion summary для пользователя.

Session-outcome пишется **до** completion summary, так что пользователь видит summary после того, как telemetry flush'нулась.

## Commit Conventions

- Префикс из enum: `fix`, `feat`, `chore`, `test`, `refactor`.
- **Не** упоминать имена планов или номера фаз в commit-сообщениях.

## Почему Orchestrator-driven wave dispatch был retired

Краткая история, так как вопрос частый. Legacy Orchestrator владел lifecycle, эмиттил gate events, диспатчил фазы в waves, запускал per-phase CodeReviewer и маршрутизировал сбои по retry budget. С февраля 2026 Copilot делает всё это нативно: subagent dispatch + parallelism — GA default-on, `/plan` mode — GA, agentic code review — GA, approvals + custom instructions — GA.

Держать ControlFlow dispatch state machine поверх этого дублировало бы нативные возможности — именно то, что slim-модель запрещает (см. `docs/agent-engineering/NATIVE-DELEGATION-BOUNDARY.md`). Поэтому Orchestrator retired как поставляемый агент. ControlFlow оставляет то, чего Copilot не предоставляет нативно: _формат_ плана, адверсариальный _verify_-гейт, tier-gated _политику_ и слой scope-drift _review_. Само исполнение — запуск фаз, retry, parallelization — задача нативного Copilot.

## Типичные ошибки

- **Искать Orchestrator или wave scheduler.** Оба retired. План объявляет фазы; нативный Copilot исполняет их.
- **Трактовать `controlflow-review` как замену нативного Copilot code review.** Это **слой поверх** него. Запустите нативное code review (или `security-review`) сначала для механического прохода; `controlflow-review` потребляет и augments его вывод.
- **Пропуск `controlflow-review` на SMALL.** SMALL запускает review (см. таблицу тиров) — только TRIVIAL пропускает пайплайн.
- **Пропуск сравнения с планом.** Когда артефакт плана существует в `plans/<task-slug>-plan.md`, сравнение с планом обязательно — scope drift это review-проблема, не style-предпочтение.
- **Вести с nit'ов перед behavior-проверками.** Soft-метки (`Nit`, `Optional`, `FYI`) идут только после blocking findings.
- **Ожидать, что ControlFlow будет retry'ить, parallelize или маршрутизировать сбои.** Это задача нативного Copilot. ControlFlow только метит сбои (`needs_replan` re-входит в пайплайн; остальные — на обработку нативного Copilot).
- **Эвристически выводить `executor_agent` во время исполнения.** Planner объявляет `executor_agent` на фазу в артефакте; нативный Copilot читает его. Если поле отсутствует в legacy-плане, re-invoke Planner, а не угадывайте.

## Упражнения

1. **(новичок)** Откройте `.github/skills/controlflow-review/SKILL.md` и перечислите три вещи, которые ControlFlow добавляет поверх нативного Copilot code review.
2. **(новичок)** Откройте `schemas/planner.plan.schema.json` и найдите enum `quality_gates`. Перечислите все пять значений.
3. **(средний)** Фаза сбоит с `needs_replan`. Кто её маршрутизирует и какова единственная точка входа ControlFlow, которая re-входит в пайплайн? Что должно re-run'нуть до возобновления исполнения?
4. **(средний)** MEDIUM-tier план завершён имплементацией. Какой гейт запускается следующим и какие три вещи он добавляет поверх нативного Copilot code review?
5. **(продвинутый)** Diff трогает файл, не указанный ни в одном `files`-массиве фаз плана, и пропускает миграцию, которую пометила строка риска `migration_rollback` плана. Какие два `controlflow-review`-finding'а срабатывают и каким absence-миражам (A11–A17) они соответствуют?

## Контрольные вопросы

1. Что значит «исполнение — задача нативного Copilot» и какую retired-поверхность ControlFlow оно заменяет?
2. Что такое «quality gates» в slim-модели (два смысла)?
3. Назовите три вещи, которые `controlflow-review` добавляет поверх нативного Copilot code review.
4. Какой класс сбоев re-входит в пайплайн ControlFlow и как?
5. Почему Orchestrator-driven wave dispatch был retired, а не slimmed?

## См. также

- [Глава 05 — Пайплайн plan → verify → review](05-orchestration.md)
- [Глава 06 — Планирование](06-planning.md)
- [Глава 07 — Ревью-пайплайн (controlflow-verify)](07-review-pipeline.md)
- [Глава 13 — Таксономия сбоев](13-failure-taxonomy.md)
- [.github/skills/controlflow-review/SKILL.md](../../.github/skills/controlflow-review/SKILL.md)
- [docs/agent-engineering/NATIVE-DELEGATION-BOUNDARY.md](../agent-engineering/NATIVE-DELEGATION-BOUNDARY.md)