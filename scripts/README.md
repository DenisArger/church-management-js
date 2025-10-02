# Church Telegram Bot - Deployment Scripts

Этот набор скриптов поможет вам развернуть Church Telegram Bot в Netlify и настроить webhook.

## Скрипты

### 1. `setup.sh` - Настройка окружения

Настраивает среду разработки и создает необходимые файлы.

```bash
./scripts/setup.sh
```

**Опции:**

- `--skip-requirements` - Пропустить проверку системных требований
- `--skip-dependencies` - Пропустить установку зависимостей
- `--skip-env` - Пропустить создание .env файла
- `--skip-build` - Пропустить сборку проекта
- `--skip-test` - Пропустить тестирование сборки
- `--skip-git` - Пропустить настройку Git hooks
- `--skip-scripts` - Пропустить создание скриптов разработки

### 2. `deploy.sh` - Деплой в Netlify

Собирает проект, деплоит в Netlify и настраивает webhook.

```bash
./scripts/deploy.sh
```

**Опции:**

- `--skip-build` - Пропустить сборку проекта
- `--skip-deploy` - Пропустить деплой в Netlify
- `--skip-webhook` - Пропустить настройку webhook
- `--skip-test` - Пропустить тестирование деплоя

### 3. `webhook-manager.sh` - Управление webhook

Управляет настройками Telegram webhook.

```bash
# Установить webhook
./scripts/webhook-manager.sh set https://your-bot.netlify.app/.netlify/functions/telegram-webhook

# Установить webhook из Netlify URL
./scripts/webhook-manager.sh set-netlify https://your-bot.netlify.app

# Установить webhook из файла .netlify-url
./scripts/webhook-manager.sh set-file

# Удалить webhook
./scripts/webhook-manager.sh delete

# Получить информацию о webhook
./scripts/webhook-manager.sh info

# Протестировать webhook
./scripts/webhook-manager.sh test https://your-bot.netlify.app/.netlify/functions/telegram-webhook
```

## Быстрый старт

### 1. Первоначальная настройка

```bash
# Клонируйте репозиторий
git clone <repository-url>
cd church-management-js

# Запустите скрипт настройки
./scripts/setup.sh
```

### 2. Настройка окружения

Отредактируйте файл `.env` с вашими значениями:

```env
TELEGRAM_BOT_TOKEN=your_bot_token_here
NOTION_TOKEN=your_notion_token_here
NOTION_PRAYER_DATABASE=your_prayer_database_id_here
NOTION_GENERAL_CALENDAR_DATABASE=your_calendar_database_id_here
NOTION_DAILY_DISTRIBUTION_DATABASE=your_daily_distribution_database_id_here
NOTION_WEEKLY_PRAYER_DATABASE=your_weekly_prayer_database_id_here
ALLOWED_USERS=282850458,123456789
```

### 3. Деплой в Netlify

```bash
# Полный деплой
./scripts/deploy.sh

# Или только деплой без webhook
./scripts/deploy.sh --skip-webhook
```

### 4. Настройка webhook

```bash
# Если webhook не был настроен автоматически
./scripts/webhook-manager.sh set-file

# Проверить статус webhook
./scripts/webhook-manager.sh info
```

## Локальная разработка

### 1. Запуск локального сервера

```bash
# Используйте созданный скрипт
./start-dev.sh

# Или напрямую
netlify dev --port 8888
```

### 2. Тестирование с ngrok

```bash
# В другом терминале
ngrok http 8888

# Протестируйте webhook
./test-local.sh https://your-ngrok-url.ngrok.io/.netlify/functions/telegram-webhook
```

## Требования

- Node.js (версия 18 или выше)
- Yarn
- Git
- Netlify CLI (устанавливается автоматически)

## Переменные окружения

Обязательные переменные в `.env`:

- `TELEGRAM_BOT_TOKEN` - Токен Telegram бота
- `NOTION_TOKEN` - Токен интеграции Notion
- `NOTION_*_DATABASE` - ID баз данных Notion
- `ALLOWED_USERS` - Список авторизованных пользователей

## Устранение неполадок

### Ошибка "Not logged in to Netlify"

```bash
netlify login
```

### Ошибка "Build failed"

```bash
# Проверьте зависимости
yarn install

# Очистите кэш
yarn cache clean

# Пересоберите
yarn build
```

### Ошибка "Webhook not set"

```bash
# Проверьте токен бота
./scripts/webhook-manager.sh info

# Установите webhook вручную
./scripts/webhook-manager.sh set-file
```

### Ошибка "Unauthorized user"

Убедитесь, что ваш Telegram ID добавлен в `ALLOWED_USERS` в файле `.env`.

## Полезные команды

```bash
# Сборка проекта
yarn build

# Линтинг
yarn lint
yarn lint:fix

# Тестирование
yarn test

# Деплой через yarn
yarn deploy
```

## Структура файлов

```
scripts/
├── setup.sh              # Настройка окружения
├── deploy.sh              # Деплой в Netlify
├── webhook-manager.sh     # Управление webhook
└── README.md             # Эта документация

start-dev.sh              # Запуск локального сервера
test-local.sh             # Тестирование локального webhook
.netlify-url              # URL деплоя (создается автоматически)
```

## Поддержка

Если у вас возникли проблемы:

1. Проверьте логи в Netlify Dashboard
2. Убедитесь, что все переменные окружения настроены правильно
3. Проверьте статус webhook: `./scripts/webhook-manager.sh info`
4. Протестируйте локально с ngrok
