# Mobile App

Expo / React Native frontend for the iKOMEK platform.

Location:

- `apps/mobile-app`

This app uses the shared FastAPI backend from `apps/backend`.

Important config:

- `.env`
- `app.json`
- `package.json`

Run manually:

```bash
cd apps/mobile-app
npm install
npm run start
```

Backend URL:

```env
EXPO_PUBLIC_BACKEND_URL=http://localhost:8001
```

For full project instructions, see the root [README](/Users/argame/Documents/ikomek-project/README.md) and [RUNNING guide](/Users/argame/Documents/ikomek-project/docs/RUNNING.md).
