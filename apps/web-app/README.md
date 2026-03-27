# Web App

React + Vite web frontend for the iKOMEK platform.

Location:

- `apps/web-app`

This app uses the same backend and database as the mobile app.

Run manually:

```bash
cd apps/web-app
npm install
npm run dev -- --host 0.0.0.0 --port 5173
```

Build:

```bash
cd apps/web-app
npm run build
```

Default backend target:

```env
VITE_API_BASE_URL=http://localhost:8001
```

For full project instructions, see the root [README](/Users/argame/Documents/ikomek-project/README.md) and [RUNNING guide](/Users/argame/Documents/ikomek-project/docs/RUNNING.md).
