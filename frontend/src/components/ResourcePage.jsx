import { useCallback, useEffect, useMemo, useState } from "react";
import {
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
import DynamicAutocomplete from "./DynamicAutocomplete.jsx";

const definitions = {
  students: {
    title: "Students", fields: [
      ["studentId", "Student ID", "text", true], ["name", "Name", "text", true],
      ["email", "Email", "email", true], ["department", "Department", "departmentRef", true],
      ["program", "Program", "programRef", true], ["semester", "Semester", "semester", true],
      ["user", "User account", "userRef"], ["gender", "Gender"], ["age", "Age", "number"], ["attendancePercentage", "Attendance %", "number"],
      ["gpa", "GPA", "number"], ["academicStatus", "Academic status", "studentStatusRef"],
    ], actions: ["add", "edit", "delete"], columns: ["studentId", "name", "email", "department", "program", "semester", "gpa"],
  },
  teachers: {
    title: "Teachers", fields: [
      ["user", "User account", "userRef", true],
      ["name", "Name", "text", true, { readOnly: true }],
      ["email", "Email", "email", true, { readOnly: true }],
      ["department", "Department", "departmentRef", true],
      ["specialization", "Specialization", "text", false],
    ], actions: ["add", "edit", "delete"], columns: ["teacherId", "name", "email", "department", "specialization"],
  },
  courses: {
    title: "Courses", fields: [
      ["courseCode", "Course code", "text", true], ["courseName", "Course name", "text", true],
      ["department", "Department", "departmentRef", true], ["credits", "Credits", "credits", true],
      ["teacher", "Teacher", "teacherRef"], ["semester", "Semester", "semester", true],
    ], actions: ["add", "edit", "delete"], columns: ["courseCode", "courseName", "department", "credits", "semester"],
  },
  enrollments: {
    title: "Enrollments", fields: [
      ["student", "Student", "studentRef", true],
      ["course", "Course", "courseRef", true],
      ["academicYear", "Academic year", "academicYearRef", true],
      ["semester", "Semester", "semester", true],
      ["enrolledAt", "Enrollment date", "date"],
      ["status", "Status", "select", true, ["active", "completed", "dropped"]],
    ], actions: ["add", "edit", "delete"],
    columns: ["student", "course", "academicYear", "semester", "enrolledAt", "status"],
  },
  attendance: {
    title: "Attendance", fields: [
      ["student", "Student", "studentRef", true], ["course", "Course", "courseRef", true],
      ["academicYear", "Academic year", "academicYearRef"],
      ["semester", "Semester", "semester", true],
      ["date", "Date", "date", true], ["status", "Status", "select", true, ["Present", "Absent", "Late"]],
      ["percentage", "Percentage", "number"],
    ], actions: ["add", "edit"], columns: ["student", "course", "date", "status", "percentage"],
  },
  performance: {
    title: "Academic performance", fields: [
      ["student", "Student", "studentRef", true], ["course", "Course", "courseRef", true],
      ["academicYear", "Academic year", "academicYearRef"],
      ["assignmentScore", "Assignment score", "number"], ["quizScore", "Quiz score", "number"],
      ["midtermScore", "Midterm score", "number"], ["finalScore", "Final score", "number"],
      ["totalScore", "Total score", "number"], ["grade", "Grade", "gradeRef"], ["gpa", "GPA", "number"], ["semester", "Semester", "semester"],
    ], actions: ["add", "edit"], columns: ["student", "course", "totalScore", "grade", "gpa", "semester"],
  },
  predictions: {
    title: "Predictions", fields: [
      ["student", "Student", "studentRef", true],
      ["predictionType", "Prediction type", "select", true, ["performance", "dropout", "courseDemand"]],
      ["prediction", "Prediction", "text", true], ["probability", "Probability (0-1)", "number", true],
      ["riskLevel", "Risk level"], ["recommendation", "Recommendation", "textarea"],
    ], actions: ["add"], columns: ["student", "predictionType", "prediction", "probability", "riskLevel", "createdAt"],
  },
  datasets: {
    title: "Datasets", fields: [
      ["name", "Dataset name", "text", true], ["description", "Description", "textarea"],
      ["fileName", "File name", "text", true], ["fileType", "File type", "datasetTypeRef", true], ["records", "Record count", "number"],
    ], actions: ["add", "delete"], columns: ["name", "fileName", "fileType", "records", "status", "createdAt"],
  },
  alerts: {
    title: "Alerts", fields: [
      ["title", "Title", "text", true], ["message", "Message", "textarea", true],
      ["type", "Type", "alertTypeRef", true], ["priority", "Priority", "select", true, ["low", "medium", "high", "critical"]],
      ["student", "Student", "studentRef"],
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

function getLookupConfig(type, resource, form) {
  const config = {
    userRef: {
      endpoint: "/lookups/users",
      params: {
        role: resource === "teachers" ? "teacher" : "student",
        unassigned: "true",
      },
      label: (option) => `${option.name} (${option.email})`,
    },
    studentRef: {
      endpoint: "/lookups/students",
      params: form.course ? { courseId: form.course } : {},
      label: (option) => `${option.studentId} — ${option.name}`,
    },
    courseRef: {
      endpoint: "/lookups/courses",
      params: {
        ...(form.student ? { studentId: form.student } : {}),
        ...(form.semester ? { semester: form.semester } : {}),
        ...(form.department ? { department: form.department } : {}),
        ...(["attendance", "performance"].includes(resource) ? { requireEnrollment: "true" } : {}),
      },
      label: (option) => {
        const teacher = option.teacher?.name ? ` · ${option.teacher.name}` : "";
        return `${option.courseCode} — ${option.courseName}${teacher}`;
      },
    },
    teacherRef: {
      endpoint: "/lookups/teachers",
      params: form.department ? { department: form.department } : {},
      label: (option) => `${option.teacherId} — ${option.name}`,
    },
    departmentRef: {
      endpoint: "/lookups/departments",
      valueField: "value",
      label: (option) => option.label,
      freeSoloWhenEmpty: true,
    },
    programRef: {
      endpoint: "/lookups/programs",
      valueField: "value",
      params: form.department ? { department: form.department } : {},
      label: (option) => option.label,
      freeSolo: true,
    },
    academicYearRef: {
      endpoint: "/lookups/academicYears",
      valueField: "value",
      params: ["attendance", "performance"].includes(resource)
        ? {
          ...(form.student ? { studentId: form.student } : {}),
          ...(form.course ? { courseId: form.course } : {}),
          requireEnrollment: "true",
        }
        : {},
      label: (option) => option.label,
      freeSolo: true,
    },
    alertTypeRef: {
      endpoint: "/lookups/alertTypes",
      valueField: "value",
      label: (option) => option.label,
      freeSolo: true,
    },
    datasetTypeRef: {
      endpoint: "/lookups/datasetTypes",
      valueField: "value",
      label: (option) => option.label,
      freeSolo: true,
    },
    studentStatusRef: {
      endpoint: "/lookups/studentStatuses",
      valueField: "value",
      label: (option) => option.label,
      freeSolo: true,
    },
    gradeRef: {
      endpoint: "/lookups/grades",
      valueField: "value",
      label: (option) => option.label,
      freeSolo: true,
    },
  };
  return config[type];
}

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
  const canCreate = role === "admin" ||
    (role === "analyst" && resource === "datasets") ||
    (role === "teacher" && ["attendance", "performance", "support"].includes(resource)) ||
    (role === "student" && resource === "support");
  const canManage = (role === "admin" && ["students", "teachers", "courses", "enrollments", "attendance", "performance", "datasets", "alerts", "users"].includes(resource)) ||
    (role === "analyst" && resource === "datasets");
  const canEditAcademic = role === "teacher" && ["attendance", "performance"].includes(resource);
  const canEditSupport = resource === "support";

  const loadRecords = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get(`/${resource}`);
      setRecords(data.data || []);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to load records from the API.");
    } finally {
      setLoading(false);
    }
  }, [resource]);

  useEffect(() => { loadRecords(); }, [loadRecords]);

  const visibleRecords = useMemo(() => {
    const query = search.trim().toLowerCase();
    return records.filter((record) => !query || Object.values(record).some((value) => display(value).toLowerCase().includes(query)));
  }, [records, search]);

  const openForm = (record = null) => {
    setEditing(record);
    setForm(record ? Object.fromEntries(definition.fields.filter(([key]) => !(resource === "users" && key === "password")).map(([key]) => {
      const value = record[key];
      return [key, value && typeof value === "object" ? value._id || "" : value ?? ""];
    })) : {});
    setDialogOpen(true);
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
                  ) : getLookupConfig(type, resource, form) ? (
                    (() => {
                      const config = getLookupConfig(type, resource, form);
                      const savedOption = editing?.[key];
                      const selectedOption = config.valueField === "value" && typeof savedOption === "string"
                        ? { value: savedOption, label: savedOption }
                        : savedOption;
                      return (
                        <DynamicAutocomplete
                          key={key}
                          endpoint={config.endpoint}
                          label={label}
                          value={form[key] ?? ""}
                          valueField={config.valueField || "_id"}
                          getOptionLabel={config.label}
                          params={config.params || {}}
                          selectedOption={selectedOption}
                          required={required}
                          disabled={Boolean(editing && type === "userRef" && resource === "teachers")}
                          freeSolo={Boolean(config.freeSolo)}
                          freeSoloWhenEmpty={Boolean(config.freeSoloWhenEmpty)}
                          onChange={(selectedValue, option) => {
                            setForm((current) => {
                              const next = { ...current, [key]: selectedValue };
                              if (key === "user" && option && typeof option === "object") {
                                next.name = option.name || next.name;
                                next.email = option.email || next.email;
                              }
                              if (key === "department") {
                                next.program = "";
                                next.teacher = "";
                                next.course = "";
                              }
                              if (key === "semester") next.course = "";
                              if (key === "student") {
                                next.course = "";
                                next.academicYear = "";
                              }
                              if (key === "course") next.academicYear = "";
                              return next;
                            });
                          }}
                        />
                      );
                    })()
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
