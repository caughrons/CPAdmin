import React, { useCallback, useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import firebase from "firebase/app";
import "firebase/auth";
import {
  listMessages,
  saveDraft,
  publishMessage,
  unpublishLive,
} from "@/services/adminMessagesAdmin";

function formatDate(date) {
  if (!date) return "—";
  return date.toLocaleString();
}

const STATUS_CHIP = {
  live: { label: "LIVE", color: "success" },
  draft: { label: "DRAFT", color: "default" },
  unpublished: { label: "UNPUBLISHED", color: "warning" },
};

function AdminMessages() {
  const [messages, setMessages] = useState([]);
  const [body, setBody] = useState("");
  const [liveUntilInput, setLiveUntilInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [unpublishing, setUnpublishing] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setMessages(await listMessages());
    } catch (e) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const currentUser = firebase.auth().currentUser;
  const updatedBy = currentUser?.email ?? currentUser?.uid ?? "unknown";

  const flash = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  const clearEditor = () => {
    setBody("");
    setLiveUntilInput("");
  };

  const handleSaveDraft = async () => {
    if (!body.trim()) {
      setError("Message is empty — nothing to save.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await saveDraft(body, updatedBy);
      flash("Draft saved.");
      clearEditor();
      await load();
    } catch (e) {
      setError(e?.message ?? String(e));
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!body.trim()) {
      setError("Message is empty — nothing to publish.");
      return;
    }
    setPublishing(true);
    setError(null);
    try {
      await publishMessage(
        body,
        updatedBy,
        liveUntilInput ? new Date(liveUntilInput) : null
      );
      flash("Published. Users will see the new message on next launch/resume.");
      clearEditor();
      await load();
    } catch (e) {
      setError(e?.message ?? String(e));
    } finally {
      setPublishing(false);
    }
  };

  const handleUnpublish = async () => {
    setUnpublishing(true);
    setError(null);
    try {
      await unpublishLive();
      flash("Unpublished. Message will no longer appear.");
      await load();
    } catch (e) {
      setError(e?.message ?? String(e));
    } finally {
      setUnpublishing(false);
    }
  };

  const isBusy = saving || publishing || unpublishing;

  return (
    <React.Fragment>
      <Helmet title="Admin Messages" />
      <Box display="flex" flexDirection="column" gap={3}>
        <Box>
          <Typography variant="h4" gutterBottom>
            Admin Messages
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Broadcast a message to all users. Users see it as a modal on next
            launch or resume until they dismiss it. Each save or publish
            creates a new message below — the editor clears afterward so you
            can compose the next one.
          </Typography>
        </Box>

        {error && <Alert severity="error">{error}</Alert>}
        {successMsg && <Alert severity="success">{successMsg}</Alert>}

        {/* Editor */}
        <Paper sx={{ p: 3 }}>
          <Stack spacing={2}>
            <Typography variant="subtitle1" fontWeight={600}>
              New Message
            </Typography>
            <TextField
              label="Message body"
              multiline
              minRows={4}
              maxRows={12}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your message here…"
              fullWidth
            />
            <TextField
              label="Expires at (optional)"
              type="datetime-local"
              value={liveUntilInput}
              onChange={(e) => setLiveUntilInput(e.target.value)}
              helperText="Leave blank for no expiry. Only applies when publishing."
              InputLabelProps={{ shrink: true }}
              sx={{ maxWidth: 320 }}
            />
            <Box display="flex" gap={1} flexWrap="wrap">
              <Button variant="outlined" onClick={handleSaveDraft} disabled={isBusy}>
                {saving ? "Saving…" : "Save Draft"}
              </Button>
              <Button
                variant="contained"
                color="primary"
                onClick={handlePublish}
                disabled={isBusy}
              >
                {publishing ? "Publishing…" : "Make Live"}
              </Button>
            </Box>
          </Stack>
        </Paper>

        <Divider />

        {/* Message history */}
        <Typography variant="subtitle1" fontWeight={600}>
          Messages
        </Typography>
        {loading ? (
          <Box display="flex" alignItems="center" gap={1}>
            <CircularProgress size={18} />
            <Typography variant="body2">Loading…</Typography>
          </Box>
        ) : messages.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No messages yet. Save a draft or publish one above.
          </Typography>
        ) : (
          <Stack spacing={2}>
            {messages.map((msg) => {
              const chip = STATUS_CHIP[msg.status] ?? { label: msg.status, color: "default" };
              return (
                <Paper key={msg.id} sx={{ p: 3 }}>
                  <Stack spacing={1.5}>
                    <Box display="flex" alignItems="center" gap={1}>
                      <Chip label={chip.label} color={chip.color} size="small" />
                      {msg.liveVersion != null && (
                        <Typography variant="caption" color="text.secondary">
                          Version {msg.liveVersion}
                        </Typography>
                      )}
                    </Box>
                    <Box
                      sx={{
                        bgcolor: "action.hover",
                        borderRadius: 1,
                        p: 2,
                        whiteSpace: "pre-wrap",
                        fontFamily: "inherit",
                      }}
                    >
                      <Typography variant="body2">{msg.body}</Typography>
                    </Box>
                    <Stack direction="row" spacing={2} flexWrap="wrap">
                      <Typography variant="caption" color="text.secondary">
                        Created: {formatDate(msg.createdAt)}
                        {msg.createdBy ? ` by ${msg.createdBy}` : ""}
                      </Typography>
                      {msg.publishedAt && (
                        <Typography variant="caption" color="text.secondary">
                          Published: {formatDate(msg.publishedAt)}
                        </Typography>
                      )}
                      {msg.liveUntil && (
                        <Typography variant="caption" color="text.secondary">
                          Expires: {formatDate(msg.liveUntil)}
                        </Typography>
                      )}
                    </Stack>
                    {msg.status === "live" && (
                      <Box>
                        <Button
                          variant="outlined"
                          color="warning"
                          onClick={handleUnpublish}
                          disabled={isBusy}
                        >
                          {unpublishing ? "Unpublishing…" : "Unpublish"}
                        </Button>
                      </Box>
                    )}
                  </Stack>
                </Paper>
              );
            })}
          </Stack>
        )}
      </Box>
    </React.Fragment>
  );
}

export default AdminMessages;
