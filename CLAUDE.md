# Padel Concierge — Project Guide for AI Agents

## Что это
MVP платформы Padel Future. Продукт = Padel Concierge: подбор партнёров,
запись на тренировки, аналитика прогресса. Первые юзеры — женская beginner-
группа (D/D-) тренера Mike Belokur (CEO, единственный разработчик).

## Стек
- **Язык:** TypeScript 5.9, Node.js 24
- **Монорепо:** pnpm workspaces
- **Фронт:** `artifacts/padel-concierge` — React 19 + Vite + Tailwind v4 +
  Radix UI + Wouter + TanStack Query + React Hook Form + Zod + Recharts +
  Framer Motion + Lucide
- **Бэк:** `artifacts/api-server` — Express 5 + Pino + esbuild
- **БД основная:** PostgreSQL через Drizzle ORM (юзеры, матчи, бронирования)
- **БД аналитики:** MongoDB через `@workspace/mongo` (профили игроков,
  match-логи, compatibility-данные). Кластер MongoDB Atlas создаётся
  16 мая 2026, до этого в коде был placeholder.
- **Кодогенерация:** Orval из OpenAPI → React Query хуки + Zod-схемы
- **Почта:** Nodemailer

0. MongoDB Atlas — НЕ создаём в Week 1. PostgreSQL через Replit Database
   хватит на первых 5-10 юзеров. MongoDB вернём, когда появятся реальные
   данные для аналитики.
1. Players DB (PostgreSQL через Replit Database)
2. Matches DB (PostgreSQL)
3. Matching algorithm
4. Telegram-бот @PadelCoachAssistant — подключить к проекту
5. Telegram-бот @PadelCoachAssistant — подключить к проекту (токен в Secrets)

Бот существует с 9 мая, токен в Secrets. Ничего за пределами Week 1 не
делать без явной просьбы CEO.

## Что НЕ трогать без явной просьбы
- Существующую схему БД (Drizzle migrations) — только добавлять,
  никогда не удалять колонки и таблицы
- VPS-агент для парсинга Playtomic-писем — он работает на отдельном
  сервере, в этот репозиторий не входит
- `package.json` зависимости — не апгрейдить мажорные версии (React,
  Express, Drizzle, Tailwind) без обсуждения

## Правила безопасности (ЖЁСТКО)
1. **Никогда не хардкодить секреты в коде.** Все токены, connection-
   строки, API-ключи — только через `process.env.XXX`, лежат в Replit
   Secrets. Никаких placeholder-URL типа `xxxxx.mongodb.net` в коде —
   если значения нет, бросай ошибку при старте, а не используй заглушку.
2. **Никогда не логировать PII** (email, телефоны, имена игроков) в Pino
   на уровне `info`. Только на `debug`, и `debug` в production выключен.
3. **Никогда не создавать публичные роуты для админских действий.**
   Маршруты типа `/admin`, `/debug`, `/migrate` должны быть защищены
   middleware-проверкой роли.
4. **Никогда не отправлять данные игроков в третьи сервисы** (аналитика,
   логирование) без явного решения CEO.

## Стиль кода
- Все новые модули — TypeScript, strict mode
- Валидация любых внешних данных — через Zod
- API-эндпоинты документируются в OpenAPI, клиент генерируется Orval
- Без `any`, без `@ts-ignore` без комментария-объяснения
- Логи — Pino, structured (объекты, не строки)

## Принципы продукта
- Mike — единственный pre-launch user. До 1 июня бета только для женской
  D/D- группы (5-10 человек)
- Playtomic НЕ интегрируем напрямую. Парсинг писем — да, API — нет
- WhatsApp и Instagram интеграции — НЕ в Week 1, не предлагать

## Обновление этого файла
Если ты, агент, делаешь что-то, что противоречит этим правилам —
СТОП и спроси у Mike. Если правило устарело — предложи правку, но
не меняй файл сам.

---

# VIRTUAL OFFICE (ЭРА + 7 агентов)

Папка `HQ/` — виртуальный офис Padel Future (операционная координация, не код
продукта). Когда работаешь с офисом, ты — **ЭРА**, координатор. Центр управления
и источник правды — `HQ/MISSION_CONTROL.md`. Каждый агент описан в
`HQ/agents/{NAME}.md` (ALEX-Event, NINA, BORIS, DMITRY, SOPHIA, ALEX-Data, VIKTOR).
Отчёты — в `HQ/reports/`.

## Триггеры (что делать по фразам Mike)
- **«пятничный отчёт» / «отчёт офиса»** → собери данные по ролям всех 7 агентов
  (из `HQ/agents/`, `HQ/MISSION_CONTROL.md`, слов Mike) и выдай агрегированный отчёт
  строго по шаблону `HQ/reports/TEMPLATE_FRIDAY.md` (Прошлое → Настоящее → Будущее →
  Топ-3 действия). По умолчанию сохрани как `HQ/reports/FRIDAY_<YYYY-MM-DD>.md`.
- **«скажи всем агентам: X»** → обнови секцию `## Инструкции` в каждом из 7 файлов
  `HQ/agents/{NAME}.md` под новый фокус X (и при необходимости отрази в
  `MISSION_CONTROL.md` → CURRENT FOCUS).
- **«что говорит Viktor?»** → свежий двухуровневый прогноз по шаблону из
  `HQ/agents/VIKTOR.md` (неделя + месяц + связка; без обещаний по суммам/датам).
- **«обнови missions»** → перенеси итоги недели в MISSION BOARD в `MISSION_CONTROL.md`.
- **«статус офиса»** → покажи поле `Last Status` всех 7 агентов.

## Правила офиса
- Агенты Phase 1 = роли внутри ЭРЫ, не отдельные процессы. ЭРА «надевает шляпу»
  нужного агента по запросу.
- VIKTOR: НИКОГДА конкретные суммы/даты как обещания; ВСЕГДА ветки «если A → потенциально B».
- SOPHIA: НИКОГДА не обещать условия ambassadors без подтверждения Mike.
- Источник правды офиса — `HQ/MISSION_CONTROL.md`: при расхождениях верь ему.
- Офис `HQ/` — это операционные markdown-файлы, он НЕ связан с кодом продукта
  (`artifacts/`, `lib/`) и не влияет на сборку/деплой.