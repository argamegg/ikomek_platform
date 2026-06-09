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
JWT_SECRET=replace-with-a-long-random-production-secret
SEED_OPERATOR_PASSWORD=replace-with-a-long-operator-password-24-plus
SEED_ADMIN_PASSWORD=replace-with-a-long-admin-password-24-plus
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
```

### Mobile App

Create `apps/mobile-app/.env`:

```env
EXPO_PUBLIC_BACKEND_URL=http://192.168.1.25:8001
```

Use a LAN IP that is reachable from your phone. For production builds use the public backend origin without `/api`:

```env
EXPO_PUBLIC_BACKEND_URL=https://ikomekservice.kz
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
- web app on `http://localhost:8080`
- MongoDB on `mongodb://localhost:27018`
- Expo mobile dev server with a QR code in the terminal

By default this command builds and runs the Docker images from `docker-compose.yml` in the background, then starts Expo in the foreground so the QR code remains visible.

Useful options:

```bash
python3 scripts/start_system.py up --skip-mobile
python3 scripts/start_system.py up --mobile-api-url http://192.168.1.25:8001
python3 scripts/start_system.py up --expo-host tunnel
python3 scripts/start_system.py up -d
python3 scripts/start_system.py logs backend
python3 scripts/start_system.py ps
python3 scripts/start_system.py reset-news
python3 scripts/start_system.py seed-demo
python3 scripts/start_system.py rotate-passwords
python3 scripts/start_system.py shell
python3 scripts/start_system.py down
python3 scripts/start_system.py down -v
```

The Docker backend uses `apps/backend/.env`, but `docker-compose.yml` overrides `MONGO_URL` to `mongodb://mongo:27017` so the container talks to the local Mongo container.

The mobile app reads `EXPO_PUBLIC_BACKEND_URL` and appends `/api` internally. Do not include `/api` in this value.

Important: `EXPO_PUBLIC_BACKEND_URL` is only the API address inside the app. Do not paste `https://ikomekservice.kz` into the Expo development client. The development client must open the Expo/Metro URL printed in the terminal, usually from the QR code. If you paste the backend or web URL there, React Native will receive HTML instead of JavaScript and show `Expected MIME-Type to be application/javascript, but got text/html`.

## 3.1 Start Without Docker

```bash
python3 scripts/start_system.py dev
```

This starts:

- backend on `http://localhost:8001`
- web app on `http://localhost:5173`
- interactive Expo mobile dev server in `apps/mobile-app`

The mobile dev server prints the QR code directly in the terminal. You can scan it from a development build, or use Expo keyboard shortcuts such as `i` for iOS Simulator and `a` for Android Emulator.

This app uses native modules, so use the installed development build rather than Expo Go. If the phone cannot reach your computer on LAN, start with `--expo-host tunnel`. If an old or blank bundle keeps opening, restart with `--clear-mobile-cache`.

```bash
python3 scripts/start_system.py dev --skip-mobile
python3 scripts/start_system.py dev --skip-web
python3 scripts/start_system.py dev --skip-backend
python3 scripts/start_system.py dev --mobile-port 8082
python3 scripts/start_system.py dev --mobile-api-url http://192.168.1.25:8001
python3 scripts/start_system.py dev --dry-run
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

## 6. Email Verification Setup

New registrations require email verification before login is allowed.

### Local development

The easiest local option is to run an SMTP catcher such as Mailpit or MailHog and point the backend to it.

Example backend email settings for local Mailpit:

```env
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_USERNAME=
SMTP_PASSWORD=
SMTP_SENDER_EMAIL=no-reply@ikomek.local
SMTP_SENDER_NAME=iKOMEK 109
SMTP_USE_TLS=false
SMTP_USE_SSL=false
```

With Mailpit, you can usually open the inbox UI at:

```text
http://localhost:8025
```

### Production

For production, use your real SMTP provider and set:

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USERNAME`
- `SMTP_PASSWORD`
- `SMTP_SENDER_EMAIL`
- `SMTP_SENDER_NAME`
- `SMTP_USE_TLS` or `SMTP_USE_SSL`

Recommended verification defaults:

- `EMAIL_VERIFICATION_EXPIRE_MINUTES=10`
- `EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS=60`
- `EMAIL_VERIFICATION_MAX_ATTEMPTS=5`

## Troubleshooting

### Backend does not start

- Make sure MongoDB is running
- Make sure `apps/backend/.env` exists
- Make sure Python dependencies are installed
- Make sure SMTP settings are configured if you want registration email verification to work

### Web app cannot reach backend

- Check that backend is running on port `8001`
- Check `apps/web-app/.env`

### Mobile app cannot reach backend

- Check `apps/mobile-app/.env`
- If using a physical device, `localhost` may need to be replaced with your machine IP

### Launcher script exits early

- One of the services likely failed to start
- Read the prefixed logs: `[backend]`, `[web]`, or `[mobile]`
