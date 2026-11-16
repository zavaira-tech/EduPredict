import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  CircularProgress,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from "@mui/material";
import {
  Activity,
  Database,
  GraduationCap,
  RefreshCw,
  ShieldCheck,
  UserRound,
  Users,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useNavigate } from "react-router-dom";
import api from "../../services/api.js";

const statisticCards = [
  ["totalStudents", "Registered students", GraduationCap],
  ["totalTeachers", "Teachers", UserRound],
  ["totalAnalysts", "Analysts", Activity],
  ["totalAdmins", "Admins", ShieldCheck],
  ["totalUsers", "Registered users", Users],
  ["totalDatasets", "Uploaded datasets", Database],
  ["totalAcademicRecords", "Academic records", Activity],
  ["activeUsers", "Active users", Users],
];

const roleColors = {
  admin: "#356ae6",
  teacher: "#14b8a6",
  student: "#8b72d8",
  analyst: "#f0a43c",
};

const riskColors = {
  low: "#14b8a6",
  medium: "#f0a43c",
  high: "#e76f51",
  critical: "#c53030",
  unknown: "#8a96a8",
};

function ChartPanel({ title, subtitle, children }) {
  return (
    <Paper className="chart-panel" elevation={0}>
      <div className="panel-heading">
        <div>
          <strong className="panel-title">{title}</strong>
          <p className="panel-subtitle">{subtitle}</p>
        </div>
      </div>
      {children}
    </Paper>
  );
}

function ChartContents({ data, children }) {
  if (!data?.length) return <div className="resource-empty">No matching MongoDB records yet.</div>;
  return <div className="chart-area department-chart"><ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer></div>;
}

