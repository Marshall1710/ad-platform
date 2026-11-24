# Исследование: регистрация и вход

## Решение 1. Готовая библиотека авторизации

**Decision**: Better Auth 1.7.20 с `pg` 8.23.1 и встроенным PostgreSQL-адаптером. Кабинет остаётся единственным владельцем учётных записей.

**Rationale**: Библиотека поддерживает Next.js 16, вход по email/паролю, серверные сессии и дальнейшее добавление Google-входа. `role` задаётся как серверное дополнительное поле с `input: false` и значением по умолчанию `advertiser`. Это уменьшает объём собственного кода для паролей, cookies, CSRF и сессий.

**Alternatives considered**: Самописные хеширование, токены и сессии через `pg` дали бы меньше зависимостей, но расширили бы критичный к безопасности код. Auth.js также пригоден для Next.js, однако для выбранной связки email/пароль + серверные сессии потребовалось бы больше собственной интеграции.

**Sources**: [Next.js authentication](https://nextjs.org/docs/app/guides/authentication), [Better Auth Next.js](https://better-auth.com/docs/integrations/next), [Better Auth PostgreSQL](https://better-auth.com/docs/adapters/postgresql), [server-owned role](https://better-auth.com/docs/concepts/database).

## Решение 2. Абсолютная сессия и проверка доступа

**Decision**: Запись сессии в PostgreSQL кабинета, срок 24 часа; обновление срока и cookie cache отключены. Защищённая страница проверяет сессию сервером при каждом запросе. Выход удаляет сессию. Пароль хеширует Better Auth.

**Rationale**: Это реализует согласованный срок, немедленный выход и серверную проверку роли без отдельного хранилища. Library cookie остаётся HttpOnly. Все операции с БД кабинета находятся в одном сервисе.

**Alternatives considered**: Подписанный автономный токен сложнее немедленно отозвать. Скользящий срок сессии расходится с 24 часами от момента входа.

**Sources**: [Better Auth session management](https://better-auth.com/docs/concepts/session-management), [OWASP session management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html).

## Решение 3. Миграции и локальная среда

**Decision**: Схему Better Auth фиксируем версионированной SQL-миграцией по конфигурации закреплённой версии библиотеки; отдельный идемпотентный runner применяет её перед стартом кабинета и в тестах. Схему сверяем с генератором Better Auth после подключения конфигурации. Для локального Next Dev БД кабинета доступна только на `127.0.0.1` через отдельный настраиваемый порт. Локальный секрет создаётся в исключённом из Git `.env` при настройке стенда.

**Rationale**: Схема воспроизводима без скачивания CLI во время запуска, а существующий `npm run dev:cabinet` продолжает работать с серверным кодом. Секрет не хранится в репозитории.

**Alternatives considered**: Неявная миграция при каждом запросе затруднила бы контроль версии схемы. Ручная правка таблиц обошла бы воспроизводимые миграции.

**Sources**: [Better Auth database and migrations](https://better-auth.com/docs/concepts/database), [PostgreSQL adapter](https://better-auth.com/docs/adapters/postgresql).

## Решение 4. Проверки

**Decision**: Vitest + React Testing Library для формы и сообщений, PostgreSQL Testcontainers 12.0.4 для реальных учётных записей/сессий/миграций, Playwright на запущенном Docker-стенде для пользовательского пути и защищённой страницы.

**Rationale**: Выполняет конституцию проекта и разделяет проверку формы, БД и полного пути. Отказы должны быть вызваны отсутствующим поведением, а не отсутствующей зависимостью. Версия 12.0.4 совместима с установленным Node 22.21; npm audit выявляет только moderate-риски транзитивных dev-зависимостей Testcontainers. Текущий Dockerfile копирует dev-зависимости в runtime-образ, поэтому в этой задаче его нужно изменить и оставить в runtime только production-зависимости. До выпуска продукта moderate-риски dev-цепочки нужно устранить обновлением стека или безопасным override.
