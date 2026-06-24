# Глава 17 — Глоссарий

Алфавитный справочник всех ключевых терминов slim-модели ControlFlow. Каждая запись содержит определение и ссылки на главы. Retired-концепции помечены как исторические.

---

## A

**ABSTAIN** — Статус выхода Planner'а: «не могу оценить с достаточной уверенностью». Не блокирует пайплайн; записывается как uncertainty. → Гл.06, Гл.07

**Acceptance criteria** — Измеримое условие, которое должно быть истинным, чтобы фаза считалась завершённой. Минимум одно измеримое observable outcome на фазу. → Гл.06, Гл.08, `schemas/planner.plan.schema.json`

**Agent (custom Copilot agent)** — Markdown-файл под `.github/agents/` с Copilot agent frontmatter (`name`, `description`, `tools`), который Copilot показывает в dropdown агентов. Slim-модель поставляет ровно один: `@controlflow-planner`. → Гл.04

**`@controlflow-planner`** — Единственный поставляемый агент ControlFlow, по пути `.github/agents/controlflow-planner.agent.md`. Производит schema-anchored планы; передаёт исполнение нативному Copilot. Использует Copilot Auto model picker (без `model:` frontmatter). → Гл.01, Гл.03, Гл.06

**Agent grants** — **Retired.** Legacy-файл `governance/agent-grants.json` больше не существует; subagent-governance делегирована нативному Copilot. → Гл.10

**AssumptionVerifier-subagent** — Метка inline verify-роли для `controlflow-verify` фазы 2 (mirage detection). Проверяет, что утверждения плана поддерживаются кодовой базой (taxonomy mirages P1–P10, A11–A17). Выполняется inline — никогда не `executor_agent`. → Гл.07, `schemas/assumption-verifier.plan-audit.schema.json`

---

## B

**Backbone pattern** — См. `docs/agent-engineering/MIGRATION-CORE-FIRST.md`. Общий ритм имплементации, который несёт `CoreImplementer-subagent`; расширяется UIImplementer и PlatformEngineer с domain-specific гейтами. → Гл.03

**Behavior contract** — `docs/agent-engineering/PROMPT-BEHAVIOR-CONTRACT.md`. Поведенческие инварианты (evidence over assertion, abstain on no harness, stop-the-line on regression). → Гл.04

**BrowserTester-subagent** — Концептуальная роль исполнителя для E2E browser-тестов и UI/accessibility-аудитов. Не поставляемый агент; воссоздайте как native Copilot custom agent согласно `NATIVE-DELEGATION-BOUNDARY.md §5`, если хотите вернуть персону. → Гл.03, `schemas/browser-tester.execution-report.schema.json`

---

## C

**`controlflow-plan`** — Plan skill по пути `.github/skills/controlflow-plan/`. Производит schema-anchored артефакт плана в `plans/`; single-source формат берёт из `schemas/planner.plan.schema.json` и `plans/templates/plan-document-template.md`. → Гл.06

**`controlflow-review`** — Review skill по пути `.github/skills/controlflow-review/`. Evidence-backed ревью, слой поверх нативного Copilot code review; добавляет сравнение plan-vs-implementation на scope drift и проактивный поиск уязвимостей/ошибок. → Гл.08

**`controlflow-verify`** — Verify skill по пути `.github/skills/controlflow-verify/`. Inline адверсариальная верификация (ноль сабагентов); tier-gated фазы (structural audit, mirage detection, executability cold-start); эмиттит `APPROVED` / `NEEDS_REVISION` / `REJECTED`. → Гл.07

**CodeMapper-subagent** — Концептуальная роль исполнителя для read-only codebase exploration. Возвращает discovery-отчёт. Не поставляемый агент. → Гл.03, `schemas/code-mapper.discovery.schema.json`

**CodeReviewer-subagent** — Концептуальная роль исполнителя для post-implementation review. В slim-модели `controlflow-review` уже наслаивает ревью поверх нативного Copilot code review; воссоздавайте эту персону, только если хотите dedicated review-агент (см. `NATIVE-DELEGATION-BOUNDARY.md §5`). → Гл.03, Гл.08, `schemas/code-reviewer.verdict.schema.json`

