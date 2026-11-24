# Implementation Plan: Кампании и креативы в кабинете

**Branch**: `epic/cabinet-access` | **Date**: 2026-11-24 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/003-cabinet-campaigns/spec.md`

## Summary

Добавить рекламодателю управление своими кампаниями. Администратор выбирает рекламодателя и выполняет те же действия с его кампаниями. Данные принадлежат кабинету, а решение о доступе и допустимости операции принимает сервер. Права, статусы и проверка креативов применяются одинаково в интерфейсе и при прямых запросах.

Вход опирается на существующие сессии. Путь обеих ролей можно проверить при запуске только кабинета и его PostgreSQL. Контракт DSP, торги и отчёты составят следующие срезы после проверки кабинета.

## Technical Context

**Language/Version**: TypeScript 5.9.3 на Node.js 22.  
**Primary Dependencies**: Next.js 16.4.5, React 19.3.1, Better Auth 1.7.20, pg 8.23.1. Для декодирования креативов предлагается прямая зависимость `sharp@0.35.5` из существующего lockfile. Её добавление нужно согласовать перед реализацией.  
**Storage**: PostgreSQL 18 кабинета. Миграция `002_campaigns` после `001_auth`, изображение в `bytea`.  
**Testing**: Vitest, React Testing Library, PostgreSQL Testcontainers и Playwright Chromium.  
**Target Platform**: Локальный Docker Compose, Node.js 22 Alpine в контейнере.  
**Project Type**: Приложение кабинета Next.js App Router с HTTP-обработчиками.  
**Performance Goals**: Списки кампаний возвращают метаданные; изображение загружается отдельным запросом.  
**Constraints**: JPEG или PNG 300×250, файл до 1 МиБ, тело запроса креатива до 2 МиБ. Ставка хранится в целых тысячных USD. Сервер проверяет владельца, роль и статус каждой операции.  
**Scale/Scope**: Тестовый стенд, две существующие роли, один креатив на кампанию.

## Constitution Check

| Принцип | Как выполняется |
| --- | --- |
| I. Границы сервисов | Кабинет использует только свою PostgreSQL. Проверка этого среза не требует DSP, Аукциона или их данных. |
| II. Требования и документация | FR и критерии AC в спецификации. После реализации добавить действующую логику в `docs/features/campaigns.md` и сверить README и эпики. |
| III. Red → Green → Refactor | Для каждого AC предусмотрена проверка наблюдаемого результата. Сначала осмысленный сбой теста, затем минимальная реализация и повторные проверки. |
| IV. Данные и доступ | Роль и владелец проверяются на сервере, включая изображение креатива. Ставка точна, удаление скрывает кампанию из управления и сохраняет связь с владельцем. |
| V. Локальный запуск и проверки | PostgreSQL Testcontainers для доступа, миграций и сохранения. Playwright для обеих ролей на Compose с кабинетом и его базой. |
| VI. Финальное ревью | После тестов и актуализации документации применить `$code-reviewer`. Зафиксировать фактически выполненные проверки и итог ревью в `verification.md`. |

После проектирования повторно сверены границы сервисов, правила доступа, переходы статусов и тестовые уровни. Для реализации нужна отдельная ветка эпика по `AGENTS.md`. Текущая ветка указана в метаданных, создание новой выполняется по прямому разрешению пользователя.

## Project Structure

### Documentation (this feature)

```text
specs/003-cabinet-campaigns/
├── spec.md
├── checklists/requirements.md
├── plan.md
├── research.md
├── data-model.md
├── contracts/cabinet-campaigns.md
├── quickstart.md
├── tasks.md
├── analysis.md
└── verification.md
```

### Source Code (repository root)

```text
apps/cabinet/
├── migrations/002_campaigns.sql
├── scripts/migrate.mjs
└── src/
    ├── lib/
    │   ├── auth.ts
    │   └── campaigns/
    │       ├── rules.ts
    │       ├── rules.test.ts
    │       ├── access.ts
    │       ├── repository.ts
    │       ├── service.ts
    │       ├── creative-image.ts
    │       ├── creative-image.test.ts
    │       └── http.ts
    ├── components/
    │   ├── campaign-editor.tsx
    │   └── campaign-editor.test.tsx
    └── app/
        ├── cabinet/page.tsx
        ├── cabinet/campaigns/[id]/page.tsx
        ├── cabinet/advertisers/[ownerId]/page.tsx
        ├── api/admin/users/route.ts
        └── api/campaigns/
            ├── route.ts
            └── [id]/
                ├── route.ts
                ├── activate/route.ts
                ├── pause/route.ts
                ├── creative/route.ts
                └── creative/image/route.ts
tests/
├── e2e/cabinet-campaigns.spec.ts
└── integration/cabinet-campaigns.test.ts
docs/features/campaigns.md
```

**Structure Decision**: Добавить модуль к действующему кабинету. Серверные страницы и HTTP-обработчики используют общие проверки прав, правила и операции сохранения. Интерфейс вызывает HTTP-запросы для записи. Обработчики входа из текущей реализации остаются источником сессий.

## Test-first and verification plan

1. **Создание и настройки**. Тесты проверяют сохранение без настроек, идентификатор, границы ставки, перечни таргетов и сохранение прежних данных при отклонении. Red после подключения теста к наблюдаемой точке входа — кампания или правила ещё не дают требуемый результат. Green — миграция, операция кампании и минимальный путь в интерфейсе. Refactor — общие правила без дублирования и повторный запуск.
2. **Креатив**. Проверить JPEG и PNG, включая точную границу размера, пустое название, повреждение, неподходящий формат и размеры, URL, второе добавление, замену и удаление. Green — проверка содержимого, запись одного креатива и защищённая выдача. Refactor — повторить проверки обоих форматов и попыток доступа.
3. **Статусы и удаление**. Проверить каждое условие включения, пустые таргеты, разрешённое редактирование в `active`, паузу, отклонение повторов и сохранение владельца при удалении. Проверить совместимость параллельных действий. Green — транзакционные переходы и отображение доступных действий. Refactor — повторить проверки состояния и ролей.
4. **Администратор и изоляция**. Проверить список пользователей, создание для выбранного владельца, операции администратора, повторное включение владельцем и отклонение прямых чужих запросов. Ошибка окружения, зависимостей, разбора теста или отсутствующий импорт не считается Red.
5. **Приёмка**. Запустить выбранные проверки и браузерный путь из [quickstart.md](quickstart.md). Сохранить соответствие AC → тест и фактический результат в `verification.md`. Проверки будущих интеграций остаются в соответствующих срезах.

Команды кабинета: `npm run test:unit`, `npm run test:integration -- tests/integration/cabinet-campaigns.test.ts tests/integration/cabinet-auth.test.ts`, `npm run typecheck --workspace=apps/cabinet`, `npx playwright test tests/e2e/cabinet-campaigns.spec.ts tests/e2e/cabinet-auth.spec.ts`. Для браузерной проверки запустить `docker compose up --build -d cabinet-db cabinet` после локальной настройки.

## Complexity Tracking

Исключения из конституции не нужны. Дополнительные сервисы не требуются.
