import { useCallback, useEffect, useState } from "react";
import { Alert, CircularProgress, Paper, Table, TableBody, TableCell, TableHead, TablePagination, TableRow } from "@mui/material";
import api from "../../services/api.js";

export default function AdminActivityPage() {
  const [activity, setActivity] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadActivity = useCallback(async (page = 1) => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/admin/activity-logs", { params: { page, limit: pagination.limit } });
      setActivity(data.data);
      setPagination(data.pagination);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Unable to load activity logs.");
    } finally {
      setLoading(false);
    }
  }, [pagination.limit]);

  useEffect(() => { loadActivity(1); }, [loadActivity]);

  return (
    <div className="dashboard-page resource-page">
      <div className="page-heading-row">
        <div><div className="breadcrumb">System <span>/</span> Activity</div><h1 className="greeting">Activity log</h1><p className="page-description">Audited user and system operations stored in MongoDB.</p></div>
      </div>
      {error && <Alert severity="error">{error}</Alert>}
      <Paper className="resource-table-panel" elevation={0}>
        {loading ? <div className="loading-view"><CircularProgress size={26} /></div> : (
          <>
            <div className="table-scroll">
              <Table size="small">
                <TableHead><TableRow><TableCell>Time</TableCell><TableCell>Actor</TableCell><TableCell>Action</TableCell><TableCell>Entity</TableCell><TableCell>Details</TableCell></TableRow></TableHead>
                <TableBody>{activity.map((item) => (
                  <TableRow key={item._id}>
                    <TableCell>{new Date(item.createdAt).toLocaleString()}</TableCell>
                    <TableCell>{item.actor?.name || "System"}</TableCell>
                    <TableCell>{item.action}</TableCell>
                    <TableCell>{item.entityType}</TableCell>
                    <TableCell>{Object.entries(item.details || {}).map(([key, value]) => `${key}: ${String(value)}`).join(", ") || "—"}</TableCell>
                  </TableRow>
                ))}{!activity.length && <TableRow><TableCell colSpan={5}>No activity has been recorded.</TableCell></TableRow>}</TableBody>
              </Table>
            </div>
            <TablePagination
              component="div"
              count={pagination.total}
              page={pagination.page - 1}
              rowsPerPage={pagination.limit}
              rowsPerPageOptions={[10, 25, 50, 100]}
              onPageChange={(_, page) => loadActivity(page + 1)}
              onRowsPerPageChange={(event) => setPagination((current) => ({ ...current, page: 1, limit: Number(event.target.value) }))}
            />
          </>
        )}
      </Paper>
    </div>
  );
}
