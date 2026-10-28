# EduPredict

EduPredict is a Windows-first educational analytics platform foundation. It is
designed to grow into a system that ingests academic data, processes batch and
streaming events, trains predictive models, and presents role-specific
dashboards. **Docker and all other container technologies are not used.**

## Architecture

```text
CSV / academic systems                  Educational events
          |                                     |
          v                                     v
   Node/Express REST API                    Apache Kafka
          |                                     |
          +--> MongoDB                         v
          |                              Spark Structured Streaming
          |                                     |
          v                                     v
     React dashboard <--- alerts/results --- Spark / PySpark
                                                |
                                      HDFS (raw/cleaned/processed)
                                                |
                               Pandas / NumPy / scikit-learn / MLlib
```

Batch work follows `dataset -> HDFS raw -> Spark cleaning and feature
engineering -> analytics/models -> HDFS results/reports -> API/dashboard`.
Streaming follows `event -> Kafka -> Spark Structured Streaming ->
prediction/anomaly -> API alert -> dashboard`. The first project milestone
only establishes the local React application, Express API, and MongoDB
connection; it does not implement models or streaming.

### Technology responsibilities

| Technology | Responsibility |
| --- | --- |
| React, Vite | Dashboard user interface and fast local development |
| Material UI, Recharts | Accessible interface components and charts |
| Axios, React Router | HTTP communication and client-side navigation |
| Node.js, Express | REST API, authentication boundary, validation, and business logic |
| MongoDB Community Server, Mongoose | Application records and schema-based database access |
| JWT, bcrypt/bcryptjs | Stateless API authentication and password hashing (later step) |
| Java JDK | Runtime required by Hadoop, Spark, and Kafka |
| Hadoop HDFS | Distributed storage organized into raw, cleaned, processed, models, and reports |
| Apache Spark, PySpark | Distributed batch processing and Structured Streaming |
| Pandas, NumPy, scikit-learn | Python data preparation and classical machine-learning models |
| Spark MLlib | Distributed feature processing and machine-learning pipelines |
| Apache Kafka | Durable event broker for future real-time educational events |
| Git/GitHub, VS Code, Postman | Source control, development, and API testing |

### Planned application modules and roles

The backend is the authorization boundary: every protected API request will
authenticate its JWT and enforce role and record-level permissions. Hiding a
button in React is not access control. The four planned roles are Administrator
(platform and users), Teacher (assigned classes and students), Student
(personal academic data), and Analyst (approved datasets and aggregate
analysis).

The modules fit into these layers:

1. **Identity and academic records:** Authentication/authorization, user,
   student, teacher, and course management; attendance and enrollment.
2. **Data pipeline:** Dataset upload and validation, ingestion, HDFS storage,
   Spark processing, data cleaning, feature preparation, and data-quality
   checks.
3. **Analytics and prediction:** Descriptive analytics, performance/dropout/
   course-demand predictions, anomaly detection, correlations, and trends.
4. **Live operations:** Kafka events, Spark Structured Streaming, predictions
   and anomaly detection, notifications, and academic alerts.
5. **User-facing outcomes:** Administrator, Teacher, Student, and Analyst
   dashboards; reports; feedback; and support tickets.

Administrators will see platform totals and risk/course-demand summaries.
Teachers will see assigned-student attendance, performance, risks, predictions,
and alerts. Students will see only their own GPA, attendance, courses,
predictions, notifications, and tickets. Analysts will manage datasets and
review data quality, aggregate analytics, models, anomalies, and reports.
These are architectural targets; this foundation does not yet implement these
modules, roles, or predictions.

## Target project structure

The `ml/`, `bigdata/` processing, and several future application pages are
intentional placeholders for later steps. The first frontend dashboard phase
is implemented with demonstration data.

