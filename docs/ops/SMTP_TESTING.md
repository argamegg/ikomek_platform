# SMTP Testing Guide

Registration uses email verification, so local SMTP setup matters for auth QA.

## Local Catcher

Use a local SMTP catcher such as Mailpit or MailHog during development.

Example backend settings:

```env
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_USERNAME=
SMTP_PASSWORD=
SMTP_SENDER_EMAIL=no-reply@ikomek.local
SMTP_SENDER_NAME=iKOMEK 109
SMTP_USE_TLS=false
SMTP_USE_SSL=false
```

## Checks

- Register a new account.
- Confirm the verification email arrives.
- Confirm the code expires according to configuration.
- Confirm resend cooldown is enforced.

## Troubleshooting

- If no email arrives, confirm SMTP host and port.
- If TLS fails locally, confirm both TLS and SSL are disabled for the catcher.
