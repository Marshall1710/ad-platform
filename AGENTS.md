# Coding workflow

## Project context

Перед изменением поведения продукта прочитайте README.md в корне проекта, AGENTS.md в родительской папке, актуальные эпики в docs/Эпики.md и относящиеся к задаче документы: Тестовый аукцион — Задание.md, Тестовый аукцион — Флоу.md и документы в docs/features. Черновик эпиков в родительской папке сохраняется как история груминга. Поддерживайте актуальные документы в согласованном состоянии с новыми решениями и кодом. Исходное задание сохраняйте как первоисточник; изменяйте его только по прямому запросу пользователя.

These rules apply to development tasks in this repository. Follow the current user request, `.specify/memory/constitution.md`, and any more specific project rules.

## Language

- Reply in the language the user used to address you, unless they explicitly request another language.
- Write new or updated project documentation in that same language. Preserve required Spec Kit filenames, IDs, markers, and command syntax. Translate explanatory prose and headings where doing so keeps the required structure intact.
- If the user has not explicitly chosen a documentation language and the request mixes languages, gives too little natural-language context, or conflicts with the language already used in project documentation, ask which language to use before writing. Do not silently switch a project's documentation language.

## Документация логики

Итог груминга отдельной задачи, согласованные правила и критерии приёмки сохраняйте в её Spec Kit spec.md. Папка docs/features/ предназначена для документации действующей логики функциональных областей, а не для истории задач. После реализации или изменения поведения создавайте либо обновляйте соответствующий документ там: описывайте, как функция работает сейчас, включая участников, сценарий, правила, состояния и ограничения. Не ведите разделы «было/стало» и не копируйте переписку. Синхронизируйте docs/features/, docs/Эпики.md, относящийся к изменению флоу и корневой README.md с реальным поведением. Пока идёт груминг и объём не согласован, файлы не меняйте.

## Before every task

1. Start grooming with `$speckit-grooming-prepare`. For follow-up review fixes within the same task, a short pass is enough: check the feedback, scope, and acceptance criteria. Do not invent missing requirements.
2. During grooming, inspect only relevant context and do not change code or documents. For material decisions, explain viable options, differences, benefits, risks, and a recommendation. Clarify open questions.
3. Present a short agreed task summary in chat: result, boundaries, approach, and acceptance criteria. Wait for explicit agreement to that scope. Silence is not agreement.
4. After agreement, prepare `spec.md` with `$speckit-specify`, then use applicable `$speckit-clarify`, `$speckit-plan`, `$speckit-checklist`, `$speckit-tasks`, analysis, and implementation. No repeated approval is required between these stages. The agreed `spec.md` becomes the durable task statement; after implementation, update the relevant docs/features document so it describes the current functional behavior.

## Before coding

- Run `$speckit-analyze` after `tasks.md`. This pass only reads artifacts and outputs a full report. **In a separate action after that pass**, save the full report without shortening it to the task's `analysis.md`. Do not claim the standard analyze command wrote the file itself.
- Resolve blocking technical inconsistencies within the agreed scope, rerun analysis, and update `analysis.md`. Discuss a new material decision about behavior, data, security, or scope with the user before the affected implementation.
- Конституция проекта принята в версии 1.0.0. При изменении принципов используйте `$speckit-constitution` и синхронизируйте зависимые документы; не придумывайте новые правила без согласования.

## Implementation and TDD

- Apply Red → Green → Refactor to every new or changed testable behavior: write and run an automated test that fails because the behavior is missing or wrong, make the smallest production change and pass the test, then refactor if useful and rerun affected tests. An environment, import, or installation error does not count as Red.
- For documentation, configuration, or other changes without testable behavior, define an appropriate check in `plan.md`. Do not write an artificial test that mirrors the implementation.
- Stay within the agreed scope. Use the repository's actual stack, commands, and conventions. Discuss a concrete need before installing dependencies or changing external systems.
- Record executed commands and outcomes in the task's `verification.md` as Passed, Failed, Blocked, or NotRun. Do not report an unperformed check as successful. Before handoff, compare code and documentation with `spec.md` and review the diff for unrelated changes and secrets.

## Git and permissions

- Agreement to work after grooming does not authorize a commit or push. For each task, establish who will commit and which branch is in scope. Without permission, leave changes uncommitted. Push, PR, merge, release, and history changes each require explicit authorization.
- Follow any stricter project Git policy. Never include someone else's changes in your commit.

<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan
<!-- SPECKIT END -->
