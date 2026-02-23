import React, { useCallback, useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Drawer,
  FormControl,
  IconButton,
  InputLabel,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Skeleton,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import {
  CheckCircle,
  Download,
  MapPin,
  MoreVertical,
  RefreshCw,
  Upload,
  X,
  XCircle,
} from "lucide-react";
import {
  listSpots,
  manageSpot,
  listChangeRequests,
  reviewChangeRequest,
  moderateImage,
  listComments,
  moderateComment,
  importSpots,
  getSpotDetail,
  fixSpotIds,
  bulkUpdateRegion,
} from "@/services/spotsAdmin";

// ── Constants ────────────────────────────────────────────────────────────────

const SPOT_TYPES = ["Bar", "Restaurant", "Snorkeling", "Dive", "Marina", "Hike", "Groceries", "Beach", "Boat Access"];

const VALID_REGIONS = [
  "Caribbean",
  "Mediterranean", 
  "Pacific",
  "US East",
  "US Gulf",
  "US West",
  "Southern Ocean",
  "Global"
];

const TYPE_COLORS = {
  Bar: "error",
  Restaurant: "warning",
  Snorkeling: "info",
  Dive: "primary",
  Marina: "success",
  Hike: "secondary",
  Groceries: "default",
  Beach: "info",
  "Boat Access": "success",
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(timestamp) {
  if (!timestamp) return "—";
  try {
    // Handle Firestore Timestamp objects
    const date = timestamp?.toDate ? timestamp.toDate() : 
                 timestamp?._seconds ? new Date(timestamp._seconds * 1000) :
                 new Date(timestamp);
    
    if (isNaN(date.getTime())) return "—";
    
    const ms = Date.now() - date.getTime();
    const mins = Math.floor(ms / 60000);
    if (mins < 2) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 30) return `${days}d ago`;
    return date.toLocaleDateString();
  } catch (e) {
    return "—";
  }
}

function parseCSV(text) {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return { headers: [], rows: [] };
  
  const headers = lines[0].split(",").map(h => h.trim());
  const rows = lines.slice(1).map((line, index) => {
    const values = line.split(",").map(v => v.trim());
    const row = { _index: index };
    headers.forEach((h, i) => {
      row[h] = values[i] || "";
    });
    return row;
  });
  
  return { headers, rows };
}

function validateSpotRow(row) {
  const errors = [];
  
  if (!row.name || !row.name.trim()) {
    errors.push("name: required");
  }
  
  const lat = parseFloat(row.latitude);
  if (isNaN(lat) || lat < -90 || lat > 90) {
    errors.push("latitude: invalid range (-90 to 90)");
  }
  
  const lng = parseFloat(row.longitude);
  if (isNaN(lng) || lng < -180 || lng > 180) {
    errors.push("longitude: invalid range (-180 to 180)");
  }
  
  if (!row.type || !SPOT_TYPES.includes(row.type)) {
    errors.push(`type: must be one of ${SPOT_TYPES.join(", ")}`);
  }
  
  // Region is optional - will be auto-derived from lat/long if not provided
  if (row.region && !VALID_REGIONS.includes(row.region)) {
    errors.push(`region: if provided, must be one of ${VALID_REGIONS.join(", ")}`);
  }
  
  return errors;
}

// ── Main Component ───────────────────────────────────────────────────────────

function Spots() {
  const [tab, setTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Spots table state
  const [spots, setSpots] = useState([]);
  const [spotsPageToken, setSpotsPageToken] = useState(null);
  const [totalCount, setTotalCount] = useState(0);
  const [filters, setFilters] = useState({ deleted: false, region: "", nameSearch: "" });
  const [selectedSpot, setSelectedSpot] = useState(null);
  const [selectedRows, setSelectedRows] = useState([]);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);
  const [spotDetail, setSpotDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // Approval queue state
  const [requests, setRequests] = useState([]);
  const [requestsPageToken, setRequestsPageToken] = useState(null);
  const [requestStatus, setRequestStatus] = useState("pending");
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [reviewNotes, setReviewNotes] = useState("");
  
  // CSV import state
  const [csvFile, setCsvFile] = useState(null);
  const [csvData, setCsvData] = useState({ headers: [], rows: [] });
  const [csvStep, setCsvStep] = useState(1);
  const [importProgress, setImportProgress] = useState(0);
  const [importResult, setImportResult] = useState(null);
  
  // Bulk region update state
  const [regionDialogOpen, setRegionDialogOpen] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState("");
  
  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState({});

  // ── Load spots ─────────────────────────────────────────────────────────────
  
  const loadSpots = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listSpots(500, null, filters);
      let filteredSpots = result.spots || [];
      
      // Apply client-side name search filter
      if (filters.nameSearch && filters.nameSearch.trim()) {
        const searchLower = filters.nameSearch.toLowerCase().trim();
        filteredSpots = filteredSpots.filter(spot => 
          spot.name && spot.name.toLowerCase().includes(searchLower)
        );
      }
      
      setSpots(filteredSpots);
      setTotalCount(filteredSpots.length);
      setSpotsPageToken(result.pageToken);
    } catch (e) {
      setError(`Failed to load spots: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }, [filters]);
  
  useEffect(() => {
    if (tab === 0) {
      loadSpots();
    }
  }, [tab, loadSpots]);
  
  // ── Load change requests ───────────────────────────────────────────────────
  
  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listChangeRequests(requestStatus, 50, null);
      setRequests(result.requests || []);
      setRequestsPageToken(result.pageToken);
    } catch (e) {
      setError(`Failed to load requests: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }, [requestStatus]);
  
  useEffect(() => {
    if (tab === 1) {
      loadRequests();
    }
  }, [tab, loadRequests]);
  
  // ── Load spot detail ───────────────────────────────────────────────────────
  
  const loadSpotDetail = useCallback(async (spotId) => {
    setDetailLoading(true);
    try {
      const detail = await getSpotDetail(spotId);
      setSpotDetail(detail);
    } catch (e) {
      console.error("Failed to load spot detail:", e);
    } finally {
      setDetailLoading(false);
    }
  }, []);
  
  // ── Handle spot actions ────────────────────────────────────────────────────
  
  const handleSpotAction = async (spotId, action, data = {}) => {
    try {
      await manageSpot(spotId, action, data);
      await loadSpots();
      if (selectedSpot?.id === spotId) {
        await loadSpotDetail(spotId);
      }
    } catch (e) {
      alert(`Action failed: ${e.message}`);
    }
  };
  
  const handleReviewRequest = async (action) => {
    if (!selectedRequest) return;
    
    try {
      await reviewChangeRequest(
        selectedRequest.id,
        action,
        reviewNotes || null,
        null
      );
      setReviewDialogOpen(false);
      setSelectedRequest(null);
      setReviewNotes("");
      await loadRequests();
    } catch (e) {
      alert(`Review failed: ${e.message}`);
    }
  };
  
  const handleModerateComment = async (commentId, action) => {
    try {
      await moderateComment(commentId, action);
      if (selectedSpot) {
        await loadSpotDetail(selectedSpot.id);
      }
    } catch (e) {
      alert(`Comment moderation failed: ${e.message}`);
    }
  };
  
  const handleModerateImage = async (spotId, r2Key, action) => {
    try {
      await moderateImage(spotId, r2Key, action);
      if (selectedSpot?.id === spotId) {
        await loadSpotDetail(spotId);
      }
    } catch (e) {
      alert(`Image moderation failed: ${e.message}`);
    }
  };
  
  const handleFixSpotIds = async () => {
    if (!confirm('Fix all spots missing id field? This is a one-time operation.')) return;
    
    try {
      const result = await fixSpotIds();
      alert(`Success! Fixed ${result.fixed} spots, ${result.alreadyHasId} already had correct id.`);
      await loadSpots();
    } catch (e) {
      alert(`Fix failed: ${e.message}`);
    }
  };
  
  const handleBulkUpdateRegion = async () => {
    if (!selectedRegion) {
      alert('Please select a region');
      return;
    }
    
    if (!confirm(`Set ALL spots to region "${selectedRegion}"? This will update ${spots.length}+ spots.`)) return;
    
    try {
      const result = await bulkUpdateRegion(selectedRegion);
      alert(`Success! Updated ${result.updated} spots to region "${result.region}".`);
      setRegionDialogOpen(false);
      setSelectedRegion("");
      await loadSpots();
    } catch (e) {
      alert(`Bulk update failed: ${e.message}`);
    }
  };
  
  const handleBulkDelete = async () => {
    if (selectedRows.length === 0) {
      alert('No spots selected');
      return;
    }
    
    setBulkDeleteDialogOpen(false);
    setLoading(true);
    
    try {
      let successCount = 0;
      let errorCount = 0;
      
      for (const spotId of selectedRows) {
        try {
          await manageSpot(spotId, 'softDelete');
          successCount++;
        } catch (e) {
          console.error(`Failed to delete spot ${spotId}:`, e);
          errorCount++;
        }
      }
      
      alert(`Bulk delete complete: ${successCount} deleted, ${errorCount} failed`);
      setSelectedRows([]);
      await loadSpots();
    } catch (e) {
      alert(`Bulk delete failed: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  // ── Handle CSV import ──────────────────────────────────────────────────────
  
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      const parsed = parseCSV(text);
      setCsvData(parsed);
      setCsvFile(file);
      setCsvStep(2);
    };
    reader.readAsText(file);
  };
  
  const handleImport = async () => {
    const validRows = csvData.rows.filter(row => validateSpotRow(row).length === 0);
    const spots = validRows.map(row => ({
      name: row.name,
      latitude: parseFloat(row.latitude),
      longitude: parseFloat(row.longitude),
      type: row.type,
      description: row.description || undefined,
      region: row.region || undefined,
    }));
    
    setCsvStep(4);
    setImportProgress(0);
    
    try {
      const result = await importSpots(spots);
      console.log('Import completed:', result);
      if (result.skippedDetails && result.skippedDetails.length > 0) {
        console.log('Skipped spots details:');
        console.table(result.skippedDetails);
      }
      setImportResult(result);
      setImportProgress(100);
    } catch (e) {
      alert(`Import failed: ${e.message}`);
      setCsvStep(3);
    }
  };
  
  // ── Render spots table ─────────────────────────────────────────────────────
  
  const spotsColumns = [
    {
      field: "name",
      headerName: "Name",
      flex: 1,
      minWidth: 200,
      renderCell: (params) => (
        <Typography variant="body2" fontWeight="600">
          {params.value}
        </Typography>
      ),
    },
    {
      field: "type",
      headerName: "Type",
      width: 130,
      renderCell: (params) => (
        <Chip
          label={params.value}
          color={TYPE_COLORS[params.value] || "default"}
          size="small"
        />
      ),
    },
    {
      field: "region",
      headerName: "Region",
      width: 150,
      renderCell: (params) => params.value || "—",
    },
    {
      field: "latitude",
      headerName: "Latitude",
      width: 110,
      renderCell: (params) => params.value?.toFixed(6) || "—",
    },
    {
      field: "longitude",
      headerName: "Longitude",
      width: 110,
      renderCell: (params) => params.value?.toFixed(6) || "—",
    },
    {
      field: "verified",
      headerName: "Verified",
      width: 100,
      renderCell: (params) =>
        params.value ? (
          <CheckCircle size={18} color="green" />
        ) : (
          <XCircle size={18} color="gray" />
        ),
    },
    {
      field: "averageRating",
      headerName: "Rating",
      width: 100,
      renderCell: (params) =>
        params.value ? `⭐ ${params.value.toFixed(1)}` : "—",
    },
    {
      field: "photoCount",
      headerName: "Photos",
      width: 90,
      renderCell: (params) => params.value || 0,
    },
    {
      field: "createdAt",
      headerName: "Created",
      width: 120,
      renderCell: (params) => relativeTime(params.value),
    },
    {
      field: "deleted",
      headerName: "Status",
      width: 100,
      renderCell: (params) =>
        params.value ? (
          <Chip label="Deleted" color="error" size="small" />
        ) : (
          <Chip label="Active" color="success" size="small" />
        ),
    },
    {
      field: "actions",
      headerName: "Actions",
      width: 80,
      sortable: false,
      renderCell: (params) => (
        <IconButton
          size="small"
          onClick={(e) => {
            e.stopPropagation();
            setSelectedSpot(params.row);
            setDetailDrawerOpen(true);
            loadSpotDetail(params.row.id);
          }}
        >
          <MoreVertical size={18} />
        </IconButton>
      ),
    },
  ];
  
  // ── Render approval queue table ────────────────────────────────────────────
  
  const requestsColumns = [
    {
      field: "requestType",
      headerName: "Type",
      width: 150,
      renderCell: (params) => (
        <Chip
          label={params.value}
          color={
            params.value === "create"
              ? "success"
              : params.value === "delete"
              ? "error"
              : "info"
          }
          size="small"
        />
      ),
    },
    {
      field: "spotName",
      headerName: "Spot Name",
      flex: 1,
      minWidth: 200,
      valueGetter: (params) =>
        params.row.proposedData?.name ||
        params.row.originalData?.name ||
        "—",
    },
    {
      field: "requesterEmail",
      headerName: "Requester",
      width: 200,
    },
    {
      field: "createdAt",
      headerName: "Submitted",
      width: 120,
      renderCell: (params) => relativeTime(params.value),
    },
    {
      field: "status",
      headerName: "Status",
      width: 120,
      renderCell: (params) => (
        <Chip
          label={params.value}
          color={
            params.value === "pending"
              ? "warning"
              : params.value === "approved"
              ? "success"
              : "error"
          }
          size="small"
        />
      ),
    },
    {
      field: "actions",
      headerName: "Actions",
      width: 100,
      sortable: false,
      renderCell: (params) => (
        <Button
          size="small"
          variant="outlined"
          onClick={() => {
            setSelectedRequest(params.row);
            setReviewDialogOpen(true);
          }}
          disabled={params.row.status !== "pending"}
        >
          Review
        </Button>
      ),
    },
  ];
  
  // ── Render CSV import step ─────────────────────────────────────────────────
  
  const renderCSVStep = () => {
    if (csvStep === 1) {
      return (
        <Box sx={{ p: 4, textAlign: "center" }}>
          <Typography variant="h6" gutterBottom>
            Upload CSV File
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Required columns: name, latitude, longitude, type
            <br />
            Optional: description, region
          </Typography>
          <Button
            variant="contained"
            component="label"
            startIcon={<Upload size={18} />}
          >
            Choose File
            <input
              type="file"
              accept=".csv"
              hidden
              onChange={handleFileUpload}
            />
          </Button>
        </Box>
      );
    }
    
    if (csvStep === 2 || csvStep === 3) {
      const validRows = csvData.rows.filter(row => validateSpotRow(row).length === 0);
      const invalidRows = csvData.rows.filter(row => validateSpotRow(row).length > 0);
      
      return (
        <Box sx={{ p: 2 }}>
          <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
            <Alert severity="info">
              {validRows.length} valid, {invalidRows.length} invalid
            </Alert>
            <Box sx={{ flexGrow: 1 }} />
            <Button
              variant="contained"
              onClick={handleImport}
              disabled={invalidRows.length > 0}
            >
              Proceed to Import
            </Button>
            <Button onClick={() => setCsvStep(1)}>Cancel</Button>
          </Stack>
          
          <Paper sx={{ height: 500, width: "100%" }}>
            <DataGrid
              rows={csvData.rows}
              columns={[
                ...csvData.headers.map(h => ({
                  field: h,
                  headerName: h,
                  flex: 1,
                  minWidth: 120,
                  renderCell: (params) => {
                    const errors = validateSpotRow(params.row);
                    const fieldError = errors.find(e => e.startsWith(`${h}:`));
                    return (
                      <Tooltip title={fieldError || ""}>
                        <Box
                          sx={{
                            color: fieldError ? "error.main" : "inherit",
                            fontWeight: fieldError ? "bold" : "normal",
                          }}
                        >
                          {params.value || "—"}
                        </Box>
                      </Tooltip>
                    );
                  },
                })),
                {
                  field: "_errors",
                  headerName: "Validation Errors",
                  flex: 2,
                  minWidth: 250,
                  renderCell: (params) => {
                    const errors = validateSpotRow(params.row);
                    if (errors.length === 0) {
                      return (
                        <Chip label="Valid" color="success" size="small" />
                      );
                    }
                    return (
                      <Box sx={{ color: "error.main", fontSize: "0.75rem" }}>
                        {errors.join("; ")}
                      </Box>
                    );
                  },
                },
              ]}
              getRowId={(row) => row._index}
              disableRowSelectionOnClick
            />
          </Paper>
        </Box>
      );
    }
    
    if (csvStep === 4) {
      return (
        <Box sx={{ p: 4, textAlign: "center" }}>
          <Typography variant="h6" gutterBottom>
            Importing...
          </Typography>
          <LinearProgress variant="determinate" value={importProgress} sx={{ my: 2 }} />
          {importResult && (
            <Stack spacing={1} sx={{ mt: 3 }}>
              <Alert severity="success">
                Imported: {importResult.imported}
              </Alert>
              <Alert severity="warning">
                Skipped (duplicates): {importResult.skipped}
              </Alert>
              {importResult.errors.length > 0 && (
                <Alert severity="error">
                  Errors: {importResult.errors.length}
                </Alert>
              )}
              <Button
                variant="contained"
                onClick={() => {
                  setCsvStep(1);
                  setCsvFile(null);
                  setCsvData({ headers: [], rows: [] });
                  setImportResult(null);
                  setTab(0);
                }}
              >
                Done
              </Button>
            </Stack>
          )}
        </Box>
      );
    }
  };
  
  // ── Main render ────────────────────────────────────────────────────────────
  
  return (
    <React.Fragment>
      <Helmet title="Spots" />
      
      <Box sx={{ mb: 3 }}>
        <Typography variant="h3" gutterBottom>
          Spots Management
        </Typography>
      </Box>
      
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      
      <Paper sx={{ mb: 3 }}>
        <Tabs value={tab} onChange={(e, v) => setTab(v)}>
          <Tab label="Spots" />
          <Tab label="Approval Queue" />
          <Tab label="Import CSV" />
        </Tabs>
      </Paper>
      
      {tab === 0 && (
        <Paper>
          <Box sx={{ p: 2, borderBottom: 1, borderColor: "divider" }}>
            <Stack direction="row" spacing={2} alignItems="center">
              <TextField
                size="small"
                label="Search Name"
                placeholder="Type to filter..."
                value={filters.nameSearch || ""}
                onChange={(e) =>
                  setFilters({ ...filters, nameSearch: e.target.value })
                }
                sx={{ minWidth: 200 }}
              />
              
              <FormControl size="small" sx={{ minWidth: 150 }}>
                <InputLabel>Type</InputLabel>
                <Select
                  value={filters.type || ""}
                  label="Type"
                  onChange={(e) =>
                    setFilters({ ...filters, type: e.target.value || undefined })
                  }
                >
                  <MenuItem value="">All</MenuItem>
                  {SPOT_TYPES.map(t => (
                    <MenuItem key={t} value={t}>{t}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              
              <FormControl size="small" sx={{ minWidth: 150 }}>
                <InputLabel>Verified</InputLabel>
                <Select
                  value={filters.verified === undefined ? "" : String(filters.verified)}
                  label="Verified"
                  onChange={(e) => {
                    const val = e.target.value;
                    setFilters({
                      ...filters,
                      verified: val === "" ? undefined : val === "true",
                    });
                  }}
                >
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="true">Yes</MenuItem>
                  <MenuItem value="false">No</MenuItem>
                </Select>
              </FormControl>
              
              <FormControl size="small" sx={{ minWidth: 150 }}>
                <InputLabel>Region</InputLabel>
                <Select
                  value={filters.region || ""}
                  label="Region"
                  onChange={(e) =>
                    setFilters({ ...filters, region: e.target.value || "" })
                  }
                >
                  <MenuItem value="">All</MenuItem>
                  {VALID_REGIONS.map(r => (
                    <MenuItem key={r} value={r}>{r}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              
              <Box sx={{ flexGrow: 1 }} />
              
              <Typography variant="body2" sx={{ mr: 2, fontWeight: 600 }}>
                Total: {totalCount} spot{totalCount !== 1 ? 's' : ''}
              </Typography>
              
              {selectedRows.length > 0 && (
                <Button
                  size="small"
                  variant="outlined"
                  color="error"
                  onClick={() => setBulkDeleteDialogOpen(true)}
                  sx={{ mr: 1 }}
                >
                  Delete Selected ({selectedRows.length})
                </Button>
              )}
              
              <Button
                size="small"
                variant="outlined"
                onClick={() => setRegionDialogOpen(true)}
                sx={{ mr: 1 }}
              >
                Bulk Set Region
              </Button>
              
              <Button
                size="small"
                variant="outlined"
                onClick={handleFixSpotIds}
                sx={{ mr: 1 }}
              >
                Fix Spot IDs
              </Button>
              
              <IconButton onClick={loadSpots} disabled={loading}>
                <RefreshCw size={18} />
              </IconButton>
            </Stack>
          </Box>
          
          {loading && <LinearProgress />}
          
          <DataGrid
            rows={spots}
            columns={spotsColumns}
            autoHeight
            rowHeight={48}
            checkboxSelection
            disableRowSelectionOnClick
            rowSelectionModel={selectedRows}
            onRowSelectionModelChange={(newSelection) => {
              setSelectedRows(newSelection);
            }}
            onRowClick={(params) => {
              setSelectedSpot(params.row);
              setDetailDrawerOpen(true);
              loadSpotDetail(params.row.id);
            }}
          />
        </Paper>
      )}
      
      {tab === 1 && (
        <Paper>
          <Box sx={{ p: 2, borderBottom: 1, borderColor: "divider" }}>
            <Stack direction="row" spacing={2} alignItems="center">
              <FormControl size="small" sx={{ minWidth: 150 }}>
                <InputLabel>Status</InputLabel>
                <Select
                  value={requestStatus}
                  label="Status"
                  onChange={(e) => setRequestStatus(e.target.value)}
                >
                  <MenuItem value="pending">Pending</MenuItem>
                  <MenuItem value="approved">Approved</MenuItem>
                  <MenuItem value="rejected">Rejected</MenuItem>
                </Select>
              </FormControl>
              
              <Box sx={{ flexGrow: 1 }} />
              
              <IconButton onClick={loadRequests} disabled={loading}>
                <RefreshCw size={18} />
              </IconButton>
            </Stack>
          </Box>
          
          {loading && <LinearProgress />}
          
          <DataGrid
            rows={requests}
            columns={requestsColumns}
            autoHeight
            rowHeight={48}
            disableRowSelectionOnClick
          />
        </Paper>
      )}
      
      {tab === 2 && (
        <Paper>
          {renderCSVStep()}
        </Paper>
      )}
      
      {/* Detail Drawer */}
      <Drawer
        anchor="right"
        open={detailDrawerOpen}
        onClose={() => {
          setDetailDrawerOpen(false);
          setSelectedSpot(null);
          setSpotDetail(null);
        }}
        PaperProps={{ sx: { width: 420 } }}
      >
        {selectedSpot && (
          <Box sx={{ p: 3 }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
              <Typography variant="h6" sx={{ flexGrow: 1 }}>
                {selectedSpot.name}
              </Typography>
              <IconButton
                size="small"
                onClick={() => {
                  setDetailDrawerOpen(false);
                  setSelectedSpot(null);
                  setSpotDetail(null);
                }}
              >
                <X size={18} />
              </IconButton>
            </Stack>
            
            <Stack spacing={1} sx={{ mb: 2 }}>
              <Chip
                label={selectedSpot.type}
                color={TYPE_COLORS[selectedSpot.type] || "default"}
                size="small"
                sx={{ width: "fit-content" }}
              />
              {selectedSpot.verified && (
                <Chip
                  label="Verified"
                  color="success"
                  size="small"
                  sx={{ width: "fit-content" }}
                />
              )}
              {selectedSpot.deleted && (
                <Chip
                  label="Deleted"
                  color="error"
                  size="small"
                  sx={{ width: "fit-content" }}
                />
              )}
            </Stack>
            
            {detailLoading ? (
              <Stack spacing={1} mt={2}>
                {[1, 2, 3, 4].map(i => <Skeleton key={i} height={20} />)}
              </Stack>
            ) : spotDetail ? (
              <>
                <Divider sx={{ my: 2 }} />
                
                <Typography variant="overline" color="text.secondary">
                  Location
                </Typography>
                <Stack spacing={0.5} sx={{ mb: 2 }}>
                  <Typography variant="body2">
                    Lat: {spotDetail.spot.latitude?.toFixed(6)}
                  </Typography>
                  <Typography variant="body2">
                    Lng: {spotDetail.spot.longitude?.toFixed(6)}
                  </Typography>
                  <Typography variant="body2">
                    Region: {spotDetail.spot.region || "—"}
                  </Typography>
                </Stack>
                
                {spotDetail.spot.description && (
                  <>
                    <Typography variant="overline" color="text.secondary">
                      Description
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 2 }}>
                      {spotDetail.spot.description}
                    </Typography>
                  </>
                )}
                
                <Typography variant="overline" color="text.secondary">
                  Rating
                </Typography>
                <Typography variant="body2" sx={{ mb: 2 }}>
                  {spotDetail.ratingSummary.average
                    ? `⭐ ${spotDetail.ratingSummary.average.toFixed(1)} (${spotDetail.ratingSummary.count} ratings)`
                    : "No ratings yet"}
                </Typography>
                
                {spotDetail.comments && spotDetail.comments.length > 0 && (
                  <>
                    <Typography variant="overline" color="text.secondary">
                      Comments ({spotDetail.comments.length})
                    </Typography>
                    <Stack spacing={1} sx={{ mb: 2 }}>
                      {spotDetail.comments.map(comment => (
                        <Paper key={comment.id} sx={{ p: 1 }}>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Typography variant="caption" sx={{ flexGrow: 1 }}>
                              {comment.text}
                            </Typography>
                            <IconButton
                              size="small"
                              onClick={() => handleModerateComment(comment.id, "delete")}
                            >
                              <X size={14} />
                            </IconButton>
                          </Stack>
                        </Paper>
                      ))}
                    </Stack>
                  </>
                )}
                
                <Divider sx={{ my: 2 }} />
                
                <Typography variant="overline" color="text.secondary">
                  Actions
                </Typography>
                <Stack spacing={1} sx={{ mt: 1 }}>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => {
                      setEditForm({
                        name: selectedSpot.name,
                        description: selectedSpot.description || "",
                        type: selectedSpot.type,
                        region: selectedSpot.region || "",
                        verified: selectedSpot.verified || false,
                      });
                      setEditDialogOpen(true);
                    }}
                  >
                    Edit
                  </Button>
                  
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() =>
                      handleSpotAction(
                        selectedSpot.id,
                        selectedSpot.verified ? "unverify" : "verify"
                      )
                    }
                  >
                    {selectedSpot.verified ? "Unverify" : "Verify"}
                  </Button>
                  
                  {!selectedSpot.deleted ? (
                    <Button
                      variant="outlined"
                      color="error"
                      size="small"
                      onClick={() => handleSpotAction(selectedSpot.id, "softDelete")}
                    >
                      Soft Delete
                    </Button>
                  ) : (
                    <Button
                      variant="outlined"
                      color="success"
                      size="small"
                      onClick={() => handleSpotAction(selectedSpot.id, "restore")}
                    >
                      Restore
                    </Button>
                  )}
                </Stack>
              </>
            ) : null}
          </Box>
        )}
      </Drawer>
      
      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Spot</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Name"
              value={editForm.name || ""}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              fullWidth
            />
            <TextField
              label="Description"
              value={editForm.description || ""}
              onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
              multiline
              rows={3}
              fullWidth
            />
            <FormControl fullWidth>
              <InputLabel>Type</InputLabel>
              <Select
                value={editForm.type || ""}
                label="Type"
                onChange={(e) => setEditForm({ ...editForm, type: e.target.value })}
              >
                {SPOT_TYPES.map(t => (
                  <MenuItem key={t} value={t}>{t}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Region"
              value={editForm.region || ""}
              onChange={(e) => setEditForm({ ...editForm, region: e.target.value })}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={async () => {
              await handleSpotAction(selectedSpot.id, "edit", editForm);
              setEditDialogOpen(false);
            }}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Review Dialog */}
      <Dialog
        open={reviewDialogOpen}
        onClose={() => {
          setReviewDialogOpen(false);
          setSelectedRequest(null);
          setReviewNotes("");
        }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Review Change Request</DialogTitle>
        <DialogContent>
          {selectedRequest && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Alert severity="info">
                Type: {selectedRequest.requestType}
              </Alert>
              
              {selectedRequest.requestType === "update" && (
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Proposed Changes:
                  </Typography>
                  <Paper sx={{ p: 2, bgcolor: "warning.light" }}>
                    <pre style={{ margin: 0, fontSize: "0.875rem" }}>
                      {JSON.stringify(selectedRequest.proposedData, null, 2)}
                    </pre>
                  </Paper>
                </Box>
              )}
              
              {selectedRequest.requestType === "create" && (
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    New Spot Data:
                  </Typography>
                  <Paper sx={{ p: 2 }}>
                    <pre style={{ margin: 0, fontSize: "0.875rem" }}>
                      {JSON.stringify(selectedRequest.proposedData, null, 2)}
                    </pre>
                  </Paper>
                </Box>
              )}
              
              {selectedRequest.requestType === "delete" && (
                <Alert severity="warning">
                  Requester wants to delete this spot.
                  {selectedRequest.deleteReason && (
                    <Typography variant="body2" sx={{ mt: 1 }}>
                      Reason: {selectedRequest.deleteReason}
                    </Typography>
                  )}
                </Alert>
              )}
              
              <TextField
                label="Review Notes (optional)"
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                multiline
                rows={3}
                fullWidth
              />
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReviewDialogOpen(false)}>Cancel</Button>
          <Button
            variant="outlined"
            color="error"
            onClick={() => handleReviewRequest("reject")}
          >
            Reject
          </Button>
          <Button
            variant="contained"
            color="success"
            onClick={() => handleReviewRequest("approve")}
          >
            Approve
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Bulk Region Update Dialog */}
      <Dialog open={regionDialogOpen} onClose={() => setRegionDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Bulk Set Region for All Spots</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            This will update ALL spots in the database to the selected region.
          </Typography>
          <FormControl fullWidth sx={{ mt: 2 }}>
            <InputLabel>Region</InputLabel>
            <Select
              value={selectedRegion}
              label="Region"
              onChange={(e) => setSelectedRegion(e.target.value)}
            >
              {VALID_REGIONS.map(region => (
                <MenuItem key={region} value={region}>{region}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRegionDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleBulkUpdateRegion}
            disabled={!selectedRegion}
          >
            Update All Spots
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Bulk Delete Confirmation Dialog */}
      <Dialog open={bulkDeleteDialogOpen} onClose={() => setBulkDeleteDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Confirm Bulk Delete</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            You are about to soft delete {selectedRows.length} spot{selectedRows.length !== 1 ? 's' : ''}.
          </Alert>
          <Typography variant="body2" color="text.secondary">
            This action will mark the selected spots as deleted. They can be restored later.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBulkDeleteDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleBulkDelete}
          >
            Delete {selectedRows.length} Spot{selectedRows.length !== 1 ? 's' : ''}
          </Button>
        </DialogActions>
      </Dialog>
    </React.Fragment>
  );
}

export default Spots;
