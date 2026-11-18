import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Autocomplete,
  Alert,
  Box,
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
  TableRow,
  TextField,
} from "@mui/material";
import api from "../services/api.js";

const definitions = {
  students: {
    title: "Students", fields: [
      ["studentId", "Student ID", "text", true], ["name", "Name", "text", true],
      ["email", "Email", "email", true], ["department", "Department", "text", true],
      ["program", "Program", "text", true], ["semester", "Semester", "number", true],
      ["user", "User account ID"], ["gender", "Gender"], ["age", "Age", "number"], ["attendancePercentage", "Attendance %", "number"],
      ["gpa", "GPA", "number"], ["academicStatus", "Academic status"],
    ], actions: ["add", "edit", "delete"], columns: ["studentId", "name", "email", "department", "program", "semester", "gpa"],
  },
  teachers: {
    title: "Teachers", fields: [
      ["user", "User Account ID", "teacherUserRef", true],
      ["name", "Name", "text", true, { readOnly: true }],
      ["email", "Email", "email", true, { readOnly: true }],
      ["department", "Department", "text", true],
      ["specialization", "Specialization", "text", false],
    ], actions: ["add", "edit", "delete"], columns: ["teacherId", "name", "email", "department", "specialization"],
  },
  courses: {
    title: "Courses", fields: [
      ["courseCode", "Course code", "text", true], ["courseName", "Course name", "text", true],
      ["department", "Department", "text", true], ["credits", "Credits", "credits", true],
      ["teacher", "Teacher", "teacherRef"], ["semester", "Semester", "semester", true],
    ], actions: ["add", "edit", "delete"], columns: ["courseCode", "courseName", "department", "credits", "semester"],
  },
  enrollments: {
    title: "Enrollments", fields: [
      ["student", "Student", "studentRef", true],
      ["course", "Course", "courseRef", true],
      ["academicYear", "Academic year", "text", true],
      ["semester", "Semester", "number", true],
      ["enrolledAt", "Enrollment date", "date"],
      ["status", "Status", "select", true, ["active", "completed", "dropped"]],
    ], actions: ["add", "edit", "delete"],
    columns: ["student", "course", "academicYear", "semester", "enrolledAt", "status"],
  },
  attendance: {
    title: "Attendance", fields: [
      ["student", "Student record ID", "text", true], ["course", "Course record ID", "text", true],
      ["date", "Date", "date", true], ["status", "Status", "select", true, ["Present", "Absent", "Late"]],
      ["percentage", "Percentage", "number"],
    ], actions: ["add", "edit"], columns: ["student", "course", "date", "status", "percentage"],
  },
  performance: {
    title: "Academic performance", fields: [
      ["student", "Student record ID", "text", true], ["course", "Course record ID", "text", true],
      ["assignmentScore", "Assignment score", "number"], ["quizScore", "Quiz score", "number"],
      ["midtermScore", "Midterm score", "number"], ["finalScore", "Final score", "number"],
      ["totalScore", "Total score", "number"], ["grade", "Grade"], ["gpa", "GPA", "number"], ["semester", "Semester", "number"],
    ], actions: ["add", "edit"], columns: ["student", "course", "totalScore", "grade", "gpa", "semester"],
  },
  predictions: {
    title: "Predictions", fields: [
      ["student", "Student record ID", "text", true],
      ["predictionType", "Prediction type", "select", true, ["performance", "dropout", "courseDemand"]],
      ["prediction", "Prediction", "text", true], ["probability", "Probability (0-1)", "number", true],
      ["riskLevel", "Risk level"], ["recommendation", "Recommendation", "textarea"],
    ], actions: ["add"], columns: ["student", "predictionType", "prediction", "probability", "riskLevel", "createdAt"],
  },
  datasets: {
    title: "Datasets", fields: [
      ["name", "Dataset name", "text", true], ["description", "Description", "textarea"],
      ["fileName", "File name", "text", true], ["fileType", "File type", "text", true], ["records", "Record count", "number"],
    ], actions: ["add", "delete"], columns: ["name", "fileName", "fileType", "records", "status", "createdAt"],
  },
  alerts: {
    title: "Alerts", fields: [
      ["title", "Title", "text", true], ["message", "Message", "textarea", true],
      ["type", "Type", "text", true], ["priority", "Priority", "select", true, ["low", "medium", "high", "critical"]],
      ["student", "Student record ID"],
    ], actions: ["add", "read"], columns: ["title", "type", "priority", "isRead", "createdAt"],
  },
  support: {
    title: "Support", fields: [
      ["subject", "Subject", "text", true], ["description", "Description", "textarea", true],
      ["priority", "Priority", "select", false, ["low", "medium", "high"]],
      ["status", "Status", "select", false, ["open", "in_progress", "resolved"]],
    ], actions: ["add", "edit"], columns: ["subject", "status", "priority", "createdAt"],
  },
  users: {
    title: "Users", fields: [
      ["name", "Name", "text", true], ["email", "Email", "email", true],
      ["password", "Initial password", "password", true],
      ["role", "Role", "select", true, ["teacher", "analyst"]],
    ], actions: ["add", "edit", "delete"], columns: ["name", "email", "role", "createdAt"],
  },
};
const singularLabels = {
  users: "user",
  students: "student",
  teachers: "teacher",
  courses: "course",
  enrollments: "enrollment",
  attendance: "attendance record",
  performance: "performance record",
  predictions: "prediction",
  datasets: "dataset",
  alerts: "alert",
  support: "ticket",
};

