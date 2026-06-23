# Глава 04 — Структура промпта агента (guidance)

## Зачем эта глава

ControlFlow больше не поставляет флот специализированных файлов агентов — slim-модель поставляет один агент (`@controlflow-planner` в `.github/agents/controlflow-planner.agent.md`) и делегирует исполнение нативному Copilot. Но вы всё ещё можете **написать свой кастомный промпт агента** под `.github/agents/` (чтобы воссоздать специализированную персону вроде BrowserTester или добавить проект-специфичную роль). Эта глава — guidance по тому, как написать хороший.

> **Историческая справка.** Legacy-модель ControlFlow enforced обязательный четырёхсекционный шаблон **P.A.R.T.** (Prompt / Archive / Resources / Tools) на каждом `*.agent.md`. Этот контракт **retired** — slim-модель поставляет один planner-агент и больше не enforced фиксированный порядок секций на файлах агентов. Дисциплина P.A.R.T. (role / scope / contracts / tools как prose) всё ещё информирует то, как пишется хороший кастомный промпт агента, но это guidance, не обязательный шаблон, и drift-чекер больше не аудирует его.

## Ключевые понятия

- **Кастомный промпт агента** — Markdown-файл под `.github/agents/` с Copilot agent frontmatter (`name`, `description`, `tools`), который Copilot surfaces в agents dropdown.
- **Role** — одно предложение, фиксирующее назначение агента (старая «P» в акрониме P.A.R.T.).
- **Scope** — что агент делает и чего **не** делает.
- **Contracts как prose** — форма выхода и правила, написанные как prose, а не как runtime-валидируемые inter-agent сообщения. В slim-модели схемы — это контрактная документация + ссылки на eval-фикстуры, а не runtime-enforced payloads.
- **Tools frontmatter** — массив `tools:` объявляет, какие инструменты агент может использовать; нет файла tool-access grant, с которым синхронизироваться (эта governance-поверхность retired — доступ к инструментам делегирован нативному Copilot).
- **Без `model:` по умолчанию** — пусть Copilot Auto model picker выбирает. Пиньте модель только если роль этого требует.

## Worked-пример: controlflow-planner.agent.md

Единственный поставляемый ControlFlow-агент — лучший пример для копирования. Откройте `.github/agents/controlflow-planner.agent.md`. Его структура:

```text
---
description: "ControlFlow Planner — ..."
name: controlflow-planner
tools: ["read", "search", "edit"]
---

# ControlFlow Planner

You are the ControlFlow Planner. ...

## Load the planning skill
## Idea Interview (when the request is vague)
## Write the plan artifact
## Hand off to native Copilot for implementation
## Failure mode
```

Обратите внимание, чего там **нет**: нет строки `model:` (Copilot Auto picker выбирает), нет списка `agents:` для делегирования, нет обязательных секций Archive/Resources/Tools, нет поля `model_role:`, нет ссылки на файл tool-access grant. Это frontmatter плюс prose с несколькими чётко помеченными секциями.

## Frontmatter (обязательно)

Copilot agent frontmatter — единственная обязательная часть файла кастомного агента:

```yaml
---
description: Однострочное описание, показываемое в Copilot Chat agents dropdown
name: your-agent-name
tools: ["read", "search", "edit"]
---
```

- **`description`** — появляется в VS Code Copilot Chat UI. Напишите так, чтобы пользователь знал, когда выбирать этого агента.
- **`name`** — идентификатор, используемый в `@-mention` и dropdown.
- **`tools`** — MCP-инструменты, которые агент может использовать. Выберите минимальный набор под роль (least privilege). Нет файла tool-access grant, с которым синхронизироваться — доступ к инструментам делегирован нативному Copilot.
- **Без `model:` по умолчанию.** Опустите, чтобы Copilot Auto model picker выбирал. Пиньте модель только если роль требует (редко).

## Написание тела (guidance, не шаблон)

Дисциплина P.A.R.T. (Prompt / Archive / Resources / Tools) retired как обязательный порядок, но четыре concern'а, которые она фиксирует, всё ещё стоит покрыть **как prose, в любом порядке, который лучше читается для вашей роли**:

| Старая секция P.A.R.T. | Современное guidance (prose, не обязательно) |
|------------------------|----------------------------------------------|
| **P — Prompt** | Сформулируйте mission роли, scope IN / scope OUT, правило abstention и output-дисциплину в prose. Это сердце файла. |
| **A — Archive** | Если роль поддерживает long-session state, опишите, что сохранять vs что выбрасывать при приближении к context limit, и куда писать (session / task-episodic / repo-persistent через `NOTES.md`, `plans/artifacts/`, `/memories/repo/`). Опустите, если не релевантно. |
| **R — Resources** | Перечислите пути `skills/patterns/`, которые роль должна загружать just-in-time (прежнее статическое binding — теперь Planner-injected `skill_references`). Держите список минимальным — только то, что роль использует напрямую. |
| **T — Tools** | Frontmatter `tools:` покрывает доступ к инструментам. Если у роли есть правила выбора инструментов («предпочитать local search вместо fetch»), напишите их как prose здесь. |

