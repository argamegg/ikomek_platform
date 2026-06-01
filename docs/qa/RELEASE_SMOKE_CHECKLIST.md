# Release Smoke Checklist

Use this lightweight checklist before pushing or demoing a release branch.

## Build And Lint

- Web build completes.
- Web lint completes or known issues are documented.
- Mobile lint completes or known issues are documented.
- Backend imports without configuration surprises.

## Product Flows

- Citizen can log in.
- Citizen can create a request.
- Operator can update request status.
- Admin can manage news or users.
- Public news and map pages load.

## Environment

- Required `.env` files are present.
- Backend URL is correct in web and mobile clients.
- MongoDB and SMTP settings point to the intended environment.
