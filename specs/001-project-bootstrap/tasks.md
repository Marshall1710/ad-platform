# Tasks: локальный каркас проекта

**Inputs**: spec.md, plan.md, research.md, contracts/health.md, quickstart.md.

## Setup and dependencies

- [X] T001 Провести read-only анализ spec.md, plan.md и tasks.md до реализации; сохранить полный отчёт отдельно в analysis.md.

- [X] T002 Создать apps/cabinet, apps/auction, apps/dsp, tests/e2e и scripts по plan.md; добавить .gitignore и .dockerignore в корне.
- [X] T003 Добавить корневой package.json с npm workspaces, package.json двух Next-приложений, конфигурацию TypeScript и установить фиксируемые lockfile зависимости.
- [X] T004 Создать Go-модуль и минимальный HTTP-сервис DSP в apps/dsp.
- [X] T005 Добавить Dockerfile.next, apps/dsp/Dockerfile и compose.yaml для трёх приложений и двух PostgreSQL.

## Story or change 1: локальный стенд

**Goal**: пять компонентов доступны локально.
**Independent check**: npm run up; проверки из contracts/health.md.

- [X] T006 [US1] Добавить стартовые страницы Next.js и служебный ответ DSP в apps/cabinet, apps/auction, apps/dsp.
- [X] T007 [US1] Добавить корневые npm-скрипты up, down и build в package.json.
- [X] T008 [US1] Собрать образы и поднять стенд; проверить состояние пяти компонентов.

## Story or change 2: проверка стенда

**Goal**: одна npm-команда обнаруживает отказ каждого компонента.
**Independent check**: npm test на запущенном стенде.

- [X] T009 [US2] Добавить Playwright smoke для двух интерфейсов и DSP в tests/e2e; добавить проверку pg_isready обеих БД в scripts/check-db.mjs.
- [X] T010 [US2] Добавить npm test и выполнить успешный smoke-прогон; проверить диагностическое сообщение при недоступном компоненте.
- [X] T011 [US2] Обновить корневой README.md фактическими адресами, командами и ограничениями каркаса.

## Final verification

- [X] T012 Зафиксировать фактические проверки в verification.md; сверить diff со spec.md и исключить секреты.

## Dependencies

T001 → T002 → T003/T004 → T005/T006/T007 → T008 → T009/T010 → T011 → T012.

## Completion criteria

- [X] Собираются три образа и запускаются пять контейнеров.
- [X] npm test проверяет все пять компонентов и возвращает ошибку при отказе любого.
- [X] README и verification.md отражают фактические команды и результаты.
- [X] Коммит имеет префикс chore: и точное имя папки спеки; PR агент не создаёт.
