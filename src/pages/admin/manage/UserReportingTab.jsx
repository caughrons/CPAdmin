import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Line } from "react-chartjs-2";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import { useTheme } from "@mui/material/styles";
import { getReports, resolveReport } from "@/services/reportsAdmin";

function monthKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const STATUS_CHIP = {
  pending: { label: "Pending", color: "warning" },
  removed: { label: "Removed", color: "error" },
  allowed: { label: "Allowed", color: "success" },
};

function statusOf(row) {
  if (row.status !== "resolved") return STATUS_CHIP.pending;
  return row.disposition === "removed" ? STATUS_CHIP.removed : STATUS_CHIP.allowed;
}

export default function UserReportingTab() {
  const theme = useTheme();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getReports({ days: 365 });
      setReports(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // ── Line chart: submissions per month, past 12 months ──────────────────────
  const chartData = useMemo(() => {
    const months = [];
    const now = new Date();
    for (let i = 11; i >= 0; i -= 1) {
      months.push(new Date(now.getFullYear(), now.getMonth() - i, 1));
    }
    const counts = {};
    months.forEach((d) => { counts[monthKey(d)] = 0; });
    reports.forEach((r) => {
      if (!r.createdAt) return;
      const key = monthKey(r.createdAt);
      if (counts[key] === undefined) return;
      counts[key] += 1;
    });
    return {
      labels: months.map((d) => d.toLocaleDateString("en-US", { month: "short", year: "2-digit" })),
      datasets: [
        {
          label: "Reports Submitted",
          data: months.map((d) => counts[monthKey(d)] || 0),
          borderColor: theme.palette.primary.main,
          backgroundColor: "transparent",
          tension: 0.35,
        },
      ],
    };
  }, [reports, theme]);

  const chartOptions = useMemo(() => ({
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { color: "rgba(0,0,0,0.05)" } },
      y: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: "rgba(0,0,0,0.05)" } },
    },
  }), []);

  // ── Frequent submitters: >2 reports filed in the past 30 days ──────────────
  const frequentSubmitters = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    const byReporter = {};
    reports.forEach((r) => {
      if (!r.createdAt || r.createdAt < cutoff) return;
      const key = r.reporterId;
      if (!key) return;
      if (!byReporter[key]) byReporter[key] = { name: r.reporterName || key, count: 0 };
      byReporter[key].count += 1;
    });
    return Object.values(byReporter).filter((s) => s.count > 2).sort((a, b) => b.count - a.count);
  }, [reports]);

  // ── Repeat offenders: >1 removed report against the same poster, past 90 days
  const repeatOffenders = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 90);
    const byOwner = {};
    reports.forEach((r) => {
      if (r.disposition !== "removed" || !r.resolvedAt || r.resolvedAt < cutoff || !r.contentOwnerId) return;
      const key = r.contentOwnerId;
      if (!byOwner[key]) byOwner[key] = { name: r.contentOwnerName || key, count: 0 };
      byOwner[key].count += 1;
    });
    return Object.values(byOwner).filter((s) => s.count > 1).sort((a, b) => b.count - a.count);
  }, [reports]);

  const handleAction = async (action) => {
    if (!selected) return;
    setActionLoading(true);
    setError(null);
    try {
      await resolveReport(selected.id, action);
      setSelected(null);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const columns = [
    {
      field: "createdAt",
      headerName: "Date",
      width: 170,
      valueFormatter: (value) => (value ? value.toLocaleString() : ""),
    },
    { field: "typeLabel", headerName: "Type", width: 170 },
    { field: "reporterName", headerName: "Sender", width: 160 },
    { field: "reason", headerName: "Comment", flex: 1, minWidth: 220 },
    { field: "contentPreview", headerName: "Link to Content", flex: 1, minWidth: 220 },
    {
      field: "status",
      headerName: "Status",
      width: 110,
      renderCell: (params) => {
        const s = statusOf(params.row);
        return <Chip size="small" label={s.label} color={s.color} />;
      },
    },
  ];

  return (
    <Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="subtitle1" gutterBottom>
          Submissions by Month
        </Typography>
        <Box sx={{ height: 260 }}>
          <Line data={chartData} options={chartOptions} />
        </Box>
      </Paper>

      <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ mb: 3 }}>
        <Paper sx={{ p: 2, flex: 1 }}>
          <Typography variant="subtitle1" gutterBottom>
            Frequent Submitters
          </Typography>
          <Typography variant="caption" color="text.secondary">
            More than 2 reports filed in the past 30 days
          </Typography>
          <Box sx={{ mt: 1 }}>
            {frequentSubmitters.length === 0 ? (
              <Typography variant="body2" color="text.secondary">None</Typography>
            ) : (
              frequentSubmitters.map((s) => (
                <Box key={s.name} sx={{ display: "flex", justifyContent: "space-between", py: 0.5 }}>
                  <Typography variant="body2">{s.name}</Typography>
                  <Chip size="small" label={s.count} />
                </Box>
              ))
            )}
          </Box>
        </Paper>
        <Paper sx={{ p: 2, flex: 1 }}>
          <Typography variant="subtitle1" gutterBottom>
            Repeat Offenders
          </Typography>
          <Typography variant="caption" color="text.secondary">
            More than 1 removed post in the past 90 days
          </Typography>
          <Box sx={{ mt: 1 }}>
            {repeatOffenders.length === 0 ? (
              <Typography variant="body2" color="text.secondary">None</Typography>
            ) : (
              repeatOffenders.map((s) => (
                <Box key={s.name} sx={{ display: "flex", justifyContent: "space-between", py: 0.5 }}>
                  <Typography variant="body2">{s.name}</Typography>
                  <Chip size="small" label={s.count} color="error" />
                </Box>
              ))
            )}
          </Box>
        </Paper>
      </Stack>

      <Paper sx={{ height: 560 }}>
        <DataGrid
          rows={reports}
          columns={columns}
          loading={loading}
          onRowClick={(params) => setSelected(params.row)}
          initialState={{ sorting: { sortModel: [{ field: "createdAt", sort: "desc" }] } }}
          disableSelectionOnClick
        />
      </Paper>

      <Dialog open={!!selected} onClose={() => setSelected(null)} maxWidth="sm" fullWidth>
        {selected && (
          <>
            <DialogTitle>{selected.typeLabel}</DialogTitle>
            <DialogContent>
              <Stack spacing={1.5} sx={{ mt: 1 }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">Reported by</Typography>
                  <Typography variant="body2">
                    {selected.reporterName} {selected.reporterEmail ? `(${selected.reporterEmail})` : ""}
                  </Typography>
                </Box>

                <Divider />

                <Box>
                  <Typography variant="caption" color="text.secondary">Complaint</Typography>
                  <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>{selected.reason}</Typography>
                </Box>

                <Divider />

                <Box>
                  <Typography variant="caption" color="text.secondary">Reported Content</Typography>
                  <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                    {selected.contentPreview || "(no preview available — content may already be gone)"}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
                    {selected.parentType} · {selected.parentId}
                    {selected.commentId ? ` · comment ${selected.commentId}` : ""}
                  </Typography>
                  {selected.contentOwnerName && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                      Posted by {selected.contentOwnerName}
                    </Typography>
                  )}
                </Box>

                {selected.status === "resolved" && (
                  <Alert severity={selected.disposition === "removed" ? "error" : "success"}>
                    Resolved — content was {selected.disposition}.
                  </Alert>
                )}
              </Stack>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setSelected(null)}>Close</Button>
              {selected.status !== "resolved" && (
                <>
                  <Button color="success" onClick={() => handleAction("allow")} disabled={actionLoading}>
                    Allow
                  </Button>
                  {selected.commentId ? (
                    <Button
                      color="error"
                      variant="contained"
                      onClick={() => handleAction("removeComment")}
                      disabled={actionLoading}
                    >
                      Delete Comment
                    </Button>
                  ) : (
                    <Button
                      color="error"
                      variant="contained"
                      onClick={() => handleAction("removeContent")}
                      disabled={actionLoading}
                    >
                      Delete Content
                    </Button>
                  )}
                </>
              )}
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
}
