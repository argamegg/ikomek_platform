# iKOMEK 109

Full-stack smart city service platform for Astana that lets citizens report city issues, track progress, and communicate with operators across mobile and web clients backed by one shared FastAPI API and MongoDB database.

## Project Aim

The goal of this project is to provide a single digital service platform for municipal issue reporting and response management.

Citizens can:

- register and sign in
- create requests about public problems
- attach details and photos
- monitor request statuses
- chat with operators
- read city news and alerts

Operators and admins can:

- review incoming requests
- update request statuses
- communicate with citizens
- publish news
- monitor analytics

## Architecture

This repository contains three main applications:

- `apps/backend`: FastAPI backend with MongoDB integration and shared business logic
- `apps/mobile-app`: Expo / React Native mobile frontend
- `apps/web-app`: React + Vite web frontend

The mobile and web apps are meant to work against the same backend and the same database.

## Tech Stack

### Backend

- Python
- FastAPI
- MongoDB
- Motor
- JWT authentication
- Passlib / bcrypt

### Mobile App

- Expo
- React Native
- TypeScript
- Expo Router
- Axios
- i18next

### Web App

- React
- TypeScript
- Vite
- React Router
- React Query
- Axios
- OpenLayers
- Framer Motion
- i18next

## Repository Structure

```text
ikomek-project/
├── apps/
│   ├── backend/
│   │   ├── server.py
│   │   ├── requirements.txt
│   │   └── .env
│   ├── mobile-app/
│   │   ├── app/
│   │   ├── assets/
│   │   ├── src/
│   │   ├── package.json
│   │   └── .env
│   └── web-app/
│       ├── public/
│       ├── src/
│       ├── package.json
│       └── .env.example
├── docs/
│   ├── PROJECT_OVERVIEW.md
│   └── RUNNING.md
├── scripts/
│   └── start_system.py
├── tests/
├── memory/
├── setup.sh
└── README.md
```

## Main Features

- citizen registration and login
- role-based access for citizen, operator, and admin
- request creation with category, location, description, and optional photos
- shared request history between mobile and web
- operator request management
- request chat
- city news publishing
- admin analytics
- multi-language support: Russian, Kazakh, English

## Demo Accounts

After seeding demo data, these accounts are available:

| Role | Email | Password |
|------|-------|----------|
| Citizen | `demo@ikomek.kz` | `demo123` |
| Operator | `operator@ikomek.kz` | `operator123` |
| Admin | `admin@ikomek.kz` | `admin123` |

## Environment Overview

### Backend

Expected file: `apps/backend/.env`

Example values:

```env
MONGO_URL=mongodb://localhost:27017
DB_NAME=ikomek_db
JWT_SECRET=ikomek109-secret-key-2025-secure
```

### Mobile App

Expected file: `apps/mobile-app/.env`

Example value:

```env
EXPO_PUBLIC_BACKEND_URL=http://localhost:8001
```

### Web App

Expected file: `apps/web-app/.env`

The easiest option is to copy from `apps/web-app/.env.example`.

Default backend target:

```env
VITE_API_BASE_URL=http://localhost:8001
```

## How To Run

Use the startup guide:

- [RUNNING.md](/Users/argame/Documents/ikomek-project/docs/RUNNING.md)
- [PROJECT_OVERVIEW.md](/Users/argame/Documents/ikomek-project/docs/PROJECT_OVERVIEW.md)

Or start everything with the helper script:

```bash
python3 scripts/start_system.py
```

## Seed Demo Data

When the backend is running:

```bash
curl -X POST http://localhost:8001/api/seed
```

## Notes

- MongoDB must be running before the backend starts.
- The web app now targets the same FastAPI contract as the mobile app.
- The web frontend contains a few frontend-side fallbacks for data the current backend does not expose with dedicated endpoints yet, such as districts, request reasons, and notifications.

## Helpful Files

- [backend service](/Users/argame/Documents/ikomek-project/apps/backend/server.py)
- [mobile app](/Users/argame/Documents/ikomek-project/apps/mobile-app/package.json)
- [web app](/Users/argame/Documents/ikomek-project/apps/web-app/package.json)
- [startup guide](/Users/argame/Documents/ikomek-project/docs/RUNNING.md)
- [launcher script](/Users/argame/Documents/ikomek-project/scripts/start_system.py)
