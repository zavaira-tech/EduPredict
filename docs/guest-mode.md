# Guest mode

Guest mode is a temporary, read-only product tour. It does not create a MongoDB
user or request institutional records. The dashboard's example counts, charts,
forecast, and anomaly cards are static illustrative data and are labeled as
demo content; they are not current EduPredict statistics or trained-model
outputs.

## Session and API behavior

| Method and route | Access | Behavior |
| --- | --- | --- |
| `POST /api/auth/guest` | Public | Issues a signed guest JWT, an ephemeral guest ID, and a one-hour expiry |
| `GET /api/auth/me` | Any valid session | Validates and returns the minimal session identity, including guest sessions |
| `POST /api/auth/guest/logout` | Guest JWT | Confirms guest exit; the frontend removes the token from local storage |

Guest JWTs carry `role: "guest"` and `sessionType: "guest"` and do not contain a
MongoDB user ID. Authentication validates the guest claims without querying the
user collection. The shared protected data API applies registered-user
authentication before routing, so a guest bearer token receives HTTP 403 for
academic records, analytics, model, upload, and management endpoints. Invalid
or expired tokens receive HTTP 401. Frontend navigation restrictions are an
additional UX measure, not the authorization boundary.

Guest JWTs are stateless and cannot be individually revoked server-side; logout
clears the token in the browser, and any copied token expires within one hour.
Even before expiry, a guest token cannot access the protected data API.

The Express process can start in a guest-only degraded state if
`MONGODB_URI` is missing or still contains a template password, or if MongoDB
cannot be reached. It logs this state and `/api/health` returns HTTP 503 with
`"database": "disconnected"`. Guest session creation and logout remain
available because they do not use MongoDB. Registration, registered-user
authentication, and all academic-data APIs remain unavailable until MongoDB
is configured and connected; these APIs return HTTP 503 rather than granting
access or pretending the database is healthy.

## Permission matrix

| Capability | Guest | Admin | Teacher | Student | Analyst |
| --- | --- | --- | --- | --- | --- |
| Guest demo dashboard | Yes | Not required | Not required | Not required | Not required |
| Read protected academic records | No | Existing admin scope | Existing assigned-course scope | Existing own-record scope | Existing approved analytics scope |
| Create, edit, or delete records | No | Existing admin permissions | Existing limited permissions | No | No |
| Manage users | No | Yes | No | No | No |
| Read datasets / create dataset metadata | No | Yes / Yes | No | No | Yes / No |
| Train models | No | Yes | No | No | No |

Existing registered-role authorization rules are unchanged. Guest permissions
are deny-by-default for every data API.

## Run and verify

Use the existing project setup and set `JWT_SECRET` in `backend/.env` to a
random value of at least 32 characters. To restore registered-user and
academic-data features, also replace the Atlas password placeholder in
`MONGODB_URI` with the URL-encoded database password. No secret belongs in the
frontend or source control. No database migration or dependency is required.

1. Open the sign-in page and select **Continue as Guest**.
2. Verify the browser opens `/guest`, shows **Guest Mode — Read Only**, and
   displays charts labeled **DEMO**.
3. Refresh `/guest`; the one-hour guest session is restored through
   `GET /api/auth/me`.
4. Visit a restricted route such as `/students`; the UI returns to the guest
   dashboard with an explanation.
5. Send the guest JWT to `GET /api/students` or `GET /api/ml/status`; both must
   return HTTP 403.
6. Select **Sign in / Create account**, confirm leaving guest mode, and verify
   the sign-in/register page appears without a stored guest token.
7. Test registered-user sign-in and role access as before.

Run automated checks from the repository root:

```powershell
npm --prefix backend test
npm --prefix frontend run build
```

Password reset is not implemented in the existing application; the sign-in
page's **Forgot password?** action explains that users must contact their
institution administrator.

## Example response shape

The `token` value below is deliberately a placeholder, not a usable credential:

```json
{
  "success": true,
  "token": "<signed-guest-jwt>",
  "expiresAt": "<ISO-8601 timestamp, about one hour from issuance>",
  "user": {
    "id": "<ephemeral-uuid>",
    "name": "Guest visitor",
    "role": "guest"
  }
}
```
