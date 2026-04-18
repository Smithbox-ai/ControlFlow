# Глава 12 — Архитектура памяти

## Зачем эта глава

Понять **трёхслойную модель памяти** ControlFlow: что куда писать, что откуда читать, и почему такое разделение существует.

## Ключевые понятия

- **Session memory** — кратковременная, ограничена текущей беседой.
- **Task-episodic memory** — память одной задачи (одного плана).
- **Repo-persistent memory** — долгосрочная, переживающая разные задачи.
- **NOTES.md** — repo-persistent active-objective state.

## Три слоя

```mermaid
flowchart TD
    subgraph Session["Session Memory"]
        S[Текущий разговор<br/>/memories/session/]
    end

    subgraph Task["Task-Episodic Memory"]
        T[plans/artifacts/&lt;task&gt;/<br/>Per-plan record]
    end

    subgraph Repo["Repo-Persistent Memory"]
        N[NOTES.md<br/>active objective + phase]
        R["/memories/repo/<br/>conventions, commands, invariants"]
    end

    Question[Вопрос или задача] -->|read order 1| Task
    Question -->|read order 2| Session
    Question -->|read order 3| Repo

    Action[Запись] -.->|task-specific| Task
    Action -.->|cross-plan fact| Repo
    Action -.->|temporary| Session
```

Источник: [docs/agent-engineering/MEMORY-ARCHITECTURE.md](../agent-engineering/MEMORY-ARCHITECTURE.md).

## Слой 1: Session

**Где живёт:** `/memories/session/` (виртуальный путь, реализуется через memory tool).

**Что хранит:**
- Текущая задача.
- В прогрессе — гипотезы и черновики.
- Промежуточные scratch-заметки.
- Состояние, нужное только до конца беседы.

**Жизненный цикл:** ограничен **одной беседой**. После reset — стерто.

**Правила:**
- Не использовать для cross-task фактов.
- Не использовать для invariants.
- Использовать для **только текущего turn-а или серии turns**.

## Слой 2: Task-Episodic

**Где живёт:** `plans/artifacts/<task-slug>/`.

**Что хранит:**
- Per-plan history (verdicts, iterations, evidence).
- Verified items list для regression tracking.
- Final review log.
- Observability NDJSON (`plans/artifacts/observability/<task>.ndjson`).

**Жизненный цикл:** живёт сколько живёт plan-артефакт. Архивируется вместе с планом.

**Правила:**
- Если факт применим к **одному** плану — сюда.
- Хранит «эпизодическую» историю задачи.
- Не дублирует план — план в `plans/<task>-plan.md`, артефакты — рядом.

## Слой 3: Repo-Persistent

Самый интересный — **разделён на два подслоя**.

### NOTES.md

**Что хранит:** active-objective state only.
- Текущая задача (что мы делаем сейчас).
- Текущая фаза.
- Blockers и unresolved risks.

**Не хранит:** task-specific историю (это в episodic), invariants (это в /memories/repo/).

**Обновляется:** на границах фаз. Stale entries удаляются при superseding.

**Цитата из политики:**
> «`NOTES.md` holds repo-persistent active-objective state only — keep it terse, update at phase boundaries, prune stale entries.»

### /memories/repo/

**Где живёт:** управляется через repo memory tool (Copilot).

**Что хранит:**
- Conventions (например, «используем Python typing»).
- Verified commands (например, «`cd evals && npm test` запускает eval-харнесс»).
- Invariants (например, «P.A.R.T. order is mandatory»).
- Лучшие практики, не очевидные из кода.

**Поддерживается только `create`** (per memory architecture). Для repo memory — JSON-объект с полями `subject`, `fact`, `citations`, `reason`, `category`.

**Что НЕ хранить:**
- Секреты.
- Изменчивые факты (например, версии).
- Task-specific детали.

## Read order и Write rules

**Read order (рекомендованный):**
1. **Task-episodic** first — самое актуальное для текущей задачи.
2. **Session** — текущий контекст беседы.
3. **Repo-persistent** — общие факты как fallback.

