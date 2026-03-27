# Running The System

This guide explains how to start the backend, web app, and mobile app from the new repository structure.

## Prerequisites

- Python 3.10+
- Node.js 18+
- npm
- MongoDB running locally

## Folder Layout

- backend: `apps/backend`
- mobile frontend: `apps/mobile-app`
- web frontend: `apps/web-app`

## 1. Prepare Environment Files

### Backend

Create `apps/backend/.env`:

```env
MONGO_URL=mongodb://localhost:27017
DB_NAME=ikomek_db
JWT_SECRET=ikomek109-secret-key-2025-secure
```

### Mobile App

Create `apps/mobile-app/.env`:

```env
EXPO_PUBLIC_BACKEND_URL=http://localhost:8001
```

### Web App

Create `apps/web-app/.env` from the example:

```bash
cp apps/web-app/.env.example apps/web-app/.env
```

## 2. Install Dependencies

### Backend

```bash
cd apps/backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### Mobile App

```bash
cd apps/mobile-app
npm install
```

### Web App

```bash
cd apps/web-app
npm install
```

## 3. Start Everything With One Command

From the project root:

```bash
python3 scripts/start_system.py
```

What it starts:

- backend on `http://localhost:8001`
- web app on `http://localhost:5173`
- Expo mobile dev server in `apps/mobile-app`

Useful options:

```bash
python3 scripts/start_system.py --skip-mobile
python3 scripts/start_system.py --skip-web
python3 scripts/start_system.py --skip-backend
python3 scripts/start_system.py --dry-run
```

## 4. Manual Start Commands

If you prefer separate terminals:

### Backend

```bash
cd apps/backend
source venv/bin/activate
python -m uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

### Web App

```bash
cd apps/web-app
npm run dev -- --host 0.0.0.0 --port 5173
```

### Mobile App

```bash
cd apps/mobile-app
npm run start
```

## 5. Seed Demo Data

After the backend is up:

```bash
curl -X POST http://localhost:8001/api/seed
```

## Troubleshooting

### Backend does not start

- Make sure MongoDB is running
- Make sure `apps/backend/.env` exists
- Make sure Python dependencies are installed

### Web app cannot reach backend

- Check that backend is running on port `8001`
- Check `apps/web-app/.env`

### Mobile app cannot reach backend

- Check `apps/mobile-app/.env`
- If using a physical device, `localhost` may need to be replaced with your machine IP

### Launcher script exits early

- One of the services likely failed to start
- Read the prefixed logs: `[backend]`, `[web]`, or `[mobile]`
