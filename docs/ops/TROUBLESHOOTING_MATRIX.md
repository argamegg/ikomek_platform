# Troubleshooting Matrix

Use this matrix to narrow down local development issues.

| Symptom | Likely Area | First Check |
| --- | --- | --- |
| Backend exits on startup | Backend env | `apps/backend/.env` has `MONGO_URL` and `DB_NAME` |
| Login fails for demo user | Seed/auth | Seed data exists and email is verified |
| Web cannot load data | Web env/API | `VITE_API_BASE_URL` points to backend |
| Mobile cannot connect | Mobile env/network | `EXPO_PUBLIC_BACKEND_URL` is reachable from device |
| Admin page redirects | Roles | Current user has `admin` role |
| Operator page redirects | Roles | Current user has `operator` or `admin` role |
| Map is empty | Data/map | `/api/map/points` returns data |
| Email code missing | SMTP | SMTP catcher or provider is running |

## Escalation Order

1. Check the relevant `.env` file.
2. Check backend logs.
3. Check browser or Metro logs.
4. Reproduce with a seeded demo account.
