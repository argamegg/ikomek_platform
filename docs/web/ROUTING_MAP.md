# Web Routing Map

The web router is defined in `apps/web-app/src/web/app/router.tsx`.

## Public Routes

| Route | Page |
| --- | --- |
| `/` | Home page |
| `/auth` | Authentication page |
| `/news` | News page |
| `/map` | Map page |

## Authenticated Routes

| Route | Page |
| --- | --- |
| `/dashboard` | Citizen dashboard |
| `/requests` | Request list |
| `/requests/new` | New request flow |
| `/requests/:requestId` | Request details |
| `/requests/:requestId/chat` | Request chat |
| `/profile` | Profile page |
| `/settings` | Settings page |

## Role Routes

| Route | Allowed roles |
| --- | --- |
| `/operator` | `operator`, `admin` |
| `/admin` | `admin` |

## Guard Behavior

- Unauthenticated users are redirected to `/auth`.
- Users without the required role are redirected to `/dashboard`.
- Unknown routes render the not found page.
