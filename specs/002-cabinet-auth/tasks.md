# Tasks: регистрация и вход в кабинет

**Inputs**: `spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/auth.md`, `quickstart.md`.

**Git**: ветка `epic/cabinet-access`; коммит и push запрещены текущим запросом пользователя. PR агент не создаёт.

## Phase 0: analysis before code

- [X] T001 Выполнить read-only `$speckit-analyze` для `spec.md`, `plan.md`, `tasks.md`; отдельным действием сохранить полный отчёт в `specs/002-cabinet-auth/analysis.md`. При блокирующих расхождениях исправить документы и повторить анализ до кода.

## Phase 1: setup and reproducible environment

- [X] T002 Проверить `specs/002-cabinet-auth/checklists/requirements.md`, текущие версии зависимостей и отсутствие конфликтующих изменений в `apps/cabinet`; установить закреплённые `better-auth`, `pg`, `tsx`, `@testcontainers/postgresql` и типы в `package.json` и `package-lock.json`.
- [X] T003 Настроить локальный секрет и подключение БД без записи секрета в Git: `scripts/setup-local-env.mjs`, `.env.example`, `compose.yaml`, `scripts/dev.mjs`, `apps/cabinet/package.json`; исключить dev-зависимости из runtime-образа в `Dockerfile.next`; проверить обе схемы запуска.
- [X] T004 Создать конфигурацию схемы Better Auth без публичного обработчика, версионированную SQL-схему `apps/cabinet/migrations/001_auth.sql` и идемпотентный runner `apps/cabinet/scripts/migrate.mjs`; проверить миграцию на чистой и повторно используемой PostgreSQL через Testcontainers до функциональных тестов.

## Phase 2: регистрация рекламодателя (US1)

**Goal**: корректная публичная регистрация создаёт только рекламодателя и сразу даёт вход.
**Independent check**: новый email через HTTP/форму → собственные email и роль после обновления страницы.

- [X] T005 [US1] Red: добавить интеграционные проверки регистрации, нормализации/уникальности email, длины пароля, хеша и отклонения публичной роли `admin` в `tests/integration/cabinet-auth.test.ts`; выполнить их на готовой тестовой БД и зафиксировать отказы из-за отсутствующего поведения.
- [X] T006 [US1] Green: завершить конфигурацию `apps/cabinet/src/lib/auth.ts` и ограниченный маршрут `apps/cabinet/src/app/api/auth/[...all]/route.ts` с нормализацией email, служебным `name` и перечнем разрешённых путей; добиться прохождения интеграционных проверок.
- [X] T007 [US1] Red: добавить тест формы регистрации в `apps/cabinet/src/app/register/register.test.tsx` и сквозной тест в `tests/e2e/cabinet-auth.spec.ts` на отсутствующий путь регистрации; подтвердить поведенческий Red.
- [X] T008 [US1] Green: реализовать `apps/cabinet/src/app/register/page.tsx`, клиент формы, ссылку со стартовой страницы и автоматический переход после регистрации; проверить RTL и E2E.
- [X] T009 [US1] Refactor: убрать дубли в нормализации email/формах без смены контрактов; повторить интеграционные, RTL и E2E проверки.

## Phase 3: вход, выход и срок сессии (US2)

**Goal**: обе роли используют общий вход и выход; сессия действует не более 24 часов.
**Independent check**: войти → обновить → выйти/истечь → защищённый путь закрыт.

