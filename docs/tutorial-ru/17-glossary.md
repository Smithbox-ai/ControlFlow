# Глава 17 — Глоссарий

> Алфавитный справочник терминов. В скобках — оригинальный английский термин. После определения — ссылки на главы, где термин подробно разбирается.

---

**ABSTAIN** — Терминальный статус Planner-а, когда после уточнений и discovery остаются неразрешимые блокеры. Не failure, а сигнал «не могу безопасно дать план». Ср. с `REPLAN_REQUIRED`. → [Глава 06](06-planning.md).

**Acceptance criteria** — Критерии приёмки фазы. Минимум 1 на фазу, обязательное поле в `planner.plan.schema.json`. Должны быть проверяемы автоматически. → [Глава 06](06-planning.md), [Глава 08](08-execution-pipeline.md).

**ACTING** — Состояние Orchestrator-а во время исполнения фазы. Один из 5 узлов state machine. → [Глава 05](05-orchestration.md).

**Agent** — Файл `<Name>.agent.md` в корне репо с структурой P.A.R.T. описывающий поведенческий контракт LLM-агента. → [Глава 03](03-agent-roster.md), [Глава 04](04-part-spec.md).

**Agent grants** — Канонические права тулз агента в `governance/agent-grants.json`, организованные семантически (read-only / fetch / etc.). → [Глава 10](10-governance.md).

**AssumptionVerifier-subagent** — Adversarial-ревьюер плана, ищет mirages (assumption-fact confusion) по 17 паттернам. → [Глава 03](03-agent-roster.md), [Глава 07](07-review-pipeline.md).

**Backbone pattern** — Pattern из `MIGRATION-CORE-FIRST.md`: сначала строим shared backbone, потом расходимся по специализациям. → [Глава 10](10-governance.md).

**Batch approval** — Стратегия Orchestrator-а: одно одобрение на волну, не на каждую фазу. Исключение — destructive операции. → [Глава 05](05-orchestration.md), [Глава 08](08-execution-pipeline.md).

**Behavior contract** — `docs/agent-engineering/PROMPT-BEHAVIOR-CONTRACT.md`. Поведенческие инварианты, дополняющие P.A.R.T.-структурные. → [Глава 04](04-part-spec.md), [Глава 14](14-evals.md).

**BrowserTester-subagent** — Агент, прогоняющий E2E браузер-тесты с health-first гейтом. → [Глава 03](03-agent-roster.md).

**Budget tracking** — Skill-pattern (`budget-tracking.md`). Учёт токен/wall-clock. → [Глава 11](11-skills.md).

**Clarification policy** — `docs/agent-engineering/CLARIFICATION-POLICY.md`. 5 классов уточнений: scope ambiguity, architecture fork, user preference, destructive-risk approval, repository structure change. → [Глава 06](06-planning.md).

**Clarification request** — Schema (`clarification-request.schema.json`). Payload при `NEEDS_INPUT`. → [Глава 09](09-schemas.md).

**CodeMapper-subagent** — Read-only исследователь репо, выдаёт `discovery` отчёт. → [Глава 03](03-agent-roster.md).

**CodeReviewer-subagent** — Пост-implementation ревьюер. Phase mode и Final mode. Никогда не fix-ит. → [Глава 03](03-agent-roster.md), [Глава 08](08-execution-pipeline.md).

**Cold-start** — Принцип ExecutabilityVerifier: «представь, что только сейчас увидел задачу — могу ли её выполнить?». → [Глава 07](07-review-pipeline.md), [Глава 15](15-case-studies.md).

**COMPLETE** — Финальное состояние Orchestrator-а. → [Глава 05](05-orchestration.md).

**Completion gate** — Финальная проверка после всех фаз: cross-phase consistency + опциональный final review. → [Глава 05](05-orchestration.md), [Глава 08](08-execution-pipeline.md).

**Complexity tier** — Один из 4: TRIVIAL, SMALL, MEDIUM, LARGE. Определяет ревью-pipeline и iteration cap. → [Глава 06](06-planning.md), [Глава 07](07-review-pipeline.md).