**Cold start** — Состояние, в котором свежий исполнитель приходит на фазу только с репозиторием и описанием плана, без дополнительного контекста. `ExecutabilityVerifier-subagent` (verify фаза 3) проверяет именно это. → Гл.07

**Complexity tier** — `TRIVIAL` / `SMALL` / `MEDIUM` / `LARGE`. Назначается Planner'ом; определяет, запускаются ли plan, verify и review вообще и сколько verify-фаз запускается. → Гл.05, Гл.06, Гл.07, Гл.08

**Confidence** — Числовое значение (0–1) в заголовке плана, отражающее уверенность Planner'а. Ниже 0.9 план автоматически `NEEDS_REVISION`. → Гл.06

**Conceptual role** — Помеченная ответственность (например, `CoreImplementer-subagent`, `PlanAuditor-subagent`), которую Planner назначает в фазах плана (`executor_agent`) или которую `controlflow-verify` выполняет inline. **Не** поставляемый файл агента. Slim-модель поставляет один агент; восемь имён ролей исполнителей и три имени verify-ролей — концептуальные метки, исполняемые нативным Copilot. → Гл.02, Гл.03

**ControlFlow** — Тонкий, не дублирующий слой поверх нативных агентных возможностей GitHub Copilot. Поставляет один агент и три skill'а; оставляет только то, чего Copilot не предоставляет нативно (schema-enforced формат плана, адверсариальный verify, tier-gated политика, scope-drift ревью, eval-харнесс на contract-drift). → Гл.00, `docs/agent-engineering/NATIVE-DELEGATION-BOUNDARY.md`

**CoreImplementer-subagent** — Концептуальная роль исполнителя для backend-имплементации (код, тесты, рефакторинг). Канонический backbone для ролей исполнителей. → Гл.03, `schemas/core-implementer.execution-report.schema.json`

---

## D

**Delegation boundary** — Правило, по которому ControlFlow не поставляет поверхность, дублирующую нативную возможность Copilot. Каноническая запись — `docs/agent-engineering/NATIVE-DELEGATION-BOUNDARY.md`. → Гл.02, Гл.03, Гл.10

**Definition of done** — Список условий, которые должны быть истинными, чтобы фаза считалась завершённой. Совпадает с `quality_gates` фазы. → Гл.08

**Drift check** — Тест в `evals/drift-checks.mjs`, проверяющий, что формат плана, taxonomy ролей и governance остаются согласованными (например, зеркало `plans/project-context.md` ↔ `governance/project-context-registry.json`). → Гл.04, Гл.14

---

## E

**Eval harness** — Оффлайн-набор тестов в `evals/`. Никаких live-агентов, никаких сетевых вызовов. → Гл.14

**Escalate** — Классификация сбоя: риск безопасности/данных или неразрешимый блокер. Нативный Copilot останавливается и ждёт user approval. Ноль автоматических retry. → Гл.13

**ExecutabilityVerifier-subagent** — Метка inline verify-роли для `controlflow-verify` фазы 3 (executability cold-start). Симулирует свежего исполнителя, начинающего Phase 1 только с планом. Запускается на тире `LARGE` или при срабатывании HIGH-risk override. → Гл.07, `schemas/executability-verifier.execution-report.schema.json`

**executor_agent** — Обязательное поле фазы; enum из восьми имён ролей исполнителей, enforced `schemas/planner.plan.schema.json`. Три inline verify-роли исключены из этого enum. → Гл.06, Гл.08

---

## F

**Failure classification** — Обязательное поле, когда фаза или verdict записывает сбой. Значения: `transient`, `fixable`, `needs_replan`, `escalate`, `model_unavailable`. (`PlanAuditor` и `AssumptionVerifier` исключают `transient`.) → Гл.13

**Fixable** — Классификация сбоя: мелкая исправимая ошибка. Нативный Copilot retry с fix hint. → Гл.13

