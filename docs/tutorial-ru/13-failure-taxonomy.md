# Глава 13 — Таксономия сбоев

## Зачем эта глава

Понять, **как ControlFlow метит сбои**, чтобы ошибки разрешались эффективно: retry, когда retry помогает, escalate, когда нужен escalate, re-invoke Planner'а, когда проблема в самом плане — без попадания в бесконечный цикл.

Главное переосмысление для читателей legacy-туториала: пять классов сбоев всё ещё метят сбои в lifecycle-секциях плана, но **retry routing, retry budgets и parallelism — теперь задача нативного Copilot, а не Orchestrator dispatch-таблицы**. В slim-модели нет `Orchestrator.agent.md`. Planner или нативный Copilot retry'ит по классу; `needs_replan` — единственный класс, который re-входит в ControlFlow пайплайн — он re-invoke'ит `@controlflow-planner` для targeted replan.

## Ключевые понятия

- **`failure_classification`** — обязательное поле в каждой записи сбоя в lifecycle-секции плана (`## Progress`, `## Discoveries`, `## Idempotence & Recovery`), когда status — `FAILED`, `NEEDS_REVISION`, `NEEDS_INPUT` или `REJECTED`.
- **Класс сбоя** — один из `transient`, `fixable`, `needs_replan`, `escalate`, `model_unavailable`. Пять классов, никаких других.
- **Routing** — кто действует по классификации. В slim-модели routing — задача нативного Copilot для четырёх из пяти классов; `needs_replan` re-входит в ControlFlow пайплайн, re-invoke'я Planner.
- **Re-enter the pipeline** — единственная точка входа ControlFlow для сбоя: `needs_replan` re-invoke'ит `@controlflow-planner` для targeted replan, затем `controlflow-verify` гейтит пересмотренный план до возобновления исполнения.
- **NEEDS_INPUT** — отдельный путь, независимый от `failure_classification`; обрабатывается clarification-поверхностью нативного Copilot (см. главу 05).

## Когда `failure_classification` обязательна

Если status — один из следующих, `failure_classification` **required** на lifecycle-записи:
- `FAILED`
- `NEEDS_REVISION`
- `NEEDS_INPUT`
- `REJECTED`

**Исключение:** inline verify роли (`PlanAuditor-subagent`, `AssumptionVerifier-subagent`, `ExecutabilityVerifier-subagent`) **исключают `transient`** — их сбои структурные и не-transient по природе.

## 5 классов классификации

| Класс | Значение | Пример |
|-------|----------|--------|
| `transient` | Временная tool-ошибка; retry с идентичным scope | Network timeout, rate limit (HTTP 429), flaky test |
| `fixable` | Мелкая исправимая ошибка; retry с fix hint | Missing import, опечатка в config |
| `needs_replan` | Архитектурное несоответствие или missing dependency; делегировать Planner'у на targeted replan | Зависимость не существует, API incompatibility |
| `escalate` | Security risk или неразрешимый blocker; стоп и ожидание human approval | Риск потери данных, уязвимость безопасности |
| `model_unavailable` | Routed/primary модель недоступна или unreachable; retry через нативную Copilot подмену модели, затем escalate при исчерпании | Provider outage, model deprecation |

Пять классов зеркалят failure-classification enum в `.github/copilot-instructions.md` и `governance/runtime-policy.json`.

## Routing Flowchart

```mermaid
flowchart TD
    Fail[Сбой записан в lifecycle-секции] --> Class{failure_classification?}
    Class -->|transient| TR[Нативный Copilot: retry идентичный scope]
    Class -->|fixable| FX[Нативный Copilot: retry с fix hint]
    Class -->|needs_replan| NR[Re-invoke "@controlflow-planner" для targeted replan]
    Class -->|escalate| ES[STOP → ожидание human approval]
    Class -->|model_unavailable| MU[Нативный Copilot: retry с model substitution, затем escalate при исчерпании]
    NR --> V["controlflow-verify гейтит пересмотренный план"]
    V -->|APPROVED| Resume[Возобновить исполнение]
    V -->|NEEDS_REVISION/REJECTED| NR
```

