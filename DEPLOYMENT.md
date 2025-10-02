# 🚀 Деплой Church Telegram Bot

## Быстрый старт

### 1. Первоначальная настройка

```bash
# Настройка окружения
yarn setup

# Или вручную
./scripts/setup.sh
```

### 2. Настройка переменных окружения

Отредактируйте файл `.env`:

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
# Полный деплой с настройкой webhook
yarn deploy:full

# Или вручную
./scripts/deploy.sh
```

### 4. Проверка webhook

```bash
# Проверить статус webhook
yarn webhook:info

# Или
./scripts/webhook-manager.sh info
```

## Полезные команды

### Yarn команды

```bash
yarn setup              # Настройка окружения
yarn deploy:full        # Полный деплой
yarn webhook:set        # Настроить webhook
yarn webhook:info       # Информация о webhook
yarn webhook:delete     # Удалить webhook
```

### Прямые скрипты

```bash
./scripts/setup.sh                    # Настройка окружения
./scripts/deploy.sh                   # Деплой в Netlify
./scripts/webhook-manager.sh info     # Информация о webhook
./scripts/webhook-manager.sh set-file # Настроить webhook из файла
```

## Локальная разработка

### Запуск локального сервера

```bash
./start-dev.sh
# Или
netlify dev --port 8888
```

### Тестирование с ngrok

```bash
# В другом терминале
ngrok http 8888

# Протестировать webhook
./test-local.sh https://your-ngrok-url.ngrok.io/.netlify/functions/telegram-webhook
```

## Управление webhook

### Основные команды

```bash
# Установить webhook
./scripts/webhook-manager.sh set https://your-bot.netlify.app/.netlify/functions/telegram-webhook

# Установить из Netlify URL
./scripts/webhook-manager.sh set-netlify https://your-bot.netlify.app

# Установить из файла .netlify-url
./scripts/webhook-manager.sh set-file

# Удалить webhook
./scripts/webhook-manager.sh delete

# Получить информацию
./scripts/webhook-manager.sh info

# Протестировать webhook
./scripts/webhook-manager.sh test https://your-bot.netlify.app/.netlify/functions/telegram-webhook
```

## Авторизация

Все команды бота доступны только авторизованным пользователям. Для добавления пользователя:

1. Получите Telegram ID пользователя
2. Добавьте ID в `ALLOWED_USERS` в файле `.env`
3. Перезапустите бота

```env
ALLOWED_USERS=282850458,123456789,555666777
```

## Устранение неполадок

### Ошибка "Not logged in to Netlify"

```bash
netlify login
```

### Ошибка "Build failed"

```bash
yarn install
yarn build
```

### Ошибка "Webhook not set"

```bash
./scripts/webhook-manager.sh set-file
```

### Ошибка "Unauthorized user"

Проверьте, что ваш Telegram ID добавлен в `ALLOWED_USERS`.

## Структура файлов

```
scripts/
├── setup.sh              # Настройка окружения
├── deploy.sh              # Деплой в Netlify
├── webhook-manager.sh     # Управление webhook
└── README.md             # Подробная документация

start-dev.sh              # Запуск локального сервера
test-local.sh             # Тестирование локального webhook
.netlify-url              # URL деплоя (создается автоматически)
```

## Мониторинг

### Проверка статуса webhook

```bash
curl https://api.telegram.org/bot<TOKEN>/getWebhookInfo
```

### Логи в Netlify

1. Откройте [Netlify Dashboard](https://app.netlify.com)
2. Выберите ваш сайт
3. Перейдите в раздел "Functions"
4. Просмотрите логи

## Безопасность

- Никогда не коммитьте файл `.env`
- Регулярно обновляйте токены
- Ограничьте доступ к авторизованным пользователям
- Мониторьте логи на подозрительную активность
