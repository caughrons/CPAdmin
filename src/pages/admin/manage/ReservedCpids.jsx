import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControl,
  FormControlLabel,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import { Plus, RefreshCw, Search } from "lucide-react";
import {
  listAllUsers,
  listBrandCpids,
  seedBrandCpids,
  upsertBrandCpid,
  releaseBrandCpid,
  assignBrandCpid,
} from "@/services/userAdmin";

// ── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = {
  content_provider: "Content provider",
  manufacturer: "Manufacturer",
  industry: "Industry services",
};

const STATES = {
  not_seeded: { label: "Not seeded", color: "default", help: "In the default list, not enforced yet" },
  reserved: { label: "Reserved", color: "info", help: "Blocked — users see it as taken" },
  assigned: { label: "Assigned", color: "success", help: "Held by the account it was assigned to" },
  conflict: { label: "Conflict", color: "error", help: "A user claimed it before it was reserved" },
  released: { label: "Released", color: "warning", help: "Unblocked — anyone can claim it" },
};

const CPID_REGEX = /^[a-z0-9_]{4,20}$/;

function normalizeCpid(raw) {
  return raw.trim().toLowerCase().replace(/^~/, "");
}

// ── Add / Edit Dialog ────────────────────────────────────────────────────────

function EditDialog({ open, row, onClose, onSave, loading }) {
  const [cpid, setCpid] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState("manufacturer");
  const [group, setGroup] = useState("");

  useEffect(() => {
    if (!open) return;
    setCpid(row?.cpid ?? "");
    setName(row?.name ?? "");
    setCategory(row?.category ?? "manufacturer");
    setGroup(row?.group ?? "");
  }, [open, row]);

  const normalized = normalizeCpid(cpid);
  const valid = CPID_REGEX.test(normalized) && name.trim().length > 0;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{row ? `Edit ~${row.cpid}` : "Reserve a CP ID"}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            size="small" label="CP ID" placeholder="e.g. garmin"
            value={cpid} disabled={!!row}
            onChange={(e) => setCpid(e.target.value)}
            error={!!cpid && !CPID_REGEX.test(normalized)}
            helperText={cpid && !CPID_REGEX.test(normalized) ? "4–20 chars: lowercase, numbers, underscores only" : " "}
          />
          <TextField
            size="small" label="Brand / provider name" placeholder="e.g. Garmin"
            value={name} onChange={(e) => setName(e.target.value)}
          />
          <FormControl size="small">
            <InputLabel>Category</InputLabel>
            <Select label="Category" value={category} onChange={(e) => setCategory(e.target.value)}>
              {Object.entries(CATEGORIES).map(([k, v]) => <MenuItem key={k} value={k}>{v}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField
            size="small" label="Group (optional)" placeholder="e.g. Marine electronics"
            value={group} onChange={(e) => setGroup(e.target.value)}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>Cancel</Button>
        <Button
          variant="contained" disabled={!valid || loading}
          onClick={() => onSave({ cpid: normalized, name: name.trim(), category, group: group.trim() })}
          startIcon={loading ? <CircularProgress size={14} color="inherit" /> : null}
        >
          {row ? "Save" : "Reserve"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Assign Dialog ────────────────────────────────────────────────────────────

function AssignDialog({ open, row, users, usersLoading, onClose, onAssign, loading }) {
  const [user, setUser] = useState(null);
  const [reason, setReason] = useState("");
  const [confirmEvict, setConfirmEvict] = useState(false);

  useEffect(() => {
    if (open) { setUser(null); setReason(""); setConfirmEvict(false); }
  }, [open]);

  const heldByOther = !!row?.holderUid && row.holderUid !== user?.uid;
  const canAssign = !!user && (!heldByOther || confirmEvict);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Assign ~{row?.cpid}</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 2 }}>
          Give <strong>~{row?.cpid}</strong> ({row?.name}) to an existing account. Their current CP ID is
          replaced and held back for a year, same as Force Rename. The account must have signed in to the app at
          least once.
        </DialogContentText>
        <Autocomplete
          size="small"
          options={users}
          loading={usersLoading}
          value={user}
          onChange={(_, v) => setUser(v)}
          isOptionEqualToValue={(o, v) => o.uid === v.uid}
          getOptionLabel={(u) => [u.displayName, u.email, u.uid].filter(Boolean).join(" · ")}
          filterOptions={(opts, { inputValue }) => {
            const q = inputValue.trim().toLowerCase();
            if (!q) return opts.slice(0, 50);
            return opts
              .filter((u) => [u.displayName, u.email, u.uid].some((f) => f?.toLowerCase().includes(q)))
              .slice(0, 50);
          }}
          renderInput={(params) => (
            <TextField {...params} label="Account" placeholder="Search name, email or UID" />
          )}
          sx={{ mb: 2 }}
        />
        <TextField
          fullWidth size="small" label="Reason (optional)"
          placeholder="e.g. Verified via support@garmin.com"
          value={reason} onChange={(e) => setReason(e.target.value)}
        />
        {heldByOther && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            <strong>~{row.cpid}</strong> is currently held by {row.holderName || row.holderEmail || row.holderUid}.
            Assigning it removes their CP ID and they'll have to choose a new one.
            <FormControlLabel
              sx={{ display: "block", mt: 1 }}
              control={<Checkbox checked={confirmEvict} onChange={(e) => setConfirmEvict(e.target.checked)} />}
              label="Take it from them"
            />
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>Cancel</Button>
        <Button
          variant="contained" color="success" disabled={!canAssign || loading}
          onClick={() => onAssign(user.uid, reason.trim(), heldByOther)}
          startIcon={loading ? <CircularProgress size={14} color="inherit" /> : null}
        >
          Assign
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

function ReservedCpids() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [state, setState] = useState("all");

  const [editRow, setEditRow] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  const [assignRow, setAssignRow] = useState(null);

  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await listBrandCpids());
    } catch (e) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Users are only needed for the assign picker — fetch on first use.
  const ensureUsers = useCallback(async () => {
    if (users.length || usersLoading) return;
    setUsersLoading(true);
    try {
      setUsers(await listAllUsers());
    } catch (e) {
      setError(e?.message ?? String(e));
    } finally {
      setUsersLoading(false);
    }
  }, [users.length, usersLoading]);

  const flash = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 5000);
  };

  const run = async (fn, msg) => {
    setBusy(true);
    setError(null);
    try {
      const result = await fn();
      flash(typeof msg === "function" ? msg(result) : msg);
      await load();
      return true;
    } catch (e) {
      setError(e?.message === "held_by_other_user"
        ? "Someone else holds that handle — tick “Take it from them” to proceed."
        : e?.message ?? String(e));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const counts = useMemo(() => {
    const c = {};
    for (const r of rows) c[r.state] = (c[r.state] ?? 0) + 1;
    return c;
  }, [rows]);

  const filtered = useMemo(() => {
    const q = normalizeCpid(search);
    return rows.filter((r) =>
      (category === "all" || r.category === category) &&
      (state === "all" || r.state === state) &&
      (!q || r.cpid.includes(q) || r.name.toLowerCase().includes(q) ||
        (r.holderEmail ?? "").toLowerCase().includes(q))
    );
  }, [rows, search, category, state]);

  const columns = [
    {
      field: "cpid", headerName: "CP ID", width: 200,
      renderCell: (p) => <Typography variant="body2" fontWeight={600}>~{p.value}</Typography>,
    },
    { field: "name", headerName: "Brand / provider", flex: 1, minWidth: 180 },
    {
      field: "category", headerName: "Category", width: 150,
      valueGetter: (value) => CATEGORIES[value] ?? value,
    },
    { field: "group", headerName: "Group", flex: 1, minWidth: 180 },
    {
      field: "state", headerName: "State", width: 120,
      renderCell: (p) => {
        const s = STATES[p.value] ?? { label: p.value, color: "default" };
        return <Chip size="small" label={s.label} color={s.color} title={s.help} />;
      },
    },
    {
      field: "holderEmail", headerName: "Held by", flex: 1, minWidth: 180,
      valueGetter: (value, row) => row.holderName || value || "",
    },
    {
      field: "actions", headerName: "", width: 260, sortable: false, filterable: false,
      renderCell: (p) => {
        const r = p.row;
        return (
          <Stack direction="row" spacing={1} alignItems="center" sx={{ height: "100%" }}>
            {r.state !== "released" && (
              <Button size="small" disabled={busy}
                onClick={() => { ensureUsers(); setAssignRow(r); }}>
                {r.state === "assigned" ? "Reassign" : "Assign"}
              </Button>
            )}
            <Button size="small" disabled={busy} onClick={() => { setEditRow(r); setEditOpen(true); }}>
              Edit
            </Button>
            {r.state === "released" ? (
              <Button size="small" color="info" disabled={busy}
                onClick={() => run(() => upsertBrandCpid(r), `~${r.cpid} reserved again.`)}>
                Re-reserve
              </Button>
            ) : (
              <Button size="small" color="warning" disabled={busy}
                onClick={() => {
                  if (window.confirm(`Release ~${r.cpid}? Any user will be able to claim it.`)) {
                    run(() => releaseBrandCpid(r.cpid), `~${r.cpid} released.`);
                  }
                }}>
                Release
              </Button>
            )}
          </Stack>
        );
      },
    },
  ];

  return (
    <React.Fragment>
      <Helmet title="Reserved CP IDs" />
      <Box sx={{ p: 3 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
          <Typography variant="h3">Reserved CP IDs</Typography>
          <Stack direction="row" spacing={1}>
            <Button startIcon={<RefreshCw size={16} />} onClick={load} disabled={loading || busy}>
              Refresh
            </Button>
            <Button startIcon={<Plus size={16} />} onClick={() => { setEditRow(null); setEditOpen(true); }} disabled={busy}>
              Reserve handle
            </Button>
            <Button
              variant="contained" disabled={busy || !counts.not_seeded}
              onClick={() => run(seedBrandCpids, (r) => `Seeded ${r.added} handle${r.added === 1 ? "" : "s"}.`)}
            >
              Seed default list{counts.not_seeded ? ` (${counts.not_seeded})` : ""}
            </Button>
          </Stack>
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Handles held back for content providers, manufacturers and industry businesses. Users trying to claim one
          (or a look-alike such as <code>garmin_official</code> or <code>therealgarmin</code>) are told it's already
          taken. Assign a handle once the real account has signed up.
        </Typography>

        <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: "wrap", gap: 1 }}>
          {Object.entries(STATES).map(([k, s]) => (
            <Chip
              key={k} label={`${s.label}: ${counts[k] ?? 0}`} color={s.color}
              variant={state === k ? "filled" : "outlined"} title={s.help}
              onClick={() => setState(state === k ? "all" : k)}
            />
          ))}
        </Stack>

        <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
          <TextField
            size="small" placeholder="Search handle, brand or holder"
            value={search} onChange={(e) => setSearch(e.target.value)}
            sx={{ width: 320 }}
            InputProps={{ startAdornment: <InputAdornment position="start"><Search size={16} /></InputAdornment> }}
          />
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Category</InputLabel>
            <Select label="Category" value={category} onChange={(e) => setCategory(e.target.value)}>
              <MenuItem value="all">All categories</MenuItem>
              {Object.entries(CATEGORIES).map(([k, v]) => <MenuItem key={k} value={k}>{v}</MenuItem>)}
            </Select>
          </FormControl>
          <Typography variant="body2" color="text.secondary" sx={{ alignSelf: "center" }}>
            {filtered.length} of {rows.length}
          </Typography>
        </Stack>

        {counts.not_seeded > 0 && !loading && (
          <Alert severity="info" sx={{ mb: 2 }}>
            {counts.not_seeded} default handles aren't enforced yet. Review the list, release anything that
            shouldn't be held back, then click <strong>Seed default list</strong>.
          </Alert>
        )}
        {counts.conflict > 0 && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            {counts.conflict} reserved handle{counts.conflict === 1 ? " is" : "s are"} already held by a user who
            claimed it first. Filter by <strong>Conflict</strong> to review.
          </Alert>
        )}
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {successMsg && <Alert severity="success" sx={{ mb: 2 }}>{successMsg}</Alert>}

        <DataGrid
          rows={filtered}
          getRowId={(r) => r.cpid}
          columns={columns}
          loading={loading}
          autoHeight
          pageSizeOptions={[25, 50, 100]}
          initialState={{ pagination: { paginationModel: { pageSize: 50 } } }}
          disableRowSelectionOnClick
          sx={{ backgroundColor: "background.paper" }}
        />
      </Box>

      <EditDialog
        open={editOpen} row={editRow} loading={busy}
        onClose={() => setEditOpen(false)}
        onSave={async (data) => {
          const ok = await run(() => upsertBrandCpid(data), `~${data.cpid} saved.`);
          if (ok) setEditOpen(false);
        }}
      />
      <AssignDialog
        open={!!assignRow} row={assignRow} users={users} usersLoading={usersLoading} loading={busy}
        onClose={() => setAssignRow(null)}
        onAssign={async (uid, reason, confirmEvict) => {
          const ok = await run(
            () => assignBrandCpid(assignRow.cpid, uid, reason, confirmEvict),
            `~${assignRow.cpid} assigned.`,
          );
          if (ok) setAssignRow(null);
        }}
      />
    </React.Fragment>
  );
}

export default ReservedCpids;