**Confidence** — Числовое значение 0–1 в выходах Planner и Orchestrator. Ниже порога → ABSTAIN. → [Глава 05](05-orchestration.md), [Глава 06](06-planning.md).

**ControlFlow** — Имя проекта. Prompts/governance/eval репо для multi-agent оркестрации. → [Глава 00](00-introduction.md).

**Convergence detection** — Детектор стагнации в Plan Review: если итерация ≥3 и улучшение <5% — стагнация. → [Глава 07](07-review-pipeline.md).

**CoreImplementer-subagent** — Backend/general-purpose имплементер. → [Глава 03](03-agent-roster.md).

**Definition of done** — Пункт акцептации в execution-report-схемах. → [Глава 09](09-schemas.md).

**Delegation protocol** — Schema (`orchestrator.delegation-protocol.schema.json`). Подгружается on-demand. → [Глава 09](09-schemas.md).

**Drift check** — Часть eval-харнесса (`drift-checks.mjs`). Проверяет P.A.R.T. order, frontmatter, tool-grants, allowlist. → [Глава 14](14-evals.md).

**Eval harness** — `evals/`. Оффлайн validation suite. `cd evals && npm test`. → [Глава 14](14-evals.md).

**Escalate** — Failure class для проблем, требующих человека. Лимит 0 retry. → [Глава 13](13-failure-taxonomy.md).

**ExecutabilityVerifier-subagent** — Симулятор cold-start, проверяет первые 3 задачи на executable. → [Глава 03](03-agent-roster.md), [Глава 07](07-review-pipeline.md).

**executor_agent** — Поле в каждой phase плана. Authoritative для dispatch. Enum 8 значений. → [Глава 06](06-planning.md), [Глава 08](08-execution-pipeline.md).

**Failure classification** — Обязательное поле при не-успешном статусе. 4 значения: transient/fixable/needs_replan/escalate. → [Глава 13](13-failure-taxonomy.md).

**Final review gate** — Опциональный гейт после всех фаз. Авто для LARGE. CodeReviewer в final mode. → [Глава 08](08-execution-pipeline.md).

**Fixable** — Failure class для маленьких исправимых дефектов. Лимит 1 retry. → [Глава 13](13-failure-taxonomy.md).

**Frontmatter** — YAML-блок в начале `*.agent.md` с полями `description`, `tools`, `model`, `model_role`. → [Глава 04](04-part-spec.md).

**Gate event** — Структурное событие на переходе Orchestrator-а. Schema: `orchestrator.gate-event.schema.json`. → [Глава 05](05-orchestration.md), [Глава 09](09-schemas.md).

**Governance** — 7 JSON-файлов в `governance/`. Single source of truth для прав и runtime-параметров. → [Глава 10](10-governance.md).

**Handoff** — Передача артефакта от одного агента другому через `plan_path` или подобное. Не implicit approval. → [Глава 06](06-planning.md), [Глава 15](15-case-studies.md).

**HIGH_RISK_APPROVAL_GATE** — Gate-event type, требующий явного одобрения пользователя. → [Глава 05](05-orchestration.md).

**Idea interview** — Шаг 0 Planner-а: clarification gate для расплывчатых запросов. → [Глава 06](06-planning.md), [Глава 15](15-case-studies.md).

**Iteration index** — Поле в gate-event-ах и delegation-payload-ах. Счётчик ревью-итераций. → [Глава 05](05-orchestration.md), [Глава 07](07-review-pipeline.md).

**LARGE** — Самый сложный тир. Полный ревью-pipeline (PA + AV + EV). → [Глава 06](06-planning.md), [Глава 07](07-review-pipeline.md).

**Memory architecture** — Трёхслойная модель: session / task-episodic / repo-persistent. → [Глава 12](12-memory.md).

**Mirage** — Assumption-fact confusion в плане. Целевая дичь AssumptionVerifier. → [Глава 07](07-review-pipeline.md).

**Model role** — Логическая роль модели в frontmatter (`research-capable`, `code-implementer`, …). Резолвится через `model-routing.json`. → [Глава 10](10-governance.md).

