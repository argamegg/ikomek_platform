# Role QA Matrix

Use this matrix to confirm role boundaries across backend, web, and mobile.

| Capability | Citizen | Operator | Admin |
| --- | --- | --- | --- |
| Register and verify email | Yes | Seeded or admin-managed | Seeded or admin-managed |
| Create requests | Yes | Optional | Optional |
| View own requests | Yes | Yes | Yes |
| View all requests | No | Yes | Yes |
| Update request status | No | Yes | Yes |
| Manage news | No | No | Yes |
| Manage user roles | No | No | Yes |
| View admin analytics | No | No | Yes |

## Regression Checks

- Citizen cannot open admin-only API routes.
- Operator can access operator routes but not admin-only user management.
- Admin can access both admin and operator workflows.
- Web and mobile navigation match the authenticated role.
