# Environment Checklist

Use this checklist before starting the full iKOMEK 109 stack locally.

## Required Tools

- Python 3.10 or newer is available as `python3`.
- Node.js 18 or newer is available as `node`.
- npm is available for the web and mobile workspaces.
- MongoDB is running locally or reachable from the configured URI.
- A local SMTP catcher is available if registration email verification is being tested.

## Backend Environment

Create `apps/backend/.env` and verify these values:

- `MONGO_URL` points to the intended MongoDB instance.
- `DB_NAME` is set to the local development database.
- `JWT_SECRET` is set for repeatable token signing in local tests.
- `SMTP_HOST` and `SMTP_PORT` match the local SMTP catcher or provider.
- Email verification timeout and retry settings are present.

## Frontend Environment

Create app environment files before starting clients:

- `apps/web-app/.env` from `apps/web-app/.env.example`.
- `apps/mobile-app/.env` with `EXPO_PUBLIC_BACKEND_URL`.

## Startup Order

1. Start MongoDB.
2. Start the backend on port `8001`.
3. Start the web app on port `5173`.
4. Start Expo after the backend URL is reachable.

## Quick Health Checks

- Open `http://localhost:8001/api/`.
- Confirm the web app can load without API connection errors.
- Confirm the mobile app points to a backend URL reachable by the device or emulator.
