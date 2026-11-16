import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Button,
  Chip,
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
} from "@mui/material";
import api from "../../services/api.js";

const initialForm = { name: "", email: "", password: "", role: "teacher" };

function notifyDataChanged() {
  window.dispatchEvent(new Event("edupredict:data-changed"));
}

export default function AdminUsersPage({ user, onNotify }) {
  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 });
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [details, setDetails] = useState(null);

  const loadUsers = useCallback(async (page = 1) => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/admin/users", {
        params: { page, limit: pagination.limit, search, role, status },
      });
      setUsers(data.data);
      setPagination(data.pagination);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to load users.");
    } finally {
      setLoading(false);
    }
  }, [pagination.limit, role, search, status]);

  useEffect(() => {
    const timer = window.setTimeout(() => loadUsers(1), search ? 250 : 0);
    return () => window.clearTimeout(timer);
  }, [loadUsers, search, role, status]);

  const openForm = (record = null) => {
    setEditing(record);
    setDialogOpen(true);
    setForm(record
      ? { name: record.name, email: record.email, password: "", role: record.role }
      : initialForm);
    setError("");
  };

  const submitForm = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    const payload = { ...form };
    if (!payload.password) delete payload.password;
    try {
      if (editing) await api.put(`/admin/users/${editing._id}`, payload);
      else await api.post("/admin/users", payload);
      setEditing(null);
      setDialogOpen(false);
      await loadUsers(editing ? pagination.page : 1);
      notifyDataChanged();
      onNotify(editing ? "User updated." : "User created.");
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to save this user.");
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (record) => {
    try {
      await api.patch(`/admin/users/${record._id}/status`, { isActive: !record.isActive });
      await loadUsers(pagination.page);
      notifyDataChanged();
      onNotify(record.isActive ? "Account deactivated." : "Account activated.");
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to update account status.");
    }
  };

  const deleteUser = async () => {
    if (!confirmDelete) return;
    try {
      await api.delete(`/admin/users/${confirmDelete._id}`);
      setConfirmDelete(null);
      await loadUsers(Math.max(1, Math.min(pagination.page, Math.ceil((pagination.total - 1) / pagination.limit))));
      notifyDataChanged();
      onNotify("User deleted.");
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to delete this user.");
    }
  };

  const loadDetails = async (record) => {
    setDetails({ loading: true, data: null });
    try {
      const { data } = await api.get(`/admin/users/${record._id}`);
      setDetails({ loading: false, data: data.data });
    } catch (requestError) {
      setDetails({ loading: false, error: requestError.response?.data?.message || "Unable to load user details." });
    }
  };

  return (
    <div className="dashboard-page resource-page">
      <div className="page-heading-row">
        <div>
          <div className="breadcrumb">Management <span>/</span> Users</div>
          <h1 className="greeting">User management</h1>
          <p className="page-description">Search, filter, provision, and manage registered accounts.</p>
        </div>
        <Button variant="contained" onClick={() => openForm()}>Create teacher or analyst</Button>
      </div>
      {error && <Alert severity="error" onClose={() => setError("")}>{error}</Alert>}
      <div className="page-heading-row">
        <TextField size="small" label="Search name or email" value={search} onChange={(event) => setSearch(event.target.value)} />
        <TextField size="small" select label="Role" value={role} onChange={(event) => setRole(event.target.value)} sx={{ minWidth: 150 }}>
          <MenuItem value="">All roles</MenuItem>
          {["admin", "teacher", "student", "analyst"].map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}
        </TextField>
        <TextField size="small" select label="Status" value={status} onChange={(event) => setStatus(event.target.value)} sx={{ minWidth: 150 }}>
          <MenuItem value="">All statuses</MenuItem>
          <MenuItem value="active">Active</MenuItem>
          <MenuItem value="inactive">Inactive</MenuItem>
        </TextField>
      </div>
      <Paper className="resource-table-panel" elevation={0}>
        {loading ? <div className="loading-view"><CircularProgress size={26} /></div> : users.length ? (
          <>
            <div className="table-scroll">
              <Table size="small">
                <TableHead><TableRow>
                  <TableCell>Name</TableCell><TableCell>Email</TableCell><TableCell>Role</TableCell>
                  <TableCell>Status</TableCell><TableCell>Created</TableCell><TableCell>Actions</TableCell>
                </TableRow></TableHead>
                <TableBody>{users.map((record) => (
                  <TableRow key={record._id} hover>
                    <TableCell>{record.name}</TableCell>
                    <TableCell>{record.email}</TableCell>
                    <TableCell>{record.role}</TableCell>
                    <TableCell><Chip size="small" label={record.isActive ? "Active" : "Inactive"} color={record.isActive ? "success" : "default"} /></TableCell>
                    <TableCell>{record.createdAt ? new Date(record.createdAt).toLocaleDateString() : "—"}</TableCell>
                    <TableCell>
                      <Button size="small" onClick={() => loadDetails(record)}>View</Button>
                      <Button size="small" onClick={() => openForm(record)}>Edit</Button>
                      <Button size="small" disabled={String(record._id) === String(user.id || user._id)} onClick={() => toggleStatus(record)}>{record.isActive ? "Deactivate" : "Activate"}</Button>
                      <Button size="small" color="error" disabled={String(record._id) === String(user.id || user._id)} onClick={() => setConfirmDelete(record)}>Delete</Button>
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
              onPageChange={(_, page) => loadUsers(page + 1)}
              onRowsPerPageChange={(event) => setPagination((current) => ({ ...current, page: 1, limit: Number(event.target.value) }))}
            />
          </>
        ) : <div className="resource-empty"><h2>No users found</h2><p>Try changing the filters or create a teacher or analyst account.</p></div>}
      </Paper>

      <Dialog open={dialogOpen} onClose={() => { setDialogOpen(false); setEditing(null); setForm({}); }} fullWidth maxWidth="sm">
        <form onSubmit={submitForm}>
          <DialogTitle>{editing ? "Update user" : "Create account"}</DialogTitle>
          <DialogContent className="resource-form">
            <TextField label="Name" required value={form.name || ""} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            <TextField label="Email" type="email" required value={form.email || ""} onChange={(event) => setForm({ ...form, email: event.target.value })} />
            {!editing || String(editing._id) !== String(user.id || user._id) ? (
              <TextField
                label={editing ? "New password (optional)" : "Temporary password"}
                type="password"
                required={!editing}
                inputProps={{ minLength: 8, maxLength: 72 }}
                value={form.password || ""}
                onChange={(event) => setForm({ ...form, password: event.target.value })}
              />
            ) : null}
            <TextField select label="Role" required disabled={Boolean(editing && String(editing._id) === String(user.id || user._id))} value={form.role || "teacher"} onChange={(event) => setForm({ ...form, role: event.target.value })}>
              {(editing ? ["admin", "teacher", "student", "analyst"] : ["teacher", "analyst"]).map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}
            </TextField>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => { setDialogOpen(false); setEditing(null); setForm({}); }}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
          </DialogActions>
        </form>
      </Dialog>

      <Dialog open={Boolean(confirmDelete)} onClose={() => setConfirmDelete(null)}>
        <DialogTitle>Delete this user?</DialogTitle>
        <DialogContent>This permanently removes the account. The last active administrator cannot be deleted.</DialogContent>
        <DialogActions><Button onClick={() => setConfirmDelete(null)}>Cancel</Button><Button color="error" onClick={deleteUser}>Delete</Button></DialogActions>
      </Dialog>

      <Dialog open={Boolean(details)} onClose={() => setDetails(null)} fullWidth maxWidth="md">
        <DialogTitle>User details</DialogTitle>
        <DialogContent>
          {details?.loading ? <CircularProgress size={24} /> : details?.error ? <Alert severity="error">{details.error}</Alert> : details?.data && (
            <div className="resource-form">
              <p><strong>{details.data.name}</strong> · {details.data.email} · {details.data.role}</p>
              <p>Status: {details.data.isActive ? "Active" : "Inactive"}</p>
              {details.data.academicProfile && <p>Academic profile: {details.data.academicProfile.studentId || details.data.academicProfile.teacherId || details.data.academicProfile.department}</p>}
              <h3>Recent activity</h3>
              {details.data.recentActivity.length
                ? details.data.recentActivity.map((item) => <p key={item._id}>{item.action} · {new Date(item.createdAt).toLocaleString()}</p>)
                : <p>No activity recorded for this account.</p>}
            </div>
          )}
        </DialogContent>
        <DialogActions><Button onClick={() => setDetails(null)}>Close</Button></DialogActions>
      </Dialog>
    </div>
  );
}