function formatBytes(bytes = 0) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / (1024 ** index)).toFixed(index ? 1 : 0)} ${units[index]}`;
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : "—";
}

export default function AdminDashboard({ onNotify }) {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [statsResponse, chartsResponse, usersResponse, activityResponse, notificationsResponse] = await Promise.all([
        api.get("/admin/dashboard/stats"),
        api.get("/admin/dashboard/charts"),
        api.get("/admin/users", { params: { page: 1, limit: 8 } }),
        api.get("/admin/activity-logs", { params: { page: 1, limit: 8 } }),
        api.get("/admin/notifications", { params: { page: 1, limit: 8 } }),
      ]);
      setData({
        stats: statsResponse.data.data,
        charts: chartsResponse.data.data,
        users: usersResponse.data.data,
        activity: activityResponse.data.data,
        notifications: notificationsResponse.data.data,
      });
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to load administrator data from MongoDB.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
    const interval = window.setInterval(loadDashboard, 60000);
    const handleDataChanged = () => loadDashboard();
    window.addEventListener("edupredict:data-changed", handleDataChanged);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("edupredict:data-changed", handleDataChanged);
    };
  }, [loadDashboard]);

  if (loading && !data) return <div className="loading-view"><CircularProgress size={26} /></div>;

  const charts = data?.charts;

  return (
    <div className="dashboard-page">
      <div className="page-heading-row">
        <div>
          <div className="breadcrumb">Overview <span>/</span> Administrator dashboard</div>
          <h1 className="greeting">Administrator dashboard</h1>
          <p className="page-description">Live account, dataset, and academic summaries from MongoDB.</p>
        </div>
        <IconButton aria-label="Refresh dashboard" onClick={loadDashboard} disabled={loading}>
          <RefreshCw size={18} />
        </IconButton>
      </div>
      {error && <Alert severity="error" onClose={() => setError("")}>{error}</Alert>}

      {data && (
        <>
          <div className="kpi-grid">
            {statisticCards.map(([key, label, Icon]) => (
              <Paper key={key} className="kpi-card" elevation={0}>
                <div className="kpi-icon kpi-icon-blue"><Icon size={19} /></div>
                <div className="kpi-heading"><span>{label}</span></div>
                <div className="kpi-value">{Number(data.stats[key] || 0).toLocaleString()}</div>
                <div className="kpi-footer">
                  <span className="kpi-detail">{key === "activeUsers" ? "Accounts not deactivated" : "Current MongoDB total"}</span>
                </div>
              </Paper>
            ))}
          </div>
          <p className="page-description">Dataset file storage used: {formatBytes(data.stats.totalDatasetBytes)}.</p>

          <div className="chart-grid chart-grid-top">
            <ChartPanel title="Student registration growth" subtitle="Student accounts created by month">
              <ChartContents data={charts?.studentRegistrations}>
                <AreaChart data={charts?.studentRegistrations}>
                  <CartesianGrid vertical={false} stroke="#edf0f5" />
                  <XAxis dataKey="period" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Area type="monotone" dataKey="count" name="Registered students" stroke="#356ae6" fill="#356ae633" />
                </AreaChart>
              </ChartContents>
            </ChartPanel>
            <ChartPanel title="User distribution by role" subtitle="Current registered-user records">
              <ChartContents data={charts?.userDistribution}>
                <PieChart>
                  <Pie data={charts?.userDistribution} dataKey="count" nameKey="role" outerRadius="82%">
                    {charts?.userDistribution?.map((item) => (
                      <Cell key={item.role} fill={roleColors[item.role] || "#8a96a8"} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ChartContents>
            </ChartPanel>
            <ChartPanel title="Performance overview" subtitle="Average recorded score by grade">
              <ChartContents data={charts?.performanceOverview}>
                <BarChart data={charts?.performanceOverview}>
                  <CartesianGrid vertical={false} stroke="#edf0f5" />
                  <XAxis dataKey="grade" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Bar dataKey="averageScore" name="Average score" fill="#356ae6" />
                </BarChart>
              </ChartContents>
            </ChartPanel>
            <ChartPanel title="Attendance statistics" subtitle="Real attendance records grouped by status">
              <ChartContents data={charts?.attendanceStatistics}>
                <BarChart data={charts?.attendanceStatistics}>
                  <CartesianGrid vertical={false} stroke="#edf0f5" />
                  <XAxis dataKey="status" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="records" name="Records" fill="#14b8a6" />
                </BarChart>
              </ChartContents>
            </ChartPanel>
            <ChartPanel title="Dropout risk distribution" subtitle="Stored dropout predictions by risk level">
              <ChartContents data={charts?.dropoutRiskDistribution}>
                <PieChart>
                  <Pie data={charts?.dropoutRiskDistribution} dataKey="count" nameKey="riskLevel" outerRadius="82%">
                    {charts?.dropoutRiskDistribution?.map((item) => (
                      <Cell key={item.riskLevel} fill={riskColors[item.riskLevel.toLowerCase()] || "#8a96a8"} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ChartContents>
            </ChartPanel>
            <ChartPanel title="Academic performance trends" subtitle="Average score from dated performance records">
              <ChartContents data={charts?.academicPerformanceTrends}>
                <LineChart data={charts?.academicPerformanceTrends}>
                  <CartesianGrid vertical={false} stroke="#edf0f5" />
                  <XAxis dataKey="period" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Line type="monotone" dataKey="averageScore" name="Average score" stroke="#356ae6" strokeWidth={2} />
                </LineChart>
              </ChartContents>
            </ChartPanel>
            <ChartPanel title="Dataset uploads" subtitle="Datasets added by month">
              <ChartContents data={charts?.datasetUploadStatistics}>
                <BarChart data={charts?.datasetUploadStatistics}>
                  <CartesianGrid vertical={false} stroke="#edf0f5" />
                  <XAxis dataKey="period" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" name="Datasets" fill="#8b72d8" />
                </BarChart>
              </ChartContents>
            </ChartPanel>
          </div>

          <div className="lower-grid">
            <Paper className="table-panel" elevation={0}>
              <div className="panel-heading table-heading">
                <div><strong className="panel-title">Recent users</strong><p className="panel-subtitle">Latest MongoDB user accounts</p></div>
                <button className="text-action" onClick={() => navigate("/users")}>Manage users</button>
              </div>
              <div className="table-scroll">
                <Table size="small">
                  <TableHead><TableRow><TableCell>Name</TableCell><TableCell>Email</TableCell><TableCell>Role</TableCell><TableCell>Status</TableCell><TableCell>Created</TableCell></TableRow></TableHead>
                  <TableBody>{data.users.map((user) => (
                    <TableRow key={user._id}>
                      <TableCell>{user.name}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>{user.role}</TableCell>
                      <TableCell>{user.isActive === false ? "Inactive" : "Active"}</TableCell>
                      <TableCell>{formatDate(user.createdAt)}</TableCell>
                    </TableRow>
                  ))}{!data.users.length && <TableRow><TableCell colSpan={5}>No users found.</TableCell></TableRow>}</TableBody>
                </Table>
              </div>
            </Paper>
            <Paper className="updates-panel" elevation={0}>
              <div className="panel-heading"><div><strong className="panel-title">Recent notifications</strong><p className="panel-subtitle">Registrations, uploads, and academic alerts</p></div></div>
              {data.notifications.length
                ? data.notifications.map((item) => (
                    <div className="alert-row" key={`${item.source}-${item._id}`}>
                      <div className="alert-copy"><strong>{item.title}</strong><span>{item.message}</span><small>{formatDate(item.createdAt)}</small></div>
                      <span className={`severity-dot ${item.isRead ? "" : "severity-high"}`} />
                    </div>
                  ))
                : <div className="resource-empty">No notifications have been recorded.</div>}
            </Paper>
          </div>

          <Paper className="table-panel" elevation={0}>
            <div className="panel-heading table-heading">
              <div><strong className="panel-title">Recent system activity</strong><p className="panel-subtitle">Audited actions stored in MongoDB</p></div>
              <button className="text-action" onClick={() => navigate("/activity")}>View activity log</button>
            </div>
            <div className="table-scroll">
              <Table size="small">
                <TableHead><TableRow><TableCell>Time</TableCell><TableCell>Actor</TableCell><TableCell>Action</TableCell><TableCell>Record</TableCell></TableRow></TableHead>
                <TableBody>{data.activity.map((item) => (
                  <TableRow key={item._id}>
                    <TableCell>{formatDate(item.createdAt)}</TableCell>
                    <TableCell>{item.actor?.name || "System"}</TableCell>
                    <TableCell>{item.action}</TableCell>
                    <TableCell>{item.entityType}</TableCell>
                  </TableRow>
                ))}{!data.activity.length && <TableRow><TableCell colSpan={4}>No activity has been recorded.</TableCell></TableRow>}</TableBody>
              </Table>
            </div>
          </Paper>
        </>
      )}
    </div>
  );
}
