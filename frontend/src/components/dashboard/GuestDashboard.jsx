import {
  Alert,
  Box,
  Button,
  Chip,
  Paper,
  Typography,
} from "@mui/material";
import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowRight, BookOpen, Eye, GraduationCap, ShieldCheck } from "lucide-react";
import { useLocation } from "react-router-dom";

const performanceDemo = [
  { term: "Term 1", score: 72 },
  { term: "Term 2", score: 76 },
  { term: "Term 3", score: 74 },
  { term: "Term 4", score: 81 },
  { term: "Term 5", score: 84 },
];

const attendanceDemo = [
  { week: "Week 1", rate: 88 },
  { week: "Week 2", rate: 91 },
  { week: "Week 3", rate: 86 },
  { week: "Week 4", rate: 94 },
  { week: "Week 5", rate: 92 },
  { week: "Week 6", rate: 95 },
];

const courseDemandDemo = [
  { course: "Data Science", current: 64, illustrativeForecast: 71 },
  { course: "Education", current: 52, illustrativeForecast: 58 },
  { course: "Mathematics", current: 48, illustrativeForecast: 46 },
  { course: "Biology", current: 39, illustrativeForecast: 44 },
];

const demoLabel = "Illustrative demo data";

function ChartPanel({ title, description, children }) {
  return (
    <Paper className="guest-chart-panel" elevation={0}>
      <div className="guest-panel-heading">
        <div>
          <Typography variant="h6">{title}</Typography>
          <Typography variant="body2">{description}</Typography>
        </div>
        <Chip size="small" label="DEMO" color="secondary" variant="outlined" />
      </div>
      <div className="guest-chart">{children}</div>
    </Paper>
  );
}

export default function GuestDashboard({ onUpgrade }) {
  const location = useLocation();
  const [guestMessage, setGuestMessage] = useState(location.state?.guestMessage || "");

  return (
    <div className="dashboard-page guest-dashboard">
      {guestMessage && (
        <Alert severity="info" onClose={() => setGuestMessage("")}>
          {guestMessage}
        </Alert>
      )}

      <div className="page-heading-row guest-heading">
        <div>
          <div className="breadcrumb">Explore <span>/</span> Guest dashboard</div>
          <h1 className="greeting">Explore EduPredict</h1>
          <p className="page-description">A safe, read-only tour of the platform&apos;s academic analytics.</p>
        </div>
        <Button variant="contained" endIcon={<ArrowRight size={16} />} onClick={onUpgrade}>
          Sign in / Create account
        </Button>
      </div>

      <Alert severity="info" icon={<Eye size={18} />}>
        <strong>Guest Mode — Read Only.</strong> Everything shown here is illustrative demo data, not live institutional
        statistics or real student records. No private academic information is available in this session.
      </Alert>

      <div className="guest-stat-grid">
        {[
          { label: "Example course completion", value: "82%", icon: GraduationCap },
          { label: "Example attendance rate", value: "91%", icon: ShieldCheck },
          { label: "Sample courses", value: "4", icon: BookOpen },
        ].map(({ label, value, icon: Icon }) => (
          <Paper className="guest-stat-card" elevation={0} key={label}>
            <span className="guest-stat-icon"><Icon size={19} /></span>
            <span className="guest-stat-label">{label}</span>
            <strong>{value}</strong>
            <small>{demoLabel} · not production data</small>
          </Paper>
        ))}
      </div>

      <div className="guest-chart-grid">
        <ChartPanel title="Student performance" description="Example average score by term">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={performanceDemo} margin={{ top: 10, right: 12, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e9eef5" />
              <XAxis dataKey="term" tickLine={false} axisLine={false} />
              <YAxis domain={[0, 100]} tickLine={false} axisLine={false} />
              <Tooltip />
              <Line type="monotone" dataKey="score" name="Example score" stroke="#356ae6" strokeWidth={3} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel title="Attendance analytics" description="Example weekly attendance rate">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={attendanceDemo} margin={{ top: 10, right: 12, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e9eef5" />
              <XAxis dataKey="week" tickLine={false} axisLine={false} />
              <YAxis domain={[0, 100]} tickLine={false} axisLine={false} />
              <Tooltip />
              <Line type="monotone" dataKey="rate" name="Example attendance" stroke="#14a991" strokeWidth={3} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel title="Course-demand demonstration" description="Example enrollment and illustrative forecast">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={courseDemandDemo} margin={{ top: 10, right: 12, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e9eef5" />
              <XAxis dataKey="course" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} />
              <Tooltip />
              <Legend />
              <Bar dataKey="current" name="Example enrollment" fill="#356ae6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="illustrativeForecast" name="Illustrative forecast" radius={[4, 4, 0, 0]}>
                {courseDemandDemo.map((entry) => <Cell key={entry.course} fill="#14a991" />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>

        <Paper className="guest-chart-panel guest-demo-notes" elevation={0}>
          <div className="guest-panel-heading">
            <div>
              <Typography variant="h6">Predictive & anomaly demos</Typography>
              <Typography variant="body2">Example outputs only; no model is queried.</Typography>
            </div>
            <Chip size="small" label="DEMO" color="secondary" variant="outlined" />
          </div>
          <Box className="guest-demo-item">
            <Chip size="small" label="Illustrative" color="primary" variant="outlined" />
            <div><strong>Performance outlook</strong><span>Example trend: steady improvement across terms.</span></div>
          </Box>
          <Box className="guest-demo-item">
            <Chip size="small" label="Illustrative" color="secondary" variant="outlined" />
            <div><strong>Attendance pattern</strong><span>Example signal: consistent weekly attendance.</span></div>
          </Box>
          <Box className="guest-demo-item">
            <Chip size="small" label="Example alert" color="warning" variant="outlined" />
            <div><strong>Unusual score change</strong><span>Demonstrates how a non-personal anomaly notice may appear.</span></div>
          </Box>
        </Paper>
      </div>
    </div>
  );
}
