# Паттерны и соглашения

## Функциональный подход

Проект использует **функциональный подход без классов**. Все компоненты реализованы как функции и модули.

**Принципы**:
- Нет классов, только функции
- Именованные экспорты (не default)
- Чистые функции где возможно
- Минимум побочных эффектов

## Именованные экспорты

Все функции экспортируются именованно:

```typescript
// ✅ Правильно
export const executeHelpCommand = async (...) => { ... };

// ❌ Неправильно
export default async function executeHelpCommand(...) { ... }
```

**Преимущества**:
- Явные зависимости
- Лучшая поддержка IDE
- Легче рефакторинг

## CommandResult паттерн

Все команды возвращают единый формат результата:

```typescript
interface CommandResult {
  success: boolean;
  message?: string;
  data?: Record<string, unknown>;
  error?: string;
}
```

**Использование**:
```typescript
if (result.success) {
  // Обработка успеха
} else {
  // Обработка ошибки
  logError("Command failed", result.error);
}
```

## Singleton для клиентов

Telegram и Notion клиенты создаются один раз и переиспользуются:

```typescript
let botInstance: TelegramBot | null = null;

export const getTelegramBot = (): TelegramBot => {
  if (!botInstance) {
    botInstance = new TelegramBot(config.botToken, { polling: false });
  }
  return botInstance;
};
```

**Преимущества**:
- Экономия ресурсов
- Единая точка доступа
- Легкое тестирование

## Обработка ошибок

**Принципы**:
1. Все ошибки логируются
2. Пользователю отправляется понятное сообщение
3. Возвращается `CommandResult` с `success: false`

**Пример**:
```typescript
try {
  const result = await someOperation();
  return { success: true, data: result };
} catch (error) {
  logError("Operation failed", error);
  return {
    success: false,
    error: "Произошла ошибка при выполнении операции"
  };
}
```

## Логирование

**Принципы**:
1. Логирование всех важных операций
2. Использование правильного уровня логирования
3. Структурированные данные в логах

**Уровни**:
- `debug` - детальная отладочная информация
- `info` - информационные сообщения о работе
- `warn` - предупреждения (неавторизованный доступ, и т.д.)
- `error` - ошибки выполнения

**Пример**:
```typescript
logInfo("Processing message", {
  userId: 123456789,
  chatId: -1001234567890,
  command: "/help"
});
```

## Структура команд

Все команды следуют единой структуре:

```typescript
export const executeCommandName = async (
  userId: number,
  chatId: number,
  params: string[] = []
): Promise<CommandResult> => {
  logInfo("Executing command", { userId, chatId, params });
  
  try {
    // Проверка режима DEBUG
    if (appConfig.debug) {
      return await sendMessage(chatId, "DEBUG mode active");
    }
    
    // Основная логика
    const result = await doSomething();
    
    // Форматирование и отправка
    const message = formatResult(result);
    return await sendMessage(chatId, message);
  } catch (error) {
    logError("Command failed", error);
    return {
      success: false,
      error: "Произошла ошибка"
    };
  }
};
```

## Именование файлов

**Соглашения**:
- Команды: `*Command.ts` (например, `helpCommand.ts`)
- Сервисы: `*Service.ts` (например, `telegramService.ts`)
- Утилиты: `*Helper.ts`, `*Formatter.ts`, `*Parser.ts`
- Обработчики: `*Handler.ts`
- Типы: `index.ts` в директории `types/`

## Комментарии в коде

**Принципы**:
- Комментарии на английском языке
- JSDoc для публичных функций
- Объяснение сложной логики

**Пример**:
```typescript
/**
 * Execute /help command
 * Shows list of available commands with descriptions
 * @param userId - Telegram user ID
 * @param chatId - Telegram chat ID
 * @returns CommandResult with help message
 */
export const executeHelpCommand = async (
  userId: number,
  chatId: number
): Promise<CommandResult> => {
  // Implementation
};
```

---

[← Назад к содержанию](README.md)



