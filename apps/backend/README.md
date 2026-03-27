# Backend

FastAPI backend for the iKOMEK platform.

Main entrypoint:

- [server.py](/Users/argame/Documents/ikomek-project/apps/backend/server.py)

Important:

- new registrations require email verification by one-time code
- SMTP settings are configured through `apps/backend/.env`
- an example config is available in `apps/backend/.env.example`

Run manually:

```bash
cd apps/backend
source venv/bin/activate
python -m uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

Shared with:

- mobile app in `apps/mobile-app`
- web app in `apps/web-app`
