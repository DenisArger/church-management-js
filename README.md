# Church Telegram Bot

Полная замена Django бота на функциональный JavaScript/TypeScript с использованием Netlify Functions.

## 🚀 Быстрый старт

### 1. Установка зависимостей

```bash
yarn install
```

### 2. Настройка переменных окружения

Создайте файл `.env` в корне проекта со следующими переменными:

```env
# Telegram Configuration
TELEGRAM_BOT_TOKEN=your_bot_token_here
ALLOWED_USERS=282850458,123456789
TELEGRAM_MAIN_CHANNEL_ID=-1001135084750
TELEGRAM_MAIN_GROUP_ID=-1001674885449
TELEGRAM_YOUTH_GROUP_ID=-1001411665242

# Notion Configuration
NOTION_TOKEN=your_notion_token_here
NOTION_PRAYER_DATABASE=c4dd9c96b8f94554bb9b020eda4e2667
NOTION_GENERAL_CALENDAR_DATABASE=03fe215aa37249f59c225f099db234fd
NOTION_DAILY_DISTRIBUTION_DATABASE=193b2c38419f80f4945dd84854f0dacd

# Application Configuration
NODE_ENV=production
LOG_LEVEL=info
LOG_FORMAT=json

# Netlify Configuration
NETLIFY_SITE_URL=https://your-site.netlify.app
```

Для production с многошаговыми формами (`/fill_sunday_service`, `/edit_schedule`, `/add_prayer`, `/youth_report`) нужны **SUPABASE_URL** и **SUPABASE_SERVICE_KEY** и таблица `user_form_state` ([scripts/supabase-schema.sql](scripts/supabase-schema.sql)); иначе в serverless состояние форм между шагами не сохраняется.

### 3. Локальная разработка

```bash
yarn dev
```

Запускает debug-сервер (Express) на `http://localhost:3000` с webhook на `/webhook`. Для проверки через Telegram используйте ngrok: `yarn test:ngrok`, затем настройте webhook на ваш ngrok-URL.

Альтернатива — окружение Netlify локально:

```bash
yarn netlify:dev
```

### 4. Настройка на продакшен

```bash
# Автоматическая настройка для продакшена
yarn setup:production

# Или вручную
./scripts/setup-production.sh
```

Подробнее: [PRODUCTION-SETUP.md](PRODUCTION-SETUP.md)

### 5. Сборка и деплой

```bash
# Полный деплой с настройкой webhook
yarn deploy:full

# Или вручную
yarn build
yarn deploy
```

## 📋 Команды бота

- `/create_poll` - Создание опроса для молодежной встречи
- `/request_pray` - Рассылка молитвенных нужд
- `/request_state_sunday` - Информация о воскресном служении

## 🏗️ Архитектура

Проект использует функциональный подход без классов:

- **Services** - работа с внешними API (Telegram, Notion)
- **Commands** - обработка команд бота
- **Handlers** - маршрутизация сообщений
- **Utils** - вспомогательные функции
- **Config** - конфигурация приложения

## 🔧 Технологии

- TypeScript
- Node.js
- Netlify Functions
- Telegram Bot API
- Notion API
- Yarn

## 📊 Мониторинг

- Логирование через Netlify Functions
- Аналитика через Netlify Analytics
- Отслеживание ошибок в консоли Netlify

## ✅ Статус проекта

Проект полностью восстановлен и готов к использованию! Все файлы созданы заново с функциональным подходом.
