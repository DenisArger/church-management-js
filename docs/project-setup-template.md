# Шаблон настройки проекта

Этот файл можно копировать в другой репозиторий и адаптировать под конкретный стек, команду и процесс разработки.

## 1. Краткое описание

- **Название проекта:** `[PROJECT_NAME]`
- **Цель проекта:** `[PROJECT_GOAL]`
- **Краткое описание:** `[PROJECT_DESCRIPTION]`
- **Основной стек:** `[TECH_STACK]`
- **Основные сервисы и интеграции:** `[SERVICES_AND_INTEGRATIONS]`

## 2. Требования к окружению

- **Версия Node.js / Python / Go / другая:** `[RUNTIME_VERSION]`
- **Менеджер пакетов / зависимостей:** `[PACKAGE_MANAGER]`
- **Необходимые внешние инструменты:** `[CLI_TOOLS]`
- **Файл окружения:** `[ENV_FILE_NAME]`

## 3. Установка

```bash
[INSTALL_COMMAND]
```

Если нужен отдельный этап подготовки, добавь его сюда:

```bash
[SETUP_COMMAND]
```

## 4. Первый запуск

```bash
[START_COMMAND]
```

Если проект требует отдельную команду для локальной разработки:

```bash
[DEV_COMMAND]
```

## 5. Переменные окружения

Список переменных, которые нужно настроить перед запуском:

- `[ENV_VAR_1]` - `[DESCRIPTION]`
- `[ENV_VAR_2]` - `[DESCRIPTION]`
- `[ENV_VAR_3]` - `[DESCRIPTION]`

Пример:

```env
[ENV_VAR_1]=[VALUE]
[ENV_VAR_2]=[VALUE]
```

## 6. Проверки качества

Перед отправкой изменений проверь:

```bash
[BUILD_COMMAND]
[TEST_COMMAND]
[LINT_COMMAND]
```

Если в проекте есть дополнительные проверки, добавь их сюда:

- `[TYPECHECK_COMMAND]`
- `[FORMAT_COMMAND]`
- `[INTEGRATION_TEST_COMMAND]`

## 7. Git hooks и conventional commits

Если в проекте используются Git hooks:

- `pre-commit` - `[PRE_COMMIT_CHECK]`
- `commit-msg` - `[COMMIT_MESSAGE_RULE]`
- `pre-push` - `[PRE_PUSH_CHECK]`

Пример формата commit message:

```text
type(scope?): subject
```

Примеры:

```text
feat: add new feature
fix(auth): handle token refresh
chore: update dependencies
```

## 8. Деплой

- **Окружение деплоя:** `[DEPLOY_TARGET]`
- **Основная команда:** `[DEPLOY_COMMAND]`
- **Дополнительные шаги:** `[DEPLOY_EXTRA_STEPS]`

Пример:

```bash
[DEPLOY_COMMAND]
```

## 9. CI/CD

Опиши здесь, что должно происходить в CI:

- запуск build
- запуск tests
- запуск lint
- публикация артефактов
- деплой в нужное окружение

Если есть отдельный pipeline, укажи его здесь:

- `[CI_WORKFLOW_NAME]`
- `[CD_WORKFLOW_NAME]`

## 10. Troubleshooting

Типовые проблемы и способы решения:

- **Проблема:** `[ERROR_1]`
  - **Проверка:** `[CHECK_1]`
  - **Решение:** `[SOLUTION_1]`
- **Проблема:** `[ERROR_2]`
  - **Проверка:** `[CHECK_2]`
  - **Решение:** `[SOLUTION_2]`

## 11. Что заменить перед использованием

Перед копированием шаблона в новый проект замени:

- `[PROJECT_NAME]`
- `[PROJECT_GOAL]`
- `[PROJECT_DESCRIPTION]`
- `[TECH_STACK]`
- `[RUNTIME_VERSION]`
- `[PACKAGE_MANAGER]`
- `[INSTALL_COMMAND]`
- `[START_COMMAND]`
- `[BUILD_COMMAND]`
- `[TEST_COMMAND]`
- `[LINT_COMMAND]`
- `[DEPLOY_COMMAND]`

