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
  getAdminMessageConfig,
  saveDraft,
  publishDraft,
  setLiveUntil,
  unpublish,
} from "@/services/adminMessagesAdmin";

function formatDate(date) {
  if (!date) return "—";
  return date.toLocaleString();
}

function AdminMessages() {
  const [config, setConfig] = useState(null);
  const [draftBody, setDraftBody] = useState("");
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
      const data = await getAdminMessageConfig();
      setConfig(data);
      setDraftBody(data.draftBody ?? "");
      if (data.liveUntil) {
        // Format as datetime-local value: "YYYY-MM-DDTHH:mm"
        const d = data.liveUntil;
        const pad = (n) => String(n).padStart(2, "0");
        setLiveUntilInput(
          `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
        );
      } else {
        setLiveUntilInput("");
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

  const currentUser = firebase.auth().currentUser;
  const updatedBy = currentUser?.email ?? currentUser?.uid ?? "unknown";

  const flash = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  const handleSaveDraft = async () => {
    setSaving(true);
    setError(null);
    try {
      await saveDraft(draftBody, updatedBy);
      flash("Draft saved.");
      await load();
    } catch (e) {
      setError(e?.message ?? String(e));
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!draftBody.trim()) {
      setError("Draft is empty — nothing to publish.");
      return;
    }
    setPublishing(true);
    setError(null);
    try {
      // Save current draft text first, then publish
      await saveDraft(draftBody, updatedBy);
      await publishDraft(updatedBy);
      // Apply liveUntil if set
      if (liveUntilInput) {
        await setLiveUntil(new Date(liveUntilInput));
      }
      flash("Published. Users will see the new message on next launch/resume.");
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
      await unpublish();
      flash("Unpublished. Message will no longer appear.");
      await load();
    } catch (e) {
      setError(e?.message ?? String(e));
    } finally {
      setUnpublishing(false);
    }
  };

  const isLive = config && config.liveBody && config.liveVersion > 0;
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
            launch or resume until they dismiss it. Publishing a new version
            re-shows the message to everyone.
          </Typography>
        </Box>

        {error && <Alert severity="error">{error}</Alert>}
        {successMsg && <Alert severity="success">{successMsg}</Alert>}

        {loading ? (
          <Box display="flex" alignItems="center" gap={1}>
            <CircularProgress size={18} />
            <Typography variant="body2">Loading…</Typography>
          </Box>
        ) : (
          <Stack spacing={3}>
            {/* Draft editor */}
            <Paper sx={{ p: 3 }}>
              <Stack spacing={2}>
                <Typography variant="subtitle1" fontWeight={600}>
                  Draft
                </Typography>
                <TextField
                  label="Message body"
                  multiline
                  minRows={4}
                  maxRows={12}
                  value={draftBody}
                  onChange={(e) => setDraftBody(e.target.value)}
                  placeholder="Write your message here…"
                  fullWidth
                />
                <TextField
                  label="Expires at (optional)"
                  type="datetime-local"
                  value={liveUntilInput}
                  onChange={(e) => setLiveUntilInput(e.target.value)}
                  helperText="Leave blank for no expiry. Message stops showing after this time."
                  InputLabelProps={{ shrink: true }}
                  sx={{ maxWidth: 320 }}
                />
                {config?.draftUpdatedAt && (
                  <Typography variant="caption" color="text.secondary">
                    Last saved {formatDate(config.draftUpdatedAt)}
                    {config.draftUpdatedBy ? ` by ${config.draftUpdatedBy}` : ""}
                  </Typography>
                )}
                <Box display="flex" gap={1} flexWrap="wrap">
                  <Button
                    variant="outlined"
                    onClick={handleSaveDraft}
                    disabled={isBusy}
                  >
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

            {/* Live message status */}
            <Paper sx={{ p: 3 }}>
              <Stack spacing={2}>
                <Box display="flex" alignItems="center" gap={1}>
                  <Typography variant="subtitle1" fontWeight={600}>
                    Live Message
                  </Typography>
                  {isLive ? (
                    <Chip label="LIVE" color="success" size="small" />
                  ) : (
                    <Chip label="No active message" size="small" />
                  )}
                </Box>

                {isLive ? (
                  <>
                    <Box
                      sx={{
                        bgcolor: "action.hover",
                        borderRadius: 1,
                        p: 2,
                        whiteSpace: "pre-wrap",
                        fontFamily: "inherit",
                      }}
                    >
                      <Typography variant="body2">{config.liveBody}</Typography>
                    </Box>
                    <Stack direction="row" spacing={2} flexWrap="wrap">
                      <Typography variant="caption" color="text.secondary">
                        Version: {config.liveVersion}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Published: {formatDate(config.liveUpdatedAt)}
                        {config.liveUpdatedBy ? ` by ${config.liveUpdatedBy}` : ""}
                      </Typography>
                      {config.liveUntil && (
                        <Typography variant="caption" color="text.secondary">
                          Expires: {formatDate(config.liveUntil)}
                        </Typography>
                      )}
                    </Stack>
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
                  </>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    No message is currently live. Save a draft and click Make Live.
                  </Typography>
                )}
              </Stack>
            </Paper>
          </Stack>
        )}
      </Box>
    </React.Fragment>
  );
}

export default AdminMessages;
