# Netlify Functions

## telegram-webhook

**Файл**: `netlify/functions/telegram-webhook.ts`

**Назначение**: Обработчик webhook от Telegram.

**Триггер**: HTTP POST запрос от Telegram

**Функциональность**:
1. Обработка CORS (preflight запросы)
2. Валидация метода (только POST)
3. Парсинг обновления от Telegram
4. Вызов `handleMessage` для обработки
5. Возврат результата

**Ответы**:
- `200 OK` - успешная обработка
- `405 Method Not Allowed` - неверный метод
- `500 Internal Server Error` - ошибка обработки

**CORS заголовки**:
- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Headers: Content-Type`
- `Access-Control-Allow-Methods: POST, OPTIONS`

## poll-scheduler

**Файл**: `netlify/functions/poll-scheduler.ts`

**Назначение**: Автоматическое создание опросов и уведомлений для событий типа «Молодежное» и «МОСТ».

**Триггер**: Scheduled функция (cron)

**Расписание**: каждые 15 минут

**Конфигурация в `netlify.toml`**:
```toml
[functions."poll-scheduler"]
  schedule = "*/15 * * * *"
```

**Функциональность**:
1. Получение событий на ближайшие 48 часов
2. Отправка опроса за 24 часа до события
3. Отправка уведомления администратору за 3 часа до события
4. Логирование результатов

---

[← Назад к содержанию](README.md)



