import { useMemo, useState } from "react";
import {
  Avatar,
  Button,
  Chip,
  Divider,
  IconButton,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  Clock3,
  Download,
  GraduationCap,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Sparkles,
  Users,
  UserRound,
  UserRoundX,
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
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  alerts,
  attendanceTrend,
  atRiskStudents,
  courseDemand,
  departmentPerformance,
  dropoutRisk,
  enrollmentTrend,
  kpis,
  processingActivity,
  upcomingEvents,
} from "../../data/mockData.js";

const iconMap = {
  students: Users,
  teachers: UserRound,
  courses: BookOpen,
  attendance: Activity,
  risk: UserRoundX,
  gpa: GraduationCap,
};

const periodOptions = ["Current semester", "This academic year", "Last 12 months"];

function ChartTooltipContent({ active, payload, label, suffix = "" }) {
  if (!active || !payload?.length) return null;

  return (
    <div className="chart-tooltip">
      <strong>{label}</strong>
      {payload.map((item) => (
        <div key={item.dataKey} className="tooltip-line">
          <span className="tooltip-dot" style={{ background: item.color }} />
          <span>{item.name || item.dataKey}</span>
          <b>
            {item.value?.toLocaleString()}
            {suffix}
          </b>
        </div>
      ))}
    </div>
  );
}

function ChartPanel({ title, subtitle, action, children, className = "" }) {
  return (
    <Paper className={`chart-panel ${className}`} elevation={0}>
      <div className="panel-heading">
        <div>
          <Typography className="panel-title">{title}</Typography>
          <Typography className="panel-subtitle">{subtitle}</Typography>
        </div>
        {action}
      </div>
      {children}
    </Paper>
  );
}

function KpiCard({ item }) {
  const Icon = iconMap[item.icon];
  const TrendIcon = item.delta.startsWith("-") ? ArrowDownRight : ArrowUpRight;
  return (
    <Paper className="kpi-card" elevation={0}>
      <div className={`kpi-icon kpi-icon-${item.tone}`}>
        <Icon size={19} strokeWidth={2} />
      </div>
      <div className="kpi-heading">
        <span>{item.label}</span>
        <Tooltip title="Compared with the previous semester">
          <IconButton size="small" aria-label={`${item.label} information`}>
            <MoreHorizontal size={17} />
          </IconButton>
        </Tooltip>
      </div>
      <div className="kpi-value">{item.value}</div>
      <div className="kpi-footer">
        <span className={`kpi-delta ${item.inverse ? "delta-good" : "delta-good"}`}>
          <TrendIcon size={14} />
          {item.delta}
        </span>
        <span className="kpi-detail">{item.detail}</span>
      </div>
      <div className="kpi-sparkline" aria-hidden="true">
        {item.points.map((point, index) => (
          <span
            key={`${item.label}-${index}`}
            style={{ height: `${point * 2.3}px` }}
            className={`spark-${item.tone}`}
          />
        ))}
      </div>
    </Paper>
  );
}

function RiskChip({ risk }) {
  return (
    <Chip
      size="small"
      label={risk}
      className={`risk-chip risk-${risk.toLowerCase()}`}
    />
  );
}

function AlertIcon({ severity }) {
  if (severity === "Critical") return <CircleAlert size={18} />;
  if (severity === "Success") return <CheckCircle2 size={18} />;
  return <Activity size={18} />;
}

