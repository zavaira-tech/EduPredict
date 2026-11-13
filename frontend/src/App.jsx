import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CssBaseline,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Snackbar,
  TextField,
  ThemeProvider,
  createTheme,
} from "@mui/material";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Eye } from "lucide-react";
import AppLayout from "./components/layout/AppLayout.jsx";
import AccountPage from "./components/AccountPage.jsx";
import ResourcePage from "./components/ResourcePage.jsx";
import api from "./services/api.js";

const LiveDashboard = lazy(() => import("./components/dashboard/LiveDashboard.jsx"));
const AnalyticsDashboard = lazy(() => import("./components/dashboard/AnalyticsDashboard.jsx"));
const AnomalyDashboard = lazy(() => import("./components/dashboard/AnomalyDashboard.jsx"));
const PredictiveAnalyticsDashboard = lazy(() => import("./components/dashboard/PredictiveAnalyticsDashboard.jsx"));
const GuestDashboard = lazy(() => import("./components/dashboard/GuestDashboard.jsx"));

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

function GuestRouteNotice() {
  return <Navigate to="/guest" replace state={{ guestMessage: "This section is available to registered users only. Guest mode is read-only." }} />;
}

function authRequestError(error, fallback) {
  if (error.response?.data?.message) return error.response.data.message;
  if (error.response?.data?.error) return error.response.data.error;
  if (typeof error.response?.data === "string" && error.response.data.trim() && !error.response.data.includes("<!DOCTYPE")) {
    return error.response.data.trim();
  }
  if (error.code === "ERR_NETWORK") {
    return `Cannot reach the EduPredict API at ${api.defaults.baseURL}. Start the backend and verify its port and frontend origin.`;
  }
  if (error.code === "ECONNABORTED") {
    return "The EduPredict API request timed out. Check that the backend and its configured services are responsive.";
  }
  if (error.response?.status) {
    return `Server responded with HTTP ${error.response.status}${error.response.statusText ? ` (${error.response.statusText})` : ""}.`;
  }
  return error.message || fallback;
}

function AuthPanel({ onAuthenticated, onContinueAsGuest, initialError = "", initialNotice = "" }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState(initialError);
  const [notice, setNotice] = useState(initialNotice);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setError(initialError);
  }, [initialError]);

  useEffect(() => {
    setNotice(initialNotice);
  }, [initialNotice]);

  const submit = async (event) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      const { data } = await api.post(`/auth/${mode}`, form);
      localStorage.setItem("edupredict-token", data.token);
      onAuthenticated(data.user);
    } catch (requestError) {
      setError(authRequestError(requestError, "Unable to sign in."));
    } finally {
      setSaving(false);
    }
  };

  const continueAsGuest = async () => {
    if (saving) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await onContinueAsGuest();
    } catch (requestError) {
      setError(authRequestError(requestError, "Unable to start a guest session."));
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
        {notice && <Alert severity="info" sx={{ mt: 1 }}>{notice}</Alert>}
        <form className="auth-form" onSubmit={submit}>
          {mode === "register" && <TextField label="Name" required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />}
          <TextField label="Email" type="email" required autoComplete="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
          <TextField label="Password" type="password" required inputProps={{ minLength: 8, maxLength: 72 }} autoComplete={mode === "login" ? "current-password" : "new-password"} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
          <Button type="submit" variant="contained" disabled={saving}>{saving ? "Please wait..." : mode === "login" ? "Sign in" : "Register"}</Button>
        </form>
        {mode === "login" && (
          <Button
            fullWidth
            variant="outlined"
            className="guest-button"
            startIcon={<Eye size={17} />}
            onClick={continueAsGuest}
            disabled={saving}
          >
            {saving ? "Starting guest session..." : "Continue as Guest"}
          </Button>
        )}
        {mode === "login" && (
          <button
            type="button"
            className="auth-link"
            onClick={() => setNotice("Password recovery is not configured. Please contact your institution administrator.")}
          >
            Forgot password?
          </button>
        )}
        <button type="button" className="auth-switch" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); setNotice(""); }}>
          {mode === "login" ? "New here? Create an account" : "Already have an account? Sign in"}
        </button>
      </Paper>
    </Box>
  );
}