## Routing-таблица

| Класс | Кто маршрутизирует | Действие |
|----------------|-----------|--------|
| `transient` | Нативный Copilot | Retry ту же фазу с идентичным scope |
| `fixable` | Нативный Copilot | Retry ту же фазу с `fix_hint` в контексте |
| `needs_replan` | Re-invoke `@controlflow-planner` | Делегировать Planner'у на targeted phase replan; `controlflow-verify` гейтит пересмотренный план до возобновления исполнения |
| `escalate` | Нативный Copilot останавливается; пользователь решает | STOP; предъявить blocker пользователю и ждать human approval |
| `model_unavailable` | Нативный Copilot | Retry с нативной Copilot model substitution, затем escalate при исчерпании |

Retry budgets, retry-attempt counters и parallelism — задача нативного Copilot, не ControlFlow. ControlFlow только метит сбой; `needs_replan` — единственный класс, который re-входит в ControlFlow пайплайн.

## Почему routing — задача нативного Copilot

Legacy Orchestrator владел retry budget таблицей, per-wave throttling, exponential backoff signaling и dispatch state machine, который маршрутизировал сбои по классу. С февраля 2026 Copilot делает subagent dispatch + parallelism нативно (GA default-on), approvals нативно и model selection нативно. Держать ControlFlow dispatch state machine поверх этого дублировало бы нативные возможности — именно то, что slim-модель запрещает. Поэтому Orchestrator retired как поставляемый агент (см. главу 05); retry routing и parallelism — задача нативного Copilot.

