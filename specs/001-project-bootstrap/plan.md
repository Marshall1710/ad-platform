# Implementation Plan: локальный каркас проекта

**Branch**: `main` | **Date**: 2026-11-06 | **Spec**: [spec.md](spec.md)

## Summary

Создать три минимально запускаемых приложения и две независимые PostgreSQL; обеспечить команды запуска, сборки и smoke-проверки из корня репозитория. Это инфраструктурная подготовка до эпиков.

## Technical Context

**Language/Version**: Node.js 22, TypeScript, Go 1.27
**Primary Dependencies**: Next.js 16, React 19, npm workspaces, Playwright
**Storage**: два контейнера PostgreSQL с отдельными томами; схемы пока отсутствуют
**Testing**: Playwright HTTP/UI smoke; pg_isready для обеих БД; Go testing, Vitest и React Testing Library установлены, предметные unit-тесты появятся с функциональными спеками
**Target Platform**: Docker Desktop, Linux-контейнеры; локальная разработка на Windows
**Project Type**: три web-приложения / HTTP-сервиса в одном репозитории
**Performance Goals**: не задаются для каркаса
**Constraints**: один корневой README; docs/features строчными буквами; без бизнес-логики
**Scale/Scope**: 3 приложения, 2 БД, 5 контейнеров

## Constitution Check

- Границы: отдельные приложения и отдельные БД кабинета/DSP; у Аукциона нет БД.
- Документация: итог этой подготовки в spec.md, фактические команды в README, проверки в verification.md.
- Red → Green → Refactor: предметное поведение не реализуется; для конфигурации и сборки выбран реальный smoke-прогон. Искусственные unit-тесты стартовых страниц не создаются.
- Права и деньги: не затрагиваются.
- Интеграция: Docker Compose поднимает пять компонентов; smoke проверяет их доступность.
- Git: пользователь разрешил подготовку в main и push после проверки; PR агент не создаёт.

## Project Structure

### Documentation (this feature)

```text
specs/001-project-bootstrap/
├── spec.md
├── plan.md
├── research.md
├── contracts/health.md
├── quickstart.md
├── tasks.md
├── analysis.md
└── verification.md
```

### Source Code (repository root)

```text
apps/
├── cabinet/          # Next.js UI и API
├── auction/          # Next.js UI и API
└── dsp/              # Go HTTP-сервис
tests/e2e/            # Playwright smoke
scripts/              # Проверка готовности БД
compose.yaml
Dockerfile.next
package.json
package-lock.json
```

**Structure Decision**: три развёртываемых приложения расположены вместе; npm workspaces включают только два Next.js-приложения; Go-модуль самостоятельный.

## Test-first and verification plan

До реализации зафиксировать ожидаемые адреса и состояния в smoke-сценарии. Для каркаса проверять результат после сборки, поскольку первичная ошибка отсутствия приложения является ошибкой окружения, а не достоверным Red для бизнес-поведения. Запустить npm run build, npm run up, npm test, npm run down и повторный npm run up; записать реальные результаты. При появлении бизнес-логики применять Red → Green → Refactor по её спецификациям.

## Complexity Tracking

Нет отклонений от конституции. Данных и межсервисного продуктового API в этой задаче нет.
