# Аудит переменных .env

Проверка: какие параметры из .env и env.example **не используются** в коде/скриптах, **дублируются** по смыслу или **используются, но не описаны** в env.example.

---

## 1. Не используются в коде и скриптах

Эти переменные читаются в `environment.ts` или есть в `env.example`, но **ни один .ts, .js или .sh их не использует** по назначению.

| Переменная | Где объявлена/читается | Почему не используется |
|------------|------------------------|-------------------------|
| **TELEGRAM_WEBHOOK_URL** | `env.example` | Ни `webhook-manager.sh`, ни `deploy.sh`, ни `ngrok-test.sh` не читают её. URL webhook собирается из: аргумента скрипта, `.netlify-url`, вывода `netlify deploy`/`netlify status` или `.ngrok-url`. В коде приложения (Netlify Functions) webhook URL вообще не нужен — Telegram сам шлёт запросы на выставленный URL. |
| **TELEGRAM_MAIN_CHANNEL_ID** | `env.example`, `environment.ts` → `mainChannelId` | `getTelegramConfig()` возвращает `mainChannelId`, но **ни один код не обращается** к `config.mainChannelId`. |
| **TELEGRAM_MAIN_GROUP_ID** | `env.example`, `environment.ts` → `mainGroupId` | Аналогично: `config.mainGroupId` **нигде не используется**. |

Для молодёжных опросов и `getTelegramConfigForMode` в проде используется только **`TELEGRAM_YOUTH_GROUP_ID`** (→ `config.youthGroupId` в `telegramService.ts`). `mainChannelId` и `mainGroupId` выглядят как зарезервированные на будущее.

---

## 2. Дублирование по смыслу

Один и тот же смысл покрывается разными способами, при этом в коде реально используется только один.

| Концепция | Вариант 1 | Вариант 2 | Что реально используется |
|-----------|-----------|-----------|---------------------------|
| **URL webhook** | `TELEGRAM_WEBHOOK_URL` (полный URL в .env) | Сборка из Netlify/ngrok URL + `/.netlify/functions/telegram-webhook` в `deploy.sh`, `webhook-manager.sh`, `ngrok-test.sh` | Только сборка в скриптах. `TELEGRAM_WEBHOOK_URL` не читается → по сути дубликат, который не используется. |

Отдельно в документации упоминается **`NETLIFY_SITE_URL`** (docs, MEMORY-BANK, README) как «URL для webhook», но эта переменная **ни в env.example, ни в коде/скриптах не используется**. Скрипты берут URL из `netlify status`, `.netlify-url` или вывода деплоя.

---

## 3. Используются в коде, но отсутствуют в env.example

| Переменная | Где используется | Назначение |
|------------|------------------|------------|
| **NOTION_YOUTH_REPORT_DATABASE** | `environment.ts` → `youthReportDatabase`, `notionService.ts`, `youthReportCommand.ts` | ID базы Notion для отчётов молодёжи. Обязательна для команды отчётов. |
| **YOUTH_LEADER_MAPPING** | `notionService.ts` → `getYouthLeadersFromEnv()` | Fallback-маппинг «Telegram ID → имя лидера» в формате `"id1:name1,id2:name2"`, если нет или не сработал `NOTION_YOUTH_LEADERS_DATABASE`. |

---

## 4. Итоговые рекомендации

### 4.1. Удалить или пометить как необязательные (не используются)

- **TELEGRAM_WEBHOOK_URL**  
  - Либо **удалить из env.example**: скрипты и так собирают webhook URL.  
  - Либо оставить только в документации как «ручной fallback», если когда‑нибудь решите передавать готовый URL в какой‑то скрипт (сейчас такого кода нет).

- **TELEGRAM_MAIN_CHANNEL_ID**, **TELEGRAM_MAIN_GROUP_ID**  
  - Либо **удалить** из `environment.ts` и `env.example`, если в обозримом будущем не планируете их использовать.  
  - Либо **оставить в env.example** с пометкой, что они опциональны и «на будущее», и не прокидывать в `validateEnvironment`.

### 4.2. Устранить дублирование

- **TELEGRAM_WEBHOOK_URL**: считать дубликатом логики «webhook URL» в скриптах. Достаточно одного способа (скрипты). Если не планируете читать `TELEGRAM_WEBHOOK_URL` в коде — убрать из `env.example`.

- **NETLIFY_SITE_URL**: в коде не используется. Либо начать использовать в скриптах (тогда добавить в env.example и логику в `webhook-manager`/`deploy`), либо убрать из README/docs как устаревшую/неиспользуемую.

### 4.3. Дополнить env.example

Добавить в `env.example` с комментариями:

```bash
# Notion: отчёты молодёжи (обязательно для /youth_report)
NOTION_YOUTH_REPORT_DATABASE=your_youth_report_database_id_here

# Fallback для маппинга лидеров, если NOTION_YOUTH_LEADERS_DATABASE не задана или недоступна.
# Формат: "telegramId1:Name1,telegramId2:Name2"
# YOUTH_LEADER_MAPPING=123:Иван,456:Мария
```

---

## 5. Сводная таблица

| Переменная | В env.example | В коде/скриптах | Рекомендация |
|------------|---------------|-----------------|--------------|
| TELEGRAM_WEBHOOK_URL | да | нет | Удалить из env.example или оставить только в доке как необязательный ручной override. |
| TELEGRAM_MAIN_CHANNEL_ID | да | нет (только чтение в config) | Удалить или пометить опциональной «на будущее». |
| TELEGRAM_MAIN_GROUP_ID | да | нет (только чтение в config) | Удалить или пометить опциональной «на будущее». |
| NETLIFY_SITE_URL | нет | нет | Убрать из README/docs или начать использовать и добавить в env.example. |
| NOTION_YOUTH_REPORT_DATABASE | нет | да | Добавить в env.example. |
| YOUTH_LEADER_MAPPING | нет | да | Добавить в env.example (опциональный fallback). |

Остальные переменные из `env.example` и `environment.ts` (TELEGRAM_BOT_TOKEN, NOTION_*, ALLOWED_USERS, DEBUG, LOG_LEVEL, LOG_FORMAT, NODE_ENV, TELEGRAM_YOUTH_GROUP_ID, debug-переменные) **используются** и дубликатов по смыслу не образуют.


