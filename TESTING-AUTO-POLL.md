# Тестирование автоматической рассылки опросов

Это руководство описывает различные способы тестирования новой функциональности автоматической рассылки опросов для МОСТ и молодежного служения.

## Содержание

1. [Быстрый старт](#быстрый-старт)
2. [Тестирование компонентов](#тестирование-компонентов)
3. [Тестирование Netlify функций](#тестирование-netlify-функций)
4. [Ручное тестирование](#ручное-тестирование)
5. [Проверка в продакшене](#проверка-в-продакшене)

## Быстрый старт

### 1. Сборка проекта

```bash
yarn build
```

### 2. Запуск всех тестов компонентов

```bash
node test-auto-poll.js
```

### 3. Тестирование отдельных компонентов

```bash
# Тест генерации текста опросов
node test-auto-poll.js text

# Тест логики планировщика
node test-auto-poll.js scheduler

# Тест получения событий из Notion
node test-auto-poll.js events

# Тест команды отправки опроса
node test-auto-poll.js poll

# Тест отправки уведомлений
node test-auto-poll.js notification
```

## Тестирование компонентов

### Генератор текста опросов

Тестирует генерацию различных вариантов текста для опросов:

```bash
node test-auto-poll.js text
```

**Что проверяется:**
- Генерация текста для молодежного служения с темой
- Генерация текста для молодежного служения без темы
- Генерация текста для МОСТ
- Вариативность текстов и опций

### Планировщик опросов

Тестирует логику расчета времени отправки:

```bash
node test-auto-poll.js scheduler
```

**Что проверяется:**
- Расчет времени отправки опроса (18:00-18:05, но не позже чем за 24ч)
- Проверка необходимости отправки опроса
- Проверка необходимости отправки уведомления (за 3 часа)
- Проверка наличия темы

### Получение событий из Notion

Тестирует получение событий из календаря:

```bash
node test-auto-poll.js events
```

**Что проверяется:**
- Получение событий "Молодежное" и "МОСТ"
- Корректность данных событий
- Наличие темы в событиях

## Тестирование Netlify функций

### Локальное тестирование

1. Запустите Netlify Dev:

```bash
netlify dev
```

2. В другом терминале запустите тесты:

```bash
./test-auto-poll-scheduler.sh local
```

Или вручную через curl:

```bash
# Тест уведомлений
curl -X POST http://localhost:8888/.netlify/functions/poll-notification-scheduler \
  -H "Content-Type: application/json" \
  -d '{"httpMethod": "POST"}'

# Тест отправки опросов
curl -X POST http://localhost:8888/.netlify/functions/poll-sender-scheduler \
  -H "Content-Type: application/json" \
  -d '{"httpMethod": "POST"}'
```

### Тестирование развернутой версии

```bash
./test-auto-poll-scheduler.sh deployed https://your-site.netlify.app
```

## Ручное тестирование

### 1. Проверка получения событий

Создайте тестовый скрипт:

```javascript
const { getYouthEventsForDateRange } = require('./dist/src/services/notionService');

async function test() {
  const now = new Date();
  const endDate = new Date(now);
  endDate.setDate(endDate.getDate() + 7);
  
  const events = await getYouthEventsForDateRange(now, endDate, ['Молодежное', 'МОСТ']);
  console.log('Events found:', events.length);
  events.forEach(e => {
    console.log(`- ${e.title} (${e.serviceType}) on ${e.date.toISOString()}`);
    console.log(`  Theme: ${e.theme || 'none'}`);
  });
}

test();
```

### 2. Проверка расчета времени отправки

```javascript
const { calculatePollSendTime } = require('./dist/src/utils/pollScheduler');

// Событие завтра в 19:00
const tomorrow = new Date();
tomorrow.setDate(tomorrow.getDate() + 1);
tomorrow.setHours(19, 0, 0, 0);

const sendTime = calculatePollSendTime(tomorrow);
console.log('Event:', tomorrow.toISOString());
console.log('Send time:', sendTime.toISOString());
console.log('Send hour:', sendTime.getHours());
console.log('Send minute:', sendTime.getMinutes());
```

### 3. Проверка генерации текста

```javascript
const { generatePollContent } = require('./dist/src/utils/pollTextGenerator');

const event = {
  id: 'test',
  title: 'Молодежное служение',
  date: new Date('2026-01-10T19:00:00'),
  theme: 'Что такое церковь?',
  type: 'event',
  serviceType: 'Молодежное'
};

const { question, options } = generatePollContent(event);
console.log('Question:', question);
console.log('Options:', options);
```

### 4. Тест отправки уведомления (в debug режиме)

Убедитесь, что `DEBUG=true` в `.env`, затем:

```javascript
const { sendPollNotification } = require('./dist/src/commands/autoPollCommand');

const event = {
  id: 'test',
  title: 'Молодежное служение',
  date: new Date('2026-01-10T19:00:00'),
  theme: 'Тестовая тема',
  type: 'event',
  serviceType: 'Молодежное'
};

const result = await sendPollNotification(event, event.date);
console.log('Result:', result);
```

## Проверка в продакшене

### 1. Проверка логов

После развертывания проверьте логи Netlify:

```bash
netlify logs:function poll-notification-scheduler
netlify logs:function poll-sender-scheduler
```

### 2. Проверка расписания

Убедитесь, что функции настроены в `netlify.toml`:

```toml
[functions."poll-notification-scheduler"]
  schedule = "0 * * * *"

[functions."poll-sender-scheduler"]
  schedule = "0 * * * *"
```

### 3. Мониторинг

- Проверяйте логи каждый час после развертывания
- Убедитесь, что уведомления приходят администратору за 3 часа до события
- Убедитесь, что опросы отправляются в правильное время (18:00-18:05, за 24 часа до события)

## Частые проблемы

### Функции не запускаются

1. Проверьте, что функции правильно настроены в `netlify.toml`
2. Убедитесь, что проект собран: `yarn build`
3. Проверьте логи Netlify на наличие ошибок

### События не находятся

1. Проверьте, что в Notion есть события с типом "Молодежное" или "МОСТ"
2. Убедитесь, что даты событий в будущем
3. Проверьте правильность ID базы данных в `.env`

### Уведомления не приходят

1. Проверьте, что `ALLOWED_USERS` настроен в `.env`
2. Убедитесь, что бот может отправлять сообщения пользователю
3. Проверьте логи на наличие ошибок

### Опросы не отправляются

1. Проверьте, что `TELEGRAM_YOUTH_GROUP_ID` настроен
2. Убедитесь, что время события правильно рассчитано
3. Проверьте логи на наличие ошибок отправки

## Дополнительные ресурсы

- [Документация Netlify Scheduled Functions](https://docs.netlify.com/functions/trigger-on-events/#scheduled-functions)
- [Документация Telegram Bot API](https://core.telegram.org/bots/api)

