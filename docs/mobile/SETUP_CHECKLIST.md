# Mobile App Setup Checklist

The mobile app lives in `apps/mobile-app` and uses Expo Router with React Native.

## Install

```bash
cd apps/mobile-app
npm install
```

## Environment

Create `apps/mobile-app/.env`:

```env
EXPO_PUBLIC_BACKEND_URL=http://localhost:8001
```

For a physical device, replace `localhost` with the host machine LAN IP.

## Start

```bash
npm run start
```

## Validate

- Scan the Expo QR code or open an emulator.
- Confirm the splash flow completes.
- Confirm login works against the configured backend.
- Confirm tabs render for the current role.
