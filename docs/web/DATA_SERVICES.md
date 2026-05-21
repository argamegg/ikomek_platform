# Web Data Services

The web client keeps API access in service modules under `apps/web-app/src/web/services`.

## Main Service Layer

- `platformApi.ts` contains the shared API calls used by the web app.
- Query keys live near API calls so React Query usage stays consistent.
- The API base URL comes from web configuration.

## Usage Pattern

- Pages and feature components should use service functions instead of inline `fetch` or `axios` calls.
- React Query should own server state loading, cache keys, refetching, and loading states.
- UI components should receive normalized data whenever possible.

## QA Checks

- Confirm failed API calls show a user-readable state.
- Confirm loading states do not block unrelated navigation.
- Confirm mutations invalidate or refresh the affected query keys.
- Confirm auth-required calls include the current bearer token.