function OverviewDashboard({ role, search, onNotify }) {
  const [period, setPeriod] = useState(periodOptions[0]);
  const [sortAscending, setSortAscending] = useState(false);

  const filteredStudents = useMemo(() => {
    const query = search.trim().toLowerCase();
    const students = atRiskStudents.filter(
      (student) =>
        !query ||
        student.name.toLowerCase().includes(query) ||
        student.id.toLowerCase().includes(query) ||
        student.department.toLowerCase().includes(query),
    );
    return [...students].sort((a, b) =>
      sortAscending ? a.gpa.localeCompare(b.gpa) : b.gpa.localeCompare(a.gpa),
    );
  }, [search, sortAscending]);

  const exportSnapshot = () => {
    const rows = [
      ["Metric", "Value"],
      ...kpis.map(({ label, value }) => [label, value]),
    ];
    const csv = rows.map((row) => row.map((field) => `"${field}"`).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "edupredict-dashboard-summary.csv";
    link.click();
    URL.revokeObjectURL(url);
    onNotify("Dashboard summary exported as CSV");
  };

  const roleHeading = role === "Administrator" ? "Good morning, Alex" : `Welcome, ${role}`;

  return (
    <div className="dashboard-page">
      <div className="page-heading-row">
        <div>
          <div className="breadcrumb">Overview <span>/</span> Dashboard</div>
          <h1 className="greeting">{roleHeading} <span className="wave">✦</span></h1>
          <p className="page-description">
            Here&apos;s what&apos;s happening across your institution today.
            <span className="demo-label"><Sparkles size={13} /> Demo data</span>
          </p>
        </div>
        <div className="heading-actions">
          <Button
            variant="outlined"
            startIcon={<Download size={16} />}
            onClick={exportSnapshot}
            className="export-button"
          >
            Export report
          </Button>
          <Button
            variant="contained"
            startIcon={<Plus size={16} />}
            onClick={() => onNotify("Quick action menu is ready for the next phase")}
            className="primary-button"
          >
            Quick action
          </Button>
        </div>
      </div>

      <div className="overview-toolbar">
        <div className="date-context">
          <div className="calendar-icon"><CalendarDays size={16} /></div>
          <div>
            <strong>Fall Semester 2025</strong>
            <span>Academic year 2025–2026</span>
          </div>
        </div>
        <Select
          size="small"
          value={period}
          onChange={(event) => setPeriod(event.target.value)}
          className="period-select"
          IconComponent={ChevronDown}
          aria-label="Dashboard time period"
        >
          {periodOptions.map((option) => (
            <MenuItem key={option} value={option}>{option}</MenuItem>
          ))}
        </Select>
        <Tooltip title="Refresh dashboard">
          <IconButton
            className="refresh-button"
            aria-label="Refresh dashboard"
            onClick={() => onNotify("Dashboard data refreshed")}
          >
            <RefreshCw size={17} />
          </IconButton>
        </Tooltip>
      </div>

      <div className="kpi-grid">
        {kpis.map((item) => <KpiCard key={item.label} item={item} />)}
      </div>

      <div className="chart-grid chart-grid-top">
        <ChartPanel
          title="Student enrollment"
          subtitle="Enrollment growth across semesters"
          action={<button className="text-action" onClick={() => onNotify("Enrollment report opened")}>View report <ArrowRight size={14} /></button>}
        >
          <div className="chart-legend"><span className="legend-dot blue-dot" /> Total enrollment <span className="chart-insight">+8.2% this year</span></div>
          <div className="chart-area enrollment-chart">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={enrollmentTrend} margin={{ top: 10, right: 6, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="enrollmentFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#356ae6" stopOpacity={0.18} />
                    <stop offset="95%" stopColor="#356ae6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="#edf0f5" />
                <XAxis dataKey="term" axisLine={false} tickLine={false} tick={{ fill: "#8290a5", fontSize: 11 }} dy={9} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: "#8290a5", fontSize: 11 }} tickFormatter={(value) => `${value / 1000}k`} />
                <ChartTooltip content={<ChartTooltipContent suffix=" students" />} />
                <Area type="monotone" dataKey="students" name="Students" stroke="#356ae6" strokeWidth={2.5} fill="url(#enrollmentFill)" activeDot={{ r: 5, strokeWidth: 0 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartPanel>

        <ChartPanel title="Dropout risk distribution" subtitle="Student population by risk level">
          <div className="risk-chart-wrap">
            <div className="risk-donut">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={dropoutRisk} dataKey="value" nameKey="name" innerRadius="72%" outerRadius="94%" paddingAngle={4} stroke="none">
                    {dropoutRisk.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                  </Pie>
                  <ChartTooltip content={<ChartTooltipContent suffix="%" />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="donut-center"><strong>12.4k</strong><span>students</span></div>
            </div>
            <div className="risk-legend">
              {dropoutRisk.map((item) => (
                <div className="risk-legend-row" key={item.name}>
                  <span className="legend-dot" style={{ background: item.color }} />
                  <span>{item.name}</span><strong>{item.value}%</strong>
                </div>
              ))}
              <Divider sx={{ my: 1.5 }} />
              <div className="risk-note"><CircleAlert size={15} /> 328 students need attention</div>
            </div>
          </div>
          <div className="demo-disclaimer">Illustrative demo data · not a real model output</div>
        </ChartPanel>
      </div>

      <div className="chart-grid chart-grid-middle">
        <ChartPanel title="Academic performance" subtitle="Average score by department" action={<button className="icon-link" aria-label="More performance options"><MoreHorizontal size={19} /></button>}>
          <div className="chart-legend"><span className="legend-dot blue-dot" /> Current semester <span className="legend-dot pale-blue-dot" /> Previous semester</div>
          <div className="chart-area department-chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={departmentPerformance} barGap={5} margin={{ top: 12, right: 8, left: -24, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#edf0f5" />
                <XAxis dataKey="department" axisLine={false} tickLine={false} tick={{ fill: "#8290a5", fontSize: 10 }} dy={9} />
                <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fill: "#8290a5", fontSize: 10 }} />
                <ChartTooltip content={<ChartTooltipContent suffix="%" />} />
                <Bar dataKey="score" name="Current" fill="#356ae6" radius={[5, 5, 0, 0]} maxBarSize={24} />
                <Bar dataKey="previous" name="Previous" fill="#cbd9f7" radius={[5, 5, 0, 0]} maxBarSize={24} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartPanel>

        <ChartPanel title="Attendance trend" subtitle="Monthly attendance against 85% target" action={<button className="text-action" onClick={() => onNotify("Attendance analytics opened")}>Details <ArrowRight size={14} /></button>}>
          <div className="chart-legend"><span className="legend-dot teal-dot" /> Attendance <span className="legend-line" /> Target</div>
          <div className="chart-area department-chart">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={attendanceTrend} margin={{ top: 12, right: 8, left: -24, bottom: 0 }}>
                <defs>
                  <linearGradient id="attendanceFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#14b8a6" stopOpacity={0.17} />
                    <stop offset="95%" stopColor="#14b8a6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="#edf0f5" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "#8290a5", fontSize: 11 }} dy={9} />
                <YAxis domain={[70, 100]} axisLine={false} tickLine={false} tick={{ fill: "#8290a5", fontSize: 10 }} tickFormatter={(value) => `${value}%`} />
                <ChartTooltip content={<ChartTooltipContent suffix="%" />} />
                <Area type="monotone" dataKey="attendance" name="Attendance" stroke="#14b8a6" strokeWidth={2.5} fill="url(#attendanceFill)" activeDot={{ r: 4, strokeWidth: 0 }} />
                <Line type="monotone" dataKey="target" name="Target" stroke="#aab5c6" strokeDasharray="5 5" dot={false} strokeWidth={1.5} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartPanel>

        <ChartPanel title="Course demand forecast" subtitle="Enrollment history and projection" action={<span className="forecast-tag"><Sparkles size={12} /> Forecast</span>}>
          <div className="chart-legend"><span className="legend-dot blue-dot" /> Historical <span className="legend-dot forecast-dot" /> Predicted</div>
          <div className="chart-area department-chart">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={courseDemand} margin={{ top: 12, right: 6, left: -24, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#edf0f5" />
                <XAxis dataKey="term" axisLine={false} tickLine={false} tick={{ fill: "#8290a5", fontSize: 10 }} dy={9} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: "#8290a5", fontSize: 10 }} />
                <ChartTooltip content={<ChartTooltipContent suffix=" enrollments" />} />
                <Line type="monotone" dataKey="actual" name="Historical" stroke="#356ae6" strokeWidth={2.5} connectNulls={false} dot={{ r: 3, fill: "#356ae6", strokeWidth: 0 }} />
                <Line type="monotone" dataKey="forecast" name="Predicted" stroke="#9c7ce7" strokeWidth={2.5} strokeDasharray="5 5" connectNulls dot={{ r: 3, fill: "#9c7ce7", strokeWidth: 0 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="demo-disclaimer">Illustrative demo data · forecast is not model-generated</div>
        </ChartPanel>
      </div>

      <div className="lower-grid">
        <Paper className="table-panel" elevation={0}>
          <div className="panel-heading table-heading">
            <div>
              <Typography className="panel-title">Students at risk</Typography>
              <Typography className="panel-subtitle">Students who may need additional support</Typography>
            </div>
            <button className="text-action" onClick={() => onNotify("At-risk student list opened")}>View all <ArrowRight size={14} /></button>
          </div>
          <div className="table-scroll">
            <Table size="small" aria-label="Students at risk">
              <TableHead>
                <TableRow>
                  <TableCell>STUDENT</TableCell>
                  <TableCell>DEPARTMENT</TableCell>
                  <TableCell align="right">
                    <button className="sort-button" onClick={() => setSortAscending((current) => !current)}>
                      GPA {sortAscending ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                    </button>
                  </TableCell>
                  <TableCell align="right">ATTENDANCE</TableCell>
                  <TableCell>RISK</TableCell>
                  <TableCell />
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredStudents.map((student) => (
                  <TableRow key={student.id} hover>
                    <TableCell>
                      <div className="student-cell">
                        <Avatar className="student-avatar" sx={{ bgcolor: student.color }}>{student.initials}</Avatar>
                        <div><strong>{student.name}</strong><span>{student.id}</span></div>
                      </div>
                    </TableCell>
                    <TableCell>{student.department}</TableCell>
                    <TableCell align="right"><strong>{student.gpa}</strong></TableCell>
                    <TableCell align="right">{student.attendance}%</TableCell>
                    <TableCell><RiskChip risk={student.risk} /></TableCell>
                    <TableCell align="right">
                      <Tooltip title="View student demo profile">
                        <IconButton size="small" aria-label={`View ${student.name}`} onClick={() => onNotify(`Opening ${student.name}'s demo profile`)}>
                          <ArrowRight size={16} />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
                {!filteredStudents.length && (
                  <TableRow><TableCell colSpan={6} align="center" sx={{ py: 4 }}>No students match “{search}”.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </Paper>

        <Paper className="updates-panel" elevation={0}>
          <div className="panel-heading">
            <div><Typography className="panel-title">Recent alerts</Typography><Typography className="panel-subtitle">Important updates from your campus</Typography></div>
            <IconButton size="small" aria-label="More alerts" onClick={() => onNotify("All alerts opened")}><MoreHorizontal size={19} /></IconButton>
          </div>
          <div className="alert-list">
            {alerts.map((alert) => (
              <div className="alert-row" key={alert.title}>
                <div className={`alert-icon alert-${alert.severity.toLowerCase()}`}><AlertIcon severity={alert.severity} /></div>
                <div className="alert-copy"><strong>{alert.title}</strong><span>{alert.description}</span><small><Clock3 size={12} /> {alert.time}</small></div>
                <span className={`severity-dot severity-${alert.severity.toLowerCase()}`} />
              </div>
            ))}
          </div>
          <button className="full-width-link" onClick={() => onNotify("Notifications center opened")}>View all notifications <ArrowRight size={15} /></button>
        </Paper>
      </div>

      <div className="lower-grid lower-grid-bottom">
        <Paper className="updates-panel" elevation={0}>
          <div className="panel-heading"><div><Typography className="panel-title">Data processing</Typography><Typography className="panel-subtitle">Recent dataset activity</Typography></div><button className="text-action" onClick={() => onNotify("Dataset activity opened")}>View all <ArrowRight size={14} /></button></div>
          <div className="processing-list">
            {processingActivity.map((item) => (
              <div className="processing-row" key={item.name}>
                <div className="processing-file"><BookOpen size={17} /></div>
                <div className="processing-copy"><strong>{item.name}</strong><span>{item.meta}</span>{item.status === "Processing" && <LinearProgress variant="determinate" value={item.progress} className="processing-progress" />}</div>
                <Chip size="small" label={item.status} className={`processing-status ${item.status === "Completed" ? "is-complete" : "is-processing"}`} />
              </div>
            ))}
          </div>
        </Paper>
        <Paper className="updates-panel" elevation={0}>
          <div className="panel-heading"><div><Typography className="panel-title">Upcoming events</Typography><Typography className="panel-subtitle">Keep track of key academic dates</Typography></div><IconButton size="small" aria-label="Calendar" onClick={() => onNotify("Academic calendar opened")}><CalendarDays size={17} /></IconButton></div>
          <div className="events-list">
            {upcomingEvents.map((event) => (
              <div className="event-row" key={event.title}>
                <div className="event-date"><strong>{event.day}</strong><span>{event.month}</span></div>
                <div className="event-copy"><strong>{event.title}</strong><span>{event.meta}</span></div>
                <ArrowRight size={15} className="event-arrow" />
              </div>
            ))}
          </div>
        </Paper>
      </div>
      <div className="dashboard-footnote">All figures shown are illustrative demonstration data. Predictions are not generated by a trained model.</div>
    </div>
  );
}

export default function AdminDashboard({ role, search, onNotify }) {
  return <OverviewDashboard role={role} search={search} onNotify={onNotify} />;
}