function display(value) {
  if (value == null || value === "") return "—";
  if (typeof value === "object") return value.name || value._id || JSON.stringify(value);
  return String(value);
}

export default function ResourcePage({ resource, role, search, onNotify }) {
  const definition = definitions[resource];
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [referenceOptions, setReferenceOptions] = useState({ students: [], courses: [], teachers: [] });
  const [teacherOptionsLoading, setTeacherOptionsLoading] = useState(false);
  const [teacherOptionsError, setTeacherOptionsError] = useState("");
  const [availableTeacherUsers, setAvailableTeacherUsers] = useState([]);
  const canCreate = role === "admin" ||
    (role === "analyst" && resource === "datasets") ||
    (role === "teacher" && ["attendance", "performance", "support"].includes(resource)) ||
    (role === "student" && resource === "support");
  const canManage = (role === "admin" && ["students", "teachers", "courses", "enrollments", "attendance", "performance", "datasets", "alerts", "users"].includes(resource)) ||
    (role === "analyst" && resource === "datasets");
  const canEditAcademic = role === "teacher" && ["attendance", "performance"].includes(resource);
  const canEditSupport = resource === "support";

  const loadAvailableTeacherUsers = useCallback(async (currentUserId = "") => {
    try {
      const { data } = await api.get("/teachers/available-users", {
        params: currentUserId ? { includeUserId: currentUserId } : {},
      });
      setAvailableTeacherUsers(data.data || []);
    } catch {
      setAvailableTeacherUsers([]);
    }
  }, []);

  const loadRecords = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get(`/${resource}`);
      setRecords(data.data || []);
      if (resource === "enrollments" && role === "admin") {
        const [studentsResponse, coursesResponse] = await Promise.all([
          api.get("/students"),
          api.get("/courses"),
        ]);
        setReferenceOptions({
          students: studentsResponse.data.data || [],
          courses: coursesResponse.data.data || [],
        });
      }
      if (resource === "teachers" && role === "admin") {
        await loadAvailableTeacherUsers();
      }
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to load records from the API.");
    } finally {
      setLoading(false);
    }
  }, [loadAvailableTeacherUsers, resource, role]);

  useEffect(() => { loadRecords(); }, [loadRecords]);

  const visibleRecords = useMemo(() => {
    const query = search.trim().toLowerCase();
    return records.filter((record) => !query || Object.values(record).some((value) => display(value).toLowerCase().includes(query)));
  }, [records, search]);

  const openForm = async (record = null) => {
    setEditing(record);
    if (resource === "courses") {
      setTeacherOptionsLoading(true);
      setTeacherOptionsError("");
      setReferenceOptions((current) => ({ ...current, teachers: [] }));
    }
    if (resource === "teachers" && role === "admin") {
      const currentUserId = record?.user?._id || record?.user || "";
      await loadAvailableTeacherUsers(currentUserId);
    }
    setForm(record ? Object.fromEntries(definition.fields.filter(([key]) => !(resource === "users" && key === "password")).map(([key]) => {
      const value = record[key];
      return [key, value && typeof value === "object" ? value._id || "" : value ?? ""];
    })) : {});
    setDialogOpen(true);
    if (resource === "courses") {
      api.get("/teachers")
        .then(({ data }) => {
          setReferenceOptions((current) => ({
            ...current,
            teachers: (data.data || []).filter((teacher) => teacher.user && teacher.user.isActive !== false),
          }));
        })
        .catch((requestError) => {
          setTeacherOptionsError(requestError.response?.data?.message || "Unable to load active teachers.");
        })
        .finally(() => setTeacherOptionsLoading(false));
    }
  };

  const submitForm = async (event) => {
    event.preventDefault();
    setError("");
    const payload = Object.fromEntries(Object.entries(form).filter(([, value]) => value !== ""));
    for (const [key, , type] of definition.fields) {
      if (payload[key] !== undefined && type === "number") payload[key] = Number(payload[key]);
    }
    try {
      if (editing && resource === "users") await api.put(`/users/${editing._id}`, payload);
      else if (editing) await api.put(`/${resource}/${editing._id}`, payload);
      else await api.post(`/${resource}`, payload);
      setDialogOpen(false);
      onNotify(`${definition.title} record ${editing ? "updated" : "created"}.`);
      await loadRecords();
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to save this record.");
    }
  };

  const remove = async (record) => {
    try {
      await api.delete(`/${resource}/${record._id}`);
      onNotify("Record deleted.");
      await loadRecords();
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to delete this record.");
    }
  };

  const markRead = async (record) => {
    try {
      await api.put(`/alerts/${record._id}/read`);
      await loadRecords();
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to update this alert.");
    }
  };

  if (!definition) return <Alert severity="error">This section does not have an API resource configured.</Alert>;

  return (
    <div className="dashboard-page resource-page">
      <div className="page-heading-row">
        <div><div className="breadcrumb">Workspace <span>/</span> {definition.title}</div><h1 className="greeting">{definition.title}</h1></div>
        {canCreate && <Button variant="contained" onClick={() => openForm()}>Add {singularLabels[resource]}</Button>}
      </div>
      {error && <Alert severity="error" onClose={() => setError("")}>{error}</Alert>}
      <Paper className="resource-table-panel" elevation={0}>
        {loading ? <div className="loading-view"><CircularProgress size={26} /></div> : visibleRecords.length === 0 ? (
          <div className="resource-empty"><h2>No {definition.title.toLowerCase()} found</h2><p>{search ? "Try changing the search term." : "Records will appear here when available."}</p></div>
        ) : (
          <Table size="small">
            <TableHead><TableRow>{definition.columns.map((column) => <TableCell key={column}>{column.replace(/[A-Z]/g, (letter) => ` ${letter}`).toUpperCase()}</TableCell>)}{(canManage || canEditAcademic || canEditSupport || resource === "alerts") && <TableCell>Actions</TableCell>}</TableRow></TableHead>
            <TableBody>{visibleRecords.map((record) => <TableRow key={record._id}>
              {definition.columns.map((column) => <TableCell key={column}>{display(record[column])}</TableCell>)}
              {(canManage || canEditAcademic || canEditSupport || resource === "alerts") && <TableCell>
                {(canManage || canEditAcademic || canEditSupport) && <Button size="small" onClick={() => openForm(record)}>Edit</Button>}
                {canManage && <Button size="small" color="error" onClick={() => remove(record)}>Delete</Button>}
                {resource === "alerts" && role !== "analyst" && !record.isRead && <Button size="small" onClick={() => markRead(record)}>Mark read</Button>}
              </TableCell>}
            </TableRow>)}</TableBody>
          </Table>
        )}
      </Paper>
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="sm">
        <form onSubmit={submitForm}>
          <DialogTitle>{editing ? "Update" : "Add"} {definition.title}</DialogTitle>
          <DialogContent className="resource-form">
            {resource === "teachers" && (
              <Box sx={{ mb: 1 }}>
                {editing ? (
                  <TextField
                    fullWidth
                    label="Teacher ID"
                    value={editing.teacherId || ""}
                    InputProps={{ readOnly: true }}
                    disabled
                    helperText="System-assigned unique Teacher ID"
                  />
                ) : (
                  <Alert severity="info" sx={{ py: 0.5 }}>
                    Teacher ID is automatically generated sequentially on save (e.g. TCH-{new Date().getFullYear()}-0001).
                  </Alert>
                )}
              </Box>
            )}
            {definition.fields
              .map(([key, label, type = "text", required = false, options]) => (
                (resource === "support" && key === "status" && (!editing || role !== "admin")) ? null :
                  type === "select" ? (
                    <TextField
                      key={key}
                      select
                      label={label}
                      required={required && !(resource === "users" && editing)}
                      value={form[key] ?? ""}
                      onChange={(event) => setForm({ ...form, [key]: event.target.value })}
                    >
                      {(resource === "users" && editing ? ["admin", "teacher", "student", "analyst"] : options)
                        .map((option) => <MenuItem key={option} value={option}>{option}</MenuItem>)}
                    </TextField>
                  ) : type === "credits" || type === "semester" ? (
                    <TextField
                      key={key}
                      select
                      label={label}
                      required={required}
                      value={form[key] ?? ""}
                      onChange={(event) => setForm({ ...form, [key]: Number(event.target.value) })}
                    >
                      {(type === "credits" ? [1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5, 6, 7, 8])
                        .map((option) => (
                          <MenuItem key={option} value={option}>
                            {type === "semester" ? `Semester ${option}` : option}
                          </MenuItem>
                        ))}
                    </TextField>
                  ) : type === "teacherRef" ? (
                    <div key={key}>
                      {teacherOptionsError && <Alert severity="error">{teacherOptionsError}</Alert>}
                      {!teacherOptionsLoading && !teacherOptionsError && referenceOptions.teachers.length === 0 && (
                        <Alert severity="info">No active teacher records are available.</Alert>
                      )}
                      <Autocomplete
                        options={referenceOptions.teachers}
                        loading={teacherOptionsLoading}
                        value={referenceOptions.teachers.find((item) => item._id === form[key]) || null}
                        getOptionLabel={(item) => `${item.teacherId} — ${item.name}`}
                        isOptionEqualToValue={(option, value) => option._id === value._id}
                        noOptionsText={teacherOptionsLoading ? "Loading teachers..." : "No active teachers found"}
                        onChange={(_, item) => setForm({ ...form, [key]: item?._id || "" })}
                        renderInput={(params) => (
                          <TextField {...params} label={label} error={Boolean(teacherOptionsError)} />
                        )}
                      />
                    </div>
                  ) : type === "teacherUserRef" ? (
                    <Autocomplete
                      key={key}
                      options={availableTeacherUsers}
                      disabled={Boolean(editing)}
                      value={availableTeacherUsers.find((item) => item._id === form[key]) || null}
                      getOptionLabel={(item) => (item ? `${item.name} (${item.email})` : "")}
                      isOptionEqualToValue={(option, val) => option._id === (val?._id || val)}
                      onChange={(_, item) => {
                        setForm((prev) => ({
                          ...prev,
                          [key]: item?._id || "",
                          name: item?.name || "",
                          email: item?.email || "",
                        }));
                      }}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label={label}
                          required={required}
                          helperText={
                            !editing && availableTeacherUsers.length === 0
                              ? "No unassigned teacher accounts found in MongoDB. Create a teacher user in Users first."
                              : "Select a teacher user account from MongoDB"
                          }
                          error={!editing && availableTeacherUsers.length === 0}
                        />
                      )}
                    />
                  ) : type === "studentRef" || type === "courseRef" ? (
                    <Autocomplete
                      key={key}
                      options={referenceOptions[type === "studentRef" ? "students" : "courses"]}
                      value={referenceOptions[type === "studentRef" ? "students" : "courses"].find((item) => item._id === form[key]) || null}
                      getOptionLabel={(item) => type === "studentRef"
                        ? `${item.studentId} — ${item.name}`
                        : `${item.courseCode} — ${item.courseName}`}
                      onChange={(_, item) => setForm({ ...form, [key]: item?._id || "" })}
                      renderInput={(params) => <TextField {...params} label={label} required={required} />}
                    />
                  ) : (
                    <TextField
                      key={key}
                      label={resource === "users" && key === "password" ? "New password (optional)" : label}
                      type={type === "textarea" ? "text" : type}
                      multiline={type === "textarea"}
                      minRows={type === "textarea" ? 3 : undefined}
                      required={required && !(resource === "users" && editing)}
                      value={form[key] ?? ""}
                      onChange={(event) => setForm({ ...form, [key]: event.target.value })}
                      InputLabelProps={{
                        ...(type === "date" ? { shrink: true } : {}),
                        ...(options?.readOnly || (resource === "teachers" && (key === "name" || key === "email"))
                          ? { shrink: Boolean(form[key]) }
                          : {}),
                      }}
                      InputProps={{
                        readOnly: Boolean(options?.readOnly || (resource === "teachers" && (key === "name" || key === "email"))),
                      }}
                      disabled={Boolean(options?.readOnly || (resource === "teachers" && (key === "name" || key === "email")))}
                      helperText={
                        resource === "teachers" && (key === "name" || key === "email")
                          ? "Auto-populated from selected user account (read-only)"
                          : undefined
                      }
                    />
                  )
            ))}
          </DialogContent>
          <DialogActions><Button onClick={() => setDialogOpen(false)}>Cancel</Button><Button type="submit" variant="contained">Save</Button></DialogActions>
        </form>
      </Dialog>
    </div>
  );
}
