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
  return row.disposition === "removed"
    ? STATUS_CHIP.removed
    : STATUS_CHIP.allowed;
}

// Apple (Guideline 1.2) requires reports to be acted on within 24 hours.
const SLA_HOURS = 24;

function hoursPending(row) {
  if (row.status === "resolved" || !row.createdAt) return 0;
  return (Date.now() - row.createdAt.getTime()) / 3600000;
}

function reportedUserLabel(row) {
  const parts = [];
  if (row.contentOwnerName) parts.push(row.contentOwnerName);
  if (row.contentOwnerCpid) parts.push(`~${row.contentOwnerCpid}`);
  if (parts.length === 0 && row.contentOwnerId) parts.push(row.contentOwnerId);
  return parts.join(" ");
}

// What "remove" means for this report, or null if there's nothing to remove.
function removeActionFor(row) {
  if (row.parentType === "user") return null;
  if (row.parentType === "chatMessage")
    return { action: "removeContent", label: "Delete Message" };
  if (row.commentId)
    return { action: "removeComment", label: "Delete Comment" };
  return { action: "removeContent", label: "Delete Content" };
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
    months.forEach((d) => {
      counts[monthKey(d)] = 0;
    });
    reports.forEach((r) => {
      if (!r.createdAt) return;
      const key = monthKey(r.createdAt);
      if (counts[key] === undefined) return;
      counts[key] += 1;
    });
    return {
      labels: months.map((d) =>
        d.toLocaleDateString("en-US", { month: "short", year: "2-digit" })
      ),
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

  const chartOptions = useMemo(
    () => ({
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: "rgba(0,0,0,0.05)" } },
        y: {
          beginAtZero: true,
          ticks: { precision: 0 },
          grid: { color: "rgba(0,0,0,0.05)" },
        },
      },
    }),
    []
  );

  // ── Frequent submitters: >2 reports filed in the past 30 days ──────────────
  const frequentSubmitters = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    const byReporter = {};
    reports.forEach((r) => {
      if (!r.createdAt || r.createdAt < cutoff) return;
      const key = r.reporterId;
      if (!key) return;
      if (!byReporter[key])
        byReporter[key] = { name: r.reporterName || key, count: 0 };
      byReporter[key].count += 1;
    });
    return Object.values(byReporter)
      .filter((s) => s.count > 2)
      .sort((a, b) => b.count - a.count);
  }, [reports]);

  // ── Repeat offenders: >1 removed report against the same poster, past 90 days
  const repeatOffenders = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 90);
    const byOwner = {};
    reports.forEach((r) => {
      if (
        r.disposition !== "removed" ||
        !r.resolvedAt ||
        r.resolvedAt < cutoff ||
        !r.contentOwnerId
      )
        return;
      const key = r.contentOwnerId;
      if (!byOwner[key])
        byOwner[key] = { name: r.contentOwnerName || key, count: 0 };
      byOwner[key].count += 1;
    });
    return Object.values(byOwner)
      .filter((s) => s.count > 1)
      .sort((a, b) => b.count - a.count);
  }, [reports]);

  const pendingCount = useMemo(
    () => reports.filter((r) => r.status !== "resolved").length,
    [reports]
  );
  const overdueCount = useMemo(
    () => reports.filter((r) => hoursPending(r) >= SLA_HOURS).length,
    [reports]
  );

  const handleAction = async (action, { suspendUser = false } = {}) => {
    if (!selected) return;
    if (
      suspendUser &&
      !window.confirm(
        `Suspend ${
          reportedUserLabel(selected) || "this user"
        }? They will be signed out of the app immediately and cannot sign back in.`
      )
    ) {
      return;
    }
    setActionLoading(true);
    setError(null);
    try {
      await resolveReport(selected.id, action, { suspendUser });
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
    {
      field: "contentOwnerName",
      headerName: "Reported User",
      width: 190,
      valueGetter: (_value, row) => reportedUserLabel(row),
    },
    { field: "reporterName", headerName: "Reported By", width: 160 },
    { field: "reason", headerName: "Comment", flex: 1, minWidth: 220 },
    {
      field: "contentPreview",
      headerName: "Link to Content",
      flex: 1,
      minWidth: 220,
    },
    {
      field: "status",
      headerName: "Status",
      width: 110,
      renderCell: (params) => {
        const s = statusOf(params.row);
        const overdue = hoursPending(params.row) >= SLA_HOURS;
        return (
          <Chip
            size="small"
            label={overdue ? "Overdue" : s.label}
            color={overdue ? "error" : s.color}
            variant={overdue ? "filled" : "outlined"}
          />
        );
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

      {pendingCount > 0 && (
        <Alert severity={overdueCount > 0 ? "error" : "warning"} sx={{ mb: 2 }}>
          {pendingCount} pending report{pendingCount === 1 ? "" : "s"}
          {overdueCount > 0
            ? ` — ${overdueCount} older than ${SLA_HOURS} hours`
            : ""}
          . Apple requires reports to be acted on within {SLA_HOURS} hours:
          remove the content and suspend the user if it violates the Terms.
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
              <Typography variant="body2" color="text.secondary">
                None
              </Typography>
            ) : (
              frequentSubmitters.map((s) => (
                <Box
                  key={s.name}
                  sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    py: 0.5,
                  }}
                >
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
              <Typography variant="body2" color="text.secondary">
                None
              </Typography>
            ) : (
              repeatOffenders.map((s) => (
                <Box
                  key={s.name}
                  sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    py: 0.5,
                  }}
                >
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
          initialState={{
            sorting: { sortModel: [{ field: "createdAt", sort: "desc" }] },
          }}
          disableSelectionOnClick
        />
      </Paper>

      <Dialog
        open={!!selected}
        onClose={() => setSelected(null)}
        maxWidth="sm"
        fullWidth
      >
        {selected && (
          <>
            <DialogTitle>{selected.typeLabel}</DialogTitle>
            <DialogContent>
              <Stack spacing={1.5} sx={{ mt: 1 }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Reported by
                  </Typography>
                  <Typography variant="body2">
                    {selected.reporterName}{" "}
                    {selected.reporterEmail
                      ? `(${selected.reporterEmail})`
                      : ""}
                  </Typography>
                </Box>

                <Divider />

                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Complaint
                  </Typography>
                  <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                    {selected.reason}
                  </Typography>
                </Box>

                <Divider />

                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Reported Content
                  </Typography>
                  <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                    {selected.contentPreview ||
                      "(no preview available — content may already be gone)"}
                  </Typography>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: "block", mt: 0.5 }}
                  >
                    {selected.parentType} · {selected.parentId}
                    {selected.commentId
                      ? ` · comment ${selected.commentId}`
                      : ""}
                  </Typography>
                </Box>

                <Divider />

                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Reported User (real account)
                  </Typography>
                  {selected.contentOwnerId ? (
                    <>
                      <Typography variant="body2">
                        {selected.contentOwnerName || "(no name)"}
                        {selected.contentOwnerCpid
                          ? ` · ~${selected.contentOwnerCpid}`
                          : ""}
                      </Typography>
                      {selected.contentOwnerEmail && (
                        <Typography variant="body2">
                          {selected.contentOwnerEmail}
                        </Typography>
                      )}
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: "block" }}
                      >
                        uid {selected.contentOwnerId}
                      </Typography>
                      {selected.anonymousName && (
                        <Typography
                          variant="caption"
                          sx={{ display: "block", mt: 0.5 }}
                        >
                          Shown to other users in Anchor Chat as{" "}
                          <strong>{selected.anonymousName}</strong>
                        </Typography>
                      )}
                    </>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      Unknown
                    </Typography>
                  )}
                </Box>

                {selected.status === "resolved" && (
                  <Alert
                    severity={
                      selected.disposition === "removed" ? "error" : "success"
                    }
                  >
                    Resolved — content was {selected.disposition}
                    {selected.userSuspended ? "; user suspended" : ""}.
                  </Alert>
                )}
              </Stack>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setSelected(null)}>Close</Button>
              {selected.status !== "resolved" &&
                (() => {
                  const remove = removeActionFor(selected);
                  const canSuspend = !!selected.contentOwnerId;
                  return (
                    <>
                      <Button
                        color="success"
                        onClick={() => handleAction("allow")}
                        disabled={actionLoading}
                      >
                        Allow
                      </Button>
                      {!remove && canSuspend && (
                        <Button
                          color="error"
                          variant="contained"
                          onClick={() =>
                            handleAction("allow", { suspendUser: true })
                          }
                          disabled={actionLoading}
                        >
                          Suspend User
                        </Button>
                      )}
                      {remove && (
                        <Button
                          color="error"
                          variant="outlined"
                          onClick={() => handleAction(remove.action)}
                          disabled={actionLoading}
                        >
                          {remove.label}
                        </Button>
                      )}
                      {remove && canSuspend && (
                        <Button
                          color="error"
                          variant="contained"
                          onClick={() =>
                            handleAction(remove.action, { suspendUser: true })
                          }
                          disabled={actionLoading}
                        >
                          {remove.label} + Suspend User
                        </Button>
                      )}
                    </>
                  );
                })()}
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
}
