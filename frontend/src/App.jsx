import { useEffect, useState } from "react";
import { Alert, AppBar, Box, Chip, Container, Paper, Toolbar, Typography } from "@mui/material";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import apiClient from "./api/client.js";

function HomePage() {
  const [apiStatus, setApiStatus] = useState({ state: "loading", message: "" });

  useEffect(() => {
    const controller = new AbortController();

    apiClient
      .get("/health", { signal: controller.signal })
      .then(({ data }) => {
        setApiStatus({
          state: "connected",
          message: `API connected; database ${data.database}.`,
        });
      })
      .catch((error) => {
        if (error.code === "ERR_CANCELED") {
          return;
        }
        setApiStatus({
          state: "error",
          message: "API is unavailable. Check that the backend and MongoDB are running.",
        });
      });

    return () => controller.abort();
  }, []);

  return (
    <Box>
      <AppBar position="static" elevation={0}>
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ fontWeight: 700 }}>
            EduPredict
          </Typography>
          <Chip
            label="Project foundation"
            color="secondary"
            size="small"
            sx={{ ml: 2 }}
          />
        </Toolbar>
      </AppBar>
      <Container maxWidth="md" sx={{ py: 8 }}>
        <Paper elevation={2} sx={{ p: { xs: 3, sm: 5 } }}>
          <Typography variant="overline" color="primary">
            Educational Big Data &amp; Predictive Analytics
          </Typography>
          <Typography variant="h3" component="h1" gutterBottom sx={{ mt: 1 }}>
            Welcome to EduPredict
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 3 }}>
            Your local project foundation is running. This dashboard will grow
            to support academic insights, predictions, and timely alerts.
          </Typography>
          <Alert severity={apiStatus.state === "error" ? "error" : "info"}>
            {apiStatus.state === "loading" ? "Connecting to the API..." : apiStatus.message}
          </Alert>
        </Paper>
      </Container>
    </Box>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="*" element={<HomePage />} />
      </Routes>
    </BrowserRouter>
  );
}
