# Типы данных

## Telegram типы

**Файл**: `src/types/index.ts`

### TelegramUser
```typescript
interface TelegramUser {
  id: number;
  username?: string;
  first_name: string;
  last_name?: string;
}
```

### TelegramMessage
```typescript
interface TelegramMessage {
  message_id: number;
  from: TelegramUser;
  chat: {
    id: number;
    type: string;
    title?: string;
  };
  text?: string;
  date: number;
}
```

### TelegramUpdate
```typescript
interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  poll?: { ... };
  poll_answer?: { ... };
}
```

## Доменные типы

### PrayerNeed
```typescript
interface PrayerNeed {
  id: string;
  text: string;
  author: string;
  date: Date;
  status: "active" | "answered" | "archived";
  category?: string;
}
```

### CalendarItem
```typescript
interface CalendarItem {
  id: string;
  title: string;
  date: Date;
  description?: string;
  theme?: string;
  type: "service" | "meeting" | "event";
}
```

### DailyScripture
```typescript
interface DailyScripture {
  id: string;
  date: Date;
  text: string;
  reference: string;
  translation: string;
}
```

### PrayerRecord
```typescript
interface PrayerRecord {
  id: string;
  person: string;
  topic: string;
  note: string;
  column?: string;
  dateStart: Date;
  dateEnd: Date;
}
```

### WeeklyPrayerInput
```typescript
interface WeeklyPrayerInput {
  person: string;
  topic: string;
  note?: string;
  weekType: "current" | "next";
  dateStart: Date;
  dateEnd: Date;
}
```

### SundayServiceItem
```typescript
interface SundayServiceItem {
  id: string;
  title: string;
  date: Date;
  type: string;
  preachers: NotionMultiSelectOption[];
  worshipService: string;
  songBeforeStart: boolean;
  numWorshipSongs: number | null;
  soloSong: boolean;
  repentanceSong: boolean;
  scriptureReading: string;
  scriptureReader: string;
}
```

### WeeklyServiceItem
```typescript
interface WeeklyServiceItem {
  id: string;
  title: string;
  date: Date;
  time?: string;
  type: string;
  description?: string;
  location?: string;
  needsMailing: boolean;
}
```

## Типы результатов

### CommandResult
```typescript
interface CommandResult {
  success: boolean;
  message?: string;
  data?: Record<string, unknown>;
  error?: string;
}
```

**Использование**:
- Все команды возвращают `CommandResult`
- Унифицированная обработка результатов
- Легкая обработка ошибок

### LoggerConfig
```typescript
interface LoggerConfig {
  level: "debug" | "info" | "warn" | "error";
  format: "json" | "text";
}
```

## Notion типы

Интерфейсы для работы с полями Notion:
- `NotionPage` - страница Notion
- `NotionRichText` - текстовое поле
- `NotionSelect` - поле выбора
- `NotionDate` - поле даты
- `NotionTitle` - заголовок
- `NotionMultiSelect` - множественный выбор
- `NotionCheckbox` - чекбокс
- `NotionNumber` - число

---

[← Назад к содержанию](README.md)


