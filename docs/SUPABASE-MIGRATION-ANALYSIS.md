# Анализ: миграция на Supabase и логирование

## Текущее состояние проекта

### Хранение данных

| Источник | Что хранится | Проблемы |
|----------|--------------|----------|
| **Notion** (6 БД) | Молитвы, календарь, служения, расписание, отчёты молодёжи, лидеры | Нет — работает как «источник правды» |
| **In-memory `Map`** | Состояния форм: `prayerState`, `scheduleState`, `sundayServiceState`, `youthReportState` | **Критично:** при cold start Netlify Functions состояние теряется, многошаговые формы ломаются |
| **ENV** | `ALLOWED_USERS`, `YOUTH_LEADER_MAPPING` (fallback) | Менять = redeploy |
| **Logger** | `console.log` / `console.error` | Логи только в Netlify, ограниченный retention, нет структурированного поиска |

---

## 1. Что лучше перенести в Supabase

### Высокий приоритет (сделать в первую очередь)

#### 1.1. User form state (состояния многошаговых форм)

**Почему:** Netlify Functions — serverless. Память обнуляется при cold start. Пользователь может заполнять форму 5–10 минут, получить cold start — и прогресс потерян.

**Файлы с in-memory state:**
- `src/utils/prayerState.ts` — `Map<userId, PrayerFormState>`
- `src/utils/scheduleState.ts` — `Map<userId, ScheduleState>`
- `src/utils/sundayServiceState.ts` — `Map<userId, SundayServiceState>`
- `src/utils/youthReportState.ts` — `Map<userId, YouthReportState>`

**Предлагаемая схема в Supabase:**

```sql
-- Одна таблица для всех типов state (или отдельная на каждый тип — по вкусу)
create table user_form_state (
  id uuid primary key default gen_random_uuid(),
  user_id bigint not null,           -- Telegram user id
  state_type text not null,          -- 'prayer' | 'schedule' | 'sunday_service' | 'youth_report'
  payload jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  unique(user_id, state_type)
);

create index idx_user_form_state_user_type on user_form_state(user_id, state_type);
create index idx_user_form_state_updated on user_form_state(updated_at);
```

**Плюсы:** состояние переживает cold start, можно делать TTL/очистку старых записей по `updated_at`.

---

#### 1.2. Логирование в Supabase

**Зачем:** централизованные логи, поиск по `level`, `message`, `user_id`, `command`, по времени; удобный просмотр в Supabase Dashboard.

**Схема:**

```sql
create table app_logs (
  id uuid primary key default gen_random_uuid(),
  ts timestamptz not null default now(),
  level text not null,               -- 'debug' | 'info' | 'warn' | 'error'
  message text not null,
  data jsonb,                        -- доп. контекст (userId, command, error, etc.)
  user_id bigint,                    -- Telegram user id, если есть
  command text,                      -- например: /prayer, /schedule
  source text,                       -- 'webhook' | 'poll-scheduler' | 'poll-scheduler' | ...
  request_id text                    -- опционально: для связки логов одного запроса
);

create index idx_app_logs_ts on app_logs(ts);
create index idx_app_logs_level on app_logs(level);
create index idx_app_logs_user_id on app_logs(user_id) where user_id is not null;
create index idx_app_logs_command on app_logs(command) where command is not null;
```

**Интеграция:** в `src/utils/logger.ts` добавить асинхронную отправку в Supabase (через `@supabase/supabase-js`), не блокируя основной поток. `console.log` оставить для Netlify, в Supabase — дублировать `info`/`warn`/`error` (и при желании `debug`).

---

### Средний приоритет

#### 2.1. Маппинг молодёжных лидеров (Telegram ID → имя)

**Сейчас:** `NOTION_YOUTH_LEADERS_DATABASE` + fallback `YOUTH_LEADER_MAPPING` в ENV.

**В Supabase:** проще править лидеров без Notion и без смены ENV.

```sql
create table youth_leaders (
  id uuid primary key default gen_random_uuid(),
  telegram_id bigint not null unique,
  name text not null,
  is_active boolean not null default true,
  updated_at timestamptz not null default now()
);
```

Дальше: в `notionService.getYouthLeadersMapping` / `getYouthLeadersFromEnv` добавить источник Supabase с кэшированием (как сейчас TTL 5 мин) или заменить оба.

---

#### 2.2. Список разрешённых пользователей (ALLOWED_USERS)

**Сейчас:** `ALLOWED_USERS` в ENV.

**В Supabase:** менять состав без redeploy.

```sql
create table allowed_users (
  telegram_id bigint primary key,
  role text,                         -- 'admin' | 'user' | null
  added_at timestamptz not null default now()
);
```

В `getTelegramConfig()` и `authHelper` — при наличии `SUPABASE_URL`/`SUPABASE_SERVICE_KEY` брать список из Supabase, иначе fallback на `ALLOWED_USERS`.

