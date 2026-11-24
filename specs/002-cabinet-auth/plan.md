# Implementation Plan: регистрация и вход в кабинет

**Branch**: `epic/cabinet-access` | **Date**: 2026-11-10 | **Spec**: [spec.md](spec.md)

**Input**: Согласованная первая спецификация доступа без списка пользователей и предметных сценариев.

## Summary

Добавить в Next.js кабинет регистрацию рекламодателя, общий вход/выход, 24-часовые серверные сессии и ручное создание администратора без автоматического входа. На защищённой странице показывать только собственные email и роль. Для аутентификации использовать Better Auth с PostgreSQL кабинета, закреплённую миграцию и проверки на уровне формы, БД и Docker-стенда.

## Technical Context

**Language/Version**: Node.js 22, TypeScript 5.9, Next.js 16.4.5, React 19.3.1
**Primary Dependencies**: Better Auth 1.7.20, `pg` 8.23.1; существующие Vitest 5.1, React Testing Library, Playwright; `@testcontainers/postgresql` 12.0.4 и `tsx` для тестов и служебных команд
**Storage**: только PostgreSQL кабинета; версионированная SQL-миграция пользователей, accounts, sessions, verification и учёта миграций; схема сверяется с конфигурацией Better Auth
**Testing**: Vitest/RTL для формы, Vitest/Testcontainers для реальной БД и HTTP-обработчика, Playwright для полного пути на Docker Compose; существующие smoke, typecheck и build
**Target Platform**: Docker Desktop/Linux-контейнеры и локальный Next Dev на Windows
**Project Type**: продуктовая функция одного Next.js-приложения в существующем монорепозитории
**Performance Goals**: специальных целей нет; нагрузочное тестирование вне объёма
**Constraints**: 24-часовая абсолютная сессия, роль не задаётся публичным запросом, секрет вне Git, dev-зависимости вне runtime-образа, сохранение существующих команд запуска
**Scale/Scope**: 2 роли, 3 пользовательских сценария, 4 страницы и одна локальная операторская команда

## Constitution Check

- I: данные пользователей и сессий только в БД кабинета; DSP/Аукцион не затрагиваются.
- II: spec.md хранит согласованный объём; после реализации docs/features/auth.md описывает действующую логику, README корректируется.
- III: для регистрации, входа/выхода, роли, срока сессии и защиты страницы есть Red → Green → Refactor и соответствие требование → тест.
- IV: публичная роль `advertiser` фиксируется на сервере; защищённая страница проверяет сессию в БД, чужие данные не выдаются.
- V: интеграционные тесты с реальным PostgreSQL через Testcontainers и сквозной Playwright поверх Docker Compose.
- VI: после кода, тестов и документов отдельное ревью по `$code-reviewer`; подтверждённые дефекты исправляются до передачи.
- Git: работа на `epic/cabinet-access`; пользователь запретил коммит на этом этапе, PR не создаётся.
- **Gate**: противоречий конституции нет; повторить после дизайна.

## Project Structure

### Documentation (this feature)

```text
specs/002-cabinet-auth/
├── spec.md
├── checklists/requirements.md
├── plan.md
├── research.md
├── data-model.md
├── contracts/auth.md
├── quickstart.md
├── tasks.md
├── analysis.md
└── verification.md
```

### Source Code (repository root)

```text
apps/cabinet/
├── migrations/001_auth.sql
├── scripts/migrate.mjs
├── scripts/create-admin.ts
├── src/lib/auth.ts
├── src/lib/create-admin.ts
├── src/components/auth-form.tsx
├── src/components/logout-button.tsx
└── src/app/
    ├── page.tsx
    ├── register/page.tsx
    ├── login/page.tsx
    ├── cabinet/page.tsx
    └── api/auth/[...all]/route.ts
tests/
├── e2e/cabinet-auth.spec.ts
└── integration/cabinet-auth.test.ts
scripts/setup-local-env.mjs
```

**Structure Decision**: весь продуктовый код живёт в `apps/cabinet`; корневые scripts и Compose изменяются только для конфигурации локального запуска. Запросы БД идут через Better Auth и ограниченный миграционный/операторский код. HTTP-обёртка нормализует email, заполняет служебное имя при регистрации и пропускает только согласованные auth-маршруты. Better Auth доверяет обоим локальным loopback-адресам на настроенном порту кабинета.

## Test-first and verification plan

1. После установки зависимостей, SQL-миграции и подготовки тестового окружения написать интеграционные тесты регистрации, уникальности email, игнорирования роли, входа, выхода, истечения сессии и ручного создания admin. Запустить их: Red — ожидаемые ошибки отсутствующего обработчика или поведения при уже работающих зависимостях и PostgreSQL, а не ошибка установки/импорта.
2. После подтверждённого Red подключить серверный HTTP-обработчик Better Auth, нормализацию email и безопасную публичную роль до Green. Версионированная миграция уже готова как структурная предпосылка теста; после каждого среза повторить затронутые тесты.
3. Написать RTL-тесты формы для валидного/невалидного ввода и сообщений; Red — отсутствующее поведение формы. Реализовать страницы и защиту `/cabinet`, повторить тесты. Добавить Playwright-сценарии после доступности приложения и выполнить на Docker Compose.
4. Отдельно проверить миграционный runner повторным запуском, отсутствие секрета в diff, конфигурацию Compose, `npm run typecheck`, сборку трёх сервисов и существующий `npm test`. Для конфигурации и документации использовать эти прямые проверки.
5. После рефакторинга повторить затронутые тесты. Записать реальные Passed/Failed/Blocked/NotRun и матрицу FR → тест в `verification.md`. Применить `$code-reviewer` как последний проход.

## Complexity Tracking

Отклонений от конституции нет. Новые зависимости ограничены задачей авторизации и реальной интеграционной проверки.