```text
EduPredict/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── dashboard/AdminDashboard.jsx
│   │   │   └── layout/AppLayout.jsx
│   │   ├── data/mockData.js
│   │   ├── styles.css
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── api/client.js
│   ├── .env.example
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── backend/
│   ├── src/
│   │   ├── config/database.js
│   │   ├── middleware/errorHandler.js
│   │   ├── routes/health.js
│   │   └── index.js
│   ├── .env.example
│   └── package.json
├── ml/                         # Python cleaning, features, training, inference
├── bigdata/
│   └── hadoop/
│       ├── core-site.xml
│       └── hdfs-site.xml
├── datasets/
│   ├── raw/
│   └── processed/
├── tests/
├── docs/
├── .gitignore
└── README.md
```

The planned HDFS layout is:

```text
/edupredict/raw/students/
/edupredict/raw/attendance/
/edupredict/raw/academics/
/edupredict/raw/lms/
/edupredict/raw/courses/
/edupredict/cleaned/
/edupredict/processed/
/edupredict/models/
/edupredict/reports/
```

When datasets are introduced, partition time-dependent records by year and
semester; include department/course partitions only where query patterns justify
them. Avoid partitioning into many tiny directories.

## Required software

Install these directly on Windows 10/11 (64-bit), not in containers:

1. Git and Visual Studio Code.
2. Node.js 22 LTS (includes npm).
3. Python 3.12 (enable the Python launcher and PATH option).
4. Eclipse Temurin JDK 17 LTS.
5. MongoDB Community Server 8.x and MongoDB Shell (`mongosh`).
6. Apache Hadoop 3.4.1 (single-node/local HDFS preparation).
7. Apache Spark 3.5.5, pre-built for Hadoop 3.
8. Apache Kafka 3.9.1 binary distribution (KRaft mode).
9. Postman (optional, for API exploration).

Use the official download pages for installers and archives:

- Node.js: <https://nodejs.org/en/download>
- Python: <https://www.python.org/downloads/windows/>
- Temurin: <https://adoptium.net/temurin/releases/>
- MongoDB Community: <https://www.mongodb.com/try/download/community>
- MongoDB Shell: <https://www.mongodb.com/try/download/shell>
- Hadoop: <https://hadoop.apache.org/releases.html>
- Spark: <https://spark.apache.org/downloads.html>
- Kafka: <https://kafka.apache.org/downloads>
- VS Code: <https://code.visualstudio.com/download>
- Postman: <https://www.postman.com/downloads/>

Choose the stated versions (or compatible newer patch releases). Restart
PowerShell after installer changes to PATH. For Hadoop, Spark, and Kafka,
extract the official binary archive to a path without spaces, for example
`C:\bigdata\hadoop`, `C:\bigdata\spark`, and `C:\bigdata\kafka`. Configure the
environment variables below in **Windows Settings > System > About > Advanced
system settings > Environment Variables**, then open a new PowerShell window:

| Variable | Example value |
| --- | --- |
| `JAVA_HOME` | `C:\Program Files\Eclipse Adoptium\jdk-17...` (use the actual installed folder) |
| `HADOOP_HOME` | `C:\bigdata\hadoop` |
| `SPARK_HOME` | `C:\bigdata\spark` |
| `KAFKA_HOME` | `C:\bigdata\kafka` |

Append these entries to the system or user `Path` (preserve existing entries):

```text
%JAVA_HOME%\bin
%HADOOP_HOME%\bin
%SPARK_HOME%\bin
%KAFKA_HOME%\bin
```

## Windows installation and verification

### 1. Install the application runtimes

In an elevated PowerShell, use `winget` where available:

```powershell
winget install --id Git.Git -e
winget install --id Microsoft.VisualStudioCode -e
winget install --id OpenJS.NodeJS.LTS -e
winget install --id Python.Python.3.12 -e
winget install --id EclipseAdoptium.Temurin.17.JDK -e
```

If a package ID is unavailable in your `winget` catalog, download the installer
from the official page above. Install MongoDB Community Server using its MSI;
select **Install MongoDB as a Service**. Install `mongosh` separately if the
server installer did not include it. Verify in a new, non-elevated PowerShell:

