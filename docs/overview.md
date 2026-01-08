# Обзор проекта

## Описание

**Church Management JS** - это Telegram бот для управления церковными процессами, полностью переписанный с Django на функциональный JavaScript/TypeScript с использованием Netlify Functions. Бот интегрирован с Notion API для хранения и управления данными о молитвах, календаре, расписании служений и других церковных активностях.

## Основные возможности

- Управление молитвенными нуждами и записями
- Автоматическое создание опросов для молодежных встреч
- Получение информации о воскресных служениях
- Ежедневное чтение Библии
- Недельное расписание служений
- Интеграция с Notion для хранения данных

## Технологии

- **Язык**: TypeScript (ES2020)
- **Платформа**: Node.js
- **Хостинг**: Netlify Functions (serverless)
- **API**: 
  - Telegram Bot API (через `node-telegram-bot-api`)
  - Notion API (через `@notionhq/client`)
- **Сборка**: TypeScript Compiler (tsc)
- **Менеджер пакетов**: Yarn

## Зависимости

### Основные

- `node-telegram-bot-api` - работа с Telegram Bot API
- `@notionhq/client` - клиент для Notion API
- `axios` - HTTP клиент
- `express` - веб-сервер (для локальной разработки)
- `@netlify/functions` - Netlify Functions runtime

### Разработка

- `typescript` - компилятор TypeScript
- `ts-node` - выполнение TypeScript напрямую
- `nodemon` - автоматическая перезагрузка при разработке
- `netlify-cli` - CLI для работы с Netlify

## История проекта

Проект был полностью переписан с Django на функциональный JavaScript/TypeScript для улучшения производительности, упрощения деплоя и использования serverless архитектуры.

---

[← Назад к содержанию](README.md) | [Далее: Архитектура →](architecture.md)



