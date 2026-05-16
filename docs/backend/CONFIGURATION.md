# Backend Configuration Reference

The backend loads configuration from `apps/backend/.env` through `core/config.py`.

## Database

| Variable | Purpose |
| --- | --- |
| `MONGO_URL` | MongoDB connection URI. |
| `DB_NAME` | Database name used by the FastAPI app. |

## Authentication

| Variable | Purpose |
| --- | --- |
| `JWT_SECRET` | Secret used to sign access tokens. |
| `EMAIL_VERIFICATION_EXPIRE_MINUTES` | Lifetime for one-time verification codes. |
| `EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS` | Cooldown before sending a new code. |
| `EMAIL_VERIFICATION_MAX_ATTEMPTS` | Maximum verification attempts per code. |

## SMTP

| Variable | Purpose |
| --- | --- |
| `SMTP_HOST` | SMTP server host. |
| `SMTP_PORT` | SMTP server port. |
| `SMTP_USERNAME` | Optional SMTP username. |
| `SMTP_PASSWORD` | Optional SMTP password. |
| `SMTP_SENDER_EMAIL` | Email shown as sender. |
| `SMTP_SENDER_NAME` | Display name shown as sender. |
| `SMTP_USE_TLS` | Enables STARTTLS when true. |
| `SMTP_USE_SSL` | Enables SSL connection mode when true. |

## CORS

`CORS_ORIGINS` can override the default local origins. `CORS_ORIGIN_REGEX` keeps local network development available for Expo and browser testing.
