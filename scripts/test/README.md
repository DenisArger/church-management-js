# Тестовые скрипты

Скрипты для ручного тестирования webhook, планировщиков, опросов и calendar. Запускать из **корня проекта**:

- `yarn test` — сборка + **test-calendar** (экспорты, formatServiceInfo, getSundayMeeting, getWeeklySchedule)
- `yarn test:poll` — сборка + test-auto-poll (text, scheduler, без Notion)
- `yarn test:integration` — yarn test + test-auto-poll (полный) + test-youth-poll (нужны Notion, Telegram)

- `node scripts/test/test-calendar.js [exports|format]` — тесты calendar после рефакторинга (сборка внутри при полном запуске)
- `node scripts/test/test-webhook.js` — тест webhook (нужен **debug-server на :3000**, `yarn debug:server`)
- `bash scripts/test/test-debug.sh http://localhost:3000` — /health и /webhook (нужен **debug-server на :3000**)
- `node scripts/test/test-auto-poll.js [text|scheduler|events|poll|notification]` — тесты auto poll (см. TESTING-AUTO-POLL.md)
- `node scripts/test/test-youth-poll.js [manual|scheduled|notion|env|help]` — тесты youth poll (см. YOUTH-POLL-TESTING.md)
- `bash scripts/test/test-bot-webhook.sh info|set|delete|test ...` — вебхук тестового бота
- `bash scripts/test/test-auto-poll-scheduler.sh local|deployed <url> — poll scheduler
- `bash scripts/test/cron-simulation.sh trigger|start|stop|status|logs ...` — симуляция cron

Вспомогательный модуль `require-dist.js` — загрузка из `dist/src` при запуске из `scripts/test/`.

Подробнее: [TESTING-GUIDE.md](../../TESTING-GUIDE.md), [TESTING-AUTO-POLL.md](../../TESTING-AUTO-POLL.md), [YOUTH-POLL-TESTING.md](../../YOUTH-POLL-TESTING.md).

