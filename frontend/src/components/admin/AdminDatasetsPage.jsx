import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
} from "@mui/material";
import api from "../../services/api.js";

function formatBytes(bytes = 0) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / (1024 ** index)).toFixed(index ? 1 : 0)} ${units[index]}`;
}

export default function AdminDatasetsPage({ onNotify }) {
  const [datasets, setDatasets] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 });
  const [storageBytes, setStorageBytes] = useState(0);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const loadDatasets = useCallback(async (page = 1) => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/admin/datasets", {
        params: { page, limit: pagination.limit, search },
      });
      setDatasets(data.data);
      setStorageBytes(data.storageBytes);
      setPagination(data.pagination);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to load datasets.");
    } finally {
      setLoading(false);
    }
  }, [pagination.limit, search]);

  useEffect(() => {
    const timer = window.setTimeout(() => loadDatasets(1), search ? 250 : 0);
    return () => window.clearTimeout(timer);
  }, [loadDatasets, search]);

  const uploadDataset = async (event) => {
    event.preventDefault();
    if (!file) {
      setError("Choose a dataset file to upload.");
      return;
    }
    setSaving(true);
    setError("");
    const formData = new FormData();
    formData.set("name", name);
    formData.set("description", description);
    formData.set("file", file);
    try {
      await api.post("/admin/datasets", formData);
      setUploadOpen(false);
      setName("");
      setDescription("");
      setFile(null);
      await loadDatasets(1);
      window.dispatchEvent(new Event("edupredict:data-changed"));
      onNotify("Dataset uploaded to MongoDB GridFS.");
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to upload this dataset.");
    } finally {
      setSaving(false);
    }
  };

  const downloadDataset = async (dataset) => {
    try {
      const response = await api.get(`/admin/datasets/${dataset._id}/download`, { responseType: "blob" });
      const url = URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = dataset.fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to download this dataset.");
    }
  };

  const deleteDataset = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/admin/datasets/${deleteTarget._id}`);
      setDeleteTarget(null);
      await loadDatasets(Math.max(1, Math.min(pagination.page, Math.ceil((pagination.total - 1) / pagination.limit))));
      window.dispatchEvent(new Event("edupredict:data-changed"));
      onNotify("Dataset and stored file deleted.");
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to delete this dataset.");
    }
  };

  return (
    <div className="dashboard-page resource-page">
      <div className="page-heading-row">
        <div>
          <div className="breadcrumb">Management <span>/</span> Datasets</div>
          <h1 className="greeting">Dataset management</h1>
          <p className="page-description">Files are persisted in MongoDB GridFS; metadata is stored in the datasets collection.</p>
        </div>
        <Button variant="contained" onClick={() => setUploadOpen(true)}>Upload dataset</Button>
      </div>
      {error && <Alert severity="error" onClose={() => setError("")}>{error}</Alert>}
      <div className="kpi-grid">
        <Paper className="kpi-card" elevation={0}>
          <div className="kpi-heading"><span>Total datasets</span></div>
          <div className="kpi-value">{pagination.total.toLocaleString()}</div>
        </Paper>
        <Paper className="kpi-card" elevation={0}>
          <div className="kpi-heading"><span>Stored file data</span></div>
          <div className="kpi-value">{formatBytes(storageBytes)}</div>
        </Paper>
      </div>
      <TextField size="small" label="Search datasets" value={search} onChange={(event) => setSearch(event.target.value)} />
      <Paper className="resource-table-panel" elevation={0}>
        {loading ? <div className="loading-view"><CircularProgress size={26} /></div> : datasets.length ? (
          <>
            <div className="table-scroll">
              <Table size="small">
                <TableHead><TableRow>
                  <TableCell>Dataset</TableCell><TableCell>Type</TableCell><TableCell>Uploaded by</TableCell>
                  <TableCell>Upload date</TableCell><TableCell>Size</TableCell><TableCell>Status</TableCell><TableCell>Actions</TableCell>
                </TableRow></TableHead>
                <TableBody>{datasets.map((dataset) => (
                  <TableRow key={dataset._id}>
                    <TableCell>{dataset.name}<br /><small>{dataset.fileName}</small></TableCell>
                    <TableCell>{dataset.fileType}</TableCell>
                    <TableCell>{dataset.uploadedBy?.name || "Unknown"}</TableCell>
                    <TableCell>{dataset.createdAt ? new Date(dataset.createdAt).toLocaleString() : "—"}</TableCell>
                    <TableCell>{formatBytes(dataset.fileSize)}</TableCell>
                    <TableCell>{dataset.status}</TableCell>
                    <TableCell>
                      <Button size="small" disabled={!dataset.fileId} onClick={() => downloadDataset(dataset)}>Download</Button>
                      <Button size="small" color="error" onClick={() => setDeleteTarget(dataset)}>Delete</Button>
                    </TableCell>
                  </TableRow>
                ))}</TableBody>
              </Table>
            </div>
            <TablePagination
              component="div"
              count={pagination.total}
              page={pagination.page - 1}
              rowsPerPage={pagination.limit}
              rowsPerPageOptions={[10, 20, 50, 100]}
              onPageChange={(_, page) => loadDatasets(page + 1)}
              onRowsPerPageChange={(event) => setPagination((current) => ({ ...current, page: 1, limit: Number(event.target.value) }))}
            />
          </>
        ) : <div className="resource-empty"><h2>No datasets found</h2><p>Upload a CSV, TSV, JSON, XLS, or XLSX file to get started.</p></div>}
      </Paper>

      <Dialog open={uploadOpen} onClose={() => setUploadOpen(false)} fullWidth maxWidth="sm">
        <form onSubmit={uploadDataset}>
          <DialogTitle>Upload dataset</DialogTitle>
          <DialogContent className="resource-form">
            <TextField label="Dataset name" required inputProps={{ maxLength: 120 }} value={name} onChange={(event) => setName(event.target.value)} />
            <TextField label="Description" multiline minRows={2} inputProps={{ maxLength: 1000 }} value={description} onChange={(event) => setDescription(event.target.value)} />
            <Button component="label" variant="outlined">
              {file ? file.name : "Choose dataset file"}
              <input hidden type="file" accept=".csv,.tsv,.json,.xls,.xlsx" onChange={(event) => setFile(event.target.files?.[0] || null)} />
            </Button>
            <p className="page-description">Maximum file size: 25 MB. Files are stored in the MongoDB datasetFiles GridFS bucket.</p>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setUploadOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={saving}>{saving ? "Uploading..." : "Upload"}</Button>
          </DialogActions>
        </form>
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)}>
        <DialogTitle>Delete this dataset?</DialogTitle>
        <DialogContent>This removes its MongoDB metadata and stored GridFS file.</DialogContent>
        <DialogActions><Button onClick={() => setDeleteTarget(null)}>Cancel</Button><Button color="error" onClick={deleteDataset}>Delete</Button></DialogActions>
      </Dialog>
    </div>
  );
}