---

### Низкий приоритет / лучше оставить в Notion

- **Молитвенные нужды** (`NOTION_PRAYER_DATABASE`)
- **Календарь и служения** (`NOTION_GENERAL_CALENDAR_DATABASE`)
- **Ежедневные стихи** (`NOTION_DAILY_DISTRIBUTION_DATABASE`)
- **Еженедельная молитва** (`NOTION_WEEKLY_PRAYER_DATABASE`)
- **Отчёты молодёжи** (`NOTION_YOUTH_REPORT_DATABASE`)

**Причины:** Notion уже используется командой для ручного редактирования, dashboards, связанных процессов. Перенос потребует миграции данных, смены UX и, возможно, обратной синхронизации — большие трудозатраты при неочевидной выгоде. Имеет смысл оставить как есть, а в Supabase держать только state, логи, и при желании — `youth_leaders` и `allowed_users`.

---

## 2. Логирование в Supabase — план внедрения

### 2.1. Зависимости

```bash
yarn add @supabase/supabase-js
```

### 2.2. Конфиг и таблица

- `env.example` и Netlify:

  ```
  SUPABASE_URL=https://xxx.supabase.co
  SUPABASE_SERVICE_KEY=eyJ...   # service_role для serverless
  SUPABASE_LOGS_ENABLED=true    # или отключать в dev
  ```

- Таблица `app_logs` — по схеме выше. RLS: для `service_role` не нужен; если будете пускать и anon — ограничить запись по `service_role`.

### 2.2. Обновление `src/utils/logger.ts`

Идея: сохранить текущий API (`logInfo`, `logWarn`, `logError`, `logDebug`), добавить «транспорт» в Supabase:

