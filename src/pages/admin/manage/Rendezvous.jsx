import React, { useCallback, useEffect, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import {
  Alert,
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
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import EditIcon from "@mui/icons-material/Edit";
import SaveIcon from "@mui/icons-material/Save";
import CancelIcon from "@mui/icons-material/Cancel";
import { DragDropContext, Draggable, Droppable } from "@hello-pangea/dnd";
import firebase from "firebase/app";
import "firebase/firestore";
import "firebase/auth";
import { firebaseConfig } from "@/config";

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const firestore = firebase.firestore();
const DOC_REF = firestore.collection("app_config").doc("rendezvous_types");
const MAX_LABEL_LENGTH = 40;

const SEED_GROUPS = [
  "Food & Drinks",
  "Water Activities",
  "On Shore",
  "Social",
  "Kids & Teens",
  "Errands & Boat Work",
];

function slugify(label) {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function validateLabel(label, existingTypes, editingId = null) {
  const trimmed = label.trim();
  if (!trimmed) return "Label is required.";
  if (trimmed.length > MAX_LABEL_LENGTH)
    return `Label must be ${MAX_LABEL_LENGTH} characters or fewer.`;
  const lower = trimmed.toLowerCase();
  const duplicate = existingTypes.find(
    (t) => t.label.toLowerCase() === lower && t.id !== editingId
  );
  if (duplicate) return `"${trimmed}" already exists.`;
  return null;
}

function uniqueGroups(types) {
  const seen = new Set();
  const groups = [...SEED_GROUPS];
  for (const t of types) {
    if (!seen.has(t.group)) {
      seen.add(t.group);
      if (!groups.includes(t.group)) groups.push(t.group);
    }
  }
  return groups;
}

export default function Rendezvous() {
  const [types, setTypes] = useState([]);
  const [docMeta, setDocMeta] = useState({ version: null, updatedAt: null, updatedBy: null });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  // Add form state
  const [addLabel, setAddLabel] = useState("");
  const [addGroup, setAddGroup] = useState(SEED_GROUPS[0]);
  const [addError, setAddError] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);

  // Inline edit state
  const [editingId, setEditingId] = useState(null);
  const [editLabel, setEditLabel] = useState("");
  const [editGroup, setEditGroup] = useState("");
  const [editError, setEditError] = useState(null);

  // Delete confirm state
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  const editInputRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const doc = await DOC_REF.get();
      if (!doc.exists) {
        setTypes([]);
        setDocMeta({ version: null, updatedAt: null, updatedBy: null });
      } else {
        const data = doc.data();
        const sorted = [...(data.types ?? [])].sort(
          (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
        );
        setTypes(sorted);
        setDocMeta({
          version: data.version ?? null,
          updatedAt: data.updatedAt?.toDate?.() ?? null,
          updatedBy: data.updatedBy ?? null,
        });
      }
    } catch (e) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Focus edit input when editing starts
  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
    }
  }, [editingId]);

  const markDirty = (updatedTypes) => {
    setTypes(updatedTypes);
    setDirty(true);
    setSuccess(false);
  };

  // ── Drag & Drop ────────────────────────────────────────────────────────────

  const onDragEnd = (result) => {
    if (!result.destination) return;
    if (result.destination.index === result.source.index) return;
    const reordered = Array.from(types);
    const [moved] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, moved);
    const withOrder = reordered.map((t, i) => ({ ...t, sortOrder: i }));
    markDirty(withOrder);
  };

  // ── Add ────────────────────────────────────────────────────────────────────

  const handleAdd = () => {
    const err = validateLabel(addLabel, types);
    if (err) { setAddError(err); return; }
    const id = slugify(addLabel);
    if (types.find((t) => t.id === id)) {
      setAddError("Generated ID already exists. Slightly adjust the label.");
      return;
    }
    const newType = {
      id,
      label: addLabel.trim(),
      group: addGroup,
      active: true,
      sortOrder: types.length,
    };
    markDirty([...types, newType]);
    setAddLabel("");
    setAddGroup(SEED_GROUPS[0]);
    setAddError(null);
    setShowAddForm(false);
  };

  // ── Inline edit ────────────────────────────────────────────────────────────

  const startEdit = (type) => {
    setEditingId(type.id);
    setEditLabel(type.label);
    setEditGroup(type.group);
    setEditError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditLabel("");
    setEditGroup("");
    setEditError(null);
  };

  const commitEdit = () => {
    const err = validateLabel(editLabel, types, editingId);
    if (err) { setEditError(err); return; }
    markDirty(
      types.map((t) =>
        t.id === editingId
          ? { ...t, label: editLabel.trim(), group: editGroup }
          : t
      )
    );
    cancelEdit();
  };

  // ── Toggle active ──────────────────────────────────────────────────────────

  const toggleActive = (id) => {
    const target = types.find((t) => t.id === id);
    if (!target) return;
    if (target.active) {
      const activeCount = types.filter((t) => t.active).length;
      if (activeCount <= 1) return; // prevent deactivating the last active type
    }
    markDirty(
      types.map((t) => (t.id === id ? { ...t, active: !t.active } : t))
    );
  };

  // ── Delete ─────────────────────────────────────────────────────────────────

  const confirmDelete = (id) => setDeleteConfirmId(id);

  const handleDelete = () => {
    const id = deleteConfirmId;
    setDeleteConfirmId(null);
    const remaining = types.filter((t) => t.id !== id);
    const withOrder = remaining.map((t, i) => ({ ...t, sortOrder: i }));
    markDirty(withOrder);
  };

  // ── Save ───────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const currentUser = firebase.auth().currentUser;
      const updatedBy = currentUser?.email ?? currentUser?.uid ?? "unknown";

      await firestore.runTransaction(async (tx) => {
        const doc = await tx.get(DOC_REF);
        const currentVersion = doc.exists ? (doc.data().version ?? 0) : 0;
        tx.set(DOC_REF, {
          types: types.map((t, i) => ({ ...t, sortOrder: i })),
          version: currentVersion + 1,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
          updatedBy,
        });
      });

      setDirty(false);
      setSuccess(true);
      await load();
    } catch (e) {
      setError(e?.message ?? String(e));
    } finally {
      setSaving(false);
    }
  };

  // ── Derived ────────────────────────────────────────────────────────────────

  const activeCount = types.filter((t) => t.active).length;
  const groups = uniqueGroups(types);
  const typeBeingDeleted = types.find((t) => t.id === deleteConfirmId);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <React.Fragment>
      <Helmet title="Rendezvous Types" />
      <Box display="flex" flexDirection="column" gap={2}>

        {/* Header */}
        <Box display="flex" alignItems="flex-start" justifyContent="space-between" flexWrap="wrap" gap={1}>
          <Box>
            <Typography variant="h4" gutterBottom>Rendezvous Types</Typography>
            <Typography variant="body2" color="text.secondary">
              Manage the activity type list used when creating rendezvous events.
              Changes take effect in the app after running{" "}
              <code>npm run sync:rendezvous-types</code> and releasing a build.
            </Typography>
          </Box>
          <Box display="flex" gap={1} alignItems="center">
            {dirty && (
              <Chip label="Unsaved changes" color="warning" size="small" />
            )}
            <Button
              variant="contained"
              startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
              onClick={handleSave}
              disabled={!dirty || saving}
            >
              Save
            </Button>
          </Box>
        </Box>

        {/* Alerts */}
        {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}
        {success && <Alert severity="success" onClose={() => setSuccess(false)}>Saved. Run sync script before next build.</Alert>}

        {/* Meta */}
        {docMeta.version != null && (
          <Typography variant="caption" color="text.secondary">
            Version {docMeta.version}
            {docMeta.updatedAt && ` · Last saved ${docMeta.updatedAt.toLocaleString()}`}
            {docMeta.updatedBy && ` · by ${docMeta.updatedBy}`}
            {` · ${activeCount} active / ${types.length} total`}
          </Typography>
        )}

        {/* Type list */}
        <Paper>
          {loading ? (
            <Box p={4} display="flex" alignItems="center" gap={1}>
              <CircularProgress size={20} />
              <Typography variant="body2">Loading…</Typography>
            </Box>
          ) : types.length === 0 ? (
            <Box p={4} textAlign="center">
              <Typography variant="body2" color="text.secondary" gutterBottom>
                No types found. Seed the list first.
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Run: <code>npm run seed:rendezvous-types</code>
              </Typography>
            </Box>
          ) : (
            <DragDropContext onDragEnd={onDragEnd}>
              <Droppable droppableId="rendezvous-types">
                {(provided) => (
                  <Box ref={provided.innerRef} {...provided.droppableProps}>
                    {types.map((type, index) => (
                      <Draggable key={type.id} draggableId={type.id} index={index}>
                        {(provided, snapshot) => (
                          <Box
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              gap: 1,
                              px: 2,
                              py: 1,
                              borderBottom: "1px solid",
                              borderColor: "divider",
                              bgcolor: snapshot.isDragging
                                ? "action.hover"
                                : type.active
                                ? "background.paper"
                                : "action.disabledBackground",
                              opacity: type.active ? 1 : 0.6,
                              "&:last-child": { borderBottom: "none" },
                            }}
                          >
                            {/* Drag handle */}
                            <Box
                              {...provided.dragHandleProps}
                              sx={{ color: "text.disabled", cursor: "grab", display: "flex" }}
                            >
                              <DragIndicatorIcon fontSize="small" />
                            </Box>

                            {/* Sort order */}
                            <Typography variant="caption" color="text.disabled" sx={{ width: 24, textAlign: "right", flexShrink: 0 }}>
                              {index + 1}
                            </Typography>

                            {/* Label / edit field */}
                            {editingId === type.id ? (
                              <Box display="flex" flex={1} gap={1} alignItems="flex-start" flexWrap="wrap">
                                <TextField
                                  inputRef={editInputRef}
                                  value={editLabel}
                                  onChange={(e) => { setEditLabel(e.target.value); setEditError(null); }}
                                  onKeyDown={(e) => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") cancelEdit(); }}
                                  size="small"
                                  error={!!editError}
                                  helperText={editError ?? `${editLabel.length}/${MAX_LABEL_LENGTH}`}
                                  sx={{ width: 200 }}
                                  inputProps={{ maxLength: MAX_LABEL_LENGTH + 5 }}
                                />
                                <FormControl size="small" sx={{ minWidth: 180 }}>
                                  <InputLabel>Group</InputLabel>
                                  <Select
                                    value={editGroup}
                                    label="Group"
                                    onChange={(e) => setEditGroup(e.target.value)}
                                  >
                                    {groups.map((g) => (
                                      <MenuItem key={g} value={g}>{g}</MenuItem>
                                    ))}
                                  </Select>
                                </FormControl>
                                <Box display="flex" gap={0.5}>
                                  <Tooltip title="Save (Enter)">
                                    <IconButton size="small" color="primary" onClick={commitEdit}>
                                      <SaveIcon fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                  <Tooltip title="Cancel (Escape)">
                                    <IconButton size="small" onClick={cancelEdit}>
                                      <CancelIcon fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                </Box>
                              </Box>
                            ) : (
                              <Box flex={1} display="flex" alignItems="center" gap={1} minWidth={0}>
                                <Box minWidth={0}>
                                  <Typography
                                    variant="body2"
                                    sx={{
                                      fontWeight: 500,
                                      textDecoration: type.active ? "none" : "line-through",
                                      color: type.active ? "text.primary" : "text.disabled",
                                    }}
                                  >
                                    {type.label}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary">
                                    {type.group} · <code style={{ fontSize: 11 }}>{type.id}</code>
                                  </Typography>
                                </Box>
                              </Box>
                            )}

                            {/* Active toggle */}
                            {editingId !== type.id && (
                              <Tooltip title={
                                !type.active
                                  ? "Activate"
                                  : activeCount <= 1
                                  ? "Cannot deactivate the last active type"
                                  : "Deactivate"
                              }>
                                <span>
                                  <Switch
                                    checked={type.active}
                                    onChange={() => toggleActive(type.id)}
                                    disabled={type.active && activeCount <= 1}
                                    size="small"
                                  />
                                </span>
                              </Tooltip>
                            )}

                            {/* Edit / Delete */}
                            {editingId !== type.id && (
                              <Box display="flex" gap={0.5}>
                                <Tooltip title="Edit label or group">
                                  <IconButton size="small" onClick={() => startEdit(type)}>
                                    <EditIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Delete">
                                  <IconButton
                                    size="small"
                                    color="error"
                                    onClick={() => confirmDelete(type.id)}
                                  >
                                    <DeleteIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              </Box>
                            )}
                          </Box>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </Box>
                )}
              </Droppable>
            </DragDropContext>
          )}

          {/* Add form */}
          {!loading && (
            <>
              <Divider />
              {showAddForm ? (
                <Box px={2} py={2} display="flex" gap={1} alignItems="flex-start" flexWrap="wrap">
                  <TextField
                    label="New type label"
                    value={addLabel}
                    onChange={(e) => { setAddLabel(e.target.value); setAddError(null); }}
                    onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); if (e.key === "Escape") { setShowAddForm(false); setAddLabel(""); setAddError(null); } }}
                    size="small"
                    error={!!addError}
                    helperText={addError ?? `${addLabel.length}/${MAX_LABEL_LENGTH}`}
                    sx={{ width: 220 }}
                    inputProps={{ maxLength: MAX_LABEL_LENGTH + 5 }}
                    autoFocus
                  />
                  <FormControl size="small" sx={{ minWidth: 180 }}>
                    <InputLabel>Group</InputLabel>
                    <Select
                      value={addGroup}
                      label="Group"
                      onChange={(e) => setAddGroup(e.target.value)}
                    >
                      {groups.map((g) => (
                        <MenuItem key={g} value={g}>{g}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <Box display="flex" gap={0.5}>
                    <Button variant="contained" size="small" onClick={handleAdd} startIcon={<AddIcon />}>
                      Add
                    </Button>
                    <Button size="small" onClick={() => { setShowAddForm(false); setAddLabel(""); setAddError(null); }}>
                      Cancel
                    </Button>
                  </Box>
                  {addLabel.trim() && (
                    <Typography variant="caption" color="text.secondary" alignSelf="center">
                      ID: <code>{slugify(addLabel)}</code>
                    </Typography>
                  )}
                </Box>
              ) : (
                <Box px={2} py={1.5}>
                  <Button
                    startIcon={<AddIcon />}
                    size="small"
                    onClick={() => setShowAddForm(true)}
                  >
                    Add Type
                  </Button>
                </Box>
              )}
            </>
          )}
        </Paper>

        {/* Hint */}
        <Typography variant="caption" color="text.secondary">
          Drag rows to reorder. Inactive types remain visible on existing events but are hidden from new event creation.
          After saving, run <code>npm run sync:rendezvous-types</code> in the CruisaPalooza repo to update the bundled JSON.
        </Typography>
      </Box>

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteConfirmId} onClose={() => setDeleteConfirmId(null)}>
        <DialogTitle>Delete "{typeBeingDeleted?.label}"?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This removes the type from the master list. Existing events that use this type will
            continue to display it, but it will no longer be available for new or edited events.
            This cannot be undone from the UI — you would need to re-add it manually.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmId(null)}>Cancel</Button>
          <Button onClick={handleDelete} color="error" variant="contained">Delete</Button>
        </DialogActions>
      </Dialog>
    </React.Fragment>
  );
}
