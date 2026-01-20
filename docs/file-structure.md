# Структура файлов и директорий

## Корневая структура

```
church-management-js/
├── src/                    # Исходный код приложения
├── netlify/               # Netlify Functions
│   └── functions/         # Serverless функции
├── scripts/               # Скрипты для деплоя и управления
├── docs/                  # Документация (Memory Bank)
├── dist/                  # Скомпилированный код (генерируется)
├── node_modules/          # Зависимости (генерируется)
├── .env                   # Переменные окружения (не в git)
├── package.json           # Конфигурация проекта и зависимости
├── tsconfig.json          # Конфигурация TypeScript
├── netlify.toml           # Конфигурация Netlify
└── README.md              # Основная документация
```

## Директория `src/`

### `src/commands/` - Команды бота

Каждая команда - отдельный файл с функцией `execute*Command`:

- **`addPrayerCommand.ts`** - добавление молитвенной записи на неделю
  - Парсинг ввода пользователя
  - Валидация данных
  - Сохранение в Notion
  
- **`createPollCommand.ts`** - создание простого опроса
  - Создание опроса для молодежной встречи
  
- **`debugCalendarCommand.ts`** - отладочная команда для календаря
  - Проверка данных в календаре
  
- **`helpCommand.ts`** - справка по командам
  - Форматированный список всех команд
  
- **`prayerRequestCommand.ts`** - рассылка молитвенных нужд
  - Получение записей из Notion
  - Группировка по людям
  - Сортировка (по дате/имени)
  - Форматирование и отправка
  
- **`prayerWeekCommand.ts`** - информация о молитвах на следующую неделю
  - Фильтрация записей по датам
  - Группировка по людям
  
- **`requestStateSundayCommand.ts`** - информация о воскресном служении
  - Получение данных из календаря
  - Форматирование информации о службах
  
- **`testNotionCommand.ts`** - тестирование подключения к Notion
  - Проверка доступности баз данных
  
- **`weeklyScheduleCommand.ts`** - расписание служений на неделю
  - Получение событий из календаря
  - Фильтрация по флагу "нужна рассылка"
  
- **`youthPollCommand.ts`** - создание опроса для молодежного служения
  - Проверка события на завтра
  - Извлечение темы и времени
  - Создание опроса в группе

- **`autoPollCommand.ts`** - автоматические опросы по расписанию (poll-sender-scheduler)
  - `getYouthEventsForDateRange`, `shouldSendPoll` (24 ч до начала)
  - Только «МОСТ» («Молодежное» — в youth-poll-scheduler)

- **`fillSundayServiceCommand.ts`** - форма заполнения воскресного служения (многошаговая)

- **`editScheduleCommand.ts`** - форма редактирования недельного расписания (многошаговая)

- **`youthReportCommand.ts`** - форма отчёта молодёжи (многошаговая)

- **`showMenuCommand.ts`** - показ главного меню с inline-кнопками

Подробнее: [Команды бота](commands/README.md)

### `src/services/` - Сервисы для работы с внешними API

- **`telegramService.ts`** - работа с Telegram Bot API
  - Singleton для экземпляра бота
  - Функции отправки сообщений, опросов, фото
  - Поддержка debug/production режимов
  - Работа с топиками в супергруппах
  
- **`notionService.ts`** - интеграция с Notion API
  - Singleton для Notion клиента
  - CRUD операции с базами данных
  - Получение молодежных событий
  
- **`calendar/`** — календарь и расписание (разбит на подмодули):
  - **`sundayService.ts`** — воскресные службы (I/II поток): getSundayMeeting, getSundayServiceByDate, create/updateSundayService, formatServiceInfo, getWorshipServices, getScriptureReaders; константы ITEM_TYPE_SUNDAY_1/2; маппинг Notion.
  - **`weeklySchedule.ts`** — недельное расписание: getWeeklySchedule, getScheduleServiceById, getScheduleServicesForWeek, create/updateScheduleService; маппинг Notion.
  - **`debug.ts`** — debugCalendarDatabase.
  - **`index.ts`** — реэкспорт. Публичный API по-прежнему через `calendarService.ts`.

- **`calendarService.ts`** — фасад: реэкспорт из `calendar/`.

Подробнее: [Сервисы](services/README.md)

### `src/handlers/` - Обработчики сообщений

- **`messageHandler.ts`** - главный обработчик сообщений
  - Маршрутизация команд
  - Проверка авторизации
  - Обработка молитвенных нужд (в приватных чатах)
  - Игнорирование не-команд в группах

- **`scriptureScheduleHandler.ts`** - обработка графика чтений Писания
  - Парсинг пересланного/вставленного графика
  - Одна дата (при выбранной в форме) или все даты
  - Создание/обновление воскресных служб в Notion

### `src/utils/` - Вспомогательные функции