1. Читать `SUPABASE_LOGS_ENABLED`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`.
2. Создать lazy-инициализацию Supabase-клиента (один раз на инстанс функции).
3. В `formatMessage` / месте формирования объекта лога — собирать объект:
   - `level`, `message`, `data`, при возможности `user_id`, `command`, `source`.
4. Для `info`/`warn`/`error` (и при `LOG_LEVEL=debug` — `debug`):
   - как сейчас: `console.log` / `console.warn` / `console.error`;
   - если `SUPABASE_LOGS_ENABLED === 'true'`: `supabase.from('app_logs').insert({...}).then().catch(err => console.error('Supabase log insert failed', err))` — **без await**, чтобы не замедлять обработку.
5. Обязательно: не пробрасывать исключения из записи логов в основной код.

### 2.3. Откуда брать `user_id`, `command`, `source`

- **user_id, command:** в `messageHandler` и командах при вызове `logInfo`/`logError` и т.п. передавать в `data`:
  - `data: { userId: update.message.from.id, command: 'prayer' }`.
  В `logger` при наличии `data.userId` и `data.command` копировать в поля `user_id`, `command` и не дублировать в `data`, чтобы не раздувать `data`.
- **source:** в Netlify Functions в `handler` в самом начале (или через небольшой wrapper) устанавливать, например, `process.env.LOG_SOURCE = 'telegram-webhook' | 'poll-scheduler' | ...` и в `logger` читать `process.env.LOG_SOURCE` в поле `source`. Для локального запуска — `LOG_SOURCE=local` или не задано.

### 2.4. Ограничения и политики

- **Объём:** при большом трафике стоит:
  - партиционировать `app_logs` по `ts` (например, по месяцам) или
  - писать в Supabase только `warn` и `error`, а `info`/`debug` — только в stdout.
- **Retention:** настройка в Supabase (pg_cron или внешний скрипт) на удаление записей старше N дней.
- **Секреты:** только `SUPABASE_SERVICE_KEY` в ENV, не в коде и не в репозитории.

---

## 3. Порядок внедрения (предложение)

1. **Supabase-проект и таблицы**
   - `app_logs`
   - `user_form_state`
   - `app_config` (если переносите часть .env в БД)
   - (по желанию) `youth_leaders`, `allowed_users`.

2. **Логирование**
   - Установить `@supabase/supabase-js`.
   - Расширить `logger.ts` транспортом в `app_logs` без изменения существующих вызовов `log*`.
   - Добавить в `data`/`user_id`/`command`/`source` там, где это легко (например, в `messageHandler` и в handlers Netlify).

3. **User form state**
   - Реализовать `supabaseState.ts` (или по одному модулю на тип) с теми же сигнатурами, что `getPrayerState`/`setPrayerState`/…, но с чтением/записью в `user_form_state`.
   - Подменить импорты в `prayerState`, `scheduleState`, `sundayServiceState`, `youthReportState` на реализацию с Supabase (или заменить эти модули целиком).
   - Убедиться, что при отключённом Supabase (нет ENV) есть fallback на in-memory, чтобы локальная разработка работала.

4. **По желанию: `app_config` (часть .env в БД)**
   - Создать таблицу `app_config`, заполнить ключи (LOG_LEVEL, DEBUG, TELEGRAM_YOUTH_GROUP_ID и т.д.).
   - В `environment.ts` при инициализации (или по первому запросу) читать из Supabase, кэшировать в памяти. Если ключа нет в БД или Supabase недоступен — брать из `process.env`.

5. **По желанию: `youth_leaders` и `allowed_users`**
   - Перенести логику из `getYouthLeadersMapping`/`getYouthLeadersFromEnv` и из `getTelegramConfig`/`authHelper` на Supabase с fallback на Notion/ENV.

---

## 4. Параметры .env: что переносить в БД, а что оставить

> **Учёт аудита:** часть переменных не используется в коде или дублируется. Подробнее: [docs/ENV-AUDIT.md](ENV-AUDIT.md).

### 4.1. Оставить в .env (обязательно)

Эти переменные **нельзя** целиком переносить в БД по двум причинам: **bootstrap** (нужны, чтобы вообще достучаться до Supabase) и **безопасность** (секреты лучше не класть в БД).

| Переменная | Причина оставить в .env |
|------------|-------------------------|
| `SUPABASE_URL` | Нужна для подключения к Supabase. Без неё конфиг из БД не прочитать. |
| `SUPABASE_SERVICE_KEY` | Секрет, открывает полный доступ к проекту. В БД = лишняя цель для атак. |
| `TELEGRAM_BOT_TOKEN` | Секрет. Компрометация БД = компрометация бота. |
| `NOTION_TOKEN` | То же: секрет, высокая чувствительность. |

Итого: **в .env всегда остаются** URL и ключ Supabase + токены Telegram и Notion.

---

### 4.2. Имеет смысл перенести в БД (таблица `app_config`)

Это параметры, которые хочется менять **без redeploy**, или которые по смыслу — «данные», а не «инфраструктура».

| Переменная | Куда | Зачем в БД |
|------------|------|------------|
| `ALLOWED_USERS` | уже рассмотрено → `allowed_users` | Менять список пользователей без redeploy. |
| `YOUTH_LEADER_MAPPING` | уже рассмотрено → `youth_leaders` | Редактировать лидеров без Notion и без ENV. |
| `LOG_LEVEL` | `app_config` | Включить `debug` на проде на время без деплоя. |
| `DEBUG` | `app_config` | Тот же сценарий. |
| `LOG_FORMAT` | `app_config` | Редко, но можно менять. |
| `SUPABASE_LOGS_ENABLED` | `app_config` | Вкл/выкл логи в Supabase без деплоя. |
| `TELEGRAM_YOUTH_GROUP_ID` | `app_config` | Используется в проде для опросов; без redeploy удобнее. |
| `TELEGRAM_CHAT_ID_DEBUG`, `TELEGRAM_TOPIC_ID_DEBUG` | `app_config` | То же для отладочного бота. |

*`TELEGRAM_MAIN_CHANNEL_ID`, `TELEGRAM_MAIN_GROUP_ID` в коде не используются — в `app_config` не переносить.*

Схема для ключ–значение конфига:

```sql
create table app_config (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

-- Примеры
insert into app_config (key, value) values
  ('LOG_LEVEL', 'info'),
  ('DEBUG', 'false'),
  ('SUPABASE_LOGS_ENABLED', 'true'),
  ('TELEGRAM_YOUTH_GROUP_ID', '');
```

В коде: при старте (или по мере надобности) один раз делать `select * from app_config` и кэшировать в памяти на время жизни инстанса. При холодном старте — один лишний запрос к Supabase, для 10–20 ключей это доли секунды.

Fallback: если в `app_config` нет ключа — брать значение из `process.env` (как сейчас). Тогда миграция пофайловая: сначала заводим `app_config`, подмешиваем в `getAppConfig`/`getTelegramConfig`, ENV оставляем как запасной вариант.

---

### 4.3. Рационально оставить в .env (можно, но не обязательно в БД)

| Переменная | Почему .env обычно достаточно |
|------------|------------------------------|
| `NOTION_PRAYER_DATABASE` | ID почти не меняются. Перенос в БД — лишний запрос на каждый cold start до первого обращения к Notion. |
| `NOTION_GENERAL_CALENDAR_DATABASE` | |
| `NOTION_DAILY_DISTRIBUTION_DATABASE` | |
| `NOTION_WEEKLY_PRAYER_DATABASE` | |
| `NOTION_YOUTH_REPORT_DATABASE` | |
| `NOTION_YOUTH_LEADERS_DATABASE` | При переносе лидеров в Supabase (`youth_leaders`) эта переменная может вообще не использоваться. |
| `NODE_ENV` | Задаётся платформой/скриптом (production/development), не «бизнес-настройка». |
| `TELEGRAM_WEBHOOK_URL` | **В коде не используется:** скрипты собирают URL из `.netlify-url`, `netlify status` или ngrok. В .env можно не держать; оставить только если появятся скрипты с готовым URL. |
| `TELEGRAM_BOT_TOKEN_DEBUG` | Секрет отладочного бота — по тем же соображениям, что и основные токены: лучше в .env. |

Имеет смысл переносить Notion- ID в `app_config` только если вы реально будете их часто менять или хранить разные наборы под dev/staging/prod в одной БД (через префиксы ключей или колонку `environment`).

---

### 4.4. Итог: что где

| Где | Что |
|-----|-----|
| **Только .env** | `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `TELEGRAM_BOT_TOKEN`, `NOTION_TOKEN`, по желанию `TELEGRAM_BOT_TOKEN_DEBUG`, `NODE_ENV`. `TELEGRAM_WEBHOOK_URL` в коде не используется — в .env не обязательна. |
| **Только БД** | `allowed_users` (вместо `ALLOWED_USERS`), `youth_leaders` (вместо `YOUTH_LEADER_MAPPING` и Notion-лидеров). |
| **БД с fallback на .env** | `app_config`: `LOG_LEVEL`, `DEBUG`, `LOG_FORMAT`, `SUPABASE_LOGS_ENABLED`, `TELEGRAM_YOUTH_GROUP_ID`, при необходимости `TELEGRAM_CHAT_ID_DEBUG`, `TELEGRAM_TOPIC_ID_DEBUG` и редко — Notion IDs. |

Минимальный .env после переноса части в БД:

```bash
# Обязательные (bootstrap + секреты)
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...
TELEGRAM_BOT_TOKEN=...
NOTION_TOKEN=...

# Notion Database IDs (оставляем, пока не решите переносить в app_config)
NOTION_PRAYER_DATABASE=...
NOTION_GENERAL_CALENDAR_DATABASE=...
NOTION_DAILY_DISTRIBUTION_DATABASE=...
NOTION_WEEKLY_PRAYER_DATABASE=...
NOTION_YOUTH_REPORT_DATABASE=...   # если /youth_report
# NOTION_YOUTH_LEADERS_DATABASE — по необходимости (или youth_leaders в Supabase)

# Платформа
NODE_ENV=production

# Опционально: fallback, если в app_config пусто или Supabase недоступен
# ALLOWED_USERS=...
# LOG_LEVEL=info
# TELEGRAM_YOUTH_GROUP_ID=...
```

---

## 5. Переменные окружения (сводка после переноса части в БД)

```bash
# Обязательные (не переносить в БД)
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...
TELEGRAM_BOT_TOKEN=...
NOTION_TOKEN=...

# Notion (оставить в .env, если не уносите в app_config)
NOTION_PRAYER_DATABASE=...
NOTION_GENERAL_CALENDAR_DATABASE=...
NOTION_DAILY_DISTRIBUTION_DATABASE=...
NOTION_WEEKLY_PRAYER_DATABASE=...
NOTION_YOUTH_REPORT_DATABASE=...   # если используется /youth_report

# Платформа
NODE_ENV=production

# Опционально: fallback на время миграции или при недоступности Supabase
# ALLOWED_USERS=...
# LOG_LEVEL=info
# TELEGRAM_YOUTH_GROUP_ID=...
# и т.д.
```

Всё, что попало в `app_config`, `allowed_users`, `youth_leaders`, читается из Supabase с подстановкой из .env только при отсутствии значения в БД.

---

## 6. Краткое резюме

| Что | Рекомендация | Зачем |
|-----|--------------|-------|
| **User form state** | Перенести в Supabase | Сохранение прогресса форм в serverless |
| **Логи** | Писать в Supabase (`app_logs`) | Централизованный поиск и хранение |
| **Youth leaders** | По желанию в Supabase | Упрощение правок без Notion/ENV |
| **Allowed users** | По желанию в Supabase | Изменение прав без redeploy |
| **Конфиг (LOG_LEVEL, DEBUG, ID каналов/чатов и т.п.)** | Таблица `app_config` в Supabase, fallback на .env | Менять без redeploy; .env — резерв |
| **Токены и ключи (Supabase, Telegram, Notion)** | Только .env | Bootstrap и безопасность: не в БД |
| **Notion (молитвы, календарь, служения, отчёты и т.д.)** | Оставить в Notion | Рабочий процесс и экономия усилий на миграции |

Если нужно, можно следующим шагом расписать конкретные патчи для `logger.ts`, для `app_config` (чтение в `environment.ts`) и для одного из `*State.ts` (например, `prayerState`) в виде пошаговых правок кода.

