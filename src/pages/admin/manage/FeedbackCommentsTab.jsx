import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
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
import { getFeedback } from "@/services/feedbackAdmin";

export default function FeedbackCommentsTab() {
  const [feedback, setFeedback] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getFeedback({ days: 365 });
      setFeedback(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const columns = [
    {
      field: "createdAt",
      headerName: "Date",
      width: 170,
      valueFormatter: (value) => (value ? value.toLocaleString() : ""),
    },
    { field: "topic", headerName: "Topic", width: 180 },
    { field: "userName", headerName: "Sender", width: 160 },
    { field: "comment", headerName: "Comment", flex: 1, minWidth: 280 },
  ];

  return (
    <Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Paper sx={{ height: 560 }}>
        <DataGrid
          rows={feedback}
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
            <DialogTitle>{selected.topic}</DialogTitle>
            <DialogContent>
              <Stack spacing={1.5} sx={{ mt: 1 }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Submitted by
                  </Typography>
                  <Typography variant="body2">
                    {selected.userName}{" "}
                    {selected.userEmail ? `(${selected.userEmail})` : ""}
                  </Typography>
                </Box>

                <Divider />

                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Comment
                  </Typography>
                  <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                    {selected.comment}
                  </Typography>
                </Box>
              </Stack>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setSelected(null)}>Close</Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
}