```powershell
git --version
code --version
node --version
npm --version
py -3.12 --version
java -version
mongosh --version
mongosh "mongodb://127.0.0.1:27017" --eval "db.runCommand({ ping: 1 })"
```

The MongoDB ping should include `"ok" : 1`. If the service is not running, open
`services.msc` and start **MongoDB Server**; alternatively, use
`Get-Service MongoDB` and `Start-Service MongoDB` in an elevated PowerShell.

### 2. Prepare Python

From the repository root, create and activate an isolated environment, then
install the initial data/ML and Spark Python libraries:

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install pandas numpy scikit-learn pyspark==3.5.5
python --version
python -c "import pandas, numpy, sklearn, pyspark; print('pandas', pandas.__version__); print('numpy', numpy.__version__); print('scikit-learn', sklearn.__version__); print('PySpark', pyspark.__version__)"
```

If PowerShell blocks activation, run
`Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` once, then activate again.
You can run `.\.venv\Scripts\python.exe` directly instead of activating.

### 3. Prepare Java, Hadoop, and HDFS

Confirm Java and the configured directories:

```powershell
java -version
where.exe java
$env:JAVA_HOME
hadoop version
```

For a local Windows HDFS installation, follow the Apache Hadoop single-node
guide's prerequisite steps, then apply the included single-node settings from
the repository root:

```powershell
Copy-Item bigdata\hadoop\core-site.xml "$env:HADOOP_HOME\etc\hadoop\core-site.xml"
Copy-Item bigdata\hadoop\hdfs-site.xml "$env:HADOOP_HOME\etc\hadoop\hdfs-site.xml"
New-Item -ItemType Directory -Force C:\edupredict\hdfs\namenode
New-Item -ItemType Directory -Force C:\edupredict\hdfs\datanode
```

In `%HADOOP_HOME%\etc\hadoop\hadoop-env.cmd`, ensure the JDK setting is
`set JAVA_HOME=%JAVA_HOME%` (or replace the right-hand side with the actual JDK
directory). Then, in a PowerShell opened as Administrator, format the
NameNode **once** with `hdfs namenode -format`, and start HDFS with
`& "$env:HADOOP_HOME\sbin\start-dfs.cmd"`. Formatting an already-used NameNode
destroys its metadata; never repeat it to troubleshoot. Windows Hadoop also
requires the matching `winutils.exe` native helper in
`%HADOOP_HOME%\bin`; Hadoop does not bundle this Windows helper in its official
binary release. Use a trusted build matching your exact Hadoop version, or
defer HDFS startup until a supported Hadoop environment is available. Do not
download executable helpers from untrusted sources. Check the setup using:

```powershell
hdfs version
hdfs dfs -ls /
```

The second command should list the HDFS root after HDFS is configured and
running. Local Hadoop/Spark Windows setups can require additional native
configuration; an installation/version check alone does not mean HDFS is
running. Shut it down with `& "$env:HADOOP_HOME\sbin\stop-dfs.cmd"` when finished.

## Frontend Phase 1: Interactive dashboard

The initial frontend provides a responsive application shell and Admin
Dashboard using mock data only. It includes a collapsible mobile navigation,
active route states, search, demonstration-role selector, theme toggle,
notification menu with read/unread actions, CSV KPI export, interactive charts,
sortable and searchable at-risk students, alerts, processing activity, and
upcoming events. Additional sidebar routes are clearly marked placeholders.
Demo risk and forecast values are illustrative; they are not generated by
trained models. The dashboard does not require the API or MongoDB.

From the repository root, install and run it directly on Windows:

```powershell
Set-Location frontend
npm install
npm run dev
```

Open the local Vite URL printed in the terminal (typically
`http://localhost:5173`). To validate the deployable frontend bundle:

```powershell
npm run build
```

### 4. Prepare Spark

Extract the Spark 3.5.5 **Pre-built for Apache Hadoop 3** archive into the
`SPARK_HOME` folder, set the environment variables above, and open a fresh
PowerShell:

```powershell
spark-submit --version
pyspark --version
```

