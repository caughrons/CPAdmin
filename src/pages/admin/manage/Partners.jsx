import React, { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { RefreshCw } from "lucide-react";
import firebase from "firebase/compat/app";
import "firebase/compat/database";

const rtdb = firebase.database();

const GROUP_TYPES = ["user", "partner", "official", "sponsor"];

const TYPE_COLORS = {
  partner: "success",
  official: "warning",
  sponsor: "info",
  user: "default",
};

function Partners() {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [confirmGroup, setConfirmGroup] = useState(null); // { id, name, currentType, newType }
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState(null);

  const loadGroups = async () => {
    setLoading(true);
    try {
      const snap = await rtdb.ref("feed_groups").get();
      if (!snap.exists()) {
        setGroups([]);
        return;
      }
      const raw = snap.val();
      const list = Object.entries(raw).map(([id, val]) => ({
        id,
        name: val.name ?? "(unnamed)",
        groupType: val.groupType ?? val.type ?? "user",
        privacy: val.privacy ?? "—",
        createdBy: val.createdBy ?? val.ownerId ?? "—",
        memberCount: val.memberCount ?? 0,
        updatedAt: val.updatedAt ?? null,
      }));
      list.sort((a, b) => a.name.localeCompare(b.name));
      setGroups(list);
    } catch (e) {
      console.error("Failed to load feed_groups:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGroups();
  }, []);

  const handleTypeChange = (group, newType) => {
    if (newType === group.groupType) return;
    setConfirmGroup({ ...group, newType });
  };

  const confirmSave = async () => {
    if (!confirmGroup) return;
    setSaving(true);
    try {
      await rtdb.ref(`feed_groups/${confirmGroup.id}/groupType`).set(confirmGroup.newType);
      setGroups((prev) =>
        prev.map((g) =>
          g.id === confirmGroup.id ? { ...g, groupType: confirmGroup.newType } : g
        )
      );
      setSavedId(confirmGroup.id);
      setTimeout(() => setSavedId(null), 2000);
    } catch (e) {
      console.error("Failed to update groupType:", e);
      alert("Save failed: " + e.message);
    } finally {
      setSaving(false);
      setConfirmGroup(null);
    }
  };

  const filtered = groups.filter((g) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      g.name.toLowerCase().includes(q) ||
      g.id.toLowerCase().includes(q) ||
      g.createdBy.toLowerCase().includes(q) ||
      g.groupType.toLowerCase().includes(q)
    );
  });

  return (
    <React.Fragment>
      <Helmet title="Partners — Communities" />

      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={3}>
        <Box>
          <Typography variant="h4" gutterBottom>
            Partner Communities
          </Typography>
          <Typography variant="body2" color="text.secondary">
            View and fix the <code>groupType</code> for feed communities. Partner users'
            communities must have <code>groupType = partner</code> to auto-appear for all users
            with Hide/Show controls.
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={loading ? <CircularProgress size={16} /> : <RefreshCw size={16} />}
          onClick={loadGroups}
          disabled={loading}
        >
          Refresh
        </Button>
      </Stack>

      <Stack direction="row" spacing={2} mb={2} alignItems="center">
        <TextField
          size="small"
          placeholder="Search by name, ID, creator, or type…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ width: 360 }}
        />
        <Typography variant="body2" color="text.secondary">
          {filtered.length} of {groups.length} communities
        </Typography>
      </Stack>

      <Paper variant="outlined">
        {loading ? (
          <Box p={4} textAlign="center">
            <CircularProgress />
          </Box>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>ID</TableCell>
                <TableCell>Created By (UID)</TableCell>
                <TableCell>Privacy</TableCell>
                <TableCell>Members</TableCell>
                <TableCell>Group Type</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 4, color: "text.secondary" }}>
                    No communities found.
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((group) => (
                <TableRow
                  key={group.id}
                  sx={{
                    backgroundColor:
                      savedId === group.id ? "action.selected" : undefined,
                    transition: "background-color 0.5s",
                  }}
                >
                  <TableCell>
                    <Typography variant="body2" fontWeight={500}>
                      {group.name}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" color="text.secondary" sx={{ fontFamily: "monospace" }}>
                      {group.id}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" color="text.secondary" sx={{ fontFamily: "monospace" }}>
                      {group.createdBy}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{group.privacy}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{group.memberCount}</Typography>
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Chip
                        label={group.groupType}
                        color={TYPE_COLORS[group.groupType] ?? "default"}
                        size="small"
                        sx={{ minWidth: 72 }}
                      />
                      <Select
                        size="small"
                        value={group.groupType}
                        onChange={(e) => handleTypeChange(group, e.target.value)}
                        sx={{ minWidth: 110, fontSize: 13 }}
                      >
                        {GROUP_TYPES.map((t) => (
                          <MenuItem key={t} value={t}>
                            {t}
                          </MenuItem>
                        ))}
                      </Select>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Paper>

      {/* Confirm dialog */}
      <Dialog open={!!confirmGroup} onClose={() => setConfirmGroup(null)}>
        <DialogTitle>Change Group Type?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Change <strong>{confirmGroup?.name}</strong> from{" "}
            <code>{confirmGroup?.groupType}</code> to{" "}
            <code>{confirmGroup?.newType}</code>?
            <br />
            <br />
            This writes directly to <code>feed_groups/{confirmGroup?.id}/groupType</code> in
            RTDB. Mobile clients will pick up the change on next sync.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmGroup(null)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={confirmSave} variant="contained" disabled={saving}>
            {saving ? <CircularProgress size={16} /> : "Confirm"}
          </Button>
        </DialogActions>
      </Dialog>
    </React.Fragment>
  );
}

export default Partners;
