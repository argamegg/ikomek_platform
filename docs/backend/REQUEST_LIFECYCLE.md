# Request Lifecycle Notes

Municipal requests move through citizen, operator, and admin workflows.

## Citizen Flow

1. Citizen authenticates.
2. Citizen creates a request through `/api/requests`.
3. The request includes category, location, place type, problem type, reason, description, and optional photos.
4. Citizen reviews personal requests through `/api/requests`.
5. Citizen can open request details and chat messages.

## Operator Flow

1. Operator loads assigned or available requests through `/api/operator/requests`.
2. Operator reviews category, address, description, location, and status.
3. Operator updates status through `/api/operator/requests/{request_id}`.
4. Operator communicates through request messages.

## Admin Flow

1. Admin can view all requests through `/api/requests/all`.
2. Admin can review analytics through `/api/admin/analytics`.
3. Admin can coordinate user roles and news management.

## QA Notes

- Confirm citizens only see their own request list.
- Confirm operator/admin routes reject regular citizens.
- Confirm status labels remain localized in web and mobile clients.