Both should report Spark 3.5.5. Once HDFS is configured, Spark can use its
Hadoop client configuration; do not start a Spark job in this foundation step.

### 5. Prepare Kafka (no streaming implementation in Step 1)

Extract the Kafka 3.9.1 binary archive and set `KAFKA_HOME`. Kafka 3.9 supports
KRaft mode and Java 17, so ZooKeeper is not required. Verify:

```powershell
kafka-topics.bat --version
```

This step only prepares and verifies the Kafka command-line tools. Do not
initialize a Kafka cluster or build producers/consumers yet.

### 6. Install and start MongoDB

The Community Server Windows MSI can run MongoDB as a Windows service. Check
that it is active and responds:

```powershell
Get-Service MongoDB
mongosh "mongodb://127.0.0.1:27017/edupredict" --eval "db.runCommand({ ping: 1 })"
```

The local development URI is unauthenticated by default. Keep MongoDB bound to
localhost and do not expose this development database to a network. Production
MongoDB authentication, network controls, backups, and secrets management must
be configured before deployment.

## Create and run the initial applications

Open PowerShell in the repository root. Create local environment files from the
templates; `.env` files are ignored by Git:

```powershell
Copy-Item backend\.env.example backend\.env
Copy-Item frontend\.env.example frontend\.env
```

The backend connects to MongoDB before it starts listening. Edit
`backend\.env` if MongoDB uses another local port or database. Then install and
start the backend:

```powershell
Set-Location backend
npm install
npm run dev
```

Expected output includes `MongoDB connected` and an API listening message.
Leave that terminal running. In a second PowerShell at the repository root,
install and start the frontend:

```powershell
Set-Location frontend
npm install
npm run dev
```