**Write rules:**
| Факт | Куда |
|------|------|
| Применим к одному плану | Task-episodic |
| Применим cross-plan | Repo-persistent |
| Не переживёт turn | Session |
| Active objective | NOTES.md |

> «If a fact applies to exactly one plan, it belongs in task-episodic memory. If it applies across plans, it belongs in repo-persistent memory. If it will not outlive the current turn, leave it in session memory.»

## Пример сценария

**Задача:** Добавить экспорт CSV в страницу отчётов.

| Что | Куда |
|-----|------|
| Текущая фаза «design API» | NOTES.md (repo-persistent) |
| План `plans/csv-export-plan.md` | Plan artifact (отдельно) |
| Verdict от PlanAuditor для итерации 1 | Task-episodic (`plans/artifacts/csv-export/`) |
| Гипотеза «возможно, использовать stream API» | Session |
| Факт «`cd evals && npm test` — каноническая верификация» | Repo-persistent (`/memories/repo/`) |

## Memory pollution

**Что это:** загрязнение repo-persistent памяти fact-ами, которые на самом деле task-specific.

**Симптомы:**
- В `/memories/repo/` появляются ссылки на конкретные plan-артефакты.
- NOTES.md разрастается до многостраничного документа.
- Stale entries не удаляются.

**Профилактика:**
- Регулярно пересматривать NOTES.md (на границах фаз).
- Перед записью в repo — спросить: «применимо ли это к будущим задачам?»
- Удалять/обновлять устаревшие memory entries.

## Observability и память

`plans/artifacts/observability/<task-id>.ndjson` — это **task-episodic**, но с особым форматом (NDJSON для трассировки). Содержит gate-events с `trace_id` для корреляции.

См. [docs/agent-engineering/OBSERVABILITY.md](../agent-engineering/OBSERVABILITY.md).

## Memory layers vs Storage

Не путайте **логические слои** с **физическим хранилищем**:

| Логический слой | Физическое хранилище |
|----------------|---------------------|
| Session | Memory tool (`/memories/session/`) |
| Task-episodic | Файлы в `plans/artifacts/<task>/` |
| Repo-persistent — active state | `NOTES.md` (commit-tracked) |
| Repo-persistent — durable facts | Memory tool (`/memories/repo/`) |

Часть памяти живёт в гите (NOTES.md, plan artifacts), часть — в инструментальной memory (репо memory store).

## Типичные ошибки

- **Записать task-fact в `/memories/repo/`**. Со временем загрязнит общую память.
- **Раздуть NOTES.md** task-history. NOTES.md = active objective only, не история.
- **Не обновлять NOTES.md на границах фаз**. Stale state ведёт к рассинхрону.
- **Хранить session-state в repo-persistent**. Память не должна расти от коротких заметок.
- **Помещать секреты в repo memory**. Никогда.

## Упражнения

1. **(новичок)** Откройте `NOTES.md` в репо. Какая там сейчас active objective?
2. **(новичок)** Сколько слоёв в модели памяти ControlFlow?
3. **(средний)** Куда вы запишете факт: «Для проекта X используется PostgreSQL 16 с расширением pgvector»?
4. **(средний)** Что произойдёт, если NOTES.md не обновлён две недели?
5. **(продвинутый)** Объясните, почему repo memory поддерживает только `create`, а не `update`/`delete`.

## Контрольные вопросы

1. Перечислите 3 слоя памяти.
2. Что хранится в NOTES.md?
3. Куда писать invariants (например, P.A.R.T. order)?
4. Какой read order рекомендован?
5. Чем отличается task-episodic от session?

## См. также

- [Глава 05 — Оркестрация](05-orchestration.md)
- [Глава 10 — Governance](10-governance.md)
- [docs/agent-engineering/MEMORY-ARCHITECTURE.md](../agent-engineering/MEMORY-ARCHITECTURE.md)
- [docs/agent-engineering/OBSERVABILITY.md](../agent-engineering/OBSERVABILITY.md)
- [NOTES.md](../../NOTES.md)