**Frontmatter** — YAML-метаданные в начале файла Copilot-агента (`.github/agents/*.agent.md`): `description`, `name`, `tools`. Без строки `model:` по умолчанию. → Гл.04

---

## G

**Governance** — Конфиги в `governance/`, определяющие runtime-политику, реестр ролей, canonical sources и rename-allowlist. Slim-модель оставляет четыре governance-файла: `runtime-policy.json`, `project-context-registry.json`, `canonical-source-matrix.json`, `rename-allowlist.json`. → Гл.10

**Ground truth** — Для doc-count-проверок: количества файлов на диске, которые eval-харнесс разрешает в runtime (схемы, skills-паттерны, governance-файлы, root agent-файлы). Указание количества, не совпадающего с ground truth в allowlisted-документе, валит Pass 15. → Гл.14

---

## H

**Handoff** — Поле выхода Planner'а (`handoff: {target, prompt}`), указывающее пользователю путь к артефакту плана и следующий шаг (`/controlflow-verify`). Planner не диспатчит исполнение; он handoff'ает. → Гл.06

---

## I

**Idea Interview** — Фаза clarifying-вопросов Planner'а, запускаемая, когда запрос расплывчат. Спрашивает пользователя напрямую, когда ответ меняет file scope, user-visible поведение, архитектуру или обработку destructive-risk; иначе записывает bounded assumption. → Гл.06

---

## L

**LARGE** — Высший complexity tier. `controlflow-verify` запускает все три фазы (structural audit + mirage detection + executability cold-start). Форсируется количеством файлов (пятнадцать или больше) или любой неразрешённой HIGH-impact записью semantic-risk. → Гл.05, Гл.07

---

## M

**Memory architecture** — Трёхслойная модель памяти (session / task-episodic / repo-persistent). → Гл.12, `docs/agent-engineering/MEMORY-ARCHITECTURE.md`

**Mirage** — Утверждение плана, не поддерживаемое реальной кодовой базой. Обнаруживается `AssumptionVerifier-subagent` (verify фаза 2). Полная taxonomy (presence P1–P10, absence A11–A17) — в `.github/skills/controlflow-verify/references/mirage-patterns.md`. → Гл.07

**Model routing** — **Retired.** Legacy-файлы `governance/model-routing.json` и `docs/agent-engineering/MODEL-ROUTING.md` больше не существуют. Выбор модели делегирован нативному Copilot (Auto model picker). Колонка `Model Routing Role` в реестре — концептуальный capability tier, не routing-поверхность. → Гл.10

**model_unavailable** — Классификация сбоя: routed/primary модель недоступна или unreachable. Нативный Copilot подменяет модель, затем escalate при исчерпании. → Гл.13

---

## N

**Native Copilot** — Платформа VS Code Copilot, предоставляющая custom agents, subagent dispatch + parallelism, Plan mode, agentic code review, skills library, MCP, model selection, approvals и custom instructions. ControlFlow наслаивается поверх без дублирования. → Гл.02, `docs/agent-engineering/NATIVE-DELEGATION-BOUNDARY.md`

**needs_replan** — Классификация сбоя: архитектурное несоответствие или missing dependency. Пользователь re-invoke'ит `@controlflow-planner` для targeted replan — единственный класс, который re-входит в пайплайн ControlFlow. → Гл.13

**NEEDS_REVISION** — Verdict `controlflow-verify`: ambiguous Phase 1, непроверенные пути, vague критерии или структурный сбой. Re-invoke Planner для правки, затем re-verify. → Гл.07

**NOTES.md** — Файл repo-persistent active-objective state. Обновляется на границах фаз; держится в бюджете до двадцати строк. → Гл.12

---

## O

**Orchestrator** — **Retired — только концептуальный дирижёр.** Legacy-агент, который вёл state machine (`PLANNING` / `WAITING_APPROVAL` / `PLAN_REVIEW` / `ACTING` / `REVIEWING` / `COMPLETE`), диспатчил сабагентов в waves и маршрутизировал сбои. В slim-модели Planner плюс нативный Copilot покрывают оркестрацию; state machine, dispatch, waves и gates ушли. См. «пайплайн plan → verify → review». → Гл.05

