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

Run together with the local Docker backend/web stack from the repository root:

```bash
./setup.sh
```

The terminal will show the Expo QR code after Mongo, backend, and web are healthy.

Backend URL:

```env
EXPO_PUBLIC_BACKEND_URL=https://ikomekservice.kz
```

For local testing on a physical phone, use your computer LAN IP instead of `localhost`, for example `http://192.168.1.25:8001`. The app appends `/api` internally, so do not include `/api` in this value.

Do not paste the backend URL into the Expo development client. The client must open the Expo/Metro URL printed by `npm run start` or shown in the QR code. If it opens `https://ikomekservice.kz`, it receives HTML instead of a JavaScript bundle and React Native shows `Expected MIME-Type to be application/javascript, but got text/html`.

Use the installed development build for this app, not Expo Go, because the project includes native modules.

For full project instructions, see the root [README](/Users/argame/Documents/ikomek-project/README.md) and [RUNNING guide](/Users/argame/Documents/ikomek-project/docs/RUNNING.md).
