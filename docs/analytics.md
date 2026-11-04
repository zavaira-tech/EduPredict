# Academic analytics

The analytics API reads the existing MongoDB `Student`, `Course`, `Enrollment`,
`Attendance`, and `Performance` collections. It does not seed or invent chart
values. All `/api/analytics` routes require a valid JWT. Admins and analysts
can review anomalies; teachers are restricted to their assigned courses and
students; students are restricted to the student record linked to their user.
Record scoping is enforced in the backend, not only in the UI.

## Filters and pagination

Analytics routes accept these optional query parameters:

| Parameter | Meaning |
| --- | --- |
| `from`, `to` | Inclusive date bounds; applied to performance `createdAt` and attendance `date` |
| `academicYear` | Matches academic-period metadata on performance/attendance records and enrollment records |
| `semester` | Matches semester performance, attendance, and enrollment records |
| `department` | Student/course department |
| `course`, `student` | MongoDB document IDs; access is checked against the caller's role |
| `page`, `limit` | Student and anomaly pagination; limit is 1–100 |
| `search` | Student name/ID/department or anomaly text search |

Attendance percentages are present plus late records divided by saved attendance
records. A passing performance record has `totalScore >= 50`; fail percentage
uses the corresponding records with scores below 50. Empty datasets return
`null` for undefined percentages and averages. Student summary fields are used
only as an all-time fallback when no relevant raw records or period filters are
available. New attendance and performance entries inherit the latest matching
enrollment's academic year and semester when those values are omitted. Records
created before these fields existed cannot be assigned reliably to a historic
academic year; year-filtered results intentionally exclude such records rather
than guessing.

## API routes

| Method and route | Roles | Result |
| --- | --- | --- |
| `GET /api/analytics/overview` | All four roles | Student/course counts, average GPA/attendance, pass/fail, risk count, score |
| `GET /api/analytics/students` | All four roles | Searchable, paginated student summaries and risk factors |
| `GET /api/analytics/performance` | All four roles | Score means, GPA, pass/fail, grade, semester, course, and department breakdowns |
| `GET /api/analytics/attendance` | All four roles | Daily, course, department, and student attendance |
| `GET /api/analytics/courses` | All four roles | Enrollments, completion counts, GPA, attendance, and failure rate |
| `GET /api/analytics/departments` | All four roles | Enrollment, GPA, attendance, and pass/fail comparison |
| `GET /api/analytics/semesters` | All four roles | Semester performance and enrollment trends |
| `GET /api/analytics/correlations` | All four roles | Pearson association and paired scatter points |
| `GET /api/analytics/trends` | All four roles | Monthly dated attendance, performance, and enrollment |
| `GET /api/analytics/at-risk-students` | All four roles | Paginated preliminary support indicators |
| `GET /api/analytics/anomalies` | Admin, analyst | Searchable and filterable anomaly list |
| `GET /api/analytics/anomalies/:id` | Admin, analyst | Anomaly evidence and review information |
| `POST /api/analytics/anomalies/detect` | Admin, analyst | Detect and persist current statistical/rule-based flags |
| `PUT /api/analytics/anomalies/:id/status` | Admin, analyst | Set status to `Reviewed`, `Resolved`, or `Dismissed` |
| `GET /api/analytics/export/:type` | Role-scoped | CSV: `performance`, `attendance`, `departments`, `courses`, `at-risk-students`; anomalies are admin/analyst only |

Exports are capped at 10,000 rows. Spreadsheet-formula-like text is escaped in
CSV cells. The dashboard's **Print / Save PDF** action uses the browser's print
dialog; no server-generated PDF dependency is introduced.

## Formulas and limitations

* **Pearson correlation:** covariance divided by the product of standard
  deviations, using only paired finite values. A constant or too-small sample
  returns no coefficient. Correlation is association, not causation.
* **At-risk rule score:** +2 for attendance below 75%, +2 for GPA below 2.00,
  +1 per failed course (capped at +2), and +1 if the three latest scores average
  below the preceding three. Low risk is below 2, medium is 2–3, and high is 4
  or more. This is a preliminary support indicator, not a validated prediction
  and must not be used to penalize students.
* **Performance anomalies:** IQR lower fence (`Q1 - 1.5 × IQR`) and z-score
  below -2 are used on student averages when the selected population has at
  least four students. A three-record moving average is compared with the
  preceding three records; a decline of at least 15 points is flagged.
* **Attendance anomalies:** the 75% rule, repeated absences (at least three
  absences and below 75%), and IQR outliers are recorded with their evidence.
* **Course anomalies:** IQR identifies unusually low active enrollment when
  there are at least four courses; a failure rate of at least 50% is flagged
  after four performance records.
* **Data-quality anomalies:** students without scoped performance or attendance
  records are reported as completeness flags. The current schema does not
  identify class sessions, so duplicate attendance on the same day is not
  assumed to be invalid.

Anomaly records have a per-day event key to avoid duplicate active records when
detection runs repeatedly. Resolved or dismissed events are not reopened by
same-day reruns. New events on a later day can be recorded again.

Attendance APIs also return daily, weekly, and monthly distributions. Semester
attendance history is reported only where attendance records carry a semester;
the system does not infer a past semester from a student's current semester.

## Optional Python service

The Node API remains usable without the Python service and calculates
correlations locally. If configured, it sends only paired numeric arrays to the
Python service; no database credentials or student identifiers are sent.
The service also exposes a protected IQR/z-score endpoint for numerical series.
Simple statistical checks are used instead of unnecessary machine learning.

From PowerShell at the repository root:

```powershell
py -3.12 -m venv analytics-service\.venv
analytics-service\.venv\Scripts\Activate.ps1
python -m pip install -r analytics-service\requirements.txt
$env:ANALYTICS_SERVICE_API_KEY = [guid]::NewGuid().ToString("N")
uvicorn app:app --app-dir analytics-service --host 127.0.0.1 --port 8000
```

Set the same secret in `backend/.env`:

```dotenv
ANALYTICS_SERVICE_URL=http://127.0.0.1:8000
ANALYTICS_SERVICE_API_KEY=<same-random-secret>
```

Restart the backend after configuring these optional values. If either value is
present, both are required and service errors are returned explicitly rather
than silently falling back. Do not expose the Python service publicly without
TLS and network access controls.

## Tests

From the repository root, run `npm --prefix backend test`. The tests cover the
correlation calculation, risk thresholds, quartile interpolation, and CSV
escaping. Build the dashboard with `npm --prefix frontend run build`.
