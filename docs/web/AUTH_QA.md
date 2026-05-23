# Web Auth QA

Use these checks after changing authentication, routing, or session behavior in the web app.

## Login

- Log in as the seeded citizen account.
- Confirm the app redirects away from `/auth`.
- Refresh the browser and confirm the session is restored.
- Confirm logout clears protected data from the visible UI.

## Registration And Verification

- Start registration with a unique email.
- Confirm the verification screen is reachable.
- Submit an invalid code and confirm the error is clear.
- Submit the valid code and confirm the authenticated session starts.

## Route Guards

- Visit `/dashboard` while logged out and confirm redirect to `/auth`.
- Visit `/operator` as a citizen and confirm redirect to `/dashboard`.
- Visit `/admin` as an operator and confirm redirect to `/dashboard`.
- Visit `/admin` as an admin and confirm access.
