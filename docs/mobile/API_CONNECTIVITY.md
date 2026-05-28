# Mobile API Connectivity Notes

Mobile clients often need a different backend URL than the browser.

## Localhost Rules

- iOS simulator can often reach the host through `localhost`.
- Android emulator may need `10.0.2.2` depending on the setup.
- Physical devices need the host machine LAN IP.

## Environment Variable

Set the mobile backend URL in `apps/mobile-app/.env`:

```env
EXPO_PUBLIC_BACKEND_URL=http://192.168.1.10:8001
```

Restart Expo after changing the value.

## Checks

- Open the backend API root from the device browser if possible.
- Confirm the backend CORS regex allows the development origin.
- Confirm the mobile app and backend are on the same network.
- Watch Metro logs for request URLs during login and request creation.
