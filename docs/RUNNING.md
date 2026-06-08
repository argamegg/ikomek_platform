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
- interactive Expo mobile dev server in `apps/mobile-app`

The mobile dev server prints the QR code directly in the terminal. You can scan it from a development build, or use Expo keyboard shortcuts such as `i` for iOS Simulator and `a` for Android Emulator.

Useful options:

```bash
python3 scripts/start_system.py --skip-mobile
python3 scripts/start_system.py --skip-web
python3 scripts/start_system.py --skip-backend
python3 scripts/start_system.py --mobile-port 8082
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
