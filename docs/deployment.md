# Процесс деплоя

## Настройка окружения

### 1. Установка зависимостей

```bash
yarn install
```

### 2. Настройка переменных окружения

Создайте файл `.env` из `env.example`:

```bash
cp env.example .env
```

Заполните все обязательные переменные.

### 3. Локальная разработка

```bash
yarn dev
```

Или с Netlify dev:

```bash
yarn netlify:dev
```

## Деплой в Netlify

### Автоматический деплой

```bash
yarn deploy:full
```

Или вручную:

```bash
./scripts/deploy.sh
```

**Что делает скрипт**:
1. Сборка проекта (`yarn build`)
2. Деплой в Netlify (`netlify deploy --prod`)
3. Настройка webhook (если нужно)

### Ручной деплой

```bash
# Сборка
yarn build

# Деплой
netlify deploy --prod
```

## Настройка webhook

### Автоматическая настройка

```bash
yarn webhook:set
```

Или из файла `.netlify-url`:

```bash
yarn webhook:set-file
```

### Ручная настройка

```bash
./scripts/webhook-manager.sh set https://your-site.netlify.app/.netlify/functions/telegram-webhook
```

### Проверка webhook

```bash
yarn webhook:info
```

Или:

```bash
./scripts/webhook-manager.sh info
```

### Удаление webhook

```bash
yarn webhook:delete
```

## Скрипты деплоя

### `scripts/setup.sh`
- Проверка зависимостей
- Создание необходимых файлов
- Настройка окружения

### `scripts/deploy.sh`
- Полный цикл деплоя
- Настройка webhook
- Проверка статуса

### `scripts/webhook-manager.sh`
- Управление webhook
- Команды: `set`, `set-file`, `set-netlify`, `info`, `delete`, `test`

## Конфигурация Netlify

**Файл**: `netlify.toml`

```toml
[build]
  command = "yarn build"
  functions = "netlify/functions"
  publish = "dist"

[functions]
  node_bundler = "esbuild"

[functions.scheduler]
  schedule = "0 18 * * *"
  function = "youth-poll-scheduler"
```

---

[← Назад к содержанию](README.md)


