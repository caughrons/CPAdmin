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
import { Image as ImageIcon, RefreshCw } from "lucide-react";

import TimeRangeSelect from "@/components/TimeRangeSelect";
import {
  TIME_RANGES,
  fetchFeedPosts,
  formatTime,
  userLabel,
} from "@/services/activityAdmin";

function FeedPosts() {
  const [rangeKey, setRangeKey] = useState(TIME_RANGES[0].key);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = async (key) => {
    setLoading(true);
    setError(null);
    try {
      const range = TIME_RANGES.find((r) => r.key === key) ?? TIME_RANGES[0];
      setData(await fetchFeedPosts(range.ms));
    } catch (e) {
      console.error("adminListFeedPosts failed:", e);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(rangeKey);
  }, [rangeKey]);

  const posts = data?.posts ?? [];

  return (
    <React.Fragment>
      <Helmet title="Feed Posts" />
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={3} gap={2} flexWrap="wrap">
        <Box>
          <Typography variant="h3">Feed Posts</Typography>
          <Typography variant="subtitle1" color="text.secondary">
            {loading ? "Loading…" : `${posts.length} post${posts.length === 1 ? "" : "s"}`}
            {data?.truncated ? " (showing the newest 500)" : ""}
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
              <TableCell>Posted</TableCell>
              <TableCell>Author</TableCell>
              <TableCell>Community</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Content</TableCell>
              <TableCell align="right">Likes</TableCell>
              <TableCell align="right">Comments</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  <CircularProgress size={24} />
                </TableCell>
              </TableRow>
            ) : posts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  No feed posts in this time range.
                </TableCell>
              </TableRow>
            ) : (
              posts.map((p) => (
                <TableRow key={p.id} hover>
                  <TableCell sx={{ whiteSpace: "nowrap" }}>{formatTime(p.createdAtMs)}</TableCell>
                  <TableCell>{userLabel(p.author)}</TableCell>
                  <TableCell>{p.groupName ?? (p.groupId ? "(unnamed)" : "—")}</TableCell>
                  <TableCell>
                    <Chip size="small" label={p.kind} />
                    {p.feedLevel && p.feedLevel !== "normal" && (
                      <Chip size="small" label={p.feedLevel} color="primary" sx={{ ml: 0.5 }} />
                    )}
                  </TableCell>
                  <TableCell sx={{ maxWidth: 420 }}>
                    <Box display="flex" alignItems="center" gap={0.5}>
                      {p.hasImage && <ImageIcon size={14} />}
                      <span>{p.preview || "—"}</span>
                    </Box>
                  </TableCell>
                  <TableCell align="right">{p.likes}</TableCell>
                  <TableCell align="right">{p.comments}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </React.Fragment>
  );
}

export default FeedPosts;