**Нет** drift-проверки, которая enforced бы порядок или наличие секций. Набор eval-проверок на contract-drift аудирует формат плана, taxonomy ролей и governance-конфиг — а не заголовки секций вашего кастомного файла агента.

## Цитирование паттернов (современные «Resources»)

Legacy-специализированные агенты (BrowserTester, UIImplementer, PlatformEngineer и т.д.) имели статические секции `Resources`, binding'шие их к файлам `skills/patterns/`. В slim-модели эти агенты retired и их дисциплина живёт в `skills/patterns/`. Если вы воссоздаёте специализированную персону, процитируйте паттерны, которые она должна загружать:

```text
## Resources
- skills/patterns/tdd-patterns.md
- skills/patterns/debugging-discipline.md
- skills/patterns/error-handling-patterns.md
```

Паттерны несут переиспользуемую дисциплину; ваш файл агента несёт персону. См. `docs/agent-engineering/NATIVE-DELEGATION-BOUNDARY.md §5` для полного recipe воссоздания и таблицы worked-examples, маппящих retired персоны на выжившие паттерны.

## Planner может назначить вашего агента как executor_role

Как только ваш файл агента существует под `.github/agents/`, `@controlflow-planner` может назначить его как `executor_agent` фазы (schema enum уже включает восемь канонических имён ролей; если вы назовёте файл совпадающим с одним из них, Planner может назначить эту роль). Исполнение — задача нативного Copilot — ваш файл агента это персона, которую Copilot загружает, когда фаза исполняется.

## Типичные заблуждения

- **Добавление строки `model:` по умолчанию.** Опустите, если роль не требует pinned-модели. Copilot Auto picker — slim-модельный дефолт.
- **Дублирование нативной возможности Copilot в теле промпта.** Если ваш агент реимплементирует planning, dispatch, code review или approvals, он нарушает delegation boundary (см. `NATIVE-DELEGATION-BOUNDARY.md`). Layer поверх; не дублируйте.
- **Раздувание списка Resources индексом всего репозитория.** Держите минимальным — только `skills/patterns/`, которые роль реально загружает.
- **Ожидание drift-failure за «неправильный порядок секций».** Порядок P.A.R.T. больше не enforced. Drift-чекер аудирует формат плана и governance-конфиг, а не заголовки секций вашего кастомного агента.
- **Синхронизация frontmatter `tools:` против retired файла tool-access grant.** Эта поверхность retired; выберите минимальный набор инструментов в frontmatter и двигайтесь дальше.
- **Написание контрактов как runtime-валидируемых JSON payloads.** В slim-модели схемы — это контрактная документация + ссылки на eval-фикстуры, а не inter-agent сообщения. Опишите форму выхода в prose.

## Упражнения

1. **(новичок)** Откройте `.github/agents/controlflow-planner.agent.md`. Найдите три frontmatter-поля. Подтвердите, что нет строки `model:`.
2. **(новичок)** Прочитайте тело. Какой «P.A.R.T. concern» (Prompt / Archive / Resources / Tools) наиболее развит, а какой опущен? Почему опущенный допустим в slim-модели?
3. **(средний)** Выберите retired персону (например, BrowserTester-subagent). Следуя `NATIVE-DELEGATION-BOUNDARY.md §5`, набросайте stub `browser-tester.agent.md` под `.github/agents/`, цитирующий `skills/patterns/tdd-patterns.md`, `skills/patterns/debugging-discipline.md` и `skills/patterns/error-handling-patterns.md`.
4. **(средний)** Почему при написании кастомного агента нет шага синхронизации tool-access grant? Куда ушла tool-access governance в slim-модели?
5. **(продвинутый)** На бумаге набросайте stub для нового агента `link-checker`, который валидирует ссылки в Markdown-файлах. Какие инструменты ему нужны? Какие `skills/patterns/` загружать? Какое правило abstension покрывает «no executable harness supplied»?

## Контрольные вопросы

1. Что значит P.A.R.T. и почему это теперь guidance, а не обязательный шаблон?
2. Какие frontmatter-поля обязательны для Copilot custom agent и какое опускается по умолчанию?
3. Где живёт tool-access governance в slim-модели и почему нет файла tool-access grant?
4. Как воссозданный специализированный агент назначается executor'ом фазы?
5. Почему список Resources держится минимальным, а не индексом всего репозитория?

## См. также

- [Глава 03 — Taxonomy ролей](03-agent-roster.md)
- [Глава 09 — Схемы](09-schemas.md)
- [Глава 10 — Governance](10-governance.md)
- [docs/agent-engineering/NATIVE-DELEGATION-BOUNDARY.md](../agent-engineering/NATIVE-DELEGATION-BOUNDARY.md)