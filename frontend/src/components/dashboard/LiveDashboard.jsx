import { useEffect, useState } from "react";
import { Alert, CircularProgress, Paper } from "@mui/material";
import { Activity, BookOpen, GraduationCap, Users, UserRound, CircleAlert } from "lucide-react";
import api from "../../services/api.js";

const cards = [
  ["students", "Total students", Users],
  ["teachers", "Total teachers", UserRound],
  ["courses", "Courses", BookOpen],
  ["attendance", "Attendance records", Activity],
  ["averageGPA", "Average GPA", GraduationCap],
  ["atRiskStudents", "Students at risk", CircleAlert],
  ["activeAlerts", "Active alerts", CircleAlert],
];

export default function LiveDashboard({ onNotify }) {
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

  useEffect(() => {
    loadSummary();
  }, []);

  if (loading) return <div className="loading-view"><CircularProgress size={26} /></div>;

  return (
    <div className="dashboard-page">
      <div className="page-heading-row">
        <div>
          <div className="breadcrumb">Overview <span>/</span> Dashboard</div>
          <h1 className="greeting">Institution overview</h1>
          <p className="page-description">Live statistics calculated from the connected database.</p>
        </div>
        <button className="text-action" onClick={() => { loadSummary(); onNotify("Refreshing dashboard statistics"); }}>
          Refresh data
        </button>
      </div>
      {error && <Alert severity="error">{error}</Alert>}
      {summary && (
        <div className="kpi-grid">
          {cards.map(([key, label, Icon]) => (
            <Paper key={key} className="kpi-card" elevation={0}>
              <div className="kpi-icon kpi-icon-blue"><Icon size={19} /></div>
              <div className="kpi-heading"><span>{label}</span></div>
              <div className="kpi-value">{Number(summary[key] ?? 0).toLocaleString()}</div>
              <div className="kpi-footer"><span className="kpi-detail">Current database total</span></div>
            </Paper>
          ))}
        </div>
      )}
      {!error && summary && !Object.values(summary).some((value) => Number(value) > 0) && (
        <Paper className="page-placeholder" elevation={0}>
          <h2>No academic records yet</h2>
          <p>Add students, courses, attendance and performance records to populate these live statistics.</p>
        </Paper>
      )}
    </div>
  );
}
