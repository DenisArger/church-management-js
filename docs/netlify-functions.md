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

## youth-poll-scheduler

**Файл**: `netlify/functions/youth-poll-scheduler.ts`

**Назначение**: Автоматическое создание опроса для молодежного служения.

**Триггер**: Scheduled функция (cron)

**Расписание**: Ежедневно в 18:00 UTC (21:00 по московскому времени)

**Конфигурация в `netlify.toml`**:
```toml
[functions."youth-poll-scheduler"]
  schedule = "0 18 * * *"
```

**Функциональность**:
1. Вызов `executeYouthPollScheduled()`
2. Проверка события на завтра
3. Создание опроса в группе
4. Логирование результата

**Ответы**:
- `200 OK` - успешное выполнение
- `500 Internal Server Error` - ошибка

---

[← Назад к содержанию](README.md)


