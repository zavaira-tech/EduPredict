# Role-based access and account setup

EduPredict stores registered roles on MongoDB `User` records. Public
`POST /api/auth/register` remains student-only; it does not accept administrator,
teacher, or analyst account creation. All registered users sign in through
`POST /api/auth/login`. Protected requests validate the JWT and current MongoDB
account, and role changes or password resets invalidate existing tokens.

Administrators can create teacher and analyst accounts from **Users**. An
administrator account must be provisioned by a trusted operator; never add a
public administrator-signup option. To create the first administrator, set
`ADMIN_SEED_PASSWORD` privately in PowerShell, run the idempotent seed command,
and then remove the environment variable:

```powershell
$securePassword = Read-Host "Initial administrator password" -AsSecureString
$env:ADMIN_SEED_PASSWORD = [System.Net.NetworkCredential]::new("", $securePassword).Password
npm run seed:admin
Remove-Item Env:ADMIN_SEED_PASSWORD
```

By default, the seed uses `EduPredict Admin` and `admin@edupredict.com`.
`ADMIN_SEED_NAME` and `ADMIN_SEED_EMAIL` can override those values. The password
is required and is never embedded in the script or exposed by an API. The
existing `User` save hook hashes it using bcrypt before MongoDB stores it.
Running the seed again does not create a duplicate or change an existing
account's role.

To verify the record, open the configured database's `users` collection in
MongoDB Compass and check its name, email, and `admin` role. The `password`
field should begin with a bcrypt prefix such as `$2a$12$`; it must not equal
the password entered at the prompt. Then sign in at the EduPredict login page
with `admin@edupredict.com` and the password entered during seeding.

Use the development password from your prompt only for local testing. Use a
private, strong password for any shared or deployed environment; never commit
it to `.env.example`, source control, or a public API.

Creating an account does not create its academic profile. For a teacher,
create a teacher record in **Teachers** and set its `user` field to the account
ID, then assign courses. Link student accounts to their student records in
**Students**. Teacher and student data views are limited to assigned courses
and linked personal records, respectively.

Analysts can view analytics and manage dataset registry records they created.
The current dataset form stores dataset metadata (name, filename, type, and
record count); it does not transfer or persist file contents.

## Role verification

Use a connected MongoDB database and test accounts with non-production data:

1. **Student:** register through the public signup form, sign in, and confirm
   the student dashboard and personal performance/prediction routes. Public
   registration attempts specifying `admin`, `teacher`, or `analyst` must
   return HTTP 403. Link the account to a student record to populate personal
   academic data.
2. **Teacher:** have an administrator create a teacher account and profile,
   assign a course, and enroll a test student. Sign in as that teacher and
   confirm only assigned students, class records, predictions, and alerts are
   visible.
3. **Analyst:** have an administrator create an analyst account. Confirm the
   analyst dashboard, analytics, model results, and dataset registry are
   available, while user management is denied. Dataset changes are scoped to
   records created by that analyst.
4. **Admin:** sign in with the provisioned account. Confirm user creation,
   editing, role changes, deletion, dataset administration, and system
   statistics. Public signup must not create another administrator.
5. For each account, try opening another role's dashboard URL and calling a
   restricted API directly. Frontend navigation is a usability aid; the
   backend's 401/403 response is the authorization check.

Run the backend tests with `npm --prefix backend test` and build the frontend
with `npm --prefix frontend run build`.
