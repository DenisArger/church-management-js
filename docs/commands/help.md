# Команда /help

## Назначение

Показывает список всех доступных команд с описанием.

## Параметры

Нет

## Пример использования

```
/help
```

## Реализация

**Файл**: `src/commands/helpCommand.ts`

```typescript
export const executeHelpCommand = async (
  userId: number,
  chatId: number
): Promise<CommandResult>
```

## Описание

Команда отправляет форматированное сообщение со списком всех доступных команд, их параметрами и примерами использования.

---

[← Назад к списку команд](README.md)