**NEEDS_INPUT** — Статус subagent-а, означающий, что нужно уточнение. С `clarification_request` → отдельный routing path через `vscode/askQuestions`. → [Глава 05](05-orchestration.md), [Глава 13](13-failure-taxonomy.md).

**needs_replan** — Failure class для архитектурных несоответствий. Routing к Planner. Лимит 1. → [Глава 13](13-failure-taxonomy.md).

**NOTES.md** — Repo-persistent active-objective state. Терse, обновляется на границах фаз. → [Глава 12](12-memory.md).

**Observability** — `docs/agent-engineering/OBSERVABILITY.md`. Trace_id, NDJSON sink, gate-event correlation. → [Глава 12](12-memory.md).

**Orchestrator** — Координатор. Не пишет код, не пишет план, маршрутизирует. → [Глава 03](03-agent-roster.md), [Глава 05](05-orchestration.md).

**P.A.R.T.** — Prompt → Archive → Resources → Tools. Обязательный порядок секций в `*.agent.md`. → [Глава 04](04-part-spec.md).

**Phase** — Единица плана. 3–10 фаз на план. Имеет id, executor_agent, files, tests, acceptance, quality_gates, skill_references. → [Глава 06](06-planning.md).

**PHASE_REVIEW_GATE** — Gate-event type для phase review. На wire — это и есть «PLAN_REVIEW» лейбла из промпта. → [Глава 05](05-orchestration.md), [Глава 18](18-faq.md).

**PlanAuditor-subagent** — Adversarial-ревьюер плана: architecture, security, risk, completeness. Не возвращает transient. → [Глава 03](03-agent-roster.md), [Глава 07](07-review-pipeline.md).

**Planner** — Автор плана. Делает clarification, decomposition, skill selection, terminal outcomes. → [Глава 03](03-agent-roster.md), [Глава 06](06-planning.md).

**PLANNING** — Состояние Orchestrator-а во время разработки плана. → [Глава 05](05-orchestration.md).

**Plan path** — Поле handoff. Указывает Orchestrator-у, где читать готовый план. Reviewable input, не approval. → [Глава 15](15-case-studies.md).

**Plan Review Gate** — Стадия в lifecycle Orchestrator-а (промпт-уровень). Условный гейт перед ACTING. На wire — серия `PHASE_REVIEW_GATE` событий. → [Глава 07](07-review-pipeline.md), [Глава 18](18-faq.md).

**PlatformEngineer-subagent** — Infra-имплементер. Approval gates, rollback, health checks. → [Глава 03](03-agent-roster.md).

**PreFlect** — Mandatory pre-action gate. 4 risk-класса. Decision: GO / REPLAN / ABSTAIN. → [Глава 05](05-orchestration.md), [Глава 11](11-skills.md).

**Prompt** — Первая секция P.A.R.T. Mission, scope, contracts, state machine, protocol. → [Глава 04](04-part-spec.md).

**Quality gate** — Поле в фазе плана. Enum 5 значений (build/test/lint/security/etc.). → [Глава 06](06-planning.md), [Глава 08](08-execution-pipeline.md).

**Reflection loop** — Skill-pattern для имплементеров после неудачи. → [Глава 11](11-skills.md).

**Reliability gates** — `docs/agent-engineering/RELIABILITY-GATES.md`. Verification gate requirements. → [Глава 04](04-part-spec.md), [Глава 08](08-execution-pipeline.md).

**REPLAN_REQUIRED** — Терминальный статус Planner-а, когда план явно требует переработки. Ср. с ABSTAIN. → [Глава 06](06-planning.md).

**Repo memory** — `/memories/repo/`. Durable facts (commands, conventions, invariants). Только `create`. → [Глава 12](12-memory.md).

**Repo-persistent** — Слой памяти, переживающий разные задачи. NOTES.md + /memories/repo/. → [Глава 12](12-memory.md).

**REVIEWING** — Состояние Orchestrator-а во время ревью фазы (CodeReviewer). → [Глава 05](05-orchestration.md).

**Researcher-subagent** — Глубокий research, evidence-based findings с цитатами. → [Глава 03](03-agent-roster.md).

**Risk_review** — Поле плана. 7 категорий semantic risk. → [Глава 06](06-planning.md).

