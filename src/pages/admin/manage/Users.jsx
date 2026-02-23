import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import {
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
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  Skeleton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import {
  Download,
  RefreshCw,
  Search,
  Shield,
  UserCheck,
  UserMinus,
  UserX,
  X,
} from "lucide-react";
import {
  listAllUsers,
  setUserRole,
  suspendUser,
  unsuspendUser,
  deleteUser,
  restoreUser,
  getUserDetail,
} from "@/services/userAdmin";

// ── Constants ────────────────────────────────────────────────────────────────

const ROLES = ["user", "sponsor", "partner", "admin"];

const ROLE_COLORS = {
  user: "default",
  sponsor: "info",
  partner: "success",
  admin: "error",
};

const ROLE_LABELS = {
  user: "User",
  sponsor: "Sponsor",
  partner: "Partner",
  admin: "Admin",
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function initials(name, email) {
  if (name && name.trim()) {
    const parts = name.trim().split(" ");
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : parts[0].slice(0, 2).toUpperCase();
  }
  return (email ?? "?")[0].toUpperCase();
}

function relativeTime(isoString) {
  if (!isoString) return "—";
  const ms = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(isoString).toLocaleDateString();
}

function exportCsv(users) {
  const header = ["Name", "Email", "Role", "Status", "Joined", "Last Sign In"];
  const rows = users.map((u) => [
    u.displayName ?? "",
    u.email ?? "",
    u.role ?? "user",
    u.disabled ? (u._deleted ? "Deleted" : "Suspended") : "Active",
    u.creationTime ? new Date(u.creationTime).toLocaleDateString() : "",
    u.lastSignInTime ? new Date(u.lastSignInTime).toLocaleDateString() : "",
  ]);
  const csv = [header, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `users-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Role Chip ────────────────────────────────────────────────────────────────

function RoleChip({ role }) {
  return (
    <Chip
      label={ROLE_LABELS[role] ?? role}
      color={ROLE_COLORS[role] ?? "default"}
      size="small"
      sx={{ fontWeight: 600, minWidth: 70 }}
    />
  );
}

// ── Status Chip ──────────────────────────────────────────────────────────────

function StatusChip({ disabled, deleted }) {
  if (deleted) return <Chip label="Deleted" color="error" size="small" variant="outlined" />;
  if (disabled) return <Chip label="Suspended" color="warning" size="small" variant="outlined" />;
  return <Chip label="Active" color="success" size="small" variant="outlined" />;
}

// ── Confirm Dialog ───────────────────────────────────────────────────────────

function ConfirmDialog({ open, title, message, confirmLabel, confirmColor = "error", requireText, onConfirm, onClose, loading }) {
  const [typed, setTyped] = useState("");
  const canConfirm = !requireText || typed === requireText;

  useEffect(() => {
    if (!open) setTyped("");
  }, [open]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <DialogContentText>{message}</DialogContentText>
        {requireText && (
          <TextField
            autoFocus
            fullWidth
            size="small"
            sx={{ mt: 2 }}
            label={`Type "${requireText}" to confirm`}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
          />
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>Cancel</Button>
        <Button
          variant="contained"
          color={confirmColor}
          disabled={!canConfirm || loading}
          onClick={onConfirm}
          startIcon={loading ? <CircularProgress size={14} color="inherit" /> : null}
        >
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Role Dialog ──────────────────────────────────────────────────────────────

function RoleDialog({ open, user, onConfirm, onClose, loading }) {
  const [selectedRole, setSelectedRole] = useState(user?.role ?? "user");

  useEffect(() => {
    if (open) setSelectedRole(user?.role ?? "user");
  }, [open, user]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Change Role</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 2 }}>
          Assign a new role to <strong>{user?.displayName ?? user?.email}</strong>.
          The user must sign out and back in for the change to take effect.
        </DialogContentText>
        <FormControl fullWidth size="small">
          <InputLabel>Role</InputLabel>
          <Select value={selectedRole} label="Role" onChange={(e) => setSelectedRole(e.target.value)}>
            {ROLES.map((r) => (
              <MenuItem key={r} value={r}>{ROLE_LABELS[r]}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>Cancel</Button>
        <Button
          variant="contained"
          disabled={selectedRole === user?.role || loading}
          onClick={() => onConfirm(selectedRole)}
          startIcon={loading ? <CircularProgress size={14} color="inherit" /> : null}
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Detail Drawer ────────────────────────────────────────────────────────────

function DetailDrawer({ user, open, onClose, onAction }) {
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [suspendDialogOpen, setSuspendDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);

  useEffect(() => {
    if (!open || !user) { setDetail(null); return; }
    setDetailLoading(true);
    getUserDetail(user.uid)
      .then(setDetail)
      .catch((e) => console.error("[UserDetail]", e))
      .finally(() => setDetailLoading(false));
  }, [open, user]);

  const handleAction = useCallback(async (fn, closeDialog) => {
    setActionLoading(true);
    try {
      await fn();
      closeDialog();
      onAction();
    } catch (e) {
      console.error("[UserAction]", e);
    } finally {
      setActionLoading(false);
    }
  }, [onAction]);

  if (!user) return null;

  const isDeleted = user._deleted;
  const isSuspended = user.disabled && !isDeleted;
  const isActive = !user.disabled;

  const profileName = [detail?.profile?.firstName, detail?.profile?.lastName].filter(Boolean).join(" ");
  const name = user.displayName ?? (profileName || user.email);

  return (
    <>
      <Drawer anchor="right" open={open} onClose={onClose} PaperProps={{ sx: { width: 400, p: 3 } }}>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
          <Typography variant="h6">User Detail</Typography>
          <IconButton onClick={onClose} size="small"><X size={18} /></IconButton>
        </Box>

        {/* Header */}
        <Box display="flex" alignItems="center" gap={2} mb={3}>
          <Avatar src={user.photoURL ?? detail?.profile?.photoURL} sx={{ width: 56, height: 56, fontSize: 20 }}>
            {initials(name, user.email)}
          </Avatar>
          <Box>
            <Typography variant="subtitle1" fontWeight={700} lineHeight={1.2}>{name}</Typography>
            <Typography variant="caption" color="text.secondary">{user.email}</Typography>
            <Box display="flex" gap={0.75} mt={0.5} flexWrap="wrap">
              <RoleChip role={user.role ?? "user"} />
              <StatusChip disabled={user.disabled} deleted={isDeleted} />
            </Box>
          </Box>
        </Box>

        <Divider sx={{ mb: 2 }} />

        {/* Identity */}
        <Typography variant="overline" color="text.secondary">Identity</Typography>
        {detailLoading ? (
          <Stack spacing={1} mt={1} mb={2}>
            {[1,2,3].map(i => <Skeleton key={i} height={20} />)}
          </Stack>
        ) : (
          <Stack spacing={0.5} mt={0.5} mb={2}>
            <DetailRow label="Phone" value={detail?.profile?.phone} />
            <DetailRow label="CPID" value={detail?.profile?.cpid} />
            <DetailRow label="MMSI" value={detail?.profile?.mmsi} />
          </Stack>
        )}

        <Divider sx={{ mb: 2 }} />

        {/* Vessel */}
        <Typography variant="overline" color="text.secondary">Vessel</Typography>
        {detailLoading ? (
          <Stack spacing={1} mt={1} mb={2}>
            {[1,2].map(i => <Skeleton key={i} height={20} />)}
          </Stack>
        ) : (
          <Stack spacing={0.5} mt={0.5} mb={2}>
            <DetailRow label="Boat Name" value={detail?.profile?.boatName} />
            <DetailRow label="Boat Type" value={detail?.profile?.boatType} />
          </Stack>
        )}

        <Divider sx={{ mb: 2 }} />

        {/* Activity */}
        <Typography variant="overline" color="text.secondary">Activity</Typography>
        {detailLoading ? (
          <Stack spacing={1} mt={1} mb={2}>
            {[1,2,3,4,5,6].map(i => <Skeleton key={i} height={20} />)}
          </Stack>
        ) : (
          <Stack spacing={0.5} mt={0.5} mb={2}>
            <DetailRow label="Joined" value={user.creationTime ? new Date(user.creationTime).toLocaleDateString() : null} />
            <DetailRow label="Last Sign In" value={user.lastSignInTime ? relativeTime(user.lastSignInTime) : null} />
            <DetailRow label="Last Seen" value={detail?.lastSeen ? relativeTime(new Date(detail.lastSeen).toISOString()) : null} />
            <DetailRow label="Posts" value={detail?.counts?.posts} />
            <DetailRow label="Voyages" value={detail?.counts?.voyages} />
            <DetailRow label="Chats" value={detail?.counts?.chats} />
          </Stack>
        )}

        <Divider sx={{ mb: 2 }} />

        {/* Actions */}
        <Typography variant="overline" color="text.secondary">Actions</Typography>
        <Stack spacing={1} mt={1}>
          <Button fullWidth variant="outlined" startIcon={<Shield size={16} />} onClick={() => setRoleDialogOpen(true)}>
            Change Role
          </Button>
          {isActive && (
            <Button fullWidth variant="outlined" color="warning" startIcon={<UserMinus size={16} />} onClick={() => setSuspendDialogOpen(true)}>
              Suspend User
            </Button>
          )}
          {isSuspended && (
            <Button fullWidth variant="outlined" color="success" startIcon={<UserCheck size={16} />} onClick={() => setSuspendDialogOpen(true)}>
              Unsuspend User
            </Button>
          )}
          {!isDeleted && (
            <Button fullWidth variant="outlined" color="error" startIcon={<UserX size={16} />} onClick={() => setDeleteDialogOpen(true)}>
              Delete User
            </Button>
          )}
          {isDeleted && (
            <Button fullWidth variant="outlined" color="success" startIcon={<UserCheck size={16} />} onClick={() => setRestoreDialogOpen(true)}>
              Restore User
            </Button>
          )}
        </Stack>
      </Drawer>

      {/* Role dialog */}
      <RoleDialog
        open={roleDialogOpen}
        user={user}
        loading={actionLoading}
        onClose={() => setRoleDialogOpen(false)}
        onConfirm={(role) => handleAction(() => setUserRole(user.uid, role), () => setRoleDialogOpen(false))}
      />

      {/* Suspend / Unsuspend dialog */}
      <ConfirmDialog
        open={suspendDialogOpen}
        title={isSuspended ? "Unsuspend User" : "Suspend User"}
        message={isSuspended
          ? `Re-enable ${name}'s account? They will be able to sign in immediately.`
          : `This will immediately block ${name} from signing in. You can reverse this at any time.`}
        confirmLabel={isSuspended ? "Unsuspend" : "Suspend"}
        confirmColor={isSuspended ? "success" : "warning"}
        loading={actionLoading}
        onClose={() => setSuspendDialogOpen(false)}
        onConfirm={() => handleAction(
          () => isSuspended ? unsuspendUser(user.uid) : suspendUser(user.uid),
          () => setSuspendDialogOpen(false)
        )}
      />

      {/* Delete dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        title="Delete User"
        message={`This will disable ${name}'s account and mark it as deleted. Their data will be preserved. You can restore the account later.`}
        confirmLabel="Delete"
        confirmColor="error"
        requireText={user.email}
        loading={actionLoading}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={() => handleAction(() => deleteUser(user.uid), () => setDeleteDialogOpen(false))}
      />

      {/* Restore dialog */}
      <ConfirmDialog
        open={restoreDialogOpen}
        title="Restore User"
        message={`Restore ${name}'s account? This will re-enable their ability to sign in.`}
        confirmLabel="Restore"
        confirmColor="success"
        loading={actionLoading}
        onClose={() => setRestoreDialogOpen(false)}
        onConfirm={() => handleAction(() => restoreUser(user.uid), () => setRestoreDialogOpen(false))}
      />
    </>
  );
}

function DetailRow({ label, value }) {
  return (
    <Box display="flex" justifyContent="space-between" alignItems="center">
      <Typography variant="caption" color="text.secondary" sx={{ minWidth: 90 }}>{label}</Typography>
      <Typography variant="body2" textAlign="right">{value ?? "—"}</Typography>
    </Box>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

function Users() {
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadProgress, setLoadProgress] = useState(0);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedUser, setSelectedUser] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 25 });
  const loadingRef = useRef(false);

  const load = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    setLoadProgress(10);
    try {
      const users = await listAllUsers();
      setLoadProgress(100);
      // Annotate deleted flag from customClaims or other signals
      setAllUsers(users.map((u) => ({
        ...u,
        id: u.uid,
        _deleted: u.disabled && false, // will be updated from detail; start false
      })));
    } catch (e) {
      console.error("[Users] load failed:", e);
      setLoadError(e?.message ?? String(e));
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Filtered + searched rows
  const filteredUsers = useMemo(() => {
    const q = search.toLowerCase().trim();
    return allUsers.filter((u) => {
      if (q && !(
        (u.displayName ?? "").toLowerCase().includes(q) ||
        (u.email ?? "").toLowerCase().includes(q) ||
        u.uid.toLowerCase().includes(q)
      )) return false;

      if (roleFilter !== "all" && (u.role ?? "user") !== roleFilter) return false;

      if (statusFilter === "active" && u.disabled) return false;
      if (statusFilter === "suspended" && (!u.disabled || u._deleted)) return false;
      if (statusFilter === "deleted" && !u._deleted) return false;

      return true;
    });
  }, [allUsers, search, roleFilter, statusFilter]);

  const handleRowClick = useCallback((params) => {
    setSelectedUser(params.row);
    setDrawerOpen(true);
  }, []);

  const handleActionComplete = useCallback(() => {
    // Refresh the user list after an action
    load();
    setDrawerOpen(false);
  }, [load]);

  const columns = useMemo(() => [
    {
      field: "displayName",
      headerName: "User",
      flex: 1.5,
      minWidth: 200,
      renderCell: (params) => {
        const name = params.value ?? params.row.email ?? "Unknown";
        return (
          <Box display="flex" alignItems="center" gap={1.5} height="100%">
            <Avatar src={params.row.photoURL} sx={{ width: 28, height: 28, fontSize: 12, flexShrink: 0 }}>
              {initials(params.value, params.row.email)}
            </Avatar>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="body2" fontWeight={600} lineHeight={1.1} noWrap>{name}</Typography>
              <Typography variant="caption" color="text.secondary" lineHeight={1.1} noWrap display="block">{params.row.email}</Typography>
            </Box>
          </Box>
        );
      },
    },
    {
      field: "role",
      headerName: "Role",
      width: 110,
      renderCell: (params) => (
        <Box display="flex" alignItems="center" height="100%">
          <RoleChip role={params.value ?? "user"} />
        </Box>
      ),
    },
    {
      field: "status",
      headerName: "Status",
      width: 110,
      valueGetter: (_value, row) => row.disabled ? (row._deleted ? "deleted" : "suspended") : "active",
      renderCell: (params) => (
        <Box display="flex" alignItems="center" height="100%">
          <StatusChip disabled={params.row.disabled} deleted={params.row._deleted} />
        </Box>
      ),
    },
    {
      field: "lastSignInTime",
      headerName: "Last Sign In",
      width: 130,
      renderCell: (params) => (
        <Box display="flex" alignItems="center" height="100%">
          <Typography variant="body2" color="text.secondary">
            {relativeTime(params.value)}
          </Typography>
        </Box>
      ),
    },
    {
      field: "creationTime",
      headerName: "Joined",
      width: 110,
      renderCell: (params) => (
        <Box display="flex" alignItems="center" height="100%">
          <Typography variant="body2" color="text.secondary">
            {params.value ? new Date(params.value).toLocaleDateString() : "—"}
          </Typography>
        </Box>
      ),
    },
  ], []);

  return (
    <React.Fragment>
      <Helmet title="Users" />

      {/* Header */}
      <Box display="flex" alignItems="flex-start" justifyContent="space-between" flexWrap="wrap" gap={2} mb={3}>
        <Box>
          <Typography variant="h4" gutterBottom>Users</Typography>
          <Typography variant="caption" color="text.secondary">
            {loading ? "Loading…" : `${allUsers.length.toLocaleString()} total · ${filteredUsers.length.toLocaleString()} shown`}
          </Typography>
        </Box>
        <Box display="flex" gap={1}>
          <Tooltip title="Refresh">
            <span>
              <IconButton onClick={load} disabled={loading}>
                <RefreshCw size={18} />
              </IconButton>
            </span>
          </Tooltip>
          <Button
            variant="outlined"
            startIcon={<Download size={16} />}
            onClick={() => exportCsv(filteredUsers)}
            disabled={loading || filteredUsers.length === 0}
          >
            Export CSV
          </Button>
        </Box>
      </Box>

      {/* Loading progress */}
      {loading && <LinearProgress variant="determinate" value={loadProgress} sx={{ mb: 2, borderRadius: 1 }} />}

      {/* Load error */}
      {loadError && (
        <Box sx={{ mb: 2, p: 2, bgcolor: "error.light", borderRadius: 2 }}>
          <Typography variant="body2" color="error.contrastText">
            Failed to load users: {loadError}
          </Typography>
        </Box>
      )}

      {/* Filters */}
      <Box display="flex" gap={2} flexWrap="wrap" mb={2}>
        <TextField
          size="small"
          placeholder="Search name, email, UID…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPaginationModel((p) => ({ ...p, page: 0 })); }}
          InputProps={{
            startAdornment: <InputAdornment position="start"><Search size={16} /></InputAdornment>,
            endAdornment: search ? (
              <InputAdornment position="end">
                <IconButton size="small" onClick={() => setSearch("")}><X size={14} /></IconButton>
              </InputAdornment>
            ) : null,
          }}
          sx={{ minWidth: 260 }}
        />
        <FormControl size="small" sx={{ minWidth: 130 }}>
          <InputLabel>Role</InputLabel>
          <Select value={roleFilter} label="Role" onChange={(e) => { setRoleFilter(e.target.value); setPaginationModel((p) => ({ ...p, page: 0 })); }}>
            <MenuItem value="all">All Roles</MenuItem>
            {ROLES.map((r) => <MenuItem key={r} value={r}>{ROLE_LABELS[r]}</MenuItem>)}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 130 }}>
          <InputLabel>Status</InputLabel>
          <Select value={statusFilter} label="Status" onChange={(e) => { setStatusFilter(e.target.value); setPaginationModel((p) => ({ ...p, page: 0 })); }}>
            <MenuItem value="all">All Statuses</MenuItem>
            <MenuItem value="active">Active</MenuItem>
            <MenuItem value="suspended">Suspended</MenuItem>
            <MenuItem value="deleted">Deleted</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {/* Data Grid */}
      <Box sx={{ height: "calc(100vh - 320px)", minHeight: 400 }}>
        <DataGrid
          rows={filteredUsers}
          columns={columns}
          paginationModel={paginationModel}
          onPaginationModelChange={setPaginationModel}
          pageSizeOptions={[25, 50, 100]}
          loading={loading}
          onRowClick={handleRowClick}
          rowHeight={48}
          disableRowSelectionOnClick={false}
          sx={{
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 2,
            "& .MuiDataGrid-row": { cursor: "pointer" },
            "& .MuiDataGrid-row:hover": { bgcolor: "action.hover" },
            "& .MuiDataGrid-columnHeaders": { bgcolor: "background.paper" },
            "& .MuiDataGrid-cell": { py: 0 },
          }}
          slotProps={{
            loadingOverlay: {
              variant: "skeleton",
              noRowsVariant: "skeleton",
            },
          }}
        />
      </Box>

      {/* Detail Drawer */}
      <DetailDrawer
        user={selectedUser}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onAction={handleActionComplete}
      />
    </React.Fragment>
  );
}

export default Users;

