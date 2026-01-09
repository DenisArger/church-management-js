# Конфигурация

## Переменные окружения

Все переменные окружения настраиваются в файле `.env` (создается из `env.example`).

### Telegram Configuration

- **`TELEGRAM_BOT_TOKEN`** (обязательно) - токен основного бота
- **`ALLOWED_USERS`** (обязательно) - список ID авторизованных пользователей через запятую
  - Пример: `282850458,123456789`
- **`TELEGRAM_MAIN_CHANNEL_ID`** - ID основного канала
- **`TELEGRAM_MAIN_GROUP_ID`** - ID основной группы
- **`TELEGRAM_YOUTH_GROUP_ID`** - ID молодежной группы
- **`TELEGRAM_WEBHOOK_URL`** - URL для webhook (настраивается автоматически)

### Debug Telegram Configuration

- **`TELEGRAM_BOT_TOKEN_DEBUG`** - токен тестового бота
- **`TELEGRAM_CHAT_ID_DEBUG`** - ID тестового чата
- **`TELEGRAM_TOPIC_ID_DEBUG`** - ID топика в тестовом чате

### Notion Configuration

- **`NOTION_TOKEN`** (обязательно) - токен интеграции Notion
- **`NOTION_PRAYER_DATABASE`** (обязательно) - ID базы данных молитвенных нужд
- **`NOTION_GENERAL_CALENDAR_DATABASE`** (обязательно) - ID базы данных календаря
- **`NOTION_DAILY_DISTRIBUTION_DATABASE`** (обязательно) - ID базы данных ежедневного чтения
- **`NOTION_WEEKLY_PRAYER_DATABASE`** (обязательно) - ID базы данных недельных молитвенных записей

### Application Configuration

- **`NODE_ENV`** - окружение (`development` или `production`)
- **`DEBUG`** - режим отладки (`true` или `false`)
- **`LOG_LEVEL`** - уровень логирования (`debug`, `info`, `warn`, `error`)
- **`LOG_FORMAT`** - формат логирования (`json` или `text`)

### Netlify Configuration

- **`NETLIFY_SITE_URL`** - URL сайта Netlify (используется для webhook)

## Валидация окружения

Функция `validateEnvironment()` проверяет наличие всех обязательных переменных при запуске приложения.

**Обязательные переменные**:
- `TELEGRAM_BOT_TOKEN`
- `NOTION_TOKEN`
- `NOTION_PRAYER_DATABASE`
- `NOTION_GENERAL_CALENDAR_DATABASE`
- `NOTION_DAILY_DISTRIBUTION_DATABASE`
- `NOTION_WEEKLY_PRAYER_DATABASE`

## Режимы работы

### Development

- `NODE_ENV=development`
- Более подробное логирование
- Debug режим доступен

### Production

- `NODE_ENV=production`
- Минимальное логирование
- Все функции работают в полном режиме

### Debug

- `DEBUG=true` или `NODE_ENV=development`
- Рассылки не отправляются
- Используется тестовый бот (если настроен)
- Отправка в тестовую группу

---

[← Назад к содержанию](README.md)







