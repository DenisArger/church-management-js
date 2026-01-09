# NotionService

**Файл**: `src/services/notionService.ts`

**Назначение**: Интеграция с Notion API для работы с базами данных.

## Singleton паттерн

```typescript
let notionClient: Client | null = null;

export const getNotionClient = (): Client => {
  if (!notionClient) {
    const config = getNotionConfig();
    notionClient = new Client({ auth: config.token });
  }
  return notionClient;
};
```

## Работа с молитвенными нуждами

- **`createPrayerNeed(text, author, category?)`** - создание молитвенной нужды
- **`getActivePrayerNeeds()`** - получение активных молитвенных нужд

**База данных**: `NOTION_PRAYER_DATABASE`

**Поля**:
- Текст (rich_text)
- Автор (rich_text)
- Дата (date)
- Статус (select: Активная, Отвеченная, Архивированная)
- Категория (select, опционально)

## Работа с календарем

- **`getCalendarItems(startDate?, endDate?)`** - получение событий календаря
- **`getYouthEventForTomorrow()`** - получение молодежного события на завтра

**База данных**: `NOTION_GENERAL_CALENDAR_DATABASE`

**Поля**:
- Название (title)
- Дата (date)
- Описание (rich_text)
- Тип (select)
- Тип служения (select: Молодежное, и т.д.)
- Тема (rich_text, в различных полях)

## Ежедневное чтение

- **`getDailyScripture(date?)`** - получение ежедневного чтения

**База данных**: `NOTION_DAILY_DISTRIBUTION_DATABASE`

**Поля**:
- Дата (date)
- Текст (rich_text)
- Ссылка (rich_text)
- Перевод (rich_text)

## Недельные молитвенные записи

- **`getWeeklyPrayerRecords()`** - получение всех записей
- **`createWeeklyPrayerRecord(prayerInput)`** - создание записи

**База данных**: `NOTION_WEEKLY_PRAYER_DATABASE`

**Поля**:
- Дата молитвы (date, диапазон)
- Молитвенное лицо (select)
- Тема молитвы (rich_text)
- Примечание (title)
- Column (title: current/next)

## Особенности

- Обработка различных форматов полей Notion
- Логирование операций
- Обработка ошибок с возвратом пустых массивов

---

[← Назад к списку сервисов](README.md)







