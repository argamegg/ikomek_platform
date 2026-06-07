# iKOMEK 109

![Backend](https://img.shields.io/badge/backend-FastAPI-009688)
![Database](https://img.shields.io/badge/database-MongoDB-47A248)
![Web](https://img.shields.io/badge/web-React%2019%20%2B%20Vite-61DAFB)
![Mobile](https://img.shields.io/badge/mobile-Expo%2054%20%2B%20React%20Native-000020)
![Language](https://img.shields.io/badge/languages-RU%20%7C%20KZ%20%7C%20EN-334155)

Full-stack платформа городских обращений для Астаны: жители создают заявки по городским проблемам, операторы обрабатывают обращения, администраторы следят за статистикой, а web и mobile клиенты работают через один общий backend и одну MongoDB.

Обновлено: июнь 2026.

## Что Это

iKOMEK 109 - единая цифровая система для взаимодействия жителей, операторов и администрации города.

Платформа помогает:

- гражданам отправлять обращения с адресом, координатами, описанием и фото;
- операторам брать заявки в работу, менять статус и приоритет;
- гражданам и операторам общаться в чате по конкретной заявке;
- администраторам видеть аналитику, пользователей, новости и нагрузку операторов;
- всем пользователям работать на русском, казахском и английском языках;
- web и mobile приложениям использовать один общий API-контракт.

## Основные Возможности

| Направление | Что реализовано |
| --- | --- |
| Авторизация | Email/password, подтверждение email кодом, JWT, интеграция с Clerk/Google |
| Роли | `citizen`, `operator`, `admin` |
| Заявки | Создание, история, публичная лента, карта, детали, статусы, приоритеты |
| Приоритеты | `Не задан`, `Низкий`, `Средний`, `Высокий`; новые заявки создаются с `unset` |
| Геозона | Создание заявок и адресов ограничено радиусом Астаны |
| Операторская работа | Очередь заявок, фильтры, смена статуса, назначение оператора, заметки |
| Чат | REST история сообщений и WebSocket realtime по заявке |
| Новости | CRUD для админа, публичный список, поиск, периоды, мультиязычные поля |
| Переводы | MyMemory + LibreTranslate fallback, локализация типовых полей |
| AI-ассистент | Помощь по навигации, заявкам, статусам, настройкам, профилю и разделам платформы |
| FAQ | Частые вопросы с разделением по ролям для граждан, операторов и админов |
| Профиль | Редактирование данных, имена с дефисом, язык, смена пароля, локальный пароль для Clerk |
| Карта | Точки заявок, фильтры по статусу/приоритету/категории, мобильная и web-версии |
| Аналитика | Админская статистика, нагрузка операторов, категории, активность по месяцам |

## Архитектура

```text
             ┌────────────────────┐
             │   Web App          │
             │   React + Vite     │
             └─────────┬──────────┘
                       │
                       │ HTTP / WebSocket
                       │
┌────────────────────┐ │        ┌────────────────────┐
│   Mobile App       │ │        │   FastAPI Backend  │
│   Expo / RN        ├─┴───────►│   /api/*           │
└────────────────────┘          └─────────┬──────────┘
                                          │
                                          │ Motor / MongoDB
                                          │
                                ┌─────────▼──────────┐
                                │   MongoDB          │
                                │   users, requests  │
                                │   news, messages   │
                                └────────────────────┘
```

Главная идея архитектуры: backend является single source of truth. Mobile и web не дублируют бизнес-логику, а работают с одной базой через общий FastAPI API.

## Приложения В Репозитории

| Путь | Назначение |
| --- | --- |
| `apps/backend` | FastAPI backend, MongoDB, auth, заявки, чат, новости, AI, аналитика |
| `apps/web-app` | Web frontend на React 19, TypeScript и Vite |
| `apps/mobile-app` | Mobile frontend на Expo, React Native и Expo Router |
| `docs` | Дополнительная документация по запуску, проекту и deployment |
| `scripts/start_system.py` | Запуск backend, web и mobile из одной команды |

## Tech Stack

### Backend

| Технология | Использование |
| --- | --- |
| Python | основной язык backend |
| FastAPI | REST API, зависимости, WebSocket |
| Uvicorn | ASGI server |
| MongoDB | основная база данных |
| Motor / PyMongo | асинхронная работа с MongoDB |
| Pydantic | схемы и валидация данных |
| PyJWT | локальные JWT access tokens |
| passlib / bcrypt | хеширование паролей |
| httpx | внешние HTTP-интеграции |
| langdetect | определение языка новостей |
| Clerk | social login bridge |
| Gemini API | AI-ассистент |
| MyMemory / LibreTranslate | автоматические переводы |

Подробнее про backend: [apps/backend/BACKEND_OVERVIEW.md](apps/backend/BACKEND_OVERVIEW.md).

### Web Frontend

| Технология | Использование |
| --- | --- |
| React 19 | UI |
| TypeScript | типизация |
| Vite | dev server и build |
| React Router 7 | маршрутизация |
| TanStack React Query | server-state и кеширование |
| Axios | HTTP-клиент |
| Clerk React | Google/social auth |
| MapLibre GL | карта |
| Recharts | графики и аналитика |
| Framer Motion | анимации |
| i18next / react-i18next | локализация |
| Lucide React | иконки |
| Zod | runtime-валидация |

### Mobile Frontend

| Технология | Использование |
| --- | --- |
| Expo 54 | mobile runtime и tooling |
| React Native 0.81 | native UI |
| React 19 | UI layer |
| TypeScript | типизация |
| Expo Router 6 | file-based routing |
| React Navigation | навигационные primitives |
| Axios | HTTP-клиент |
| Clerk Expo | Google/social auth |
| Expo Secure Store | безопасное хранение токена |
| AsyncStorage | локальное состояние |
| Expo Location | геолокация |
| Expo Image Picker | выбор изображений |
| MapLibre React Native / React Native Maps | карты |
| i18next / react-i18next | локализация |
| Reanimated | анимации |

## Структура Проекта

```text
ikomek-project/
├── apps/
│   ├── backend/
│   │   ├── core/
│   │   ├── routes/
│   │   ├── scripts/
│   │   ├── services/
│   │   ├── server.py
│   │   ├── schemas.py
│   │   ├── helpers.py
│   │   ├── geo.py
│   │   ├── README.md
│   │   └── BACKEND_OVERVIEW.md
│   ├── mobile-app/
│   │   ├── app/
│   │   ├── assets/
│   │   ├── src/
│   │   ├── package.json
│   │   └── README.md
│   └── web-app/
│       ├── public/
│       ├── src/
│       ├── package.json
│       └── README.md
├── docs/
│   ├── PROJECT_OVERVIEW.md
│   ├── RUNNING.md
│   └── deployment.md
├── scripts/
│   └── start_system.py
├── tests/
├── Dockerfile
├── render.yaml
└── README.md
```

## Быстрый Старт

### Требования

- Python 3.10+
- Node.js 18+
- npm
- MongoDB локально или MongoDB Atlas
- SMTP catcher для локальной регистрации, например Mailpit или MailHog

### 1. Backend env

Создайте файл:

```text
apps/backend/.env
```

Можно начать с примера:

```bash
cp apps/backend/.env.example apps/backend/.env
```

Минимальный локальный набор:

```env
MONGO_URL=mongodb://localhost:27017
DB_NAME=ikomek_db
JWT_SECRET=replace-with-a-long-random-production-secret

SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_USERNAME=
SMTP_PASSWORD=
SMTP_SENDER_EMAIL=no-reply@ikomek.local
SMTP_SENDER_NAME=iKOMEK 109
SMTP_USE_TLS=false
SMTP_USE_SSL=false

EMAIL_VERIFICATION_EXPIRE_MINUTES=10
EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS=60
EMAIL_VERIFICATION_MAX_ATTEMPTS=5

ASTANA_CENTER_LAT=51.1282
ASTANA_CENTER_LNG=71.4306
ASTANA_MAX_RADIUS_KM=15

GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash
```

### 2. Web env

Создайте файл:

```text
apps/web-app/.env.local
```

Пример:

```env
VITE_API_BASE_URL=http://localhost:8001
VITE_WS_BASE_URL=ws://localhost:8001
VITE_API_TOKEN_PREFIX=Bearer
VITE_CLERK_PUBLISHABLE_KEY=
```

Также можно использовать пример:

```bash
cp apps/web-app/.env.example apps/web-app/.env.local
```

### 3. Mobile env

Создайте файл:

```text
apps/mobile-app/.env
```

Для iOS/Android simulator:

```env
EXPO_PUBLIC_BACKEND_URL=http://localhost:8001
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=
```

Для физического телефона обычно нужен IP компьютера в локальной сети:

```env
EXPO_PUBLIC_BACKEND_URL=http://192.168.1.51:8001
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=
```

### 4. Установка зависимостей

Backend:

```bash
cd apps/backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

Web:

```bash
cd apps/web-app
npm install
```

Mobile:

```bash
cd apps/mobile-app
npm install
```

### 5. Запуск всего проекта

Из корня репозитория:

```bash
python3 scripts/start_system.py
```

Будут запущены:

| Сервис | URL / порт |
| --- | --- |
| Backend | `http://localhost:8001` |
| Web | `http://localhost:5173` |
| Mobile | Expo dev server, обычно `8081` |

Полезные опции:

```bash
python3 scripts/start_system.py --skip-mobile
python3 scripts/start_system.py --skip-web
python3 scripts/start_system.py --skip-backend
python3 scripts/start_system.py --backend-port 8001
python3 scripts/start_system.py --web-port 5173
python3 scripts/start_system.py --mobile-port 8082
python3 scripts/start_system.py --dry-run
```

### 6. Ручной запуск

Backend:

```bash
cd apps/backend
source venv/bin/activate
python -m uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

Web:

```bash
cd apps/web-app
npm run dev -- --host 0.0.0.0 --port 5173
```

Mobile:

```bash
cd apps/mobile-app
npm run start
```

## Демо-Данные

Когда backend запущен, можно заполнить базу демо-данными.

Базовый seed:

```bash
curl -X POST http://localhost:8001/api/seed
```

Реалистичный seed с 50 гражданами, оператором, админом и большим набором заявок:

```bash
curl -X POST http://localhost:8001/api/seed-demo
```

Демо-аккаунты:

| Роль | Email | Пароль |
| --- | --- | --- |
| Citizen | `demo@ikomek.kz` | `demo123` |
| Operator | `operator@ikomek.kz` | `operator123` |
| Admin | `admin@ikomek.kz` | `admin123` |

Для реалистичного seed также создаются граждане:

```text
demo1@ikomek.kz ... demo49@ikomek.kz
```

Пароль для них:

```text
demo123
```

Seed endpoints открыты в коде и предназначены для разработки/демо. Для production их нужно закрыть или отключить.

## API

FastAPI автоматически отдает документацию:

```text
http://localhost:8001/docs
http://localhost:8001/openapi.json
```

Ключевые группы endpoints:

| Группа | Примеры |
| --- | --- |
| Health | `GET /api/health`, `GET /api/health/db` |
| Auth | `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me` |
| Profile | `PUT /api/auth/profile`, `PUT /api/auth/password`, `PUT /api/auth/language` |
| Requests | `POST /api/requests`, `GET /api/requests`, `GET /api/requests/all` |
| Operator | `GET /api/operator/requests`, `PUT /api/operator/requests/:id` |
| Chat | `GET /api/requests/:id/messages`, `WS /api/requests/:id/messages/ws` |
| News | `GET /api/news`, `POST /api/admin/news` |
| Map | `GET /api/requests/map`, `GET /api/map/points` |
| AI | `POST /api/ai/assistant` |
| Admin | `GET /api/admin/users`, `GET /api/admin/analytics`, `GET /api/admin/platform-stats` |

Подробный backend reference: [apps/backend/BACKEND_OVERVIEW.md](apps/backend/BACKEND_OVERVIEW.md).

## Проверки И Разработка

Web:

```bash
cd apps/web-app
npm run lint
npm run build
```

Mobile:

```bash
cd apps/mobile-app
npm run lint
```

Backend:

```bash
cd apps/backend
source venv/bin/activate
python -m pytest
```

Полезные backend-скрипты:

```bash
cd apps/backend
source venv/bin/activate

PYTHONPATH=. python scripts/migrate_request_priorities.py --dry-run
PYTHONPATH=. python scripts/migrate_request_priorities.py

PYTHONPATH=. python scripts/cleanup_out_of_zone_requests.py --dry-run
PYTHONPATH=. python scripts/cleanup_out_of_zone_requests.py
```

## Deployment

Общий порядок:

1. подготовить MongoDB Atlas или другой MongoDB;
2. задеплоить backend;
3. указать backend URL в web и mobile env;
4. обновить CORS для финальных frontend доменов;
5. задеплоить web;
6. собрать mobile через EAS Build;
7. выполнить smoke test.

Подробнее: [docs/deployment.md](docs/deployment.md).

Backend можно собирать через Docker:

```bash
docker build -t ikomek-backend:latest -f apps/backend/Dockerfile .
docker run --rm -p 8001:8001 --env-file apps/backend/.env ikomek-backend:latest
```

## Документация

| Файл | Что внутри |
| --- | --- |
| [docs/RUNNING.md](docs/RUNNING.md) | подробный локальный запуск |
| [docs/PROJECT_OVERVIEW.md](docs/PROJECT_OVERVIEW.md) | общий обзор проекта |
| [docs/deployment.md](docs/deployment.md) | deployment plan |
| [apps/backend/BACKEND_OVERVIEW.md](apps/backend/BACKEND_OVERVIEW.md) | подробное описание backend |
| [apps/backend/README.md](apps/backend/README.md) | быстрый backend README |
| [apps/web-app/README.md](apps/web-app/README.md) | быстрый web README |
| [apps/mobile-app/README.md](apps/mobile-app/README.md) | быстрый mobile README |

## Production Notes

- Не хранить реальные `.env` секреты в репозитории.
- `JWT_SECRET` должен быть длинным и случайным.
- SMTP должен быть настоящим production-провайдером.
- `CORS_ORIGINS` и `CORS_ORIGIN_REGEX` должны соответствовать реальным доменам.
- Seed endpoints нужно закрыть или убрать.
- In-memory rate limit лучше заменить на Redis/API Gateway для нескольких backend-инстансов.
- WebSocket broadcast сейчас хранит подключения в памяти процесса; для горизонтального масштабирования нужен внешний pub/sub.
- Внешние сервисы MyMemory, LibreTranslate и Gemini могут иметь лимиты и fallback-поведение.

## Коротко

iKOMEK 109 - это не просто web-сайт или mobile-приложение, а единая full-stack система городских обращений. Backend на FastAPI и MongoDB хранит бизнес-логику и данные, web на React/Vite дает desktop-интерфейс для граждан, операторов и админов, а mobile на Expo/React Native закрывает пользовательский сценарий с телефона: заявки, карта, чат, настройки, FAQ и AI-помощник.