Open the printed Vite URL (normally <http://localhost:5173>). The page should
show the EduPredict foundation and a successful API connection. Verify the API
directly in another terminal:

```powershell
Invoke-RestMethod http://localhost:5000/api/health
```

The response contains `"status": "ok"` and `"database": "connected"`.

### Environment variables

`backend/.env.example` contains the Atlas URI template, API port, and allowed
frontend origin. `frontend/.env.example` contains the API base URL. Never put
passwords, JWT signing keys, or production secrets in committed files.

### Connect the backend to MongoDB Atlas

The backend loads `backend/.env` explicitly, connects through Mongoose before
opening the HTTP port, and reports database status at `/api/health`. Atlas
credentials must be entered only in the ignored local `backend/.env` file.
`backend/.env.example` intentionally contains a password placeholder.

1. In MongoDB Atlas, create/verify the database user
   `zavaira2312f_db_user`, ensure it has read/write access to the `edupredict`
   database, and add your current public IP under **Security > Network Access**.
   Allow a few minutes for a new access-list rule to apply.
2. Open `backend/.env` in VS Code. Keep the existing `PORT` and `CORS_ORIGIN`
   lines, and set `MONGODB_URI` to the Atlas URI shown in
   `backend/.env.example`, replacing `<URL_ENCODED_PASSWORD>` locally with the
   database user's password. Do not send the password in chat, add it to source
   files, or commit `.env`. If the password contains URI-reserved characters,
   percent-encode the password portion only (for example `@` becomes `%40`).
3. If you have not created `backend/.env`, copy the template in PowerShell:

   ```powershell
   Copy-Item backend\.env.example backend\.env
   ```

4. Install dependencies and start the backend from the backend directory:

   ```powershell
   Set-Location backend
   npm install
   npm run dev
   ```

   A successful connection prints the database name and API address, not the
   connection string or password. The API starts listening only after MongoDB
   connects.
5. Test in a browser at <http://localhost:5000/api/health>, or from PowerShell:

   ```powershell
   Invoke-RestMethod http://localhost:5000/api/health
   ```

   When connected, the JSON includes `"status": "ok"`, `"server": "running"`,
   and `"database": "connected"`. The equivalent Postman request is `GET
   http://localhost:5000/api/health`.

If connection fails, check in this order:

1. Confirm the Atlas database username and password. Use the **database
   user's** credentials, not your Atlas website login.
2. Percent-encode reserved characters in the password portion of the URI.
   Do not encode the whole connection string.
3. Add the current public IP under Atlas **Network Access**. Avoid opening
   access to every IP except temporarily in a controlled environment.
4. Confirm the database user has read/write permissions for `edupredict`.
5. Confirm the Atlas cluster is available and finished provisioning.
6. Confirm the edited file is `backend/.env`, next to `backend/package.json`.
   The backend loads that path explicitly with `dotenv`; restart the backend
   after edits.
7. Check the `mongodb+srv://` URI uses host
   `cluster0.fozedbv.mongodb.net`, database `edupredict`, and the provided
   retry/write/app-name options. Do not paste credentials into logs or issue
   reports.

`MONGODB_URI` is the preferred variable. The backend temporarily accepts the
previous `MONGO_URI` name for compatibility with the existing local setup.

## Deploy as Vercel Services

The root `vercel.json` configures two services:

- `backend` uses the Express framework and `backend/src/index.js`. `/api/*`
  requests are publicly routed to it.
- `frontend` uses Vite. Remaining paths are publicly routed to its built SPA.

The backend exports its Express app for Vercel Functions and only opens a
listening port for local Node.js runs. The Vite client calls the local backend
at `http://localhost:5000/api` in development and same-origin `/api` after
production build, so the browser does not need a runtime service binding.
There are currently **no service bindings**: the frontend is a static browser
app (not a server-side service), and the backend does not call another service.

To deploy, import this repository into Vercel with the repository root as the
project root, then set `MONGODB_URI` in the backend service's Vercel environment
variables for each required deployment environment. Use the Atlas URI and
credentials configured privately for this project; never add them to Git or
`vercel.json`. `CORS_ORIGIN` is optional when using the same-origin `/api`
rewrite. Set it only if the API should accept browser requests from a separate
origin. The Vercel CLI's `vercel dev` can be used to exercise the configured
services locally; service support may depend on the Vercel CLI version/account
availability.

### Troubleshooting

- **`node`, `npm`, `py`, or `java` not recognized:** finish installation, check
  PATH/`JAVA_HOME`, and open a new terminal.
- **MongoDB connection refused:** start the MongoDB service and confirm the URI
  port matches the service listener.
- **Backend says `MONGODB_URI is required`:** create `backend\.env` from the
  example, replace the Atlas password placeholder locally, and run `npm run dev`
  from `backend`.
- **Frontend cannot reach API:** ensure both processes are running; check
  `VITE_API_BASE_URL` and `CORS_ORIGIN`, then restart Vite after editing env.
- **Python activation blocked:** use the execution-policy command above or
  invoke the virtual environment's Python executable directly.
- **Hadoop fails on Windows:** verify `JAVA_HOME`, Hadoop XML configuration,
  permissions, and a trusted `winutils.exe` matching the Hadoop version. The
  HDFS checks require the NameNode and DataNode to be running.
- **Spark or Kafka command not recognized:** verify extraction path and the
  corresponding `*_HOME\bin` PATH entry, then open a new terminal.

## Step 1 testing checklist

- [ ] Git, VS Code, Node/npm, Python 3.12, and Java 17 commands work.
- [ ] MongoDB service is running and `mongosh` ping returns `ok: 1`.
- [ ] Python virtual environment imports pandas, NumPy, scikit-learn, and PySpark.
- [ ] Hadoop and Spark versions are reported; HDFS root listing works if the
      local Windows HDFS configuration is complete.
- [ ] Kafka CLI reports its version; no Kafka streaming code is expected yet.
- [ ] Backend starts after connecting to MongoDB; `/api/health` returns `ok`.
- [ ] Vite frontend opens and displays a successful backend connection.
- [ ] `backend/.env` and `frontend/.env` are local and not committed.

**STEP 1 COMPLETE** — proceed to Step 2 only after the checklist items relevant
to your local environment are working.
