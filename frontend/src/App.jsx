import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CssBaseline,
  CircularProgress,
  Paper,
  Snackbar,
  TextField,
  ThemeProvider,
  createTheme,
} from "@mui/material";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "./components/layout/AppLayout.jsx";
import AccountPage from "./components/AccountPage.jsx";
import ResourcePage from "./components/ResourcePage.jsx";
import api from "./services/api.js";

const LiveDashboard = lazy(() => import("./components/dashboard/LiveDashboard.jsx"));
const AnalyticsDashboard = lazy(() => import("./components/dashboard/AnalyticsDashboard.jsx"));

const resourceRoutes = [
  "users", "students", "teachers", "courses", "enrollments", "attendance", "performance",
  "predictions", "datasets", "alerts", "support",
];
const resourceRoles = {
  users: ["admin"],
  students: ["admin", "teacher", "student"],
  teachers: ["admin", "teacher"],
  courses: ["admin", "teacher", "student"],
  enrollments: ["admin", "teacher", "student", "analyst"],
  attendance: ["admin", "teacher", "student", "analyst"],
  performance: ["admin", "teacher", "student", "analyst"],
  predictions: ["admin", "analyst", "teacher", "student"],
  datasets: ["admin", "analyst"],
  alerts: ["admin", "teacher", "student", "analyst"],
  support: ["admin", "teacher", "student"],
};

function AccessDenied() {
  return <Alert severity="error">You do not have permission to access this section.</Alert>;
}

function AuthPanel({ onAuthenticated, initialError = "" }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState(initialError);
  const [saving, setSaving] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const { data } = await api.post(`/auth/${mode}`, form);
      localStorage.setItem("edupredict-token", data.token);
      onAuthenticated(data.user);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to connect to the EduPredict API.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box className="auth-screen">
      <Paper className="auth-card" elevation={0}>
        <div className="brand-mark auth-brand">E</div>
        <h1>{mode === "login" ? "Welcome back" : "Create your account"}</h1>
        <p>Sign in to your EduPredict workspace.</p>
        {error && <Alert severity="error">{error}</Alert>}
        <form className="auth-form" onSubmit={submit}>
          {mode === "register" && <TextField label="Name" required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />}
          <TextField label="Email" type="email" required autoComplete="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
          <TextField label="Password" type="password" required inputProps={{ minLength: 8, maxLength: 72 }} autoComplete={mode === "login" ? "current-password" : "new-password"} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
          <Button type="submit" variant="contained" disabled={saving}>{saving ? "Please wait..." : mode === "login" ? "Sign in" : "Register"}</Button>
        </form>
        <button className="auth-switch" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}>
          {mode === "login" ? "New here? Create an account" : "Already have an account? Sign in"}
        </button>
      </Paper>
    </Box>
  );
}

function AppContent({ darkMode, onToggleTheme }) {
  const [user, setUser] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [sessionError, setSessionError] = useState("");
  const [toast, setToast] = useState("");
  const [toastSeverity, setToastSeverity] = useState("success");
  const [search, setSearch] = useState("");

  const showToast = useCallback((message, severity = "success") => {
    setToast(message);
    setToastSeverity(severity);
  }, []);
  const closeToast = () => setToast("");

  useEffect(() => {
    const token = localStorage.getItem("edupredict-token");
    if (!token) {
      setCheckingSession(false);
      return;
    }
    api.get("/auth/me")
      .then(({ data }) => setUser(data.user))
      .catch((requestError) => {
        localStorage.removeItem("edupredict-token");
        setSessionError(requestError.response?.data?.message || "Unable to validate your session. Sign in again.");
      })
      .finally(() => setCheckingSession(false));
  }, []);

  useEffect(() => {
    const handleUnauthorized = () => {
      setUser(null);
      setSessionError("Your session expired or is no longer valid. Sign in again.");
    };
    window.addEventListener("edupredict:unauthorized", handleUnauthorized);
    return () => window.removeEventListener("edupredict:unauthorized", handleUnauthorized);
  }, []);

  const logout = () => {
    const token = localStorage.getItem("edupredict-token");
    api.post("/auth/logout", {}, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }).catch((requestError) => {
      showToast(requestError.response?.data?.message || "Your local session ended, but the server could not invalidate its token.", "error");
    });
    localStorage.removeItem("edupredict-token");
    setUser(null);
  };

  if (checkingSession) return <Box className="loading-view"><CircularProgress size={26} /></Box>;
  if (!user) return <AuthPanel onAuthenticated={setUser} initialError={sessionError} />;

  return (
    <BrowserRouter>
      <AppLayout
        darkMode={darkMode}
        onToggleTheme={onToggleTheme}
        role={user.role}
        user={user}
        onLogout={logout}
        onNotify={showToast}
        search={search}
        onSearchChange={setSearch}
      >
        <Routes>
          <Route
            path="/"
            element={
              <Suspense fallback={<Box className="loading-view"><CircularProgress size={26} /></Box>}>
                <LiveDashboard onNotify={showToast} />
              </Suspense>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
          {resourceRoutes.map((path) => (
            <Route
              key={path}
              path={`/${path}`}
              element={resourceRoles[path].includes(user.role)
                ? <ResourcePage resource={path} role={user.role} search={search} onNotify={showToast} />
                : <AccessDenied />}
            />
          ))}
          <Route path="/analytics" element={["admin", "analyst"].includes(user.role)
            ? <Suspense fallback={<Box className="loading-view"><CircularProgress size={26} /></Box>}><AnalyticsDashboard /></Suspense>
            : <AccessDenied />} />
          <Route path="/anomalies" element={["admin", "analyst"].includes(user.role)
            ? <ResourcePage resource="alerts" role={user.role} search={search} onNotify={showToast} />
            : <AccessDenied />} />
          <Route path="/profile" element={<AccountPage user={user} onUserUpdated={setUser} onNotify={showToast} />} />
          <Route path="/settings" element={user.role === "admin"
            ? <AccountPage user={user} onUserUpdated={setUser} onNotify={showToast} />
            : <AccessDenied />} />
        </Routes>
      </AppLayout>
      <Snackbar
        open={Boolean(toast)}
        autoHideDuration={3200}
        onClose={closeToast}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert onClose={closeToast} severity={toastSeverity} variant="filled">
          {toast}
        </Alert>
      </Snackbar>
    </BrowserRouter>
  );
}

export default function App() {
  const [darkMode, setDarkMode] = useState(() => {
    try {
      return localStorage.getItem("edupredict-theme") === "dark";
    } catch {
      return false;
    }
  });

  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode: darkMode ? "dark" : "light",
          primary: { main: "#356ae6" },
          secondary: { main: "#14b8a6" },
          background: {
            default: darkMode ? "#111827" : "#f5f7fb",
            paper: darkMode ? "#1b2638" : "#ffffff",
          },
          text: {
            primary: darkMode ? "#edf2fa" : "#142d4e",
            secondary: darkMode ? "#a5b2c7" : "#718096",
          },
        },
        shape: { borderRadius: 12 },
        typography: {
          fontFamily: '"Inter", "Segoe UI", Arial, sans-serif',
          button: { textTransform: "none", fontWeight: 600 },
        },
      }),
    [darkMode],
  );

  const toggleTheme = () => {
    setDarkMode((current) => {
      const next = !current;
      try {
        localStorage.setItem("edupredict-theme", next ? "dark" : "light");
      } catch {
        // The dashboard remains usable when browser storage is unavailable.
      }
      return next;
    });
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AppContent darkMode={darkMode} onToggleTheme={toggleTheme} />
    </ThemeProvider>
  );
}