**Schema** — JSON Schema (draft 2020-12). Контракт между агентами. → [Глава 09](09-schemas.md).

**Scope drift** — Изменения за пределами плана. Цель Final Review Gate. → [Глава 08](08-execution-pipeline.md), [Глава 15](15-case-studies.md).

**Scoring spec** — `docs/agent-engineering/SCORING-SPEC.md`. Quantitative scoring для review verdicts. → [Глава 04](04-part-spec.md).

**Semantic risk taxonomy** — 7 категорий из `plans/project-context.md`. Используется в risk_review и focus_areas. → [Глава 06](06-planning.md).

**Session memory** — `/memories/session/`. Кратковременная память текущей беседы. → [Глава 12](12-memory.md).

**Skill** — Файл в `skills/patterns/`. Переиспользуемый паттерн для домена. ≤3 на фазу. → [Глава 11](11-skills.md).

**Skill index** — `skills/index.md`. Domain Mapping таблица. → [Глава 11](11-skills.md).

**SMALL** — Тир. PlanAuditor only. → [Глава 06](06-planning.md), [Глава 07](07-review-pipeline.md).

**Stagnation** — Convergence detection: iteration ≥3, improvement <5%. → [Глава 07](07-review-pipeline.md).

**Subagent** — Любой агент кроме Orchestrator и Planner. Файлы `*-subagent.agent.md`. → [Глава 03](03-agent-roster.md).

**Task-episodic** — Слой памяти. `plans/artifacts/<task>/`. Per-plan history. → [Глава 12](12-memory.md).

**TDD** — Test-Driven Development. Skill-pattern (`tdd-patterns.md`). → [Глава 11](11-skills.md).

**TechnicalWriter-subagent** — Documentation specialist. Parity check, diagrams. → [Глава 03](03-agent-roster.md).

**Tool grants** — `governance/tool-grants.json`. Single source для frontmatter `tools:`. → [Глава 10](10-governance.md).

**Tool routing** — `docs/agent-engineering/TOOL-ROUTING.md`. Local-first и external tool правила. → [Глава 04](04-part-spec.md), [Глава 10](10-governance.md).

**Trace ID** — UUIDv4 для корреляции логов через цепочку delegation. Создаётся Orchestrator-ом. → [Глава 05](05-orchestration.md), [Глава 12](12-memory.md).

**Transient** — Failure class для временных сбоев. Лимит 3. PA/AV не возвращают. → [Глава 13](13-failure-taxonomy.md).

**TRIVIAL** — Самый лёгкий тир. Skip PLAN_REVIEW. Code review всё равно обязателен. → [Глава 06](06-planning.md), [Глава 07](07-review-pipeline.md).

**UIImplementer-subagent** — Frontend specialist. Accessibility, responsive. → [Глава 03](03-agent-roster.md).

**Validated blocking issues** — Поле в CodeReviewer verdict. Только они блокируют, не raw issues. → [Глава 08](08-execution-pipeline.md), [Глава 09](09-schemas.md).

**Verified items** — Список ранее verified пунктов для regression tracking. → [Глава 07](07-review-pipeline.md).

**vscode/askQuestions** — Тулза для прямого опроса пользователя. Используется при mandatory clarification. → [Глава 05](05-orchestration.md), [Глава 06](06-planning.md).

**WAITING_APPROVAL** — Состояние Orchestrator-а в ожидании одобрения пользователя. → [Глава 05](05-orchestration.md).

**Wave** — Группа фаз с одинаковым `wave` числом. Параллельны внутри волны, серийны между волнами. → [Глава 08](08-execution-pipeline.md).

**Wave-aware execution** — Алгоритм Orchestrator-а для wave-grouped execution. → [Глава 05](05-orchestration.md), [Глава 08](08-execution-pipeline.md).

**Workflow state** — Enum в gate-event схеме: PLANNING/WAITING_APPROVAL/ACTING/REVIEWING/COMPLETE. **Не** содержит PLAN_REVIEW (это лейбл промпта). → [Глава 09](09-schemas.md), [Глава 18](18-faq.md).

## См. также

- [Глава 18 — FAQ](18-faq.md)
- [README пособия](README.md)
