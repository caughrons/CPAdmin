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
import { InputAdornment, IconButton as MuiIconButton } from "@mui/material";
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
  deduplicateSpots,
  purgeDeletedSpots,
  bulkUpdateRegion,
  migrateSpotSchema,
  bulkGenerateSnapshots,
  processSnapshotBatch,
  cleanupOldPngSnapshots,
  analyzeR2Storage,
  quickStorageStats,
  processCruisnewsImages,
  deleteCruisnewsPngs,
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

function formatDate(timestamp) {
  if (!timestamp) return "—";
  try {
    // Handle Firestore Timestamp objects
    const date = timestamp?.toDate ? timestamp.toDate() : 
                 timestamp?._seconds ? new Date(timestamp._seconds * 1000) :
                 new Date(timestamp);
    
    if (isNaN(date.getTime())) return "—";
    
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  } catch (e) {
    return "—";
  }
}

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
  const [filters, setFilters] = useState({ deleted: false, region: "", nameSearch: "", startDate: null, endDate: null });
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
  
  // Deduplication state
  const [dedupDialogOpen, setDedupDialogOpen] = useState(false);
  const [dedupResult, setDedupResult] = useState(null);
  const [dedupLoading, setDedupLoading] = useState(false);
  
  // Purge deleted state
  const [purgeDialogOpen, setPurgeDialogOpen] = useState(false);
  const [purgeResult, setPurgeResult] = useState(null);
  const [purgeLoading, setPurgeLoading] = useState(false);
  
  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState({});
  
  // Migration state
  const [migrateDialogOpen, setMigrateDialogOpen] = useState(false);
  const [migrateResult, setMigrateResult] = useState(null);
  const [migrateLoading, setMigrateLoading] = useState(false);
  
  // Bulk snapshot generation state
  const [snapshotDialogOpen, setSnapshotDialogOpen] = useState(false);
  const [snapshotProgress, setSnapshotProgress] = useState({
    total: 0,
    processed: 0,
    successful: 0,
    failed: 0,
    errors: [],
    isProcessing: false,
    cancelRequested: false
  });
  
  // Cleanup PNG snapshots state
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [cleanupResult, setCleanupResult] = useState(null);
  
  // Storage analysis state
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [quickStatsLoading, setQuickStatsLoading] = useState(false);
  const [processCruisnewsLoading, setProcessCruisnewsLoading] = useState(false);
  const [deletePngsLoading, setDeletePngsLoading] = useState(false);

  // ── Load spots ─────────────────────────────────────────────────────────────
  
  const loadSpots = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Increase page size to 10000 to fetch all spots (was 500)
      // TODO: Implement proper pagination if spot count exceeds 10000
      const result = await listSpots(10000, null, filters);
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
      
      // Log if we might be hitting the limit
      if (filteredSpots.length >= 10000) {
        console.warn('⚠️ Fetched 10000+ spots - may need pagination');
      }
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
  
  const handleDeduplicateSpots = async (dryRun = true) => {
    setDedupLoading(true);
    try {
      // Use selected rows if any, otherwise check all spots
      const spotIds = selectedRows.length > 0 ? selectedRows : [];
      const result = await deduplicateSpots(spotIds, dryRun);
      setDedupResult(result);
      
      if (!dryRun) {
        alert(`Success! ${result.message}`);
        setDedupDialogOpen(false);
        setDedupResult(null);
        setSelectedRows([]);
        await loadSpots();
      }
    } catch (e) {
      alert(`Deduplication failed: ${e.message}`);
    } finally {
      setDedupLoading(false);
    }
  };
  
  const handlePurgeDeletedSpots = async (dryRun = true) => {
    setPurgeLoading(true);
    try {
      const result = await purgeDeletedSpots(dryRun);
      setPurgeResult(result);
      
      if (!dryRun) {
        alert(`Success! ${result.message}`);
        setPurgeDialogOpen(false);
        setPurgeResult(null);
        await loadSpots();
      }
    } catch (e) {
      alert(`Purge failed: ${e.message}`);
    } finally {
      setPurgeLoading(false);
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
  
  const handleMigrateSchema = async (dryRun = true) => {
    setMigrateLoading(true);
    try {
      const result = await migrateSpotSchema(dryRun);
      setMigrateResult(result);
      
      if (!dryRun) {
        alert(`Success! ${result.message}\nMigrated: ${result.migrated}\nSkipped: ${result.skipped}`);
        setMigrateDialogOpen(false);
        setMigrateResult(null);
        await loadSpots();
      }
    } catch (e) {
      alert(`Migration failed: ${e.message}`);
    } finally {
      setMigrateLoading(false);
    }
  };
  
  const handleBulkSnapshotGeneration = async () => {
    try {
      setSnapshotProgress({ 
        total: 0,
        processed: 0,
        successful: 0,
        failed: 0,
        errors: [],
        isProcessing: true,
        cancelRequested: false
      });
      
      // Get list of spots without snapshots
      const result = await bulkGenerateSnapshots();
      
      setSnapshotProgress({
        total: result.totalSpots,
        processed: 0,
        successful: 0,
        failed: 0,
        errors: [],
        isProcessing: true,
        cancelRequested: false
      });
      
      setSnapshotDialogOpen(true);
      
      // Process each spot sequentially
      for (let i = 0; i < result.spotIds.length; i++) {
        // Check if cancellation was requested
        const shouldCancel = await new Promise(resolve => {
          setSnapshotProgress(prev => {
            resolve(prev.cancelRequested);
            return prev;
          });
        });
        
        if (shouldCancel) {
          console.log('Snapshot generation cancelled by user');
          break;
        }
        
        const spotId = result.spotIds[i];
        
        try {
          const batchResult = await processSnapshotBatch(spotId);
          
          setSnapshotProgress(prev => ({
            ...prev,
            processed: prev.processed + 1,
            successful: batchResult.success ? prev.successful + 1 : prev.successful,
            failed: batchResult.success ? prev.failed : prev.failed + 1,
            errors: batchResult.success ? prev.errors : [...prev.errors, { 
              spotId, 
              spotName: batchResult.spotName || spotId,
              error: batchResult.error 
            }]
          }));
        } catch (error) {
          setSnapshotProgress(prev => ({
            ...prev,
            processed: prev.processed + 1,
            failed: prev.failed + 1,
            errors: [...prev.errors, { spotId, error: error.message }]
          }));
        }
        
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      setSnapshotProgress(prev => ({ ...prev, isProcessing: false }));
      
    } catch (error) {
      alert(`Failed to start snapshot generation: ${error.message}`);
      setSnapshotProgress(prev => ({ ...prev, isProcessing: false, cancelRequested: false }));
    }
  };
  
  const handleCleanupPngSnapshots = async () => {
    if (!confirm('This will delete all old PNG snapshot files from R2 storage. Continue?')) {
      return;
    }
    
    setCleanupLoading(true);
    setCleanupResult(null);
    
    try {
      const result = await cleanupOldPngSnapshots();
      setCleanupResult(result);
      alert(`Cleanup complete!\nDeleted: ${result.deleted}\nFailed: ${result.failed}\nTotal found: ${result.totalFound}`);
    } catch (error) {
      alert(`Cleanup failed: ${error.message}`);
    } finally {
      setCleanupLoading(false);
    }
  };
  
  const handleAnalyzeStorage = async () => {
    setAnalysisLoading(true);
    setAnalysisResult(null);
    
    try {
      const result = await analyzeR2Storage();
      setAnalysisResult(result);
      
      // Log full results to console for detailed analysis
      console.log('=== R2 STORAGE ANALYSIS ===');
      console.log('Total Files:', result.totalFiles);
      console.log('Total Size:', result.totalSizeFormatted);
      console.log('\n=== BY CATEGORY ===');
      
      // Create a summary for the alert
      let summary = `Storage Analysis Complete!\n\n`;
      summary += `Total Files: ${result.totalFiles}\n`;
      summary += `Total Size: ${result.totalSizeFormatted}\n\n`;
      summary += `Top Categories:\n`;
      
      // Sort categories by size and show top 5
      const sortedCategories = Object.entries(result.byCategory)
        .sort(([,a], [,b]) => b.size - a.size)
        .slice(0, 5);
      
      sortedCategories.forEach(([category, stats]) => {
        summary += `${category}: ${stats.count} files, ${stats.sizeFormatted}\n`;
        console.log(`${category}:`);
        console.log(`  Files: ${stats.count}`);
        console.log(`  Size: ${stats.sizeFormatted}`);
        console.log(`  Extensions:`, stats.byExtension);
      });
      
      console.log('\n=== LARGEST FILES ===');
      console.table(result.largestFiles.slice(0, 20));
      
      console.log('\n=== FULL RESULTS ===');
      console.log(JSON.stringify(result, null, 2));
      
      alert(summary + '\n\nFull details logged to console (F12 → Console)');
    } catch (error) {
      console.error('Analysis failed:', error);
      alert(`Analysis failed: ${error.message}\n\nCheck console for details.`);
    } finally {
      setAnalysisLoading(false);
    }
  };
  
  const handleQuickStats = async () => {
    setQuickStatsLoading(true);
    
    try {
      const result = await quickStorageStats();
      
      console.log('=== QUICK STORAGE STATS ===');
      console.log('Total Files:', result.totalFiles);
      console.log('Total Size:', result.totalSizeFormatted);
      console.log('\n=== BY CATEGORY ===');
      
      let summary = `Quick Storage Stats:\n\n`;
      summary += `Total Files: ${result.totalFiles}\n`;
      summary += `Total Size: ${result.totalSizeFormatted}\n\n`;
      summary += `Categories:\n`;
      
      Object.entries(result.categories).forEach(([category, stats]) => {
        summary += `${category}: ${stats.count} files, ${stats.sizeFormatted}\n`;
        console.log(`${category}:`, stats);
      });
      
      console.log('\n=== FULL RESULT ===');
      console.log(JSON.stringify(result, null, 2));
      
      alert(summary + '\n\nFull details logged to console (F12 → Console)');
    } catch (error) {
      console.error('Quick stats failed:', error);
      alert(`Quick stats failed: ${error.message}\n\nCheck console for details.`);
    } finally {
      setQuickStatsLoading(false);
    }
  };
  
  const handleProcessCruisnewsImages = async (dryRun = false) => {
    const action = dryRun ? 'Dry run' : 'Process';
    const confirmMessage = dryRun 
      ? 'This will analyze CruisNews images without making changes. Continue?'
      : 'This will convert all CruisNews PNG images to optimized WebP format. This action cannot be undone. Continue?';
      
    if (!confirm(confirmMessage)) {
      return;
    }
    
    setProcessCruisnewsLoading(true);
    
    try {
      const result = await processCruisnewsImages({ dryRun, batchSize: 10 });
      
      console.log(`=== CRUISNEWS IMAGE PROCESSING (${action.toUpperCase()}) ===`);
      console.log('Result:', result);
      
      let message = `${action} Complete!\n\n`;
      message += `Total PNG images found: ${result.totalFound}\n`;
      message += `Processed: ${result.processed}\n`;
      message += `Skipped: ${result.skipped}\n`;
      message += `Failed: ${result.failed}\n`;
      
      if (result.spaceSaved > 0) {
        message += `Space saved: ${result.spaceSavedFormatted}\n`;
      }
      
      if (result.errors.length > 0) {
        message += `\nErrors (first 5):\n`;
        result.errors.slice(0, 5).forEach(error => {
          message += `- ${error}\n`;
        });
        if (result.errors.length > 5) {
          message += `... and ${result.errors.length - 5} more errors (check console)`;
        }
      }
      
      if (!dryRun && result.processed > 0) {
        message += `\n✅ ${result.processed} images converted to WebP format!`;
      }
      
      alert(message + '\n\nFull details logged to console (F12 → Console)');
    } catch (error) {
      console.error(`${action} failed:`, error);
      alert(`${action} failed: ${error.message}\n\nCheck console for details.`);
    } finally {
      setProcessCruisnewsLoading(false);
    }
  };
  
  const handleDeleteCruisnewsPngs = async (dryRun = false) => {
    const action = dryRun ? 'Dry run' : 'Delete';
    const confirmMessage = dryRun 
      ? 'This will analyze CruisNews PNG images for deletion without making changes. Continue?'
      : '⚠️ WARNING: This will permanently delete all CruisNews PNG images from R2 storage. This action cannot be undone. Only run this AFTER confirming WebP conversions are working. Continue?';
      
    if (!confirm(confirmMessage)) {
      return;
    }
    
    setDeletePngsLoading(true);
    
    try {
      const result = await deleteCruisnewsPngs({ dryRun, batchSize: 50 });
      
      console.log(`=== CRUISNEWS PNG DELETION (${action.toUpperCase()}) ===`);
      console.log('Result:', result);
      
      let message = `${action} Complete!\n\n`;
      message += `Total PNG images found: ${result.totalFound}\n`;
      message += `Deleted: ${result.deleted}\n`;
      message += `Failed: ${result.failed}\n`;
      
      if (result.spaceFreed > 0) {
        message += `Space freed: ${result.spaceFreedFormatted}\n`;
      }
      
      if (result.errors.length > 0) {
        message += `\nErrors (first 5):\n`;
        result.errors.slice(0, 5).forEach(error => {
          message += `- ${error}\n`;
        });
        if (result.errors.length > 5) {
          message += `... and ${result.errors.length - 5} more errors (check console)`;
        }
      }
      
      if (!dryRun && result.deleted > 0) {
        message += `\n🗑️ ${result.deleted} PNG files permanently deleted!`;
        message += `\n💾 ${result.spaceFreedFormatted} of storage freed!`;
      }
      
      alert(message + '\n\nFull details logged to console (F12 → Console)');
    } catch (error) {
      console.error(`${action} failed:`, error);
      alert(`${action} failed: ${error.message}\n\nCheck console for details.`);
    } finally {
      setDeletePngsLoading(false);
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
      field: "mapSnapshotR2Key",
      headerName: "Snapshot",
      width: 100,
      renderCell: (params) =>
        params.value ? (
          <CheckCircle size={18} color="green" />
        ) : null,
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
      width: 130,
      renderCell: (params) => formatDate(params.value),
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
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { 
                  xs: 'repeat(2, 1fr)',
                  sm: 'repeat(3, 1fr)',
                  md: 'repeat(4, 1fr)',
                  lg: 'repeat(6, 1fr)'
                },
                gap: 2,
                '& > *': { width: '100%' }
              }}
            >
              <TextField
                size="small"
                label="Search Name"
                placeholder="Type to filter..."
                value={filters.nameSearch || ""}
                onChange={(e) =>
                  setFilters({ ...filters, nameSearch: e.target.value })
                }
              />
              
              <FormControl size="small">
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
              
              <FormControl size="small">
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
              
              <FormControl size="small">
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
              
              <TextField
                size="small"
                type="date"
                label="Start Date"
                value={filters.startDate || ""}
                onChange={(e) =>
                  setFilters({ ...filters, startDate: e.target.value || null })
                }
                InputLabelProps={{ shrink: true }}
                InputProps={{
                  endAdornment: filters.startDate ? (
                    <InputAdornment position="end">
                      <MuiIconButton
                        size="small"
                        onClick={() => setFilters({ ...filters, startDate: null })}
                        edge="end"
                      >
                        <X size={16} />
                      </MuiIconButton>
                    </InputAdornment>
                  ) : null
                }}
              />
              
              <TextField
                size="small"
                type="date"
                label="End Date"
                value={filters.endDate || ""}
                onChange={(e) =>
                  setFilters({ ...filters, endDate: e.target.value || null })
                }
                InputLabelProps={{ shrink: true }}
                InputProps={{
                  endAdornment: filters.endDate ? (
                    <InputAdornment position="end">
                      <MuiIconButton
                        size="small"
                        onClick={() => setFilters({ ...filters, endDate: null })}
                        edge="end"
                      >
                        <X size={16} />
                      </MuiIconButton>
                    </InputAdornment>
                  ) : null
                }}
              />
            </Box>
            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center' }}>
              <IconButton onClick={loadSpots} disabled={loading}>
                <RefreshCw size={18} />
              </IconButton>
            </Box>
            
            <Box sx={{ mt: 2, display: 'flex', alignItems: 'center' }}>
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
                onClick={() => {
                  setDedupDialogOpen(true);
                  handleDeduplicateSpots(true);
                }}
                sx={{ mr: 1 }}
              >
                Deduplicate {selectedRows.length > 0 ? `Selected (${selectedRows.length})` : 'All'}
              </Button>
              
              <Button
                size="small"
                variant="outlined"
                color="error"
                onClick={() => {
                  setPurgeDialogOpen(true);
                  handlePurgeDeletedSpots(true);
                }}
                sx={{ mr: 1 }}
              >
                Purge Deleted
              </Button>
              
              <Button
                size="small"
                variant="outlined"
                color="warning"
                onClick={() => {
                  setMigrateDialogOpen(true);
                  handleMigrateSchema(true);
                }}
                sx={{ mr: 1 }}
              >
                Migrate Schema
              </Button>
              
              <Button
                size="small"
                variant="outlined"
                color="primary"
                onClick={handleBulkSnapshotGeneration}
                disabled={snapshotProgress.isProcessing}
                sx={{ mr: 1 }}
              >
                Create Snapshots
              </Button>
              <Button
                size="small"
                variant="outlined"
                color="info"
                onClick={handleQuickStats}
                disabled={quickStatsLoading}
                sx={{ mr: 1 }}
              >
                {quickStatsLoading ? 'Loading...' : 'Quick Stats'}
              </Button>
              <Button
                size="small"
                variant="outlined"
                color="primary"
                onClick={handleAnalyzeStorage}
                disabled={analysisLoading}
                sx={{ mr: 1 }}
              >
                {analysisLoading ? 'Analyzing...' : 'Full Analysis'}
              </Button>
              <Button
                size="small"
                variant="outlined"
                color="warning"
                onClick={() => handleProcessCruisnewsImages(true)}
                disabled={processCruisnewsLoading}
                sx={{ mr: 1 }}
              >
                {processCruisnewsLoading ? 'Analyzing...' : 'CruisNews Dry Run'}
              </Button>
              <Button
                size="small"
                variant="outlined"
                color="secondary"
                onClick={() => handleProcessCruisnewsImages(false)}
                disabled={processCruisnewsLoading}
                sx={{ mr: 1 }}
              >
                {processCruisnewsLoading ? 'Processing...' : 'Convert CruisNews'}
              </Button>
              <Button
                size="small"
                variant="outlined"
                color="success"
                onClick={() => handleDeleteCruisnewsPngs(true)}
                disabled={deletePngsLoading}
                sx={{ mr: 1 }}
              >
                {deletePngsLoading ? 'Analyzing...' : 'PNGs Dry Run'}
              </Button>
              <Button
                size="small"
                variant="contained"
                color="error"
                onClick={() => handleDeleteCruisnewsPngs(false)}
                disabled={deletePngsLoading}
                sx={{ mr: 1 }}
              >
                {deletePngsLoading ? 'Deleting...' : 'Delete PNGs ⚠️'}
              </Button>
              <Button
                size="small"
                variant="outlined"
                color="error"
                onClick={handleCleanupPngSnapshots}
                disabled={cleanupLoading}
                sx={{ mr: 1 }}
              >
                {cleanupLoading ? 'Cleaning...' : 'Cleanup Old PNGs'}
              </Button>
            </Box>
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
          setEditForm({});
        }}
        PaperProps={{ 
          sx: { 
            width: { xs: '100%', sm: '100%', md: 700 },
            maxWidth: '100%'
          } 
        }}
      >
        {selectedSpot && (
          <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <Box sx={{ p: 3, pb: 2, borderBottom: 1, borderColor: 'divider' }}>
              <Stack direction="row" alignItems="center" spacing={2}>
                <Box sx={{ flexGrow: 1 }}>
                  <Typography variant="h5" sx={{ fontWeight: 600, mb: 0.5 }}>
                    {selectedSpot.name}
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    <Chip
                      label={selectedSpot.type}
                      color={TYPE_COLORS[selectedSpot.type] || "default"}
                      size="small"
                    />
                    {selectedSpot.verified && (
                      <Chip label="Verified" color="success" size="small" icon={<CheckCircle size={14} />} />
                    )}
                    {selectedSpot.deleted && (
                      <Chip label="Deleted" color="error" size="small" />
                    )}
                    {selectedSpot.isPrivate && (
                      <Chip label="Private" color="warning" size="small" />
                    )}
                  </Stack>
                </Box>
                <IconButton
                  onClick={() => {
                    setDetailDrawerOpen(false);
                    setSelectedSpot(null);
                    setSpotDetail(null);
                    setEditForm({});
                  }}
                >
                  <X size={20} />
                </IconButton>
              </Stack>
            </Box>
            
            {detailLoading ? (
              <Box sx={{ p: 3 }}>
                <Stack spacing={2}>
                  {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} height={80} />)}
                </Stack>
              </Box>
            ) : spotDetail ? (
              <Box sx={{ flexGrow: 1, overflowY: 'auto', overflowX: 'hidden', p: { xs: 2, sm: 3 } }}>
                <Stack spacing={2.5}>
                  {/* Map Snapshot & Images Section */}
                  <Paper elevation={0} sx={{ p: 2.5, bgcolor: 'grey.50', border: 1, borderColor: 'divider' }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2 }}>
                      Media
                    </Typography>
                    
                    {/* Map Snapshot */}
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                        Map Snapshot
                      </Typography>
                      {spotDetail.spot.mapSnapshotR2Key ? (
                        <Box
                          component="img"
                          src={`https://cruisapalooza.com/${spotDetail.spot.mapSnapshotR2Key}`}
                          alt="Map snapshot"
                          sx={{
                            width: '100%',
                            height: 240,
                            objectFit: 'cover',
                            borderRadius: 1.5,
                            bgcolor: 'grey.200',
                            boxShadow: 1,
                            mb: 1
                          }}
                          onError={(e) => {
                            console.error('Failed to load snapshot:', spotDetail.spot.mapSnapshotR2Key);
                            e.target.style.display = 'none';
                          }}
                        />
                      ) : (
                        <Box
                          sx={{
                            width: '100%',
                            height: 240,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: 1.5,
                            bgcolor: 'grey.200',
                            border: '2px dashed',
                            borderColor: 'grey.400',
                            mb: 1
                          }}
                        >
                          <Typography variant="body2" color="text.secondary">
                            No snapshot available
                          </Typography>
                        </Box>
                      )}
                      <Button
                        variant="outlined"
                        size="small"
                        fullWidth
                        startIcon={<RefreshCw size={16} />}
                        onClick={async () => {
                          try {
                            setDetailLoading(true);
                            // Trigger snapshot generation by updating the spot
                            // The Cloud Function onSpotWrite will detect the change and generate snapshot
                            await handleSpotAction(selectedSpot.id, "edit", {
                              name: spotDetail.spot.name,
                              description: spotDetail.spot.description,
                              type: spotDetail.spot.type,
                              region: spotDetail.spot.region
                            });
                            alert("Snapshot generation triggered! The page will reload in 30 seconds to show the new snapshot.");
                            setTimeout(() => {
                              loadSpotDetail(selectedSpot.id);
                              setDetailLoading(false);
                            }, 30000);
                          } catch (e) {
                            alert(`Failed to trigger snapshot: ${e.message}`);
                            setDetailLoading(false);
                          }
                        }}
                      >
                        {spotDetail.spot.mapSnapshotR2Key ? 'Regenerate Snapshot' : 'Generate Snapshot'}
                      </Button>
                    </Box>

                    {/* Spot Images */}
                    <Box>
                      <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                        Photos {spotDetail.images && spotDetail.images.length > 0 ? `(${spotDetail.images.length})` : ''}
                      </Typography>
                      {spotDetail.images && spotDetail.images.length > 0 ? (
                        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1.5 }}>
                          {spotDetail.images.map((image, idx) => (
                            <Box
                              key={image.id || idx}
                              sx={{
                                position: 'relative',
                                paddingTop: '75%',
                                borderRadius: 1.5,
                                overflow: 'hidden',
                                boxShadow: 1,
                                border: image.isPrimary ? 3 : 0,
                                borderColor: 'primary.main'
                              }}
                            >
                              <Box
                                component="img"
                                src={image.r2Key ? `https://cruisapalooza.com/${image.r2Key}` : image.url}
                                alt={`Spot image ${idx + 1}`}
                                sx={{
                                  position: 'absolute',
                                  top: 0,
                                  left: 0,
                                  width: '100%',
                                  height: '100%',
                                  objectFit: 'cover',
                                  bgcolor: 'grey.200'
                                }}
                                onError={(e) => {
                                  console.error('Failed to load image:', image);
                                  e.target.style.display = 'none';
                                }}
                              />
                              {image.isPrimary && (
                                <Chip
                                  label="Primary"
                                  size="small"
                                  color="primary"
                                  sx={{
                                    position: 'absolute',
                                    top: 8,
                                    right: 8,
                                    height: 20,
                                    fontSize: '0.7rem'
                                  }}
                                />
                              )}
                            </Box>
                          ))}
                        </Box>
                      ) : (
                        <Box
                          sx={{
                            width: '100%',
                            height: 120,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: 1.5,
                            bgcolor: 'grey.200',
                            border: '2px dashed',
                            borderColor: 'grey.400'
                          }}
                        >
                          <Typography variant="body2" color="text.secondary">
                            No photos available
                          </Typography>
                        </Box>
                      )}
                    </Box>
                  </Paper>

                  {/* Basic Info Section */}
                  <Paper elevation={0} sx={{ p: 2.5, bgcolor: 'grey.50', border: 1, borderColor: 'divider' }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2 }}>
                      Basic Information
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <TextField
                        label="Name"
                        value={editForm.name !== undefined ? editForm.name : (spotDetail.spot.name || "")}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        size="small"
                        variant="outlined"
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            backgroundColor: 'white',
                            minHeight: 40
                          }
                        }}
                      />

                      <FormControl size="small" variant="outlined">
                        <InputLabel>Type</InputLabel>
                        <Select
                          value={editForm.type !== undefined ? editForm.type : (spotDetail.spot.type || "")}
                          onChange={(e) => setEditForm({ ...editForm, type: e.target.value })}
                          label="Type"
                        >
                          {SPOT_TYPES.map(type => (
                            <MenuItem key={type} value={type}>{type}</MenuItem>
                          ))}
                        </Select>
                      </FormControl>

                      <TextField
                        label="Description"
                        value={editForm.description !== undefined ? editForm.description : (spotDetail.spot.description || "")}
                        onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                        multiline
                        rows={4}
                        size="small"
                        variant="outlined"
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            backgroundColor: 'white',
                            minHeight: 100
                          }
                        }}
                      />
                    </Box>
                  </Paper>

                  {/* Location Section */}
                  <Paper elevation={0} sx={{ p: 2.5, bgcolor: 'grey.50', border: 1, borderColor: 'divider' }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2 }}>
                      Location
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                        <TextField
                          label="Latitude"
                          value={editForm.latitude !== undefined ? editForm.latitude : (spotDetail.spot.latitude || "")}
                          onChange={(e) => setEditForm({ ...editForm, latitude: parseFloat(e.target.value) })}
                          type="number"
                          inputProps={{ step: 0.000001 }}
                          size="small"
                          variant="outlined"
                          sx={{
                            '& .MuiOutlinedInput-root': {
                              backgroundColor: 'white',
                              minHeight: 40
                            }
                          }}
                        />
                        <TextField
                          label="Longitude"
                          value={editForm.longitude !== undefined ? editForm.longitude : (spotDetail.spot.longitude || "")}
                          onChange={(e) => setEditForm({ ...editForm, longitude: parseFloat(e.target.value) })}
                          type="number"
                          inputProps={{ step: 0.000001 }}
                          size="small"
                          variant="outlined"
                          sx={{
                            '& .MuiOutlinedInput-root': {
                              backgroundColor: 'white',
                              minHeight: 40
                            }
                          }}
                        />
                      </Box>
                      <FormControl size="small" variant="outlined">
                        <InputLabel>Region</InputLabel>
                        <Select
                          value={editForm.region !== undefined ? editForm.region : (spotDetail.spot.region || "")}
                          onChange={(e) => setEditForm({ ...editForm, region: e.target.value })}
                          label="Region"
                        >
                          <MenuItem value="">None</MenuItem>
                          {VALID_REGIONS.map(region => (
                            <MenuItem key={region} value={region}>{region}</MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Box>
                  </Paper>

                  {/* Metadata Section */}
                  <Paper elevation={0} sx={{ p: 2.5, bgcolor: 'grey.50', border: 1, borderColor: 'divider' }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2 }}>
                      Metadata
                    </Typography>
                    <Stack spacing={1.5}>
                      <Box>
                        <Typography variant="caption" color="text.secondary">Spot ID</Typography>
                        <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                          {spotDetail.spot.id}
                        </Typography>
                      </Box>
                      {spotDetail.spot.uuid && (
                        <Box>
                          <Typography variant="caption" color="text.secondary">UUID</Typography>
                          <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                            {spotDetail.spot.uuid}
                          </Typography>
                        </Box>
                      )}
                      {spotDetail.spot.ownerId && (
                        <Box>
                          <Typography variant="caption" color="text.secondary">Owner ID</Typography>
                          <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                            {spotDetail.spot.ownerId}
                          </Typography>
                        </Box>
                      )}
                      <Stack direction="row" spacing={3}>
                        {spotDetail.spot.createdAt && (
                          <Box>
                            <Typography variant="caption" color="text.secondary">Created</Typography>
                            <Typography variant="body2">{formatDate(spotDetail.spot.createdAt)}</Typography>
                          </Box>
                        )}
                        {spotDetail.spot.updatedAt && (
                          <Box>
                            <Typography variant="caption" color="text.secondary">Updated</Typography>
                            <Typography variant="body2">{formatDate(spotDetail.spot.updatedAt)}</Typography>
                          </Box>
                        )}
                      </Stack>
                    </Stack>
                  </Paper>

                  {/* Rating & Comments Section */}
                  {(spotDetail.ratingSummary.count > 0 || (spotDetail.comments && spotDetail.comments.length > 0)) && (
                    <Paper elevation={0} sx={{ p: 2.5, bgcolor: 'grey.50', border: 1, borderColor: 'divider' }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2 }}>
                        User Feedback
                      </Typography>
                      
                      {/* Rating */}
                      <Box sx={{ mb: spotDetail.comments?.length > 0 ? 2 : 0 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                          Rating
                        </Typography>
                        <Typography variant="body2">
                          {spotDetail.ratingSummary.average
                            ? `⭐ ${spotDetail.ratingSummary.average.toFixed(1)} (${spotDetail.ratingSummary.count} ${spotDetail.ratingSummary.count === 1 ? 'rating' : 'ratings'})`
                            : "No ratings yet"}
                        </Typography>
                      </Box>

                      {/* Comments */}
                      {spotDetail.comments && spotDetail.comments.length > 0 && (
                        <Box>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                            Comments ({spotDetail.comments.length})
                          </Typography>
                          <Stack spacing={1}>
                            {spotDetail.comments.slice(0, 5).map(comment => (
                              <Paper key={comment.id} variant="outlined" sx={{ p: 1.5, bgcolor: 'white' }}>
                                <Stack direction="row" spacing={1} alignItems="flex-start">
                                  <Box sx={{ flexGrow: 1 }}>
                                    <Typography variant="body2" sx={{ mb: 0.5 }}>
                                      {comment.text}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                      {comment.userName} • {formatDate(comment.createdAt)}
                                    </Typography>
                                  </Box>
                                  <IconButton
                                    size="small"
                                    onClick={() => handleModerateComment(comment.id, "delete")}
                                  >
                                    <X size={14} />
                                  </IconButton>
                                </Stack>
                              </Paper>
                            ))}
                            {spotDetail.comments.length > 5 && (
                              <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center', pt: 0.5 }}>
                                + {spotDetail.comments.length - 5} more comments
                              </Typography>
                            )}
                          </Stack>
                        </Box>
                      )}
                    </Paper>
                  )}

                  {/* Action Buttons */}
                  <Stack spacing={1.5} sx={{ pt: 1 }}>
                    <Button
                      variant="contained"
                      size="large"
                      onClick={async () => {
                        try {
                          await handleSpotAction(selectedSpot.id, "update", {
                            name: editForm.name !== undefined ? editForm.name : spotDetail.spot.name,
                            description: editForm.description !== undefined ? editForm.description : spotDetail.spot.description,
                            type: editForm.type !== undefined ? editForm.type : spotDetail.spot.type,
                            region: editForm.region !== undefined ? editForm.region : spotDetail.spot.region,
                            latitude: editForm.latitude !== undefined ? editForm.latitude : spotDetail.spot.latitude,
                            longitude: editForm.longitude !== undefined ? editForm.longitude : spotDetail.spot.longitude,
                          });
                          setEditForm({});
                          alert("Spot updated successfully");
                        } catch (e) {
                          alert(`Failed to update: ${e.message}`);
                        }
                      }}
                      disabled={Object.keys(editForm).length === 0}
                    >
                      Save Changes
                    </Button>
                    
                    <Stack direction="row" spacing={1}>
                      <Button
                        variant="outlined"
                        size="medium"
                        fullWidth
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
                          size="medium"
                          fullWidth
                          onClick={() => handleSpotAction(selectedSpot.id, "softDelete")}
                        >
                          Delete
                        </Button>
                      ) : (
                        <Button
                          variant="outlined"
                          color="success"
                          size="medium"
                          fullWidth
                          onClick={() => handleSpotAction(selectedSpot.id, "restore")}
                        >
                          Restore
                        </Button>
                      )}
                    </Stack>
                  </Stack>
                </Stack>
              </Box>
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
      
      {/* Deduplication Dialog */}
      <Dialog open={dedupDialogOpen} onClose={() => setDedupDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Deduplicate Spots</DialogTitle>
        <DialogContent>
          {dedupLoading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress />
            </Box>
          )}
          
          {!dedupLoading && dedupResult && (
            <>
              <Alert severity={dedupResult.duplicateGroups.length > 0 ? "warning" : "success"} sx={{ mb: 2 }}>
                {dedupResult.message}
              </Alert>
              
              {dedupResult.duplicateGroups.length > 0 && (
                <>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Found {dedupResult.duplicateGroups.length} duplicate group{dedupResult.duplicateGroups.length !== 1 ? 's' : ''} 
                    ({dedupResult.toDelete} spot{dedupResult.toDelete !== 1 ? 's' : ''} to delete).
                    Spots are matched by name and location (within ~11m). Priority: photos &gt; ratings &gt; oldest.
                  </Typography>
                  
                  <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
                    {dedupResult.duplicateGroups.map((group, idx) => (
                      <Paper key={idx} sx={{ p: 2, mb: 2, bgcolor: 'background.default' }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
                          {group.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                          {group.location}
                        </Typography>
                        
                        <Stack spacing={1}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Chip label="KEEP" color="success" size="small" />
                            <Typography variant="body2">
                              ID: {group.keeper.id}
                              {group.keeper.hasPhotos && ' • Has Photos'}
                              {group.keeper.hasRatings && ' • Has Ratings'}
                            </Typography>
                          </Box>
                          
                          {group.duplicates.map((dup, dupIdx) => (
                            <Box key={dupIdx} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Chip label="DELETE" color="error" size="small" />
                              <Typography variant="body2">
                                ID: {dup.id}
                                {dup.hasPhotos && ' • Has Photos'}
                                {dup.hasRatings && ' • Has Ratings'}
                              </Typography>
                            </Box>
                          ))}
                        </Stack>
                      </Paper>
                    ))}
                  </Box>
                </>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setDedupDialogOpen(false);
            setDedupResult(null);
          }}>
            Cancel
          </Button>
          {dedupResult && dedupResult.duplicateGroups.length > 0 && dedupResult.dryRun && (
            <Button
              variant="contained"
              color="error"
              onClick={() => handleDeduplicateSpots(false)}
              disabled={dedupLoading}
            >
              Delete {dedupResult.toDelete} Duplicate{dedupResult.toDelete !== 1 ? 's' : ''}
            </Button>
          )}
        </DialogActions>
      </Dialog>
      
      {/* Purge Deleted Dialog */}
      <Dialog open={purgeDialogOpen} onClose={() => setPurgeDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Purge Deleted Spots</DialogTitle>
        <DialogContent>
          {purgeLoading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress />
            </Box>
          )}
          
          {!purgeLoading && purgeResult && (
            <>
              <Alert severity={purgeResult.purged > 0 || purgeResult.spots?.length > 0 ? "warning" : "info"} sx={{ mb: 2 }}>
                {purgeResult.message}
              </Alert>
              
              {purgeResult.spots && purgeResult.spots.length > 0 && (
                <>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    ⚠️ <strong>WARNING:</strong> This will permanently delete {purgeResult.spots.length} spot{purgeResult.spots.length !== 1 ? 's' : ''} from the database. 
                    This action <strong>CANNOT be undone</strong>.
                  </Typography>
                  
                  <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
                    {purgeResult.spots.map((spot, idx) => (
                      <Paper key={idx} sx={{ p: 2, mb: 1, bgcolor: 'background.default' }}>
                        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                          {spot.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          ID: {spot.id} • Region: {spot.region || 'Unknown'}
                        </Typography>
                      </Paper>
                    ))}
                  </Box>
                </>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setPurgeDialogOpen(false);
            setPurgeResult(null);
          }}>
            Cancel
          </Button>
          {purgeResult && purgeResult.spots?.length > 0 && purgeResult.dryRun && (
            <Button
              variant="contained"
              color="error"
              onClick={() => handlePurgeDeletedSpots(false)}
              disabled={purgeLoading}
            >
              Permanently Delete {purgeResult.spots.length} Spot{purgeResult.spots.length !== 1 ? 's' : ''}
            </Button>
          )}
        </DialogActions>
      </Dialog>
      
      {/* Migrate Schema Dialog */}
      <Dialog open={migrateDialogOpen} onClose={() => setMigrateDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Migrate Spot Schema</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            This migration adds missing fields (region, deleted, updatedAt) to all spots in Firestore.
            This is required for incremental sync to work correctly.
          </Typography>
          
          {migrateLoading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress />
            </Box>
          )}
          
          {!migrateLoading && migrateResult && (
            <>
              <Alert severity={migrateResult.migrated > 0 ? "warning" : "info"} sx={{ mb: 2 }}>
                {migrateResult.message}
              </Alert>
              
              <Stack spacing={2}>
                <Box>
                  <Typography variant="body2">
                    <strong>Total spots:</strong> {migrateResult.total}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Need migration:</strong> {migrateResult.migrated}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Already up-to-date:</strong> {migrateResult.skipped}
                  </Typography>
                  {migrateResult.errors?.length > 0 && (
                    <Typography variant="body2" color="error">
                      <strong>Errors:</strong> {migrateResult.errors.length}
                    </Typography>
                  )}
                </Box>
                
                {migrateResult.regionCounts && Object.keys(migrateResult.regionCounts).length > 0 && (
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 1 }}>
                      Region Distribution:
                    </Typography>
                    {Object.entries(migrateResult.regionCounts).map(([region, count]) => (
                      <Typography key={region} variant="caption" display="block">
                        {region}: {count}
                      </Typography>
                    ))}
                  </Box>
                )}
              </Stack>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setMigrateDialogOpen(false);
            setMigrateResult(null);
          }}>
            Cancel
          </Button>
          {migrateResult && migrateResult.migrated > 0 && migrateResult.dryRun && (
            <Button
              variant="contained"
              color="warning"
              onClick={() => handleMigrateSchema(false)}
              disabled={migrateLoading}
            >
              Run Migration ({migrateResult.migrated} spots)
            </Button>
          )}
        </DialogActions>
      </Dialog>
      
      {/* Bulk Snapshot Generation Dialog */}
      <Dialog
        open={snapshotDialogOpen}
        onClose={() => !snapshotProgress.isProcessing && setSnapshotDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Bulk Snapshot Generation
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Spots without snapshots: {snapshotProgress.total}
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Processed: {snapshotProgress.processed} / {snapshotProgress.total}
            </Typography>
            <Typography variant="body2" color="success.main" gutterBottom>
              Successful: {snapshotProgress.successful}
            </Typography>
            <Typography variant="body2" color="error.main" gutterBottom>
              Failed: {snapshotProgress.failed}
            </Typography>
          </Box>
          
          <LinearProgress 
            variant="determinate" 
            value={snapshotProgress.total > 0 ? (snapshotProgress.processed / snapshotProgress.total) * 100 : 0}
            sx={{ mb: 2 }}
          />
          
          {snapshotProgress.errors.length > 0 && (
            <Box sx={{ mt: 2, maxHeight: 200, overflowY: 'auto' }}>
              <Typography variant="subtitle2" color="error" gutterBottom>
                Errors:
              </Typography>
              {snapshotProgress.errors.map((err, idx) => (
                <Typography key={idx} variant="caption" display="block" color="text.secondary">
                  {err.spotName || err.spotId}: {err.error}
                </Typography>
              ))}
            </Box>
          )}
          
          {!snapshotProgress.isProcessing && snapshotProgress.processed > 0 && (
            <Alert severity="success" sx={{ mt: 2 }}>
              Snapshot generation complete! {snapshotProgress.successful} successful, {snapshotProgress.failed} failed.
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          {snapshotProgress.isProcessing && (
            <Button 
              onClick={() => {
                setSnapshotProgress(prev => ({ ...prev, cancelRequested: true }));
              }}
              color="error"
              disabled={snapshotProgress.cancelRequested}
            >
              {snapshotProgress.cancelRequested ? 'Cancelling...' : 'Cancel'}
            </Button>
          )}
          <Button 
            onClick={() => {
              setSnapshotDialogOpen(false);
              loadSpots();
            }}
            disabled={snapshotProgress.isProcessing}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </React.Fragment>
  );
}

export default Spots;
