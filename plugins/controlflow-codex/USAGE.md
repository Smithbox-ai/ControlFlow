# ControlFlow for Codex - Usage

**Version:** 1.0.0

Короткий справочник по использованию slim-плагина ControlFlow в Codex. Плагин содержит 3
skill и 0 subagent: plan, verify, review.

## Skills

| Skill | Вызов | Назначение |
| ----- | ----- | ---------- |
| `controlflow-plan` | `/controlflow-plan` | Сгенерировать план в общем ControlFlow-формате (schema-sourced, tier-gated) |
| `controlflow-verify` | `/controlflow-verify` | Inline-проверка плана с adversarial-framing (zero subagents); пишет `plans/artifacts/<task-slug>/verify-verdict.md` |
| `controlflow-review` | `/controlflow-review` | Evidence-backed review реализации: тонкий слой над нативным Codex review |

## Рекомендуемый путь

Для нетривиальной задачи (SMALL и выше):

```text
/controlflow-plan      # план -> plans/<task-slug>-plan.md
/controlflow-verify    # вердикт -> plans/artifacts/<task-slug>/verify-verdict.md
# ... реализация ...
/controlflow-review     # review diff'а против плана
```

Маршрутизация для MEDIUM/LARGE описана в репо `CLAUDE.md`: plan → verify → review.

Для простой правки используйте обычный Codex без плагина: ControlFlow-Codex полезен, когда
стоимость плана, review-artifacts и gate-процесса окупается снижением риска.

## Когда использовать

- задача `SMALL` или крупнее
- изменение затрагивает несколько файлов, фаз или границ владения
- план, review-gates, rollback-заметки или durable-artifacts снизят риск
- миграции, рефакторы, semantic-risk проверки или execution-handoffs важны

Пропустить плагин и промптить Codex напрямую когда:

- задача тривиальна (один файл, очевидно, низкий риск)
- прямая правка быстрее создания plan-artifact
- прототип throwaway-кода

## Установка

```powershell
powershell -ExecutionPolicy Bypass -File plugins/controlflow-codex/scripts/install-home-local.ps1
```

## Удаление

```powershell
powershell -ExecutionPolicy Bypass -File plugins/controlflow-codex/scripts/uninstall-home-local.ps1
```