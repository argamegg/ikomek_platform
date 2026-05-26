# Mobile Navigation Map

The mobile app uses Expo Router under `apps/mobile-app/app`.

## Root

- `app/_layout.tsx` configures the root app layout.
- `app/index.tsx` handles the initial app entry.

## Auth

- `app/(auth)/login.tsx`
- `app/(auth)/register.tsx`
- `app/(auth)/verify.tsx`

## Citizen Tabs

- `app/(tabs)/index.tsx`
- `app/(tabs)/requests.tsx`
- `app/(tabs)/create.tsx`
- `app/(tabs)/map.tsx`
- `app/(tabs)/profile.tsx`

## Request Flow

- `app/request/details.tsx`
- `app/request/location.tsx`
- `app/request/confirm.tsx`

## Role Areas

- Admin routes live under `app/(admin)`.
- Operator routes live under `app/(operator)`.
