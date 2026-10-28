import { lazy, Suspense, useMemo, useState } from "react";
import {
  Alert,
  Box,
  CssBaseline,
  CircularProgress,
  Snackbar,
  ThemeProvider,
  createTheme,
} from "@mui/material";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "./components/layout/AppLayout.jsx";

const AdminDashboard = lazy(() => import("./components/dashboard/AdminDashboard.jsx"));

const roles = ["Administrator", "Teacher", "Student", "Analyst"];

function PlaceholderPage({ title }) {
  return (
    <Box className="page-placeholder">
      <span className="eyebrow">EDUPREDICT WORKSPACE</span>
      <h1>{title}</h1>
      <p>
        This section is part of the EduPredict roadmap. Its interactive
        workspace will be added in a later development phase.
      </p>
    </Box>
  );
}

function AppContent({ darkMode, onToggleTheme }) {
  const [role, setRole] = useState("Administrator");
  const [toast, setToast] = useState("");
  const [search, setSearch] = useState("");

  const showToast = (message) => setToast(message);
  const closeToast = () => setToast("");

  return (
    <BrowserRouter>
      <AppLayout
        darkMode={darkMode}
        onToggleTheme={onToggleTheme}
        role={role}
        roles={roles}
        onRoleChange={setRole}
        onNotify={showToast}
        search={search}
        onSearchChange={setSearch}
      >
        <Routes>
          <Route
            path="/"
            element={
              <Suspense fallback={<Box className="loading-view"><CircularProgress size={26} /></Box>}>
                <AdminDashboard role={role} search={search} onNotify={showToast} />
              </Suspense>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
          {[
            "students",
            "teachers",
            "courses",
            "attendance",
            "performance",
            "predictions",
            "anomalies",
            "analytics",
            "datasets",
            "alerts",
            "support",
            "settings",
          ].map((path) => (
            <Route
              key={path}
              path={`/${path}`}
              element={
                <PlaceholderPage
                  title={path
                    .split("-")
                    .map((word) => word[0].toUpperCase() + word.slice(1))
                    .join(" ")}
                />
              }
            />
          ))}
        </Routes>
      </AppLayout>
      <Snackbar
        open={Boolean(toast)}
        autoHideDuration={3200}
        onClose={closeToast}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert onClose={closeToast} severity="success" variant="filled">
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