- [X] T010 [US2] Red: расширить `tests/integration/cabinet-auth.test.ts` проверками общего сообщения об ошибке, сохраняемой cookie, 24-часового срока и серверной аннуляции выхода; подтвердить поведенческий Red.
- [X] T011 [US2] Green: настроить абсолютный срок Better Auth без refresh/cache и проверить обработчик входа/выхода в `apps/cabinet/src/lib/auth.ts`; добиться Green.
- [X] T012 [US2] Red: расширить RTL и Playwright сценариями входа, выхода, защиты `/cabinet` и недоступности после выхода в `apps/cabinet/src/app/login/login.test.tsx` и `tests/e2e/cabinet-auth.spec.ts`.
- [X] T013 [US2] Green: реализовать `apps/cabinet/src/app/login/page.tsx`, общий клиентский компонент формы, `apps/cabinet/src/app/cabinet/page.tsx`, кнопку выхода и серверную проверку сессии; добиться Green.
- [X] T014 [US2] Refactor: упростить формы и обработку ошибок, повторить затронутые проверки.

## Phase 4: ручной администратор (US3)

**Goal**: локальная команда создаёт admin, публичный путь его не создаёт.
**Independent check**: запуск команды и последующий вход через общий экран показывают собственную роль admin.

- [X] T015 [US3] Red: добавить интеграционный тест создания `admin`, отказа при повторном email и отсутствия публичной выдачи роли в `tests/integration/cabinet-auth.test.ts`; подтвердить поведенческий Red.
- [X] T016 [US3] Green: реализовать `apps/cabinet/scripts/create-admin.ts` и `npm run admin:create` с интерактивным вводом без печати пароля и аргументов с секретом; добиться Green.
- [X] T017 [US3] Refactor: проверить отсутствие копирования учётных данных в логи, повторить интеграционные тесты и вручную выполнить CLI + вход admin на локальном стенде.

## Phase 5: integration and handoff

- [X] T018 Сверить `apps/cabinet/migrations/001_auth.sql` с генератором схемы установленной Better Auth после T006; повторно применить миграцию и проверить ограничения БД.
- [X] T019 Добавить команды проверок в `package.json`; выполнить typecheck, RTL/Vitest, Testcontainers, Playwright, `npm run build`, `npm run up`, локальный `npm run dev:cabinet` и существующий `npm test`; записать Passed/Failed/Blocked/NotRun и FR→тест в `specs/002-cabinet-auth/verification.md`.
- [X] T020 Создать `docs/features/auth.md` с действующей логикой и обновить `README.md` по фактическому запуску, ролям и команде администратора; не описывать будущие сценарии как готовые.
- [X] T021 Провести отдельное итоговое ревью по `$code-reviewer` на незакоммиченном diff, новых файлах, соседнем коде и критериях спеки; исправить подтверждённые дефекты, повторить нужные проверки и ревью; записать итог в `verification.md` без коммита.

## Follow-up: локальный Origin и сообщения форм

- [X] T022 Воспроизвести отказ регистрации через `localhost` в production Docker Playwright (Red), разрешить loopback-алиас на том же порту и подтвердить Green.
- [X] T023 Воспроизвести ошибочную классификацию 403 и 429 в RTL для регистрации и входа (Red), показать отдельные сообщения и подтвердить Green.
- [X] T024 Обновить контракт, актуальную документацию и verification; пересобрать кабинет, прогнать набор тестов и повторить code review. Коммит не делать.

## Dependencies

T001 → T002 → T003 → T004 → T005/T006 → T007/T008/T009 → T010/T011 → T012/T013/T014 → T015/T016/T017 → T018 → T019/T020 → T021. Red/Green внутри каждой истории выполняются строго последовательно. Сверка схемы Better Auth после T006 дополняет проверку T004.

## Completion criteria

- [ ] Все проверяемые новые правила имеют поведенческий Red до соответствующего Green.
- [X] Регистрация, вход, выход, срок сессии, роль и CLI проверены; затронутые тесты проходят.
- [X] `analysis.md` не содержит нерешённых блокирующих расхождений; `verification.md` честно отражает проверки и ревью.
- [X] `docs/features/auth.md` и `README.md` описывают только действующую логику.
- [X] Ветка `epic/cabinet-access` содержит незакоммиченные изменения для просмотра пользователем; коммит, push и PR не выполнены.