---

## P

**P.A.R.T.** — **Retired как обязательный шаблон.** Legacy четырёхсекционный порядок (Prompt / Archive / Resources / Tools), enforced на каждом `*.agent.md`. Дисциплина (role / scope / contracts / tools как prose) всё ещё информирует написание хорошего custom agent prompt, но это guidance, не обязательный шаблон, и drift-checker больше не аудирует его. → Гл.04

**Phase** — Единица плана с `executor_agent`, acceptance criteria, quality gates и steps. → Гл.06, Гл.08

**Plan artifact** — Markdown-файл, который Planner записывает в `plans/<task-slug>-plan.md`, conforming to `schemas/planner.plan.schema.json`. Reviewable-вход, не implicit approval. → Гл.05, Гл.06

**PlanAuditor-subagent** — Метка inline verify-роли для `controlflow-verify` фазы 1 (structural audit). Подтверждает соответствие schema/template, десять секций по порядку, семь категорий риска, executor enum, правила Mermaid. → Гл.07, `schemas/plan-auditor.plan-audit.schema.json`

**Planner** — Роль plan-producer, поставляемая как `@controlflow-planner`. Ведёт Idea Interview, назначает tier, заполняет семь категорий риска, объявляет `executor_agent` на фазу, пишет артефакт. Не пишет код. → Гл.03, Гл.06

**PlatformEngineer-subagent** — Концептуальная роль исполнителя для CI/CD, контейнеров и infrastructure-deploy. Добавляет approval-, idempotency- и rollback-гейты поверх backbone. → Гл.03, `schemas/platform-engineer.execution-report.schema.json`

**PreFlect** — Обязательная self-check перед каждой action-batch, с `skills/patterns/preflect-core.md`. Четыре класса риска: destructive, scope-drift, assumption, dependency. Решение: `GO` / `PAUSE` / `ABORT`. → Гл.05, Гл.11

**Prompt** — Тело файла custom agent, описывающее mission роли, scope IN/OUT, правило abstention и output discipline. «P» в retired-акрониме P.A.R.T. → Гл.04

**Pipeline** — Поток plan → verify → review поверх нативного Copilot: `controlflow-plan` (Planner производит артефакт) → `controlflow-verify` (inline адверсариальный аудит) → нативный Copilot исполняет фазы → `controlflow-review` (слой scope-drift + evidence). Три гейта, а не state machine. → Гл.05

**Quality gate** — Условие готовности фазы. Enum: `tests_pass`, `lint_clean`, `schema_valid`, `safety_clear`, `human_approved_if_required`. → Гл.08

---

## R

**REJECTED** — Verdict `controlflow-verify`: структурный изъян; scope не deliverable как написано. Не начинать кодинг; запросить направление у пользователя или replan с нуля. → Гл.07

**REPLAN_REQUIRED** — Статус выхода Planner'а: требования нуждаются в clarification перед планированием. Блокирует прогресс. → Гл.06

**Repo memory** — `/memories/repo/` — durable codebase-факты. Create-only (без правок). → Гл.12

**Repo-persistent** — Третий слой памяти: `NOTES.md` + `/memories/repo/`. Переживает reset-контекста. → Гл.12

**Researcher-subagent** — Концептуальная роль исполнителя для research и evidence. Возвращает findings с цитатами. → Гл.03, `schemas/researcher.research-findings.schema.json`

**risk_review** — Поле плана с семью категориями semantic risk, dispositions и applicability. → Гл.06, Гл.07

---

## S

**Schema** — Файл `schemas/*.json` (JSON Schema draft 2020-12). Контрактная документация + ссылки на eval-фикстуры в slim-модели; не runtime-валидируемые inter-agent сообщения. Всего двадцать схем. → Гл.09

