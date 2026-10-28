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

The empty directories are intentional placeholders for later steps.

```text
EduPredict/
├── frontend/
│   ├── src/
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

`backend/.env.example` contains local API port, MongoDB URI, and allowed
frontend origin. `frontend/.env.example` contains the API base URL. Never put
passwords, JWT signing keys, or production secrets in committed files.

### Troubleshooting

- **`node`, `npm`, `py`, or `java` not recognized:** finish installation, check
  PATH/`JAVA_HOME`, and open a new terminal.
- **MongoDB connection refused:** start the MongoDB service and confirm the URI
  port matches the service listener.
- **Backend says `MONGO_URI is required`:** create `backend\.env` from the
  example and run `npm run dev` from `backend`.
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
