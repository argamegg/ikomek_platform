# Regression Plan

Run this plan before shipping changes that touch API contracts, auth, routing, or request workflows.

## Backend

- Start the backend with a local MongoDB database.
- Seed demo data.
- Run auth smoke checks.
- Create a request as a citizen.
- Update the request as an operator.
- Load analytics as an admin.

## Web

- Build the web app.
- Log in as each demo role.
- Check dashboard, requests, news, map, profile, operator, and admin pages.
- Confirm protected route redirects.

## Mobile

- Start Expo.
- Log in with at least one demo role.
- Check tabs, request creation, map, and profile.
- Confirm the configured backend URL is reachable from the test device.