**Scope drift** — Исполнение действий за пределами объявленного scope плана. Обнаруживается сравнением plan-vs-implementation в `controlflow-review`. → Гл.08, Гл.11

**Semantic risk taxonomy** — Семь категорий риска в `risk_review`: `data_volume`, `performance`, `concurrency`, `access_control`, `migration_rollback`, `dependency`, `operability`. Ни одна не пропускается; `not_applicable` с обоснованием, когда не релевантно. → Гл.06

**Session memory** — Слой 1: `/memories/session/`. Conversation-scoped scratch. → Гл.12

**Skill** — Переиспользуемый Markdown-паттерн. Две поверхности: три workflow skill'а в `.github/skills/controlflow-{plan,verify,review}/` и value-add паттерны в `skills/patterns/`. → Гл.11

**Skill index** — `skills/index.md`. Реестр, из которого Planner инжектит ≤3 паттерна на фазу через `skill_references`. → Гл.11

**Skill references** — Поле `skill_references` в фазе плана, перечисляющее value-add паттерны, которые Planner инжектит (≤3 на фазу). → Гл.06, Гл.11

**SMALL** — Complexity tier. `controlflow-verify` запускает только фазу 1 (structural audit). → Гл.07

**Subagent** — **Концептуальная роль исполнителя (нативный Copilot исполняет).** В slim-модели имена `*-subagent` — это метки ролей, которые Planner назначает в фазах плана; нативный Copilot исполняет их inline. Поставляемых ControlFlow-сабагентов нет. → Гл.03

---

## T

**Task-episodic** — Слой 2: `plans/artifacts/<task-slug>/`. Per-task revision history и deliverables. → Гл.12

**TDD** — Test-driven development. Применяется через `skills/patterns/tdd-patterns.md`. → Гл.11

**TechnicalWriter-subagent** — Концептуальная роль исполнителя для документации и code-doc parity. → Гл.03, `schemas/technical-writer.execution-report.schema.json`

**Tier-gated** — Политика, по которой complexity tier определяет, запускаются ли plan, verify и review вообще и сколько verify-фаз запускается. → Гл.05, Гл.07

**Tool grants** — **Retired.** Legacy-файл `governance/tool-grants.json` больше не существует. Доступ к инструментам делегирован нативному Copilot (объявляется per-agent в `tools:` frontmatter при воссоздании). → Гл.10

**Transient** — Классификация сбоя: временная ошибка (timeout, rate limit). Нативный Copilot retry с тем же scope. → Гл.13

**TRIVIAL** — Низший complexity tier. Plan, verify и review все пропускаются. → Гл.07

---

## U

**UIImplementer-subagent** — Концептуальная роль исполнителя для frontend-имплементации (UI, styling, responsive, accessibility). Добавляет a11y/responsive/design-system-гейты поверх backbone. → Гл.03, `schemas/ui-implementer.execution-report.schema.json`

---

## V

**Verdict** — Решение, эмиттируемое skill'ом. `controlflow-verify` → `APPROVED` / `NEEDS_REVISION` / `REJECTED`; `controlflow-review` → findings + verdict. Гейт блокирует продвижение, пока не разрешён. → Гл.05, Гл.07, Гл.08

**Verdict gate** — Точка решения в пайплайне. Verify-гейт блокирует исполнение до `APPROVED`; review-гейт блокирует публикацию до ревью findings пользователем. → Гл.05

---

## W

**Workflow state (legacy)** — **Retired.** Бывший enum узлов state machine Orchestrator'а (`PLANNING` / `WAITING_APPROVAL` / `ACTING` / `REVIEWING` / `COMPLETE`). Не поставляется в slim-модели. Гейты пайплайна заменяют его. → Гл.05

---

## См. также

- [Глава 00 — Введение](00-introduction.md)
- [Глава 18 — FAQ](18-faq.md)
- [plans/project-context.md](../../plans/project-context.md)
- [docs/agent-engineering/NATIVE-DELEGATION-BOUNDARY.md](../agent-engineering/NATIVE-DELEGATION-BOUNDARY.md)