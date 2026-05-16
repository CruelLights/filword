# Филворд

Филворд — многопользовательская игра для поиска слов в таблице букв. Игроки соревнуются в реальном времени, находя спрятанные слова на поле 10×10.

## Проект создан студентом группы ПП 3 курс

- Васильев Владимир

---

## Возможности

- Регистрация и вход по email
- Игровое поле 10×10 с буквами
- Выделение слов мышью в любом направлении
- Многопользовательский режим от 2 до 6 игроков
- Realtime-синхронизация найденных слов через WebSocket
- Командный режим с выбором команды
- Игра против бота с настраиваемой скоростью
- Статистика матчей и лидерборд
- Светлая и тёмная тема

---

## Технологии

- **Next.js** (App Router)
- **TypeScript**
- **tRPC** — типобезопасный API
- **Drizzle ORM** — работа с базой данных
- **Better Auth** — аутентификация
- **PostgreSQL** (Neon) — база данных
- **WebSocket (ws)** — realtime-синхронизация
- **Tailwind CSS** — стилизация
- **Vitest** — unit-тесты

---

## Структура проекта

- `src/app` — страницы и UI
- `src/server` — tRPC-роутеры, логика сервера, WebSocket
- `src/server/db` — схемы Drizzle
- `src/server/game` — генерация поля, валидация слов, бот
- `src/server/ws` — WebSocket сервер
- `src/components` — React-компоненты
- `src/lib` — клиентские утилиты

---

## Запуск проекта

### 1. Клонировать репозиторий

```bash
git clone https://github.com/CruelLights/filword.git
cd filword
```

### 2. Установить зависимости

```bash
npm install --legacy-peer-deps
```

### 3. Настроить переменные окружения

Создать файл `.env.local` в корне проекта:

```env
DATABASE_URL=postgresql://...
BETTER_AUTH_URL=http://localhost:3000
BETTER_AUTH_SECRET=your-secret-key-min-32-chars
NEXT_PUBLIC_WS_URL=ws://localhost:3001
WS_PORT=3001
```

### 4. Применить миграции

```bash
npm run db:push
```

### 5. Создать пользователя для бота (в Neon SQL Editor)

```sql
INSERT INTO users (id, name, email, email_verified, created_at, updated_at)
VALUES ('bot-player-000000000000000000000', '🤖 Бот', 'bot@filword.internal', true, NOW(), NOW())
ON CONFLICT DO NOTHING;
```

### 6. Запустить проект в режиме разработки

```bash
# Терминал 1 — Next.js
npm run dev

# Терминал 2 — WebSocket сервер
npm run ws:dev
```

---

## Тесты

### Unit-тесты (Vitest)

```bash
npm run test:run
```

---

## Деплой

- **Vercel** — Next.js приложение
- **Railway** — WebSocket сервер

Переменные окружения для Vercel:

```env
DATABASE_URL=...
BETTER_AUTH_SECRET=...
BETTER_AUTH_URL=https://your-app.vercel.app
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
NEXT_PUBLIC_WS_URL=wss://your-ws.railway.app
WS_INTERNAL_URL=https://your-ws.railway.app
```

---

## Правила игры

1. На поле 10×10 спрятаны слова в разных направлениях
2. Выдели слово мышью — зажми на первой букве и потяни до последней
3. Найденное слово засчитывается тебе и блокируется для других
4. Побеждает игрок (или команда) с наибольшим количеством слов к концу таймера
5. При равном счёте побеждает тот, кто находил слова быстрее