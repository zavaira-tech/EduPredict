import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
} from "@mui/material";
import api from "../../services/api.js";

export default function AdminStudentsPage() {
  const [students, setStudents] = useState([]);
  const [courses, setCourses] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 });
  const [search, setSearch] = useState("");
  const [course, setCourse] = useState("");
  const [department, setDepartment] = useState("");
  const [performance, setPerformance] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [details, setDetails] = useState(null);

  const loadStudents = useCallback(async (page = 1) => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/admin/students", {
        params: { page, limit: pagination.limit, search, course, department, performance },
      });
      setStudents(data.data);
      setPagination(data.pagination);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to load student records.");
    } finally {
      setLoading(false);
    }
  }, [course, department, pagination.limit, performance, search]);

  useEffect(() => {
    const timer = window.setTimeout(() => loadStudents(1), search ? 250 : 0);
    return () => window.clearTimeout(timer);
  }, [loadStudents, search]);

  useEffect(() => {
    api.get("/courses")
      .then(({ data }) => setCourses(data.data || []))
      .catch((requestError) => setError(requestError.response?.data?.message || "Unable to load course filters."));
  }, []);

  const loadDetails = async (student) => {
    setDetails({ loading: true });
    try {
      const { data } = await api.get(`/admin/students/${student._id}`);
      setDetails({ loading: false, data: data.data });
    } catch (requestError) {
      setDetails({ loading: false, error: requestError.response?.data?.message || "Unable to load student history." });
    }
  };

  return (
    <div className="dashboard-page resource-page">
      <div className="page-heading-row">
        <div>
          <div className="breadcrumb">Management <span>/</span> Students</div>
          <h1 className="greeting">Student records</h1>
          <p className="page-description">Student profiles, courses, grades, attendance, and stored predictions.</p>
        </div>
      </div>
      {error && <Alert severity="error" onClose={() => setError("")}>{error}</Alert>}
      <div className="page-heading-row">
        <TextField size="small" label="Search students" value={search} onChange={(event) => setSearch(event.target.value)} />
        <TextField size="small" label="Department" value={department} onChange={(event) => setDepartment(event.target.value)} />
        <TextField size="small" select label="Course" value={course} onChange={(event) => setCourse(event.target.value)} sx={{ minWidth: 180 }}>
          <MenuItem value="">All courses</MenuItem>
          {courses.map((item) => <MenuItem key={item._id} value={item._id}>{item.courseCode} — {item.courseName}</MenuItem>)}
        </TextField>
        <TextField size="small" select label="Performance" value={performance} onChange={(event) => setPerformance(event.target.value)} sx={{ minWidth: 160 }}>
          <MenuItem value="">All levels</MenuItem><MenuItem value="high">High GPA (3+)</MenuItem>
          <MenuItem value="medium">Medium GPA (2.5–3)</MenuItem><MenuItem value="low">Low GPA (&lt;2.5)</MenuItem>
        </TextField>
      </div>
      <Paper className="resource-table-panel" elevation={0}>
        {loading ? <div className="loading-view"><CircularProgress size={26} /></div> : students.length ? (
          <>
            <div className="table-scroll">
              <Table size="small">
                <TableHead><TableRow><TableCell>Student</TableCell><TableCell>Student ID</TableCell><TableCell>Department / program</TableCell><TableCell>Semester</TableCell><TableCell>GPA</TableCell><TableCell>Attendance</TableCell><TableCell>Actions</TableCell></TableRow></TableHead>
                <TableBody>{students.map((student) => (
                  <TableRow key={student._id}>
                    <TableCell>{student.user?.name || student.name}<br /><small>{student.user?.email || student.email}</small></TableCell>
                    <TableCell>{student.studentId}</TableCell>
                    <TableCell>{student.department} / {student.program}</TableCell>
                    <TableCell>{student.semester}</TableCell>
                    <TableCell>{Number(student.gpa || 0).toFixed(2)}</TableCell>
                    <TableCell>{Number(student.attendancePercentage || 0)}%</TableCell>
                    <TableCell><Button size="small" onClick={() => loadDetails(student)}>View academic history</Button></TableCell>
                  </TableRow>
                ))}</TableBody>
              </Table>
            </div>
            <TablePagination
              component="div"
              count={pagination.total}
              page={pagination.page - 1}
              rowsPerPage={pagination.limit}
              rowsPerPageOptions={[10, 20, 50, 100]}
              onPageChange={(_, page) => loadStudents(page + 1)}
              onRowsPerPageChange={(event) => setPagination((current) => ({ ...current, page: 1, limit: Number(event.target.value) }))}
            />
          </>
        ) : <div className="resource-empty"><h2>No students found</h2><p>Change the filters or add student profiles.</p></div>}
      </Paper>
      <Dialog open={Boolean(details)} onClose={() => setDetails(null)} fullWidth maxWidth="lg">
        <DialogTitle>Student academic history</DialogTitle>
        <DialogContent>
          {details?.loading ? <CircularProgress size={24} /> : details?.error ? <Alert severity="error">{details.error}</Alert> : details?.data && (
            <div className="resource-form">
              <h3>{details.data.student.name} · {details.data.student.studentId}</h3>
              <h4>Performance</h4>
              <Table size="small"><TableHead><TableRow><TableCell>Course</TableCell><TableCell>Score</TableCell><TableCell>Grade</TableCell><TableCell>GPA</TableCell><TableCell>Date</TableCell></TableRow></TableHead>
                <TableBody>{details.data.performance.map((record) => <TableRow key={record._id}>
                  <TableCell>{record.course?.courseCode || "—"}</TableCell><TableCell>{record.totalScore ?? "—"}</TableCell><TableCell>{record.grade || "—"}</TableCell><TableCell>{record.gpa ?? "—"}</TableCell><TableCell>{new Date(record.createdAt).toLocaleDateString()}</TableCell>
                </TableRow>)}{!details.data.performance.length && <TableRow><TableCell colSpan={5}>No performance records.</TableCell></TableRow>}</TableBody>
              </Table>
              <h4>Attendance</h4>
              <Table size="small"><TableHead><TableRow><TableCell>Course</TableCell><TableCell>Status</TableCell><TableCell>Date</TableCell></TableRow></TableHead>
                <TableBody>{details.data.attendance.map((record) => <TableRow key={record._id}>
                  <TableCell>{record.course?.courseCode || "—"}</TableCell><TableCell>{record.status}</TableCell><TableCell>{new Date(record.date).toLocaleDateString()}</TableCell>
                </TableRow>)}{!details.data.attendance.length && <TableRow><TableCell colSpan={3}>No attendance records.</TableCell></TableRow>}</TableBody>
              </Table>
              <h4>Predictions</h4>
              {details.data.predictions.length
                ? details.data.predictions.map((record) => <p key={record._id}>{record.predictionType}: {record.predictedGrade || record.prediction} · Risk: {record.riskLevel || "not provided"}</p>)
                : <p>No prediction records.</p>}
            </div>
          )}
        </DialogContent>
        <DialogActions><Button onClick={() => setDetails(null)}>Close</Button></DialogActions>
      </Dialog>
    </div>
  );
}
