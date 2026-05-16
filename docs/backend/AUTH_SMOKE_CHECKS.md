# Authentication Smoke Checks

Run these checks when auth behavior changes or when a fresh database is seeded.

## Registration

- Register with a unique email.
- Confirm the response starts email verification instead of silently activating the user.
- Confirm the verification code is delivered to the configured SMTP destination.
- Verify the account with the one-time code.

## Login

- Log in with a verified user.
- Confirm the response includes `access_token` and `user`.
- Call `/api/auth/me` with the bearer token.
- Confirm the returned user email matches the login email.

## Negative Cases

- Try login before email verification.
- Try login with a wrong password.
- Try verification with an invalid code.
- Try requesting a new verification code before the cooldown expires.

## Profile Checks

- Update profile fields through `/api/auth/profile`.
- Update language through `/api/auth/language`.
- Confirm `/api/auth/me` reflects the updated values.
