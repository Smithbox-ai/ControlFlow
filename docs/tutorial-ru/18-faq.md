# Глава 18 — FAQ

Часто задаваемые вопросы о slim-модели ControlFlow, сгруппированные по категориям.

---

## Концептуальные вопросы (1–10)

**Q1. В чём разница между AssumptionVerifier-subagent и PlanAuditor-subagent?**

`PlanAuditor-subagent` (verify фаза 1) ревьюит **дизайн**: архитектура ли sound, риски ли покрыты, запланирован ли rollback, соответствует ли артефакт схеме? `AssumptionVerifier-subagent` (verify фаза 2) проверяет **фактическую точность**: утверждения плана действительно истинны (указанные files/symbols существуют, предположения bounded)? План может быть архитектурно sound, но содержать ложные утверждения о кодовой базе. Это разные оси, поэтому обе фазы запускаются на тирах MEDIUM+. Обе — inline фазы `controlflow-verify`, не диспатченные сабагенты.

---

**Q2. В чём разница между ABSTAIN и REPLAN_REQUIRED?**

- **ABSTAIN** (от Planner'а): «Не могу оценить с достаточной уверенностью.» **Не** блокирует пайплайн; записывается как uncertainty.
- **REPLAN_REQUIRED** (от Planner'а): «Требования противоречивы или отсутствуют; планирование невозможно.» **Блокирует** прогресс — пользователь должен уточнить требования.

ABSTAIN — эпистемический сигнал. REPLAN_REQUIRED — жёсткий блокер.

---

**Q3. Почему Planner сам не вызывает `controlflow-verify`?**

Разделение забот. Planner — **planning**-агент: он производит артефакт и handoff'ает. `controlflow-verify` — **адверсариален**: он пытается опровергнуть план. Пользователь запускает verify как отдельный гейт, чтобы Planner не мог одобрить свою же работу. Planner не needs знать tier-gated глубину фаз; он фокусируется на качестве плана.

---

**Q4. Почему в slim-модели нет файла агента `Orchestrator`?**

Orchestrator — **retired** как поставляемый агент. Legacy state machine (`PLANNING` / `WAITING_APPROVAL` / `PLAN_REVIEW` / `ACTING` / `REVIEWING` / `COMPLETE`), dispatch, waves и gates ушли. С февраля 2026 Copilot делает всё это нативно: subagent dispatch + parallelism — GA, `/plan` mode — GA, agentic code review — GA, approvals + custom instructions — GA. Держать ControlFlow dispatch state machine поверх этого дублировало бы нативные возможности — именно то, что slim-модель запрещает. Planner + нативный Copilot покрывают оркестрацию; пайплайн plan → verify → review — это то, что теперь значит «оркестрация». См. `docs/agent-engineering/NATIVE-DELEGATION-BOUNDARY.md`.

---

**Q5. В чём разница между `failure_classification` и mid-execution clarification?**

- **`failure_classification`** (`transient` / `fixable` / `needs_replan` / `escalate` / `model_unavailable`): описывает **тип сбоя** для routing. Записывается в lifecycle-секциях плана. Retry routing — задача нативного Copilot; `needs_replan` re-входит в пайплайн ControlFlow через Planner.
- **Mid-execution clarification**: нативная ask-questions-поверхность Copilot показывает вопрос пользователю. Не сбой — вопрос. Если ответ меняет file scope, user-visible поведение, архитектуру или обработку destructive-risk, пользователь re-invoke'ит `@controlflow-planner` для targeted replan.

---

**Q6. Почему «governance бьёт prompt»?**

Governance-файлы (`governance/*.json`) — **явные контракты**, check-in'утые в репозиторий. Промпты агентов содержат **поведение по умолчанию** и эвристики. При конфликте governance-файлы побеждают, потому что:
1. Они versioned и auditable.
2. Их можно обновлять без правки каждого custom agent prompt.
3. Они — single source of truth для операционных политик (tier-gated verify depth, semantic-risk policy, verdict routing).

---

**Q7. Почему skill'и — это Markdown-файлы, а не код?**

Skill'и предоставляют **guidance и паттерны** для LLM-агента — они часть prompt-контекста, не исполняемый код. Агент читает skill-файл так же, как разработчик читает coding standard: это информирует decision-making. Делать их исполняемым кодом потребовало бы runtime-окружения, которого slim-модель намеренно избегает (ControlFlow — это prompt/governance/eval-слой поверх нативного Copilot, не runtime).

---

**Q8. Почему ≤3 skill'ов на фазу?**

Больше skill'ов в контексте создают шум и token-overhead. Skill'и наиболее эффективны, когда они laser-focused на конкретном домене текущей фазы. Если фаза, кажется, требует больше трёх — она, скорее всего, слишком широка и её надо декомпозировать на меньшие фазы.

---

**Q9. Почему PlanAuditor-subagent и AssumptionVerifier-subagent исключают `transient`?**

Потому что их сбои по природе **структурные**. Если `PlanAuditor-subagent` находит проблему, он нашёл реальный изъян плана — не timeout. Если `AssumptionVerifier-subagent` идентифицирует mirage, это реальный фактический пробел — не network error. Retry с тем же scope (transient-логика) дал бы тот же результат. Сбои этих фаз всегда `fixable`, `needs_replan` или `escalate`.

---

**Q10. «Приход плана = implicit approval»?**

**Нет.** Артефакт плана в `plans/<task-slug>-plan.md` — это **reviewable-вход**. Пользователь должен запустить `/controlflow-verify` (на SMALL+ работе) и получить `APPROVED` до начала имплементации. Наличие артефакта плана не обходит verify-гейт.

---

## Технические вопросы (11–20)

**Q11. Какова каноническая команда верификации?**

```bash
cd evals && npm test
```

Должна запускаться из директории `evals/`, **не** из корня репозитория. Запускает оффлайн-проверки: структурную валидацию, prompt-behavior-контракты, drift detection, tutorial parity, skill discoverability, capability matrix, plugin manifest parity, contract-drift и doc-count consistency. Никаких LLM-вызовов, никаких сетевых вызовов.

---

**Q12. Что происходит, если `executor_agent` пропущен в фазе?**

`controlflow-verify` фаза 1 (structural audit) помечает это как структурный сбой → `NEEDS_REVISION`. План уходит обратно к Planner'у; фаза должна быть переиздана с явным `executor_agent` из enum восьми имён. Silent-infering запрещено.

---

**Q13. Где живёт taxonomy ролей?**

Single source of truth — `governance/project-context-registry.json`. Человекочитаемое зеркало — в `plans/project-context.md` (таблицы Phase Executor Agents, Review Pipeline Agents и Agent Role Matrix). Drift-проверка Pass 14 (`validateProjectContextRegistryMirror`) сверяет их построчно. Не правьте зеркало независимо от реестра.

---

**Q14. Что происходит после `escalate`?**

Нативный Copilot останавливается и предъявляет пользователю накопленные evidence сбоев. Пользователь принимает одно из решений:
- Отменить задачу.
- Дать clarification и разрешить retry.
- Эскалировать на ручное вмешательство человека.

Для `escalate` есть **ноль автоматических retry**.

---

**Q15. В чём разница между per-task и reusable-артефактами?**

- **Per-task** (`plans/artifacts/<task-slug>/`): task-specific история, логи ревизий, deliverables. Не переиспользуется между задачами.
- **Reusable** (`skills/patterns/`, `schemas/`, `governance/`): разделяется между всеми задачами. Изменения затрагивают всех потребителей.

`NOTES.md` — **active-objective state**, не per-task history.

---

**Q16. Какие 4 PreFlect-класса риска?**

1. **High-risk-destructive** — действие уничтожает или необратимо изменяет данные.
2. **Scope-drift** — действие выходит за scope плана.
3. **Assumption** — агент действует на непроверенной предпосылке.
4. **Dependency** — prerequisite для действия ещё не выполнен.

Решение: `GO` / `PAUSE` / `ABORT`. Паттерн живёт в `skills/patterns/preflect-core.md`.

---

**Q17. Когда срабатывает HIGH-risk override?**

Когда запись `risk_review` имеет `applicability: applicable` AND `impact: HIGH` AND `disposition` не `resolved`, план трактуется как `LARGE` для verify depth независимо от количества файлов — запускаются все три verify-фазы. Правило закодировано в `governance/runtime-policy.json` → `semantic_risk_policy`.

---

**Q18. Кто владеет циклом фикса, когда `controlflow-review` находит scope drift?**

Всегда **пользователь или новая фаза плана**, никогда `controlflow-review` сам. `controlflow-review` метит findings (severity, confidence, file, line, user impact, validation method); он их не чинит. Если фикс меняет file scope, пользователь re-invoke'ит `@controlflow-planner` для targeted replan; иначе нативный Copilot применяет фикс, а re-review — на усмотрение пользователя.

---

**Q19. Почему нет `governance/model-routing.json` или `governance/tool-grants.json`?**

Оба **retired**. Выбор модели делегирован нативному Copilot (Auto model picker; pin модель только если роль требует). Доступ к инструментам объявляется per-agent в `tools:` frontmatter при воссоздании специализированного агента под `.github/agents/`; нет центрального файла tool-access grant для синхронизации. Slim-модель не поставляет поверхность, дублирующую нативную возможность Copilot. См. `docs/agent-engineering/NATIVE-DELEGATION-BOUNDARY.md`.

---

**Q20. Почему `additionalProperties: false` во всех схемах?**

Чтобы enforce **закрытый контракт**: любое неизвестное поле — ошибка, не silent-ignored. Это ловит:
- Опечатки в именах полей.
- Устаревшие payload (поле удалено, но всё ещё отправляется).
- Schema drift (агент эмиттит поле, которое не ревьюлось).

В slim-модели схемы — контрактная документация + ссылки на eval-фикстуры; правило closed-contract всё ещё anchor'ит eval-харнесс.

---

## Операционные вопросы (21–25)

**Q21. Что делать, если CI падает?**

1. Запустите `cd evals && npm test` локально (удалите `evals/.cache/` сначала — кэш может маскировать ошибки после структурных правок).
2. Прочитайте падающий проход и сообщение об ошибке.
3. Для Pass 15 (doc-count): проверьте, что allowlisted-док указывает количество, не совпадающее с disk truth.
4. Для Pass 7c (tutorial parity): проверьте heading aliases в `evals/scenarios/tutorial-parity/allowlist.json`.
5. Для Pass 14 (registry mirror): проверьте `governance/project-context-registry.json` vs `plans/project-context.md`.
6. Исправьте, перезапустите, подтвердите зелёный.

---

**Q22. Как pin модель для конкретного custom agent?**

По умолчанию **не делайте** — опустите строку `model:` в frontmatter файла агента, чтобы Copilot Auto model picker выбирал. Если роль действительно требует pinned модели, добавьте `model:` в frontmatter только этого агента. Центрального model-routing-файла для правки нет. Колонка `Model Routing Role` в taxonomy ролей — концептуальный capability tier, не routing-поверхность.

---

**Q23. Можно пропустить verdict-гейт?**

**Нет.** Пропуск verify-гейта (имплементация до `APPROVED`) или review-гейта (публикация до ревью findings) — нарушение контракта. Правила остановки — обязательные паузы: после записи плана, после того как verify вернёт verdict, и после того как review вернёт findings.

---

**Q24. Какие 7 категорий semantic risk?**

Из `schemas/planner.plan.schema.json` → `risk_review.items.properties.category.enum`:
1. `data_volume`
2. `performance`
3. `concurrency`
4. `access_control`
5. `migration_rollback`
6. `dependency`
7. `operability`

Каждый не-TRIVIAL план должен включать все семь ровно один раз; используйте `not_applicable` с обоснованием, когда категория не релевантна — никогда не пропускайте строку.

---

**Q25. Каков процесс добавления нового специализированного агента?**

Slim-модель поставляет один агент (`@controlflow-planner`). Чтобы добавить специализированную персону, следуйте `docs/agent-engineering/NATIVE-DELEGATION-BOUNDARY.md §5`:
1. Создайте новый файл агента под `.github/agents/` с Copilot agent frontmatter (`name`, `description`, `tools`). Без `model:` по умолчанию.
2. В теле процитируйте файлы `skills/patterns/`, которые персона должна загружать (бывшая static binding теперь Planner-injected).
3. Напишите дисциплину персоны как prose (abstain when no executable harness is supplied; evidence over assertion; stop-the-line on regression).
4. Planner теперь может назначать эту роль как `executor_agent` фазы. Исполнение — нативный Copilot.

Файла tool-access grant или model-routing для обновления нет — эти governance-поверхности retired.

---

## Философские вопросы (26–28)

**Q26. Почему процесс такой строгий, если LLM гибки?**

LLM мощны, но ненадёжны для длинных multi-step задач без структуры. Строгий процесс обеспечивает:
- **Воспроизводимость** — тот же вход, предсказуемое поведение.
- **Аудитируемость** — каждый план, verdict и finding — письменный артефакт.
- **Безопасность** — деструктивные операции требуют human approval.
- **Отлаживаемость** — когда что-то идёт не так, taxonomy сбоев говорит точно, где и почему.

Гибкость сохраняется там, где это важно (Idea Interview Planner'а, содержание паттернов); структура управляет там, где сбои дороги.

---

**Q27. Почему нет auto-merge или auto-deploy?**

ControlFlow — это **prompt/governance/eval-слой** поверх нативного Copilot. Нет скомпилированного продукта и нет runtime-деплоя. Коммиты затрагивают агент planner'а, skill'и, схемы и governance — изменения, требующие человеческого ревью. Auto-merge обошёл бы verify- и review-гейты, центральные для safety-модели системы.

---

**Q28. Можно использовать ControlFlow вне этого репозитория?**

Да. Slim-поверхность (`.github/agents/`, `.github/skills/`, `.github/copilot-instructions.md`) плюс контракты (`schemas/`, `governance/`, `plans/templates/`, `plans/project-context.md`, `skills/`, `evals/`) portable. См. раздел Installation корневого `README.md`. Паттерны (формат плана, taxonomy сбоев, архитектура памяти, verify/review-пайплайн, skill-система) общи и адаптируются к любому Copilot-оснащённому репо. Поскольку slim-модель делегирует исполнение, доступ к инструментам и выбор модели нативному Copilot, per-agent-runtime портировать не нужно.

---

## См. также

- [Глава 00 — Введение](00-introduction.md)
- [Глава 16 — Упражнения](16-exercises.md)
- [Глава 17 — Глоссарий](17-glossary.md)
- [plans/project-context.md](../../plans/project-context.md)
- [docs/agent-engineering/NATIVE-DELEGATION-BOUNDARY.md](../agent-engineering/NATIVE-DELEGATION-BOUNDARY.md)
- [docs/agent-engineering/](../agent-engineering/)