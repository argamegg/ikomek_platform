# Backend Startup Checklist

This checklist keeps backend startup predictable during local development.

## Before Starting

- Confirm `apps/backend/.env` exists.
- Confirm `MONGO_URL` and `DB_NAME` are set.
- Activate the backend virtual environment.
- Install dependencies with `pip install -r requirements.txt`.

## Start Command

From `apps/backend`:

```bash
python -m uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

The API routes are mounted under `/api`.

## Expected Startup Signals

- Uvicorn starts without import errors.
- MongoDB connection is created from `core/config.py`.
- CORS allows the local web and Expo development origins.
- The root API route responds at `http://localhost:8001/api/`.

## Common Local Issues

- Missing `.env` usually fails when `MONGO_URL` or `DB_NAME` is read.
- MongoDB unavailable causes request failures even if Uvicorn starts.
- Wrong port causes clients to report network or CORS errors.
