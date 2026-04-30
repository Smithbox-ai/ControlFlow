# ControlFlow-Codex Usage

Короткий справочник по использованию плагина в Codex.

## Рекомендуемый путь

Для нетривиальной задачи используйте единый entry point:

`Use $controlflow-strict-workflow to run the full ControlFlow-Codex process for this task.`

Он должен вести вас по такому потоку:

`router -> planning -> plan-audit -> assumption-verifier -> executability-verifier -> orchestration -> review`

Для простой правки используйте обычный Codex без плагина: ControlFlow-Codex полезен, когда стоимость плана, review artifacts и gate-процесса окупается снижением риска.

В зависимости от сложности часть шагов может пропускаться:

- `TRIVIAL`: обычно без полного review pipeline
- `SMALL`: `plan-audit`
- `MEDIUM`: `plan-audit` + `assumption-verifier`
- `LARGE`: `plan-audit` + `assumption-verifier` + `executability-verifier`

## Готовые запросы

### 1. Полный строгий workflow

`Use $controlflow-strict-workflow to handle this repository task from plan through execution.`

### 2. Только построение строгого плана

`Use $controlflow-planning to write a strict ControlFlow-style plan in plans/ for this task.`

### 3. Аудит готового плана

`Use $controlflow-plan-audit to review plans/my-task-plan.md before implementation.`

### 4. Проверка скрытых допущений в плане

`Use $controlflow-assumption-verifier to find plan mirages in plans/my-task-plan.md.`

### 5. Проверка исполнимости плана

`Use $controlflow-executability-verifier to simulate cold-start execution of plans/my-task-plan.md.`

### 6. Исполнение уже одобренного плана

`Use $controlflow-orchestration to execute plans/my-task-plan.md in phases.`

### 7. Финальный code review

`Use $controlflow-review to review the completed implementation against the approved plan.`

### 8. Поддержание долгой сессии

`Use $controlflow-memory-hygiene to keep notes and repo memory clean during this task.`

## Артефакты

План:

- `plans/<task-slug>-plan.md`

Review artifacts:

- `plans/artifacts/<task-slug>/plan-audit.md`
- `plans/artifacts/<task-slug>/assumption-verifier.md`
- `plans/artifacts/<task-slug>/executability-verifier.md`

## Жизненный цикл артефактов

- Пока задача активна, держите план и review artifacts рядом с работой.
- После успешного завершения перенесите план и артефакты в `plans/archive/` или удалите их, если они были временными.
- Если план отменён до реализации, удалите черновик и связанные `plans/artifacts/<task-slug>/`.
- Для длинных задач используйте `$controlflow-memory-hygiene`, чтобы не продвигать временные заметки в постоянную память проекта.

Пример архивации завершённой задачи:

```powershell
$month = Get-Date -Format "yyyy-MM"
New-Item -ItemType Directory -Path "plans/archive/$month" -Force | Out-Null
Move-Item "plans/my-task-plan.md" "plans/archive/$month/"
Move-Item "plans/artifacts/my-task" "plans/archive/$month/my-task-artifacts"
```

Для одноразовых задач безопаснее удалить временные артефакты сразу после проверки результата.

## Validator

Проверка структуры артефактов:

`powershell -ExecutionPolicy Bypass -File plugins/controlflow-codex/scripts/validate-strict-artifacts.ps1 -RepoRoot <repo-root> -PlanPath plans/<task-slug>-plan.md -RequirePlanAudit -RequireAssumptionVerifier -RequireExecutabilityVerifier`
