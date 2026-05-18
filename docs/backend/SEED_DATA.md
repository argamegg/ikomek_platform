# Seed Data Workflow

Seed data gives local developers a shared baseline for demos and smoke tests.

## Start From A Clean Local Backend

1. Start MongoDB.
2. Start the backend on port `8001`.
3. Confirm `http://localhost:8001/api/` responds.

## Seed Command

```bash
curl -X POST http://localhost:8001/api/seed
```

## Demo Accounts

| Role | Email | Password |
| --- | --- | --- |
| Citizen | `demo@ikomek.kz` | `demo123` |
| Operator | `operator@ikomek.kz` | `operator123` |
| Admin | `admin@ikomek.kz` | `admin123` |

## After Seeding

- Verify login for each demo account.
- Confirm role-specific navigation appears in web and mobile clients.
- Create at least one request and confirm it appears for operator/admin users.