Что ControlFlow оставляет — это **метку** (пятиклассная taxonomy) и **единственную точку re-entry** (`needs_replan` re-invoke'ит Planner, а `controlflow-verify` re-гейтит пересмотренный план). Всё остальное делегировано.

## Кто возвращает что

| Концептуальная роль | Возможные классификации |
|---------------------|-------------------------|
| CoreImplementer-subagent | `transient`, `fixable`, `needs_replan`, `escalate`, `model_unavailable` |
| UIImplementer-subagent | `transient`, `fixable`, `needs_replan`, `escalate`, `model_unavailable` |
| PlatformEngineer-subagent | `transient`, `fixable`, `needs_replan`, `escalate`, `model_unavailable` |
| TechnicalWriter-subagent | `transient`, `fixable`, `needs_replan`, `escalate`, `model_unavailable` |
| BrowserTester-subagent | `transient`, `fixable`, `needs_replan`, `escalate`, `model_unavailable` |
| PlanAuditor-subagent | `fixable`, `needs_replan`, `escalate` (НЕТ `transient`, НЕТ `model_unavailable`) |
| AssumptionVerifier-subagent | `fixable`, `needs_replan`, `escalate` (НЕТ `transient`, НЕТ `model_unavailable`) |
| ExecutabilityVerifier-subagent | `fixable`, `needs_replan`, `escalate` (НЕТ `transient`, НЕТ `model_unavailable`) |
| `@controlflow-planner` | `needs_replan`, `escalate` |

Это концептуальные роли (см. главу 03), исполняемые inline нативным Copilot. Inline verify роли исключают `transient` и `model_unavailable`, потому что их сбои структурные — model outage не делает план структурно валидным.

## NEEDS_INPUT — отдельный путь

`NEEDS_INPUT` — отдельный routing-путь, **независимый от** `failure_classification`. Когда фаза возвращает `status: "NEEDS_INPUT"` с `clarification_request`, нативный Copilot surfaces его пользователю напрямую (своей нативной approvals/ask-questions поверхностью) и продолжает. Никакой ControlFlow routing-таблицы для NEEDS_INPUT нет — это было концепцией Orchestrator'а.

Если clarification меняет file scope, user-visible поведение, архитектуру или обработку destructive-risk, пользователь re-invoke'ит `@controlflow-planner` для targeted replan, а не разрешает её inline (см. главу 05).

Формат `clarification_request` (см. `schemas/clarification-request.schema.json`):
- `question`
- `options[]` — каждый с `label`, `pros`, `cons`, `affected_files`, `recommended`
- `recommendation_rationale`
- `impact_analysis`

## End-to-End сценарий walkthrough

**Сценарий:** Phase 3 сбоит во время исполнения.

1. Исполнитель возвращает `status: FAILED`, `failure_classification: transient`. → Нативный Copilot retry'ит (retry 1).
2. Тот же сбой. → Нативный Copilot retry'ит (retry 2).
3. Тот же сбой снова. → Retry budget нативного Copilot исчерпан; сбой реклассифицируется или эскалируется. Если пользователь считает, что проблема в сети, он инструктирует нативный Copilot retry'ить после ожидания.
4. Исполнитель возвращает `COMPLETE`. Фаза продолжается.

**Сценарий:** Phase 3 сбоит с `needs_replan`.

1. Исполнитель возвращает `status: FAILED`, `failure_classification: needs_replan`. → Пользователь re-invoke'ит `@controlflow-planner` с записью сбоя.
2. Planner читает существующий артефакт в `plans/`, обновляет затронутые фазы и перезапускает `controlflow-verify`.
3. `controlflow-verify` возвращает `APPROVED`. Исполнение возобновляется по пересмотренному плану.

## Output Requirements

При записи `failure_classification` в lifecycle-секцию плана включите:
- `failure_classification` (строка)
- `failure_reason` (описание для routing)
- `fix_hint` (для `fixable` — что именно исправить)
- `escalation_details` (для `escalate` — почему нужно вмешательство человека)

Эти поля определены в соответствующих execution-report схемах в `schemas/`.

## Типичные ошибки

- **Трактовать NEEDS_INPUT как `failure_classification`.** Нет — это отдельный путь, обрабатываемый clarification-поверхностью нативного Copilot.
- **Продолжать после пустого ответа.** Silent failure — должен быть пойман, не проигнорирован.
- **Давать inline verify роли `transient` или `model_unavailable` классификацию.** Запрещено — verifier'ы исключают оба по контракту; их сбои структурные.
- **Ожидать, что ControlFlow будет retry'ить, parallelize или throttling'ать.** Это задача нативного Copilot. ControlFlow только метит сбои; `needs_replan` re-входит в пайплайн.
- **Предполагать, что `needs_replan` чинит текущую фазу in place.** Он переписывает затронутые фазы через Planner и перезапускает `controlflow-verify` — не in place.
- **Искать retired Orchestrator retry-budget таблицу.** Её нет. Retry budgets и parallelism — нативного Copilot.

## Упражнения

1. **(новичок)** Исполнитель = CoreImplementer-subagent, сбой = «npm registry недоступен 30 секунд». Классификация?
2. **(новичок)** Verify role = PlanAuditor-subagent, сбой = «архитектурная секция ссылается на модуль, которого не существует». Классификация?
3. **(средний)** Фаза сбоит с `model_unavailable`. Кто её маршрутизирует и каково действие?
4. **(средний)** Фаза сбоит с `needs_replan`. Кто её маршрутизирует и какова единственная точка входа ControlFlow, которая re-входит в пайплайн?
5. **(продвинутый)** Фаза сбоит с `needs_replan` mid-execution. Проследите точную последовательность: кто re-invoke'ится, какой артефакт обновляется, какой гейт перезапускается, какой verdict позволяет исполнению возобновиться.

## Контрольные вопросы

1. Назовите 5 классов failure classification.
2. Когда `failure_classification` обязательна?
3. Кто исключает `transient` и `model_unavailable`, и почему?
4. Какой класс сбоев re-входит в ControlFlow пайплайн и как?
5. Почему retry routing — задача нативного Copilot, а не Orchestrator dispatch-таблица?

## См. также

- [Глава 05 — Пайплайн plan → verify → review](05-orchestration.md)
- [Глава 08 — Пайплайн исполнения](08-execution-pipeline.md)
- [docs/agent-engineering/CLARIFICATION-POLICY.md](../agent-engineering/CLARIFICATION-POLICY.md)
- [schemas/clarification-request.schema.json](../../schemas/clarification-request.schema.json)
- [.github/copilot-instructions.md](../../.github/copilot-instructions.md)