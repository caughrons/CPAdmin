import React, { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from "@mui/material";
import { RefreshCw } from "lucide-react";

import TimeRangeSelect from "@/components/TimeRangeSelect";
import {
  TIME_RANGES,
  fetchChats,
  formatTime,
  userLabel,
} from "@/services/activityAdmin";

const TYPE_LABEL = { dm: "1:1", group: "Group", anchor: "Anchor" };

// Metadata only — the server never returns message text.
function Chat() {
  const [rangeKey, setRangeKey] = useState(TIME_RANGES[0].key);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = async (key) => {
    setLoading(true);
    setError(null);
    try {
      const range = TIME_RANGES.find((r) => r.key === key) ?? TIME_RANGES[0];
      setData(await fetchChats(range.ms));
    } catch (e) {
      console.error("adminListChats failed:", e);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(rangeKey);
  }, [rangeKey]);

  const chats = data?.chats ?? [];

  return (
    <React.Fragment>
      <Helmet title="Chat" />
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={3} gap={2} flexWrap="wrap">
        <Box>
          <Typography variant="h3">Chats</Typography>
          <Typography variant="subtitle1" color="text.secondary">
            {loading ? "Loading…" : `${chats.length} active chat${chats.length === 1 ? "" : "s"}`}
            {data?.truncated ? " (showing the newest 500)" : ""} · metadata only, no message content
          </Typography>
        </Box>
        <Box display="flex" alignItems="center" gap={1}>
          <TimeRangeSelect value={rangeKey} onChange={setRangeKey} />
          <Tooltip title="Refresh">
            <span>
              <IconButton onClick={() => load(rangeKey)} disabled={loading}>
                <RefreshCw size={18} />
              </IconButton>
            </span>
          </Tooltip>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Last activity</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Group name</TableCell>
              <TableCell>Participants</TableCell>
              <TableCell align="right">Messages in range</TableCell>
              <TableCell align="right">Total messages</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  <CircularProgress size={24} />
                </TableCell>
              </TableRow>
            ) : chats.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  No chat activity in this time range.
                </TableCell>
              </TableRow>
            ) : (
              chats.map((c) => (
                <TableRow key={c.id} hover>
                  <TableCell sx={{ whiteSpace: "nowrap" }}>{formatTime(c.lastActivityMs)}</TableCell>
                  <TableCell>
                    <Chip size="small" label={TYPE_LABEL[c.type] ?? c.type} />
                  </TableCell>
                  <TableCell>{c.groupName ?? "—"}</TableCell>
                  <TableCell sx={{ maxWidth: 420 }}>
                    {c.participants.map(userLabel).join(", ") || "—"}
                  </TableCell>
                  <TableCell align="right">{c.messagesInRange}</TableCell>
                  <TableCell align="right">{c.totalMessages}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </React.Fragment>
  );
}

export default Chat;
