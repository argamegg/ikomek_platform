# Web App Setup Checklist

The web app lives in `apps/web-app` and uses Vite, React, React Query, and TypeScript.

## Install

```bash
cd apps/web-app
npm install
```

## Environment

Create `apps/web-app/.env` from the example:

```bash
cp apps/web-app/.env.example apps/web-app/.env
```

Confirm `VITE_API_BASE_URL` points to the backend base URL.

## Start

```bash
npm run dev -- --host 0.0.0.0 --port 5173
```

## Validate

- Open the Vite URL in a browser.
- Confirm the home page renders.
- Log in with a seeded demo account.
- Open dashboard, requests, news, map, profile, operator, and admin routes as the matching roles.
