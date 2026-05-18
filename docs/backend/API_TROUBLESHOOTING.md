# API Troubleshooting Guide

Use this guide when the clients cannot reach or use the backend API.

## Backend Not Reachable

- Confirm Uvicorn is running on port `8001`.
- Confirm the client uses `http://localhost:8001` or a reachable LAN IP.
- Check whether another process already owns the port.

## Database Errors

- Confirm MongoDB is running.
- Confirm `MONGO_URL` points to the intended instance.
- Confirm `DB_NAME` exists or can be created by the app.

## Auth Failures

- Confirm the user is verified before login.
- Confirm the `Authorization` header uses `Bearer <token>`.
- Confirm the token was created with the same `JWT_SECRET`.

## CORS Failures

- Confirm the browser origin is covered by `CORS_ORIGINS` or `CORS_ORIGIN_REGEX`.
- Restart the backend after changing `.env`.

## Email Failures

- Confirm SMTP host and port are correct.
- Confirm TLS and SSL settings match the provider.
- For local development, confirm the SMTP catcher is running.
