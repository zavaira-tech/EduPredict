/**
 * Static Demonstration Dataset for EduPredict Guest Mode.
 *
 * CRITICAL ARCHITECTURAL GUARANTEE:
 * This module contains ONLY synthetic, illustrative demonstration data.
 * It does NOT query MongoDB, does NOT require database connections,
 * and contains NO real student personal identifiable information (PII).
 */

export const DEMO_DATA_LABEL = "DEMO DATA — NOT LIVE DATABASE DATA";

export const guestAcademicOverview = {
  label: DEMO_DATA_LABEL,
  disclaimer: "Illustrative sample metrics. Not live institutional records.",
  metrics: [
    { label: "Example Course Completion", value: "84%", change: "+2.4% vs last term" },
    { label: "Example Attendance Rate", value: "91%", change: "+1.1% vs last term" },
    { label: "Sample Active Courses", value: "6", change: "Demo catalog" },
    { label: "Example Average GPA", value: "3.42", change: "Scale 0.0 - 4.0" },
  ],
  departmentBreakdown: [
    { department: "Computer Science", completionRate: 88, averageGpa: 3.51 },
    { department: "Data Science", completionRate: 85, averageGpa: 3.44 },
    { department: "Mathematics", completionRate: 81, averageGpa: 3.32 },
    { department: "Physics", completionRate: 83, averageGpa: 3.38 },
  ],
};

export const guestPerformanceDemo = [
  { term: "Term 1", score: 72, target: 70 },
  { term: "Term 2", score: 76, target: 72 },
  { term: "Term 3", score: 74, target: 75 },
  { term: "Term 4", score: 81, target: 78 },
  { term: "Term 5", score: 84, target: 80 },
];

export const guestGradeDistribution = [
  { grade: "A (90-100)", percentage: 28, count: 42 },
  { grade: "B (80-89)", percentage: 41, count: 62 },
  { grade: "C (70-79)", percentage: 21, count: 31 },
  { grade: "D (60-69)", percentage: 7, count: 11 },
  { grade: "F (<60)", percentage: 3, count: 4 },
];

export const guestAttendanceDemo = [
  { week: "Week 1", rate: 88, benchmark: 85 },
  { week: "Week 2", rate: 91, benchmark: 85 },
  { week: "Week 3", rate: 86, benchmark: 85 },
  { week: "Week 4", rate: 94, benchmark: 85 },
  { week: "Week 5", rate: 92, benchmark: 85 },
  { week: "Week 6", rate: 95, benchmark: 85 },
];

export const guestCourseDemandDemo = [
  { course: "Data Science", current: 64, illustrativeForecast: 71, capacity: 80 },
  { course: "Machine Learning", current: 58, illustrativeForecast: 68, capacity: 75 },
  { course: "Education Analytics", current: 52, illustrativeForecast: 58, capacity: 60 },
  { course: "Mathematics", current: 48, illustrativeForecast: 46, capacity: 55 },
  { course: "Biology", current: 39, illustrativeForecast: 44, capacity: 50 },
];

export const guestPredictiveAnalyticsDemo = {
  label: DEMO_DATA_LABEL,
  riskDistribution: [
    { level: "Low Risk", percentage: 70, description: "Consistent engagement & high marks" },
    { level: "Moderate Risk", percentage: 22, description: "Minor attendance or assignment gaps" },
    { level: "High Risk", percentage: 8, description: "Urgent academic intervention recommended" },
  ],
  keyFactors: [
    { factor: "Attendance Consistency", weight: 35, impact: "High" },
    { factor: "Midterm Assessment", weight: 30, impact: "High" },
    { factor: "Assignment Timeliness", weight: 20, impact: "Medium" },
    { factor: "Course Discussion Participation", weight: 15, impact: "Medium" },
  ],
  forecastOutlook: "Predictive model demonstrates 87.5% early-detection precision on synthetic training sets.",
};

export const guestAnomalyDetectionDemo = {
  label: DEMO_DATA_LABEL,
  anomalies: [
    {
      id: "demo-anomaly-1",
      title: "Sudden Attendance Dip",
      type: "Attendance",
      severity: "Moderate",
      detectedIn: "Week 3 (Illustrative)",
      status: "Resolved (Demo)",
      description: "Sample pattern showing 12% week-over-week drop in attendance during midterms.",
    },
    {
      id: "demo-anomaly-2",
      title: "Unusual Grade Fluctuation",
      type: "Performance",
      severity: "Low",
      detectedIn: "Term 3 - CS-101 (Illustrative)",
      status: "Investigating (Demo)",
      description: "Sample anomaly representing grade distribution shift beyond 2 standard deviations.",
    },
    {
      id: "demo-anomaly-3",
      title: "Enrollment Surge Outside Trend",
      type: "Course Demand",
      severity: "Informational",
      detectedIn: "Data Science Prep (Illustrative)",
      status: "Acknowledged (Demo)",
      description: "Sample demonstration of rapid demand spike exceeding regular seasonal forecasts.",
    },
  ],
};

export const guestPublicReports = [
  {
    id: "demo-report-2026-term1",
    title: "Public Demonstration Report: Term 1 Academic Performance Summary",
    category: "Academic Overview",
    publishedDate: "2026-03-01",
    label: DEMO_DATA_LABEL,
    summary: "Illustrative summary demonstrating high-level academic KPI reporting and trend analysis.",
    data: {
      averageScore: 78.4,
      totalDemoStudents: 150,
      completionRate: 84.2,
      retentionRate: 92.1,
    },
  },
  {
    id: "demo-report-2026-attendance",
    title: "Public Demonstration Report: Institutional Attendance Benchmarks",
    category: "Attendance",
    publishedDate: "2026-03-15",
    label: DEMO_DATA_LABEL,
    summary: "Demonstration report illustrating weekly attendance monitoring and threshold tracking.",
    data: {
      averageAttendance: 91.0,
      highestAttendanceWeek: "Week 6 (95%)",
      minimumThresholdMet: true,
    },
  },
  {
    id: "demo-report-2026-predictive",
    title: "Public Demonstration Report: Predictive Analytics and Retention Outlook",
    category: "Predictive Insights",
    publishedDate: "2026-04-01",
    label: DEMO_DATA_LABEL,
    summary: "Illustrative machine learning demonstration showing student risk classification distributions.",
    data: {
      modelName: "Demo Gradient Boosted Trees",
      evaluatedPrecision: 0.88,
      evaluatedRecall: 0.85,
    },
  },
];
