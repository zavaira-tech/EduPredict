import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import api from "../../services/api.js";

export default function AnomalyDashboard() {
  const [filters, setFilters] = useState({ severity: "", status: "", type: "", search: "", from: "", to: "" });
  const [anomalies, setAnomalies] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0 });
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadAnomalies = useCallback(async () => {
    setError("");
    try {
      const params = {
        ...Object.fromEntries(Object.entries(filters).filter(([, value]) => value)),
        page: pagination.page,
        limit: pagination.limit,
      };
      const { data } = await api.get("/analytics/anomalies", { params });
      setAnomalies(data.data.anomalies);
      setPagination((current) => ({ ...current, total: data.data.pagination.total }));
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to load anomaly records.");
    } finally {
      setLoading(false);
    }
  }, [filters, pagination.page, pagination.limit]);

  useEffect(() => { loadAnomalies(); }, [loadAnomalies]);

  const updateStatus = async (id, status) => {
    try {
      await api.put(`/analytics/anomalies/${id}/status`, { status });
      setSelected(null);
      setMessage(`Anomaly marked ${status.toLowerCase()}.`);
      await loadAnomalies();
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to update anomaly status.");
    }
  };

  const detect = async () => {
    setError("");
    setMessage("");
    try {
      const { data } = await api.post("/analytics/anomalies/detect", {});
      setMessage(`Detection complete: ${data.data.candidates} candidate(s) found.`);
      await loadAnomalies();
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to run anomaly detection.");
    }
  };

  const exportCsv = async () => {
    try {
      const { data } = await api.get("/analytics/export/anomalies", {
        params: Object.fromEntries(Object.entries(filters).filter(([, value]) => value)),
        responseType: "blob",
      });
      const url = URL.createObjectURL(data);
      const link = document.createElement("a");
      link.href = url;
      link.download = "anomaly-report.csv";
      link.click();
      URL.revokeObjectURL(url);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to export the anomaly report.");
    }
  };

  if (loading) return <div className="loading-view"><CircularProgress size={26} /></div>;

  return (
    <div className="dashboard-page">
      <div className="page-heading-row">
        <div>
          <div className="breadcrumb">Insights <span>/</span> Anomalies</div>
          <h1 className="greeting">Anomaly management</h1>
          <p className="page-description">Review explainable statistical flags derived from academic records.</p>
        </div>
        <div className="analytics-actions">
          <Button variant="outlined" onClick={exportCsv}>Export CSV</Button>
          <Button variant="contained" onClick={detect}>Run detection</Button>
        </div>
      </div>
      {error && <Alert severity="error" onClose={() => setError("")}>{error}</Alert>}
      {message && <Alert severity="success" onClose={() => setMessage("")}>{message}</Alert>}
      <Paper className="analytics-filters" elevation={0}>
        <TextField label="Search" size="small" value={filters.search} onChange={(event) => { setFilters({ ...filters, search: event.target.value }); setPagination({ ...pagination, page: 1 }); }} />
        <TextField label="From" type="date" size="small" value={filters.from} InputLabelProps={{ shrink: true }} onChange={(event) => { setFilters({ ...filters, from: event.target.value }); setPagination({ ...pagination, page: 1 }); }} />
        <TextField label="To" type="date" size="small" value={filters.to} InputLabelProps={{ shrink: true }} onChange={(event) => { setFilters({ ...filters, to: event.target.value }); setPagination({ ...pagination, page: 1 }); }} />
        <TextField label="Severity" select size="small" value={filters.severity} onChange={(event) => { setFilters({ ...filters, severity: event.target.value }); setPagination({ ...pagination, page: 1 }); }}>
          <MenuItem value="">All severities</MenuItem>{["Low", "Medium", "High", "Critical"].map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}
        </TextField>
        <TextField label="Type" select size="small" value={filters.type} onChange={(event) => { setFilters({ ...filters, type: event.target.value }); setPagination({ ...pagination, page: 1 }); }}>
          <MenuItem value="">All types</MenuItem>{["attendance", "performance", "course", "data-quality"].map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}
        </TextField>
        <TextField label="Status" select size="small" value={filters.status} onChange={(event) => { setFilters({ ...filters, status: event.target.value }); setPagination({ ...pagination, page: 1 }); }}>
          <MenuItem value="">All statuses</MenuItem>{["New", "Reviewed", "Resolved", "Dismissed"].map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}
        </TextField>
      </Paper>
      <Paper className="resource-table-panel analytics-table-wrap" elevation={0}>
        <Table size="small">
          <TableHead><TableRow><TableCell>Detected</TableCell><TableCell>Type</TableCell><TableCell>Severity</TableCell><TableCell>Description</TableCell><TableCell>Status</TableCell><TableCell>Details</TableCell></TableRow></TableHead>
          <TableBody>{anomalies.map((anomaly) => (
            <TableRow key={anomaly._id}>
              <TableCell>{new Date(anomaly.detectedAt).toLocaleString()}</TableCell>
              <TableCell>{anomaly.anomalyType}</TableCell>
              <TableCell>{anomaly.severity}</TableCell>
              <TableCell>{anomaly.description}</TableCell>
              <TableCell>{anomaly.status}</TableCell>
              <TableCell><Button size="small" onClick={() => setSelected(anomaly)}>Review</Button></TableCell>
            </TableRow>
          ))}</TableBody>
        </Table>
        {!anomalies.length && <div className="resource-empty"><h2>No anomalies found</h2><p>Try changing filters or run detection against current records.</p></div>}
        <TablePagination
          component="div"
          count={pagination.total}
          page={pagination.page - 1}
          rowsPerPage={pagination.limit}
          rowsPerPageOptions={[10, 25, 50, 100]}
          onPageChange={(_, page) => setPagination({ ...pagination, page: page + 1 })}
          onRowsPerPageChange={(event) => setPagination({ page: 1, limit: Number(event.target.value), total: pagination.total })}
        />
      </Paper>
      <Dialog open={Boolean(selected)} onClose={() => setSelected(null)} fullWidth maxWidth="sm">
        <DialogTitle>Anomaly evidence</DialogTitle>
        <DialogContent dividers>
          {selected && <>
            <Typography variant="subtitle2">{selected.description}</Typography>
            <Typography variant="body2" sx={{ mt: 1 }}>Detection: {selected.detectionMethod}</Typography>
            <Typography variant="body2">Measured value: {JSON.stringify(selected.measuredValue)}</Typography>
            <Typography variant="body2">Expected range: {JSON.stringify(selected.expectedRange)}</Typography>
            <Typography variant="body2">Entity: {selected.entityType} · {selected.entityId}</Typography>
            <Typography variant="body2">Evidence: {JSON.stringify(selected.evidence)}</Typography>
            <Typography variant="body2">Status: {selected.status} · Severity: {selected.severity}</Typography>
          </>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelected(null)}>Close</Button>
          {selected && !["Resolved", "Dismissed"].includes(selected.status) && <>
            {selected.status === "New" && <Button onClick={() => updateStatus(selected._id, "Reviewed")}>Mark reviewed</Button>}
            <Button onClick={() => updateStatus(selected._id, "Resolved")}>Resolve</Button>
            <Button color="error" onClick={() => updateStatus(selected._id, "Dismissed")}>Dismiss</Button>
          </>}
        </DialogActions>
      </Dialog>
    </div>
  );
}
