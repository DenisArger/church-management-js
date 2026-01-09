# TelegramService

**Файл**: `src/services/telegramService.ts`

**Назначение**: Работа с Telegram Bot API.

## Singleton паттерн

```typescript
let botInstance: TelegramBot | null = null;

export const getTelegramBot = (): TelegramBot => {
  if (!botInstance) {
    const config = getTelegramConfig();
    botInstance = new TelegramBot(config.botToken, { polling: false });
  }
  return botInstance;
};
```

## Режимы работы

- **Production**: основной бот и группа
- **Debug**: тестовый бот и группа (если настроено)

```typescript
export const getTelegramConfigForMode = (isDebug: boolean) => {
  // Возвращает конфигурацию для нужного режима
};
```

## Функции отправки

- **`sendMessage(chatId, text, options?)`** - отправка текстового сообщения
- **`sendMessageToUser(userId, text, options?)`** - отправка пользователю
- **`sendPoll(bot, chatId, question, options, messageThreadId?)`** - отправка опроса
  - Поддержка топиков в супергруппах через `messageThreadId`
- **`sendPhoto(chatId, photo, caption?)`** - отправка фото

## Особенности

- Все функции возвращают `CommandResult`
- Логирование всех операций
- Обработка ошибок

---

[← Назад к списку сервисов](README.md)