function AppContent({ darkMode, onToggleTheme }) {
  const [user, setUser] = useState(null);
  const guestExpiryTimer = useRef(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [sessionError, setSessionError] = useState("");
  const [toast, setToast] = useState("");
  const [toastSeverity, setToastSeverity] = useState("success");
  const [search, setSearch] = useState("");
  const [authNotice, setAuthNotice] = useState("");
  const [confirmGuestExit, setConfirmGuestExit] = useState(false);

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
      .then(({ data }) => setUser(data.expiresAt ? { ...data.user, expiresAt: data.expiresAt } : data.user))
      .catch((requestError) => {
        localStorage.removeItem("edupredict-token");
        setSessionError(requestError.response?.data?.message || "Unable to validate your session. Sign in again.");
      })
      .finally(() => setCheckingSession(false));
  }, []);

  useEffect(() => {
    if (user?.role !== "guest" || !user.expiresAt) return undefined;
    const expiresIn = Math.max(0, Date.parse(user.expiresAt) - Date.now());
    guestExpiryTimer.current = window.setTimeout(() => {
      localStorage.removeItem("edupredict-token");
      window.history.replaceState(null, "", "/");
      setSessionError("Your guest session expired. Start a new guest session or sign in.");
      setUser(null);
    }, expiresIn);
    return () => window.clearTimeout(guestExpiryTimer.current);
  }, [user]);

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
    const endpoint = user?.role === "guest" ? "/auth/guest/logout" : "/auth/logout";
    api.post(endpoint, {}, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }).catch((requestError) => {
      showToast(requestError.response?.data?.message || "Your local session ended, but the server could not invalidate its token.", "error");
    });
    localStorage.removeItem("edupredict-token");
    setUser(null);
  };

  const continueAsGuest = async () => {
    const { data } = await api.post("/auth/guest");
    localStorage.setItem("edupredict-token", data.token);
    window.history.replaceState(null, "", "/guest");
    setSessionError("");
    setAuthNotice("");
    setUser({ ...data.user, expiresAt: data.expiresAt });
  };

  const finishGuestUpgrade = async () => {
    setConfirmGuestExit(false);
    const token = localStorage.getItem("edupredict-token");
    try {
      await api.post("/auth/guest/logout", {}, {
        headers: token ? { Authorization: "Bearer " + token } : {},
      });
    } catch (requestError) {
      showToast(requestError.response?.data?.message || "The guest session could not be ended on the server.", "error");
    }
    localStorage.removeItem("edupredict-token");
    window.history.replaceState(null, "", "/");
    setSessionError("");
    setAuthNotice("Guest mode has ended. Sign in or create an account to continue.");
    setUser(null);
  };
  const requestGuestUpgrade = () => setConfirmGuestExit(true);
  const onAuthenticated = (authenticatedUser) => {
    setSessionError("");
    setAuthNotice("");
    setUser(authenticatedUser);
  };

  if (checkingSession) return <Box className="loading-view"><CircularProgress size={26} /></Box>;
  if (!user) return (
    <AuthPanel
      onAuthenticated={onAuthenticated}
      onContinueAsGuest={continueAsGuest}
      initialError={sessionError}
      initialNotice={authNotice}
    />
  );

  return (
    <BrowserRouter>
      <AppLayout
        darkMode={darkMode}
        onToggleTheme={onToggleTheme}
        role={user.role}
        user={user}
        onLogout={logout}
        onUpgrade={requestGuestUpgrade}
        onNotify={showToast}
        search={search}
        onSearchChange={setSearch}
      >
        <Routes>
          <Route
            path="/"
            element={
              user.role === "guest"
                ? <Navigate to="/guest" replace />
                : <Suspense fallback={<Box className="loading-view"><CircularProgress size={26} /></Box>}>
                    <LiveDashboard onNotify={showToast} />
                  </Suspense>
            }
          />
          <Route path="/guest" element={user.role === "guest"
            ? <Suspense fallback={<Box className="loading-view"><CircularProgress size={26} /></Box>}><GuestDashboard onUpgrade={requestGuestUpgrade} /></Suspense>
            : <Navigate to="/" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
          {resourceRoutes.map((path) => (
            <Route
              key={path}
              path={"/" + path}
              element={user.role === "guest"
                ? <GuestRouteNotice />
                : resourceRoles[path].includes(user.role)
                  ? <ResourcePage resource={path} role={user.role} search={search} onNotify={showToast} />
                  : <AccessDenied />}
            />
          ))}
          <Route path="/analytics" element={["admin", "analyst", "teacher", "student"].includes(user.role)
            ? <Suspense fallback={<Box className="loading-view"><CircularProgress size={26} /></Box>}><AnalyticsDashboard user={user} /></Suspense>
            : user.role === "guest" ? <GuestRouteNotice /> : <AccessDenied />} />
          <Route path="/ml" element={["admin", "analyst", "teacher", "student"].includes(user.role)
            ? <Suspense fallback={<Box className="loading-view"><CircularProgress size={26} /></Box>}><PredictiveAnalyticsDashboard user={user} /></Suspense>
            : user.role === "guest" ? <GuestRouteNotice /> : <AccessDenied />} />
          <Route path="/anomalies" element={["admin", "analyst"].includes(user.role)
            ? <Suspense fallback={<Box className="loading-view"><CircularProgress size={26} /></Box>}><AnomalyDashboard /></Suspense>
            : user.role === "guest" ? <GuestRouteNotice /> : <AccessDenied />} />
          <Route path="/profile" element={user.role === "guest"
            ? <GuestRouteNotice />
            : <AccountPage user={user} onUserUpdated={setUser} onNotify={showToast} />} />
          <Route path="/settings" element={user.role === "admin"
            ? <AccountPage user={user} onUserUpdated={setUser} onNotify={showToast} />
            : user.role === "guest" ? <GuestRouteNotice /> : <AccessDenied />} />
        </Routes>
      </AppLayout>
      {user.role === "guest" && (
        <Dialog open={confirmGuestExit} onClose={() => setConfirmGuestExit(false)}>
          <DialogTitle>Leave guest mode?</DialogTitle>
          <DialogContent>
            Your temporary read-only session will end on this device. Continue to sign in or create a registered account?
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setConfirmGuestExit(false)}>Stay as guest</Button>
            <Button variant="contained" onClick={finishGuestUpgrade}>Sign in / Create account</Button>
          </DialogActions>
        </Dialog>
      )}
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
