export const kpis = [
  {
    label: "Total students",
    value: "12,450",
    delta: "+8.2%",
    detail: "vs previous semester",
    icon: "students",
    tone: "blue",
    points: [5, 7, 6, 9, 8, 11, 13],
  },
  {
    label: "Total teachers",
    value: "420",
    delta: "+3.4%",
    detail: "vs previous semester",
    icon: "teachers",
    tone: "purple",
    points: [7, 6, 8, 8, 10, 9, 12],
  },
  {
    label: "Active courses",
    value: "186",
    delta: "+5.7%",
    detail: "vs previous semester",
    icon: "courses",
    tone: "teal",
    points: [4, 6, 5, 7, 8, 7, 10],
  },
  {
    label: "Avg. attendance",
    value: "87.4%",
    delta: "+2.1%",
    detail: "vs previous semester",
    icon: "attendance",
    tone: "orange",
    points: [7, 6, 8, 7, 9, 10, 12],
  },
  {
    label: "Students at risk",
    value: "328",
    delta: "-4.8%",
    detail: "vs previous semester",
    icon: "risk",
    tone: "red",
    points: [13, 12, 11, 12, 9, 10, 8],
    inverse: true,
  },
  {
    label: "Average GPA",
    value: "3.24",
    delta: "+0.12",
    detail: "vs previous semester",
    icon: "gpa",
    tone: "green",
    points: [5, 6, 6, 8, 7, 10, 12],
  },
];

export const enrollmentTrend = [
  { term: "Fall '22", students: 8900 },
  { term: "Spr '23", students: 9400 },
  { term: "Fall '23", students: 10100 },
  { term: "Spr '24", students: 10800 },
  { term: "Fall '24", students: 11350 },
  { term: "Spr '25", students: 12100 },
  { term: "Fall '25", students: 12450 },
];

export const departmentPerformance = [
  { department: "Engineering", score: 82, previous: 77 },
  { department: "Business", score: 76, previous: 73 },
  { department: "Sciences", score: 88, previous: 84 },
  { department: "Arts", score: 79, previous: 76 },
  { department: "Health", score: 85, previous: 80 },
];

export const dropoutRisk = [
  { name: "Low risk", value: 72, color: "#18a990" },
  { name: "Medium risk", value: 19, color: "#f4ad48" },
  { name: "High risk", value: 9, color: "#ed6b6b" },
];

export const attendanceTrend = [
  { month: "Jan", attendance: 83, target: 85 },
  { month: "Feb", attendance: 86, target: 85 },
  { month: "Mar", attendance: 84, target: 85 },
  { month: "Apr", attendance: 89, target: 85 },
  { month: "May", attendance: 87, target: 85 },
  { month: "Jun", attendance: 91, target: 85 },
  { month: "Jul", attendance: 88, target: 85 },
  { month: "Aug", attendance: 87, target: 85 },
];

export const courseDemand = [
  { term: "Fall '23", actual: 420, forecast: null },
  { term: "Spr '24", actual: 510, forecast: null },
  { term: "Fall '24", actual: 480, forecast: null },
  { term: "Spr '25", actual: 590, forecast: null },
  { term: "Fall '25", actual: 620, forecast: 620 },
  { term: "Spr '26", actual: null, forecast: 710 },
  { term: "Fall '26", actual: null, forecast: 765 },
  { term: "Spr '27", actual: null, forecast: 820 },
];

export const atRiskStudents = [
  {
    id: "STU-2024-0842",
    name: "Olivia Bennett",
    initials: "OB",
    department: "Engineering",
    gpa: "2.14",
    attendance: 68,
    risk: "High",
    color: "#f4d8cb",
  },
  {
    id: "STU-2023-1196",
    name: "Ethan Mitchell",
    initials: "EM",
    department: "Business",
    gpa: "2.38",
    attendance: 72,
    risk: "High",
    color: "#d9e7fa",
  },
  {
    id: "STU-2024-0231",
    name: "Sophia Turner",
    initials: "ST",
    department: "Sciences",
    gpa: "2.61",
    attendance: 76,
    risk: "Medium",
    color: "#e5dcf4",
  },
  {
    id: "STU-2022-0748",
    name: "Noah Williams",
    initials: "NW",
    department: "Arts",
    gpa: "2.72",
    attendance: 79,
    risk: "Medium",
    color: "#d7eee9",
  },
  {
    id: "STU-2024-1510",
    name: "Ava Rodriguez",
    initials: "AR",
    department: "Health",
    gpa: "2.89",
    attendance: 81,
    risk: "Medium",
    color: "#f0e2c7",
  },
];

export const alerts = [
  {
    title: "Attendance threshold reached",
    description: "12 students in Engineering are below 70% attendance",
    time: "12 min ago",
    severity: "Critical",
    initials: "AT",
  },
  {
    title: "Performance drop detected",
    description: "CS-204 midterm average decreased by 18%",
    time: "48 min ago",
    severity: "Warning",
    initials: "PD",
  },
  {
    title: "New dataset processed",
    description: "Spring 2025 enrollment data is ready to review",
    time: "2 hours ago",
    severity: "Success",
    initials: "DS",
  },
];

export const processingActivity = [
  { name: "Spring 2025 Enrollment", meta: "12,450 records · 8 min ago", status: "Completed", progress: 100 },
  { name: "Attendance — Week 18", meta: "9,820 records · 32 min ago", status: "Completed", progress: 100 },
  { name: "LMS Activity Export", meta: "6,240 records · 1 hour ago", status: "Processing", progress: 68 },
];

export const upcomingEvents = [
  { day: "04", month: "NOV", title: "Final examination period", meta: "All departments · 9:00 AM" },
  { day: "12", month: "NOV", title: "Course registration opens", meta: "Spring semester · 8:30 AM" },
  { day: "18", month: "NOV", title: "Academic board meeting", meta: "Main campus · 2:00 PM" },
];

export const initialNotifications = [
  { id: 1, title: "Attendance alert", text: "12 Engineering students are below the attendance threshold.", time: "12 min ago", read: false },
  { id: 2, title: "Dataset processed", text: "Spring 2025 enrollment data is ready to review.", time: "2 hours ago", read: false },
  { id: 3, title: "Weekly report ready", text: "Your academic performance summary is available.", time: "Yesterday", read: true },
];
