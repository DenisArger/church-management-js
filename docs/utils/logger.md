# Logger

**Файл**: `src/utils/logger.ts`

**Назначение**: Централизованная система логирования.

## Уровни логирования

- `debug` - отладочная информация
- `info` - информационные сообщения
- `warn` - предупреждения
- `error` - ошибки

## Форматы

- `json` - JSON формат (по умолчанию)
- `text` - текстовый формат

## Функции

- `logDebug(message, data?)` - отладочное сообщение
- `logInfo(message, data?)` - информационное сообщение
- `logWarn(message, data?)` - предупреждение
- `logError(message, error?)` - ошибка
- `setLoggerConfig(config)` - настройка логгера

## Конфигурация

- `LOG_LEVEL` - уровень логирования
- `LOG_FORMAT` - формат логирования

## Пример

```typescript
logInfo("Processing message", {
  userId: 123456789,
  chatId: -1001234567890,
  text: "Hello"
});
```

---

[← Назад к списку утилит](README.md)


