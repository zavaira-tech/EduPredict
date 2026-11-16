import { useEffect, useState } from "react";
import { Alert, CircularProgress, Paper } from "@mui/material";
import { Activity, BookOpen, Database, GraduationCap, Users, UserRound, CircleAlert } from "lucide-react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api.js";

const cards = [
  ["students", "Total students", Users],
  ["teachers", "Total teachers", UserRound],
  ["courses", "Courses", BookOpen],
  ["users", "Registered users", Users],
  ["datasets", "Datasets", Database],
  ["attendance", "Attendance records", Activity],
  ["averageGPA", "Average GPA", GraduationCap],
  ["atRiskStudents", "Students at risk", CircleAlert],
  ["activeAlerts", "Active alerts", CircleAlert],
];

const dashboardDetails = {
  admin: {
    title: "Administrator dashboard",
    description: "Manage users, datasets, permissions, and institution-wide activity.",
    cards: ["students", "teachers", "courses", "users", "datasets", "attendance", "atRiskStudents", "activeAlerts"],
    links: [["Manage users and roles", "/users"], ["Manage datasets", "/datasets"], ["Analytics & reports", "/analytics"], ["Account settings", "/settings"]],
  },
  teacher: {
    title: "Teacher dashboard",
    description: "Review your assigned students, academic progress, risk indicators, and alerts.",
    cards: ["students", "courses", "attendance", "averageGPA", "atRiskStudents", "activeAlerts"],
    links: [["Assigned students", "/students"], ["Attendance", "/attendance"], ["Performance", "/performance"], ["Predictions", "/predictions"], ["Alerts", "/alerts"]],
  },
  student: {
    title: "Student dashboard",
    description: "Review your personal academic progress, grades, predictions, and alerts.",
    cards: ["courses", "attendance", "averageGPA", "atRiskStudents", "activeAlerts"],
    links: [["My performance", "/performance"], ["My predictions", "/predictions"], ["My courses", "/courses"], ["My progress", "/analytics"]],
  },
  analyst: {
    title: "Analyst dashboard",
    description: "Manage your datasets and review educational trends, model results, and reports.",
    cards: ["users", "students", "teachers", "courses", "datasets", "attendance", "atRiskStudents"],
    links: [["Manage datasets", "/datasets"], ["Analytics & reports", "/analytics"], ["Model results", "/ml"], ["Anomalies", "/anomalies"]],
  },
};

const cardOverrides = {
  teacher: { students: "Assigned students", courses: "Assigned courses", averageGPA: "Average student GPA" },
  student: { courses: "My courses", attendance: "My attendance records", averageGPA: "My average GPA", atRiskStudents: "Risk indicators", activeAlerts: "My unread alerts" },
  analyst: { atRiskStudents: "At-risk students" },
};

export default function LiveDashboard({ role = "admin", onNotify }) {
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadSummary = async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/dashboard/summary");
      setSummary(data.data);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to load dashboard statistics.");
    } finally {
      setLoading(false);
    }
  };
  const details = dashboardDetails[role] || dashboardDetails.student;
  const visibleCards = details.cards.map((key) => {
    const [cardKey, label, Icon] = cards.find(([itemKey]) => itemKey === key);
    return [cardKey, cardOverrides[role]?.[key] || label, Icon];
  });
  const hasAcademicRecords = role === "student"
    ? ["courses", "attendance", "averageGPA"].some((key) => Number(summary?.[key]) > 0)
    : ["students", "teachers", "courses", "attendance", "averageGPA"].some((key) => Number(summary?.[key]) > 0);

  useEffect(() => {
    loadSummary();
  }, []);

  if (loading) return <div className="loading-view"><CircularProgress size={26} /></div>;

  return (
    <div className="dashboard-page">
      <div className="page-heading-row">
        <div>
          <div className="breadcrumb">Overview <span>/</span> {role} dashboard</div>
          <h1 className="greeting">{details.title}</h1>
          <p className="page-description">{details.description}</p>
        </div>
        <button className="text-action" onClick={() => { loadSummary(); onNotify("Refreshing dashboard statistics"); }}>
          Refresh data
        </button>
      </div>
      {error && <Alert severity="error">{error}</Alert>}
      {summary && (
        <div className="kpi-grid">
          {visibleCards.map(([key, label, Icon]) => (
            <Paper key={key} className="kpi-card" elevation={0}>
              <div className="kpi-icon kpi-icon-blue"><Icon size={19} /></div>
              <div className="kpi-heading"><span>{label}</span></div>
              <div className="kpi-value">{Number(summary[key] ?? 0).toLocaleString()}</div>
              <div className="kpi-footer"><span className="kpi-detail">{role === "student" ? "From your academic records" : role === "teacher" ? "For your assigned classes" : "Current database total"}</span></div>
            </Paper>
          ))}
        </div>
      )}
      {!error && summary && !hasAcademicRecords && (
        <Paper className="page-placeholder" elevation={0}>
          <h2>{role === "student" ? "No academic records linked yet" : "No academic records yet"}</h2>
          <p>{role === "student"
            ? "Ask your institution administrator to link your student profile to this account."
            : "Add students, courses, attendance and performance records to populate these live statistics."}</p>
        </Paper>
      )}
      <Paper className="page-placeholder" elevation={0}>
        <h2>{role === "student" ? "Your learning workspace" : role === "teacher" ? "Classroom workspace" : role === "analyst" ? "Analysis workspace" : "Administration workspace"}</h2>
        <p>{role === "student"
          ? "Explore your academic records and available grade or dropout-risk predictions."
          : role === "teacher"
            ? "Open your assigned rosters, record progress, and follow up on at-risk students."
            : role === "analyst"
              ? "Explore approved academic data, predictive analytics, and model evaluations."
              : "Manage registered users, system datasets, and institution-wide reports."}</p>
        <div className="page-heading-row">
          {details.links.map(([label, path]) => (
            <button key={path} className="text-action" onClick={() => navigate(path)}>{label}</button>
          ))}
        </div>
      </Paper>
    </div>
  );
}
