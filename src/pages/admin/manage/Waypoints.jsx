import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  Drawer,
  IconButton,
  LinearProgress,
  Paper,
  Skeleton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import { AlertTriangle, RefreshCw, Trash2, X } from "lucide-react";
import {
  listVoyages,
  getVoyageDetail,
  deleteVoyage,
  reassignVoyage,
} from "@/services/voyagesAdmin";

// ── Helpers ──────────────────────────────────────────────────────────────────

function r2Url(r2Key) {
  return r2Key ? `https://cruisapalooza.com/${r2Key}` : null;
}

// createdAt/updatedAt come from the mobile app as either an ISO string
// (local-first writes) or a numeric server timestamp (ServerValue.timestamp) —
// both need to render, so normalize before formatting.
function formatDate(value) {
  if (!value) return "—";
  const date = typeof value === "number" ? new Date(value) : new Date(value);
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function ownerLabel(row) {
  return row.ownerEmail || (row.ownerId ? "(no email on file)" : "(unowned)");
}

// ── Main Component ───────────────────────────────────────────────────────────

function Waypoints() {
  const [voyages, setVoyages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailVoyageId, setDetailVoyageId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState(null);

  const [deleteTarget, setDeleteTarget] = useState(null); // { id, name, waypointCount, photoCount }
  const [deleting, setDeleting] = useState(false);

  const [reassignEmail, setReassignEmail] = useState("");
  const [reassigning, setReassigning] = useState(false);
  const [reassignError, setReassignError] = useState(null);
  const [reassignSuccess, setReassignSuccess] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listVoyages();
      setVoyages(result.voyages || []);
    } catch (e) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filteredVoyages = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return voyages;
    return voyages.filter(
      (v) =>
        (v.name || "").toLowerCase().includes(q) ||
        (v.ownerEmail || "").toLowerCase().includes(q) ||
        (v.ownerId || "").toLowerCase().includes(q)
    );
  }, [voyages, search]);

  const openDetail = useCallback(async (voyageId) => {
    setDetailVoyageId(voyageId);
    setDetailOpen(true);
    setDetail(null);
    setDetailError(null);
    setReassignEmail("");
    setReassignError(null);
    setReassignSuccess(null);
    setDetailLoading(true);
    try {
      const d = await getVoyageDetail(voyageId);
      setDetail(d);
    } catch (e) {
      setDetailError(e?.message ?? String(e));
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const closeDetail = () => {
    setDetailOpen(false);
    setDetailVoyageId(null);
    setDetail(null);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteVoyage(deleteTarget.id);
      setDeleteTarget(null);
      if (detailVoyageId === deleteTarget.id) closeDetail();
      await load();
    } catch (e) {
      alert(`Delete failed: ${e.message}`);
    } finally {
      setDeleting(false);
    }
  };

  const handleReassign = async () => {
    if (!detailVoyageId || !reassignEmail.trim()) return;
    setReassigning(true);
    setReassignError(null);
    setReassignSuccess(null);
    try {
      const result = await reassignVoyage(detailVoyageId, reassignEmail.trim());
      setReassignSuccess(`Reassigned to ${result.newOwnerEmail}.`);
      setReassignEmail("");
      await Promise.all([openDetail(detailVoyageId), load()]);
    } catch (e) {
      setReassignError(e?.message ?? String(e));
    } finally {
      setReassigning(false);
    }
  };

  // ── Table columns ────────────────────────────────────────────────────────

  const columns = [
    {
      field: "thumbnailR2Key",
      headerName: "",
      width: 60,
      sortable: false,
      renderCell: (params) => (
        <Avatar
          variant="rounded"
          src={r2Url(params.value)}
          sx={{ width: 36, height: 36, bgcolor: "grey.200" }}
        >
          {!params.value && (params.row.name || "?").charAt(0).toUpperCase()}
        </Avatar>
      ),
    },
    {
      field: "name",
      headerName: "Name",
      flex: 1,
      minWidth: 180,
      renderCell: (params) => (
        <Typography variant="body2" fontWeight={600}>
          {params.value || "(untitled)"}
        </Typography>
      ),
    },
    {
      field: "ownerEmail",
      headerName: "Owner Email",
      flex: 1,
      minWidth: 200,
      renderCell: (params) => ownerLabel(params.row),
    },
    {
      field: "ownerId",
      headerName: "Owner ID",
      width: 220,
      renderCell: (params) => (
        <Typography variant="caption" sx={{ fontFamily: "monospace" }}>
          {params.value || "—"}
        </Typography>
      ),
    },
    {
      field: "createdAt",
      headerName: "Created",
      width: 120,
      renderCell: (params) => formatDate(params.value),
    },
    {
      field: "waypointCount",
      headerName: "Waypoints",
      width: 100,
      renderCell: (params) => params.value ?? 0,
    },
    {
      field: "photoCount",
      headerName: "Photos",
      width: 90,
      renderCell: (params) => params.value ?? 0,
    },
    {
      field: "delete",
      headerName: "Delete",
      width: 80,
      sortable: false,
      renderCell: (params) => (
        <IconButton
          size="small"
          color="error"
          onClick={(e) => {
            e.stopPropagation();
            setDeleteTarget(params.row);
          }}
        >
          <Trash2 size={18} />
        </IconButton>
      ),
    },
  ];

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <React.Fragment>
      <Helmet title="Voyages" />

      <Box sx={{ mb: 3, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Box>
          <Typography variant="h3" gutterBottom sx={{ mb: 0.5 }}>
            Voyages
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Every voyage across all accounts, with its waypoints and photos. Use this
            to clean up test fixtures and fix voyages assigned to the wrong owner.
          </Typography>
        </Box>
        <IconButton onClick={load} disabled={loading}>
          <RefreshCw size={18} />
        </IconButton>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Paper>
        <Box sx={{ p: 2, borderBottom: 1, borderColor: "divider" }}>
          <Stack direction="row" spacing={2} alignItems="center">
            <TextField
              size="small"
              label="Search name or owner"
              placeholder="e.g. QA Fixture, or an email"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              sx={{ minWidth: 280 }}
            />
            <Typography variant="body2" color="text.secondary">
              {filteredVoyages.length} of {voyages.length} voyage
              {voyages.length !== 1 ? "s" : ""}
            </Typography>
          </Stack>
        </Box>

        {loading && <LinearProgress />}

        <DataGrid
          rows={filteredVoyages}
          columns={columns}
          autoHeight
          rowHeight={52}
          disableRowSelectionOnClick
          onRowClick={(params) => openDetail(params.row.id)}
        />
      </Paper>

      {/* ── Detail Drawer ─────────────────────────────────────────────────── */}
      <Drawer
        anchor="right"
        open={detailOpen}
        onClose={closeDetail}
        PaperProps={{ sx: { width: { xs: "100%", sm: "100%", md: 600 }, maxWidth: "100%" } }}
      >
        <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
          <Box sx={{ p: 3, pb: 2, borderBottom: 1, borderColor: "divider" }}>
            <Stack direction="row" alignItems="center" spacing={2}>
              <Box sx={{ flexGrow: 1 }}>
                <Typography variant="h5" sx={{ fontWeight: 600, mb: 0.5 }}>
                  {detail?.name || "Voyage"}
                </Typography>
                {detail && (
                  <Typography variant="caption" color="text.secondary">
                    {detail.id}
                  </Typography>
                )}
              </Box>
              <IconButton onClick={closeDetail}>
                <X size={20} />
              </IconButton>
            </Stack>
          </Box>

          <Box sx={{ flexGrow: 1, overflowY: "auto", p: { xs: 2, sm: 3 } }}>
            {detailLoading ? (
              <Stack spacing={2}>
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} height={80} />
                ))}
              </Stack>
            ) : detailError ? (
              <Alert severity="error">{detailError}</Alert>
            ) : detail ? (
              <Stack spacing={2.5}>
                <Paper elevation={0} sx={{ p: 2.5, bgcolor: "grey.50", border: 1, borderColor: "divider" }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1.5 }}>
                    Details
                  </Typography>
                  <Stack spacing={0.75}>
                    <Typography variant="body2">
                      <strong>Owner:</strong> {ownerLabel(detail)}
                    </Typography>
                    <Typography variant="body2" sx={{ fontFamily: "monospace", fontSize: "0.8rem" }}>
                      {detail.ownerId || "—"}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Created:</strong> {formatDate(detail.createdAt)}
                    </Typography>
                    {detail.description && (
                      <Typography variant="body2">
                        <strong>Description:</strong> {detail.description}
                      </Typography>
                    )}
                  </Stack>
                </Paper>

                {/* Reassign */}
                <Paper elevation={0} sx={{ p: 2.5, bgcolor: "grey.50", border: 1, borderColor: "divider" }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1.5 }}>
                    Reassign Owner
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1.5 }}>
                    Updates the owner in the database only. It does not update the
                    voyage on the previous or new owner's device — they'll need to
                    reopen the app (or a local fix may be needed) for it to reflect there.
                  </Typography>
                  <Stack direction="row" spacing={1}>
                    <TextField
                      size="small"
                      fullWidth
                      label="New owner's email"
                      value={reassignEmail}
                      onChange={(e) => setReassignEmail(e.target.value)}
                      disabled={reassigning}
                    />
                    <Button
                      variant="contained"
                      onClick={handleReassign}
                      disabled={reassigning || !reassignEmail.trim()}
                    >
                      {reassigning ? "Saving…" : "Reassign"}
                    </Button>
                  </Stack>
                  {reassignError && (
                    <Alert severity="error" sx={{ mt: 1.5 }}>
                      {reassignError}
                    </Alert>
                  )}
                  {reassignSuccess && (
                    <Alert severity="success" sx={{ mt: 1.5 }}>
                      {reassignSuccess}
                    </Alert>
                  )}
                </Paper>

                <Divider />

                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  Waypoints ({detail.waypoints.length})
                </Typography>

                {detail.waypoints.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    No waypoints on this voyage.
                  </Typography>
                ) : (
                  <Stack spacing={2}>
                    {detail.waypoints.map((wp) => (
                      <Paper key={wp.id} elevation={0} sx={{ p: 2, border: 1, borderColor: "divider" }}>
                        <Stack direction="row" spacing={2}>
                          <Stack spacing={0.5} sx={{ flexGrow: 1 }}>
                            <Typography variant="body2" fontWeight={600}>
                              {wp.title || "(untitled waypoint)"}
                            </Typography>
                            {wp.description && (
                              <Typography variant="caption" color="text.secondary">
                                {wp.description}
                              </Typography>
                            )}
                            <Typography variant="caption" color="text.secondary">
                              {formatDate(wp.createdAt)}
                              {wp.latitude != null && wp.longitude != null
                                ? ` · ${Number(wp.latitude).toFixed(4)}, ${Number(wp.longitude).toFixed(4)}`
                                : ""}
                            </Typography>
                          </Stack>
                          {wp.photos.length > 0 && (
                            <Stack direction="row" spacing={0.5}>
                              {wp.photos.map((p, i) => (
                                <Avatar
                                  key={i}
                                  variant="rounded"
                                  src={r2Url(p.r2Key)}
                                  sx={{ width: 48, height: 48, bgcolor: "grey.200" }}
                                />
                              ))}
                            </Stack>
                          )}
                        </Stack>
                      </Paper>
                    ))}
                  </Stack>
                )}

                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<Trash2 size={16} />}
                  onClick={() =>
                    setDeleteTarget({
                      id: detail.id,
                      name: detail.name,
                      waypointCount: detail.waypoints.length,
                      photoCount: detail.waypoints.reduce((sum, w) => sum + w.photos.length, 0),
                    })
                  }
                >
                  Delete Voyage
                </Button>
              </Stack>
            ) : null}
          </Box>
        </Box>
      </Drawer>

      {/* ── Delete confirmation ──────────────────────────────────────────── */}
      <Dialog open={!!deleteTarget} onClose={() => (deleting ? null : setDeleteTarget(null))}>
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <AlertTriangle size={20} color="#d32f2f" />
          Delete this voyage?
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            This permanently deletes <strong>{deleteTarget?.name || "this voyage"}</strong>
            {typeof deleteTarget?.waypointCount === "number"
              ? `, its ${deleteTarget.waypointCount} waypoint${deleteTarget.waypointCount !== 1 ? "s" : ""}`
              : ""}
            {typeof deleteTarget?.photoCount === "number" && deleteTarget.photoCount > 0
              ? ` and ${deleteTarget.photoCount} photo${deleteTarget.photoCount !== 1 ? "s" : ""} (including the stored image files)`
              : ""}
            , and any sharing with other sailors. This cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)} disabled={deleting}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleDelete}
            disabled={deleting}
            startIcon={deleting ? <CircularProgress size={16} color="inherit" /> : null}
          >
            {deleting ? "Deleting…" : "Delete Permanently"}
          </Button>
        </DialogActions>
      </Dialog>
    </React.Fragment>
  );
}

export default Waypoints;
