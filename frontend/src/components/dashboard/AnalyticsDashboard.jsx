import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  CircularProgress,
  MenuItem,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import api from "../../services/api.js";

function ChartPanel({ title, children }) {
  return (
    <Paper className="analytics-panel" elevation={0}>
      <Typography className="panel-title">{title}</Typography>
      {children}
    </Paper>
  );
}

function Metric({ label, value }) {
  return (
    <Paper className="kpi-card analytics-metric" elevation={0}>
      <div className="kpi-heading">{label}</div>
      <div className="kpi-value">{value ?? "—"}</div>
    </Paper>
  );
}

const emptyAnalytics = {
  overview: null,
  trends: [],
  performance: null,
  attendance: null,
  courses: [],
  departments: [],
  semesters: [],
  correlations: null,
  students: { students: [], pagination: {} },
  atRisk: { students: [], methodology: "" },
  anomalies: { anomalies: [] },
};

function formatPercent(value) {
  return Number.isFinite(value) ? `${value}%` : "—";
}

export default function AnalyticsDashboard({ user }) {
  const [filters, setFilters] = useState({
    from: "",
    to: "",
    academicYear: "",
    semester: "",
    department: "",
    course: "",
  });
  const [search, setSearch] = useState("");
  const [analytics, setAnalytics] = useState(emptyAnalytics);
  const [courseOptions, setCourseOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const canManageAnomalies = ["admin", "analyst"].includes(user?.role);

  const requestFilters = useMemo(() => {
    const params = Object.fromEntries(
      Object.entries(filters).filter(([, value]) => value !== ""),
    );
    if (search.trim()) params.search = search.trim();
    return params;
  }, [filters, search]);

  const loadAnalytics = useCallback(async () => {
    setError("");
    setRefreshing(true);
    try {
      const requests = [
        api.get("/analytics/overview", { params: requestFilters }),
        api.get("/analytics/trends", { params: requestFilters }),
        api.get("/analytics/performance", { params: requestFilters }),
        api.get("/analytics/attendance", { params: requestFilters }),
        api.get("/analytics/courses", { params: requestFilters }),
        api.get("/analytics/departments", { params: requestFilters }),
        api.get("/analytics/semesters", { params: requestFilters }),
        api.get("/analytics/correlations", { params: requestFilters }),
        api.get("/analytics/students", { params: { ...requestFilters, limit: 10 } }),
        api.get("/analytics/at-risk-students", { params: { ...requestFilters, limit: 8 } }),
      ];
      if (canManageAnomalies) {
        requests.push(api.get("/analytics/anomalies", { params: { limit: 10 } }));
      }
      const results = await Promise.all(requests);
      const next = {
        overview: results[0].data.data,
        trends: results[1].data.data,
        performance: results[2].data.data,
        attendance: results[3].data.data,
        courses: results[4].data.data,
        departments: results[5].data.data,
        semesters: results[6].data.data,
        correlations: results[7].data.data,
        students: results[8].data.data,
        atRisk: results[9].data.data,
        anomalies: canManageAnomalies ? results[10].data.data : { anomalies: [] },
      };
      setAnalytics(next);
      setCourseOptions(next.courses);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to load analytics from academic records.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [canManageAnomalies, requestFilters]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  const exportCsv = async (type) => {
    try {
      const response = await api.get(`/analytics/export/${type}`, {
        params: requestFilters,
        responseType: "blob",
      });
      const url = URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${type}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to export this report.");
    }
  };

  const detectAnomalies = async () => {
    setNotice("");
    try {
      const { data } = await api.post("/analytics/anomalies/detect", filters);
      setNotice(`Detection complete: ${data.data.candidates} candidate(s) found.`);
      await loadAnalytics();
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to run anomaly detection.");
    }
  };

  const updateAnomaly = async (id, status) => {
    try {
      await api.put(`/analytics/anomalies/${id}/status`, { status });
      await loadAnalytics();
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to update the anomaly.");
    }
  };

  if (loading) return <div className="loading-view"><CircularProgress size={26} /></div>;

  const overview = analytics.overview || {};
  const performance = analytics.performance || {};
  const attendance = analytics.attendance || {};
  const scoreComparison = [
    { assessment: "Assignment", score: performance.summary?.assignmentScore },
    { assessment: "Quiz", score: performance.summary?.quizScore },
    { assessment: "Midterm", score: performance.summary?.midtermScore },
    { assessment: "Final", score: performance.summary?.finalScore },
    { assessment: "Overall", score: performance.summary?.overallScore },
  ].filter((item) => Number.isFinite(item.score));

  return (
    <div className="dashboard-page">
      <div className="page-heading-row">
        <div>
          <div className="breadcrumb">Insights <span>/</span> Analytics</div>
          <h1 className="greeting">Academic analytics</h1>
          <p className="page-description">Aggregated from the academic records you are authorized to view.</p>
        </div>
        <div className="analytics-actions">
          <Button variant="outlined" onClick={() => window.print()}>Print / Save PDF</Button>
          <Button variant="outlined" onClick={() => exportCsv("performance")}>Performance CSV</Button>
          <Button variant="outlined" onClick={() => exportCsv("attendance")}>Attendance CSV</Button>
          <Button variant="outlined" onClick={() => exportCsv("departments")}>Departments CSV</Button>
          <Button variant="outlined" onClick={() => exportCsv("courses")}>Courses CSV</Button>
          <Button variant="outlined" onClick={() => exportCsv("at-risk-students")}>Export at-risk CSV</Button>
        </div>
      </div>
      {error && <Alert severity="error" onClose={() => setError("")}>{error}</Alert>}
      {notice && <Alert severity="success" onClose={() => setNotice("")}>{notice}</Alert>}

      <Paper className="analytics-filters" elevation={0}>
        <TextField label="From" type="date" size="small" value={filters.from} InputLabelProps={{ shrink: true }} onChange={(event) => setFilters({ ...filters, from: event.target.value })} />
        <TextField label="To" type="date" size="small" value={filters.to} InputLabelProps={{ shrink: true }} onChange={(event) => setFilters({ ...filters, to: event.target.value })} />
        <TextField label="Academic year" size="small" value={filters.academicYear} onChange={(event) => setFilters({ ...filters, academicYear: event.target.value })} />
        <TextField label="Semester" select size="small" value={filters.semester} onChange={(event) => setFilters({ ...filters, semester: event.target.value })}>
          <MenuItem value="">All semesters</MenuItem>
          {Array.from({ length: 12 }, (_, index) => <MenuItem key={index + 1} value={index + 1}>{index + 1}</MenuItem>)}
        </TextField>
        <TextField label="Department" size="small" value={filters.department} onChange={(event) => setFilters({ ...filters, department: event.target.value })} />
        <TextField label="Course" select size="small" value={filters.course} onChange={(event) => setFilters({ ...filters, course: event.target.value })}>
          <MenuItem value="">All courses</MenuItem>
          {courseOptions.map((course) => <MenuItem key={course.courseId} value={course.courseId}>{course.courseCode} · {course.courseName}</MenuItem>)}
        </TextField>
        <Button variant="contained" disabled={refreshing} onClick={loadAnalytics}>{refreshing ? "Updating…" : "Update"}</Button>
      </Paper>

      <div className="analytics-metrics">
        <Metric label="Total students" value={overview.totalStudents?.toLocaleString()} />
        <Metric label="Average GPA" value={Number.isFinite(overview.averageGpa) ? overview.averageGpa.toFixed(2) : "—"} />
        <Metric label="Average attendance" value={formatPercent(overview.averageAttendance)} />
        <Metric label="Pass percentage" value={formatPercent(overview.passPercentage)} />
        <Metric label="Fail percentage" value={formatPercent(overview.failPercentage)} />
        <Metric label="At-risk students" value={overview.atRiskStudents?.toLocaleString()} />
        <Metric label="Total courses" value={overview.totalCourses?.toLocaleString()} />
        <Metric label="Performance score" value={formatPercent(overview.academicPerformanceScore)} />
      </div>

      <div className="analytics-grid">
        <ChartPanel title="Academic and attendance trends">
          {analytics.trends.length ? (
            <div className="analytics-chart"><ResponsiveContainer width="100%" height="100%">
              <LineChart data={analytics.trends}>
                <CartesianGrid vertical={false} stroke="#edf0f5" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} />
                <YAxis yAxisId="score" domain={[0, 100]} axisLine={false} tickLine={false} />
                <Tooltip />
                <Line yAxisId="score" dataKey="attendance" name="Attendance %" stroke="#356ae6" connectNulls />
                <Line yAxisId="score" dataKey="averageScore" name="Average score" stroke="#14a991" connectNulls />
              </LineChart>
            </ResponsiveContainer></div>
          ) : <div className="resource-empty"><h2>No trend records</h2><p>Trend charts appear when dated academic records are available.</p></div>}
        </ChartPanel>
        <ChartPanel title="Grade distribution">
          {performance.gradeDistribution?.length ? (
            <div className="analytics-chart"><ResponsiveContainer width="100%" height="100%">
              <BarChart data={performance.gradeDistribution}>
                <CartesianGrid vertical={false} stroke="#edf0f5" />
                <XAxis dataKey="grade" axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} axisLine={false} tickLine={false} />
                <Tooltip />
                <Bar dataKey="count" name="Records" fill="#7898e8" radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer></div>
          ) : <div className="resource-empty"><h2>No grade records</h2><p>Grade distribution is based on saved performance records.</p></div>}
        </ChartPanel>
        <ChartPanel title="Score comparison">
          {scoreComparison.length ? (
            <div className="analytics-chart"><ResponsiveContainer width="100%" height="100%">
              <BarChart data={scoreComparison}>
                <CartesianGrid vertical={false} stroke="#edf0f5" />
                <XAxis dataKey="assessment" axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} axisLine={false} tickLine={false} />
                <Tooltip />
                <Bar dataKey="score" name="Average score" fill="#7898e8" radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer></div>
          ) : <div className="resource-empty"><h2>No score records</h2><p>Assessment averages use saved performance records.</p></div>}
        </ChartPanel>
        <ChartPanel title="Semester performance">
          {analytics.semesters.length ? (
            <div className="analytics-chart"><ResponsiveContainer width="100%" height="100%">
              <LineChart data={analytics.semesters}>
                <CartesianGrid vertical={false} stroke="#edf0f5" />
                <XAxis dataKey="semester" tickFormatter={(value) => `S${value}`} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 4]} axisLine={false} tickLine={false} />
                <Tooltip />
                <Line dataKey="averageGpa" name="Average GPA" stroke="#8d74d8" connectNulls />
              </LineChart>
            </ResponsiveContainer></div>
          ) : <div className="resource-empty"><h2>No semester records</h2><p>Semester trends require saved performance records.</p></div>}
        </ChartPanel>
        <ChartPanel title="Course performance">
          {performance.coursePerformance?.length ? (
            <div className="analytics-chart"><ResponsiveContainer width="100%" height="100%">
              <BarChart data={performance.coursePerformance}>
                <CartesianGrid vertical={false} stroke="#edf0f5" />
                <XAxis dataKey="courseCode" axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} axisLine={false} tickLine={false} />
                <Tooltip />
                <Bar dataKey="averageScore" name="Average score" fill="#14a991" radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer></div>
          ) : <div className="resource-empty"><h2>No course performance</h2><p>Course scores appear when performance records are available.</p></div>}
        </ChartPanel>
        <ChartPanel title="Department comparison">
          {analytics.departments.length ? (
            <div className="analytics-chart"><ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.departments}>
                <CartesianGrid vertical={false} stroke="#edf0f5" />
                <XAxis dataKey="department" axisLine={false} tickLine={false} />
                <YAxis yAxisId="gpa" domain={[0, 4]} axisLine={false} tickLine={false} />
                <Tooltip />
                <Bar yAxisId="gpa" dataKey="averageGpa" name="Average GPA" fill="#8d74d8" radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer></div>
          ) : <div className="resource-empty"><h2>No department records</h2><p>Department comparisons appear when academic records are available.</p></div>}
        </ChartPanel>
        <ChartPanel title="Attendance by course">
          {attendance.courseAttendance?.length ? (
            <div className="analytics-chart"><ResponsiveContainer width="100%" height="100%">
              <BarChart data={attendance.courseAttendance}>
                <CartesianGrid vertical={false} stroke="#edf0f5" />
                <XAxis dataKey="courseCode" axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} unit="%" axisLine={false} tickLine={false} />
                <Tooltip />
                <Bar dataKey="attendance" name="Attendance" fill="#e5a84e" radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer></div>
          ) : <div className="resource-empty"><h2>No attendance records</h2><p>Attendance is calculated from present and late records.</p></div>}
        </ChartPanel>
        <ChartPanel title="Weekly attendance">
          {attendance.weekly?.length ? (
            <div className="analytics-chart"><ResponsiveContainer width="100%" height="100%">
              <LineChart data={attendance.weekly}>
                <CartesianGrid vertical={false} stroke="#edf0f5" />
                <XAxis dataKey="week" axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} unit="%" axisLine={false} tickLine={false} />
                <Tooltip />
                <Line dataKey="attendance" name="Attendance" stroke="#e5a84e" connectNulls />
              </LineChart>
            </ResponsiveContainer></div>
          ) : <div className="resource-empty"><h2>No weekly attendance</h2><p>Weekly metrics appear for dated attendance records.</p></div>}
        </ChartPanel>
        <ChartPanel title="Course enrollment">
          {analytics.courses.length ? (
            <div className="analytics-chart"><ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.courses}>
                <CartesianGrid vertical={false} stroke="#edf0f5" />
                <XAxis dataKey="courseCode" axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} axisLine={false} tickLine={false} />
                <Tooltip />
                <Bar dataKey="enrollments" name="Enrollments" fill="#8d74d8" radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer></div>
          ) : <div className="resource-empty"><h2>No enrollment records</h2><p>Course popularity is based on saved enrollment records.</p></div>}
        </ChartPanel>
        <ChartPanel title="Attendance and GPA correlation">
          {analytics.correlations?.points?.length ? (
            <>
              <div className="analytics-chart"><ResponsiveContainer width="100%" height="100%">
                <ScatterChart>
                  <CartesianGrid />
                  <XAxis type="number" dataKey="attendance" name="Attendance" unit="%" domain={[0, 100]} />
                  <YAxis type="number" dataKey="gpa" name="GPA" domain={[0, 4]} />
                  <Tooltip cursor={{ strokeDasharray: "3 3" }} />
                  <Scatter data={analytics.correlations.points} fill="#356ae6" />
                </ScatterChart>
              </ResponsiveContainer></div>
              <div className="correlation-results">
                {analytics.correlations.relationships?.map((relationship) => (
                  <Typography key={`${relationship.x}-${relationship.y}`} variant="body2">
                    {relationship.x} ↔ {relationship.y}: r = {relationship.coefficient ?? "not enough variation"} (n={relationship.sampleSize})
                  </Typography>
                ))}
                <Typography variant="body2">{analytics.correlations.explanation}</Typography>
              </div>
            </>
          ) : <div className="resource-empty"><h2>Insufficient paired records</h2><p>Correlation needs at least two students with attendance and GPA values.</p></div>}
        </ChartPanel>
      </div>

      <ChartPanel title="Student analytics">
        <TextField label="Search students" size="small" value={search} onChange={(event) => setSearch(event.target.value)} sx={{ mb: 1.5, maxWidth: 360 }} />
        <div className="analytics-table-wrap">
          <Table size="small">
            <TableHead><TableRow><TableCell>Student</TableCell><TableCell>Department</TableCell><TableCell>Semester</TableCell><TableCell>GPA</TableCell><TableCell>Attendance</TableCell><TableCell>Risk</TableCell></TableRow></TableHead>
            <TableBody>{analytics.students.students.map((student) => (
              <TableRow key={student.studentId}>
                <TableCell>{student.name} <span className="analytics-subtext">{student.recordId}</span></TableCell>
                <TableCell>{student.department}</TableCell><TableCell>{student.semester}</TableCell>
                <TableCell>{Number.isFinite(student.gpa) ? student.gpa.toFixed(2) : "—"}</TableCell>
                <TableCell>{formatPercent(student.attendance)}</TableCell>
                <TableCell>{student.risk.level}</TableCell>
              </TableRow>
            ))}</TableBody>
          </Table>
        </div>
        {!analytics.students.students.length && <div className="resource-empty"><h2>No matching students</h2><p>Try adjusting the selected filters or search.</p></div>}
      </ChartPanel>

      <ChartPanel title="At-risk student support indicators">
        <div className="analytics-actions">
          <Button variant="outlined" onClick={() => exportCsv("at-risk-students")}>Export CSV</Button>
        </div>
        <Alert severity="info" sx={{ my: 1 }}>{analytics.atRisk.methodology}</Alert>
        <div className="analytics-table-wrap">
          <Table size="small">
            <TableHead><TableRow><TableCell>Student</TableCell><TableCell>Department</TableCell><TableCell>Risk</TableCell><TableCell>Factors</TableCell></TableRow></TableHead>
            <TableBody>{analytics.atRisk.students.map((student) => (
              <TableRow key={student.studentId}>
                <TableCell>{student.name} <span className="analytics-subtext">{student.recordId}</span></TableCell>
                <TableCell>{student.department}</TableCell><TableCell>{student.risk.level}</TableCell>
                <TableCell>{student.risk.factors.join(" ") || "No recorded risk factors."}</TableCell>
              </TableRow>
            ))}</TableBody>
          </Table>
        </div>
        {!analytics.atRisk.students.length && <div className="resource-empty"><h2>No students meet the current indicators</h2><p>This is based only on the filtered real academic records.</p></div>}
      </ChartPanel>

      {canManageAnomalies && (
        <ChartPanel title="Anomaly management">
          <div className="analytics-actions">
            <Button variant="contained" onClick={detectAnomalies}>Run detection on current data</Button>
            <Button variant="outlined" onClick={() => exportCsv("anomalies")}>Export anomalies CSV</Button>
          </div>
          <div className="analytics-table-wrap">
            <Table size="small">
              <TableHead><TableRow><TableCell>Detected</TableCell><TableCell>Type</TableCell><TableCell>Severity</TableCell><TableCell>Description</TableCell><TableCell>Status</TableCell><TableCell>Review action</TableCell></TableRow></TableHead>
              <TableBody>{analytics.anomalies.anomalies.map((anomaly) => (
                <TableRow key={anomaly._id}>
                  <TableCell>{new Date(anomaly.detectedAt).toLocaleDateString()}</TableCell>
                  <TableCell>{anomaly.anomalyType}</TableCell><TableCell>{anomaly.severity}</TableCell>
                  <TableCell>{anomaly.description}</TableCell><TableCell>{anomaly.status}</TableCell>
                  <TableCell>
                    {anomaly.status === "New" && <Button size="small" onClick={() => updateAnomaly(anomaly._id, "Reviewed")}>Review</Button>}
                    {!["Resolved", "Dismissed"].includes(anomaly.status) && <Button size="small" onClick={() => updateAnomaly(anomaly._id, "Resolved")}>Resolve</Button>}
                    {!["Resolved", "Dismissed"].includes(anomaly.status) && <Button size="small" color="error" onClick={() => updateAnomaly(anomaly._id, "Dismissed")}>Dismiss</Button>}
                  </TableCell>
                </TableRow>
              ))}</TableBody>
            </Table>
          </div>
          {!analytics.anomalies.anomalies.length && <div className="resource-empty"><h2>No anomalies yet</h2><p>Run detection to evaluate current records using the documented statistical checks.</p></div>}
        </ChartPanel>
      )}
    </div>
  );
}