- **`logger.ts`** - система логирования
- **`authHelper.ts`** - проверка авторизации
- **`textAnalyzer.ts`** - анализ текста
- **`dateHelper.ts`** - работа с датами
- **`messageFormatter.ts`** - форматирование сообщений
- **`prayerInputParser.ts`** - парсинг ввода молитв
- **`sundayServiceFormatter.ts`** - форматирование воскресных служб
- **`weeklyScheduleFormatter.ts`** - форматирование недельного расписания
- **`blessingGenerator.ts`** - генератор благословений
- **`menuBuilder.ts`** - построение главного меню с inline-кнопками
- **`stateStore.ts`** - хранение состояния форм (Supabase или in-memory Map)
- **`prayerState.ts`** / **`prayerFormBuilder.ts`** - состояние и форма для `/add_prayer`
- **`scheduleState.ts`** / **`scheduleFormBuilder.ts`** - состояние и форма для `/edit_schedule`
- **`sundayServiceState.ts`** / **`sundayServiceFormBuilder.ts`** - состояние и форма для `/fill_sunday_service`
- **`youthReportState.ts`** / **`youthReportFormBuilder.ts`** - состояние и форма для `/youth_report`
- **`pollScheduler.ts`** - `shouldSendPoll`, `shouldSendNotification` для авто-опросов
- **`pollTextGenerator.ts`** - генерация текста опросов (autoPoll)
- **`scriptureScheduleParser.ts`** - парсинг графика чтений Писания

Подробнее: [Утилиты](utils/README.md)

### `src/config/` - Конфигурация

- **`environment.ts`** - управление переменными окружения
  - Получение конфигурации Telegram
  - Получение конфигурации Notion
  - Получение конфигурации приложения
  - Валидация обязательных переменных

- **`appConfigStore.ts`** - конфиг из Supabase (`app_config`, `allowed_users`) или fallback на `process.env`
  - `ensureAppConfigLoaded()`, `getAppConfigValue()`, `getAllowedUsers()`

### `src/types/` - Типы данных

- **`index.ts`** - все TypeScript интерфейсы и типы
  - Telegram типы (Update, Message, User)
  - Notion типы (Page, RichText, Select, Date, и т.д.)
  - Доменные типы (PrayerNeed, CalendarItem, DailyScripture, и т.д.)
  - Типы результатов команд (CommandResult)
  - Типы конфигурации (LoggerConfig)

Подробнее: [Типы данных](types.md)

### `src/index.ts` - Точка входа

- Инициализация приложения
- Валидация окружения
- Настройка логирования

## Директория `netlify/functions/`

- **`telegram-webhook.ts`** - обработчик webhook от Telegram
  - Прием обновлений от Telegram (в т.ч. `callback_query`)
  - CORS обработка
  - Вызов `handleUpdate`
  - Возврат ответа

- **`youth-poll-scheduler.ts`** - scheduled функция (18:00 UTC ежедневно)
  - Только «Молодежное»: `getYouthEventForTomorrow` → `executeYouthPollScheduled`

- **`poll-sender-scheduler.ts`** - scheduled функция (каждый час)
  - События «МОСТ» (без «Молодежное»): `getYouthEventsForDateRange`, `shouldSendPoll` (24 ч до начала) → `executeAutoPollForEvent`

- **`poll-notification-scheduler.ts`** - напоминания о закрытии опросов

Подробнее: [Netlify Functions](netlify-functions.md)

## Директория `scripts/`

- **`setup.sh`** - первоначальная настройка проекта
- **`deploy.sh`** - деплой в Netlify
- **`webhook-manager.sh`** - управление webhook
- **`ngrok-test.sh`** - тестирование с ngrok
- **`seed-supabase-from-env.ts`** - наполнение Supabase из `.env`
- **`supabase-schema.sql`** - схема БД (в т.ч. `user_form_state`)
- **`README.md`** - документация по скриптам

### `scripts/test/` - тестовые скрипты

- **`test-auto-poll.js`**, **`test-auto-poll-scheduler.sh`** - тесты авто-опросов
- **`test-youth-poll.js`**, **`test-youth-poll-scheduler.sh`** - тесты youth-poll
- **`test-bot-webhook.sh`**, **`test-webhook.js`** - тесты webhook
- **`test-debug.sh`** - тесты debug-сервера
- **`test-most-youth-poll.js`** - тест «большинство придут»
- **`cron-simulation.sh`** - симуляция cron
- **`README.md`** - описание тестов (см. также [TESTING-GUIDE.md](../TESTING-GUIDE.md) в корне проекта)

## Конфигурационные файлы

- **`package.json`** - зависимости и скрипты проекта
- **`tsconfig.json`** - настройки TypeScript компилятора
- **`netlify.toml`** - конфигурация Netlify (build, functions, schedule)
- **`env.example`** - пример переменных окружения

---

[← Назад к содержанию](README.md) | [Далее: Команды бота →](commands/README.md)











