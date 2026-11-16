# Role-based access and account setup

EduPredict stores registered roles on MongoDB `User` records. Public
`POST /api/auth/register` remains student-only; it does not accept administrator,
teacher, or analyst account creation. All registered users sign in through
`POST /api/auth/login`. Protected requests validate the JWT and current MongoDB
account, and role changes or password resets invalidate existing tokens.

Administrators can create teacher and analyst accounts from **Users**. An
administrator account must be provisioned by a trusted operator; never add a
public administrator-signup option. For a first administrator:

1. In PowerShell, enter a strong initial password without echoing it and
   generate its bcrypt hash from the backend directory:

   ```powershell
   $securePassword = Read-Host "Initial administrator password" -AsSecureString
   $env:ADMIN_PASSWORD = [System.Net.NetworkCredential]::new("", $securePassword).Password
   node --input-type=module -e "import bcrypt from 'bcryptjs'; console.log(await bcrypt.hash(process.env.ADMIN_PASSWORD, 12))"
   Remove-Item Env:ADMIN_PASSWORD
   ```

2. Connect `mongosh` to the configured MongoDB database and insert a `users`
   document with `name`, unique lowercase `email`, the generated hash as
   `password`, `role: "admin"`, `tokenVersion: 0`, and timestamps. Do not insert
   a plaintext password or commit the hash or credentials to source control.
3. Sign in through the app and create accounts from the administrator's
   **Users** page.

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
