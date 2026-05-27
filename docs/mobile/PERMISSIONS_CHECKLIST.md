# Mobile Permissions Checklist

Use this checklist when testing native builds or device-specific behavior.

## Location

- Confirm the app asks for location permission only when needed.
- Confirm denial keeps the flow usable with manual address entry.
- Confirm granted permission fills map or location context correctly.

## Photos

- Confirm image picker permission prompts are clear.
- Confirm denial does not block request creation without photos.
- Confirm selected images preview before submit.

## Networking

- Confirm physical devices can reach `EXPO_PUBLIC_BACKEND_URL`.
- Confirm emulator networking uses the correct host mapping.
- Confirm failed network calls show retryable states.

## Platform Notes

- Test at least one iOS simulator or device.
- Test at least one Android emulator or device.
- Recheck permissions after uninstalling and reinstalling the app.
