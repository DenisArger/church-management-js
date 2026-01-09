# Тестирование

## Локальное тестирование

### Запуск локального сервера

```bash
yarn netlify:dev
```

Сервер запустится на `http://localhost:8888`.

### Тестирование webhook локально

```bash
# Отправка тестового запроса
curl -X POST http://localhost:8888/.netlify/functions/telegram-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "update_id": 1,
    "message": {
      "message_id": 1,
      "from": {"id": 123456789, "first_name": "Test"},
      "chat": {"id": 123456789, "type": "private"},
      "text": "/help",
      "date": 1234567890
    }
  }'
```

## Тестирование с ngrok

### Настройка ngrok

```bash
# Запуск ngrok
ngrok http 8888
```

### Настройка webhook на ngrok URL

```bash
./scripts/webhook-manager.sh set https://your-ngrok-url.ngrok.io/.netlify/functions/telegram-webhook
```

### Тестирование

Отправьте команду боту в Telegram. Запрос пойдет через ngrok на локальный сервер.

## Тестирование команд

### Список команд для тестирования

- `/help` - справка
- `/test_notion` - проверка Notion
- `/debug_calendar` - отладка календаря
- `/create_poll` - создание опроса
- `/request_pray` - рассылка молитв
- `/add_prayer Иван | Здоровье | current` - добавление молитвы
- `/daily_scripture` - ежедневное чтение
- `/request_state_sunday` - воскресное служение
- `/weekly_schedule` - недельное расписание
- `/prayer_week` - молитвы на неделю
- `/youth_poll` - опрос для молодежи

## Debug режим

### Включение debug режима

В `.env`:
```env
DEBUG=true
# или
NODE_ENV=development
```

### Особенности debug режима

- Рассылки не отправляются (показывается сообщение)
- Используется тестовый бот (если настроен)
- Отправка в тестовую группу
- Более подробное логирование

## Тестирование scheduled функции

### Локальный запуск

```bash
# Запуск Netlify dev
yarn netlify:dev

# В другом терминале - вызов функции
curl -X POST http://localhost:8888/.netlify/functions/youth-poll-scheduler
```

### Проверка логов

Логи отображаются в терминале, где запущен `netlify dev`.

## Устранение проблем

### 502 Bad Gateway

- Убедитесь, что Netlify dev сервер запущен
- Проверьте, что порт 8888 свободен
- Перезапустите сервер

### Webhook не отвечает

- Проверьте статус: `yarn webhook:info`
- Перезапустите webhook: `yarn webhook:set-file`
- Проверьте логи в Netlify Dashboard

### Бот не отвечает

- Проверьте, что бот добавлен в группу
- Убедитесь, что используется правильный токен
- Проверьте права бота в группе
- Проверьте авторизацию пользователя (`ALLOWED_USERS`)

---

[← Назад к содержанию](README.md)




