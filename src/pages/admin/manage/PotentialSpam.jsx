import React, { useCallback, useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import {
  Alert,
  Box,
  Button,
  Chip,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import { RefreshCw, Trash2, ExternalLink } from "lucide-react";
import {
  getSpamViolations,
  dismissSpamViolation,
} from "@/services/spamViolations";

const VIOLATION_COLORS = {
  rate_limit: "warning",
  anti_spoofing: "error",
  stale_location: "default",
  privacy_enabled: "default",
};

const VIOLATION_LABELS = {
  rate_limit: "Rate Limit",
  anti_spoofing: "Anti-Spoofing",
  stale_location: "Stale Location",
  privacy_enabled: "Privacy Enabled",
};

function ViolationChip({ type }) {
  return (
    <Chip
      label={VIOLATION_LABELS[type] ?? type}
      color={VIOLATION_COLORS[type] ?? "default"}
      size="small"
      variant="outlined"
    />
  );
}

function LocationLink({ lat, lng }) {
  if (lat == null || lng == null) return <Typography variant="body2" color="text.secondary">—</Typography>;
  const url = `https://www.google.com/maps?q=${lat},${lng}`;
  return (
    <Tooltip title="Open in Google Maps">
      <IconButton
        size="small"
        component="a"
        href={url}
        target="_blank"
        rel="noopener noreferrer"
      >
        <ExternalLink size={14} />
      </IconButton>
    </Tooltip>
  );
}

export default function PotentialSpam() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [violationFilter, setViolationFilter] = useState("");
  const [eventTypeFilter, setEventTypeFilter] = useState("");
  const [dismissing, setDismissing] = useState(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getSpamViolations({
        limit: 200,
        violationType: violationFilter || undefined,
        eventType: eventTypeFilter || undefined,
      });
      setRows(data);
    } catch (e) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }, [violationFilter, eventTypeFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDismiss = useCallback(async (id) => {
    setDismissing((prev) => new Set(prev).add(id));
    try {
      await dismissSpamViolation(id);
      setRows((prev) => prev.filter((r) => r.id !== id));
    } catch (e) {
      setError(e?.message ?? String(e));
    } finally {
      setDismissing((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }, []);

  const columns = [
    {
      field: "timestamp",
      headerName: "Time",
      width: 170,
      valueFormatter: (value) =>
        value instanceof Date ? value.toLocaleString() : "—",
    },
    {
      field: "uid",
      headerName: "User ID",
      width: 200,
      renderCell: ({ value }) => (
        <Tooltip title={value}>
          <Typography variant="body2" noWrap sx={{ maxWidth: 180 }}>
            {value}
          </Typography>
        </Tooltip>
      ),
    },
    {
      field: "eventType",
      headerName: "Event Type",
      width: 120,
      renderCell: ({ value }) => (
        <Chip label={value ?? "—"} size="small" variant="outlined" />
      ),
    },
    {
      field: "violationType",
      headerName: "Violation",
      width: 150,
      renderCell: ({ value }) => <ViolationChip type={value} />,
    },
    {
      field: "attemptedTitle",
      headerName: "Title",
      width: 180,
      renderCell: ({ value }) => (
        <Typography variant="body2" color={value ? "text.primary" : "text.secondary"}>
          {value ?? "—"}
        </Typography>
      ),
    },
    {
      field: "attemptedLat",
      headerName: "Location",
      width: 80,
      sortable: false,
      renderCell: ({ row }) => (
        <LocationLink lat={row.attemptedLat} lng={row.attemptedLng} />
      ),
    },
    {
      field: "hourKey",
      headerName: "Hour (UTC)",
      width: 130,
    },
    {
      field: "actions",
      headerName: "",
      width: 60,
      sortable: false,
      renderCell: ({ row }) => (
        <Tooltip title="Dismiss">
          <IconButton
            size="small"
            disabled={dismissing.has(row.id)}
            onClick={() => handleDismiss(row.id)}
          >
            <Trash2 size={14} />
          </IconButton>
        </Tooltip>
      ),
    },
  ];

  return (
    <React.Fragment>
      <Helmet title="Potential Spam" />
      <Box display="flex" flexDirection="column" gap={2}>
        <Typography variant="h4">Potential Spam</Typography>
        <Typography variant="body2" color="text.secondary">
          Event creation attempts blocked by rate limit or anti-spoofing checks.
        </Typography>

        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Violation Type</InputLabel>
            <Select
              value={violationFilter}
              label="Violation Type"
              onChange={(e) => setViolationFilter(e.target.value)}
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value="rate_limit">Rate Limit</MenuItem>
              <MenuItem value="anti_spoofing">Anti-Spoofing</MenuItem>
              <MenuItem value="stale_location">Stale Location</MenuItem>
              <MenuItem value="privacy_enabled">Privacy Enabled</MenuItem>
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>Event Type</InputLabel>
            <Select
              value={eventTypeFilter}
              label="Event Type"
              onChange={(e) => setEventTypeFilter(e.target.value)}
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value="popup">Pop Up</MenuItem>
              <MenuItem value="anchorage">Anchorage</MenuItem>
              <MenuItem value="public">Public</MenuItem>
              <MenuItem value="friends">Friends</MenuItem>
              <MenuItem value="groups">Groups</MenuItem>
              <MenuItem value="communities">Communities</MenuItem>
            </Select>
          </FormControl>

          <Button
            variant="outlined"
            size="small"
            onClick={load}
            disabled={loading}
            startIcon={<RefreshCw size={14} />}
          >
            Refresh
          </Button>

          <Typography variant="body2" color="text.secondary">
            {rows.length} record{rows.length !== 1 ? "s" : ""}
          </Typography>
        </Stack>

        {error && <Alert severity="error">{error}</Alert>}

        <DataGrid
          rows={rows}
          columns={columns}
          loading={loading}
          autoHeight
          pageSizeOptions={[25, 50, 100]}
          initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
          disableRowSelectionOnClick
          sx={{ backgroundColor: "background.paper" }}
        />
      </Box>
    </React.Fragment>
  );
}
