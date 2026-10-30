import { useEffect, useState } from "react";
import {
  Alert,
  CircularProgress,
  Paper,
  Typography,
} from "@mui/material";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
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

export default function AnalyticsDashboard() {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    api.get("/analytics/overview")
      .then(({ data }) => {
        if (active) setAnalytics(data.data);
      })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.message || "Unable to load analytics.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  if (loading) return <div className="loading-view"><CircularProgress size={26} /></div>;

  return (
    <div className="dashboard-page">
      <div className="page-heading-row">
        <div>
          <div className="breadcrumb">Insights <span>/</span> Analytics</div>
          <h1 className="greeting">Academic analytics</h1>
          <p className="page-description">Trends aggregated from attendance, performance, and enrollment records.</p>
        </div>
      </div>
      {error && <Alert severity="error">{error}</Alert>}
      {analytics && (
        <>
          <div className="analytics-grid">
            <ChartPanel title="Attendance rate · last six months">
              <div className="analytics-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={analytics.attendanceTrend}>
                    <CartesianGrid vertical={false} stroke="#edf0f5" />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 100]} unit="%" axisLine={false} tickLine={false} />
                    <Tooltip formatter={(value, name) => [name === "attendanceRate" ? `${value}%` : value, name]} />
                    <Line dataKey="attendanceRate" name="Attendance" stroke="#356ae6" strokeWidth={2.5} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </ChartPanel>
            <ChartPanel title="Average academic score · last six months">
              <div className="analytics-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={analytics.performanceTrend}>
                    <CartesianGrid vertical={false} stroke="#edf0f5" />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 100]} axisLine={false} tickLine={false} />
                    <Tooltip />
                    <Line dataKey="averageScore" name="Average score" stroke="#14a991" strokeWidth={2.5} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </ChartPanel>
            <ChartPanel title="Active enrollments by course">
              {analytics.courseEnrollment.length ? (
                <div className="analytics-chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analytics.courseEnrollment} margin={{ left: 8, right: 12 }}>
                      <CartesianGrid vertical={false} stroke="#edf0f5" />
                      <XAxis dataKey="courseCode" axisLine={false} tickLine={false} />
                      <YAxis allowDecimals={false} axisLine={false} tickLine={false} />
                      <Tooltip labelFormatter={(code) => analytics.courseEnrollment.find((item) => item.courseCode === code)?.courseName || code} />
                      <Bar dataKey="enrollments" name="Active students" fill="#7898e8" radius={[5, 5, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="resource-empty"><h2>No active enrollments</h2><p>Active enrollments will appear as records are added.</p></div>
              )}
            </ChartPanel>
          </div>
          {!analytics.attendanceTrend.some((item) => item.records) &&
            !analytics.performanceTrend.some((item) => item.records) &&
            !analytics.courseEnrollment.length && (
              <Alert severity="info">No academic records are available for these analytics yet.</Alert>
            )}
        </>
      )}
    </div>
  );
}
