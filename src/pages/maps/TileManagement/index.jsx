import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  LinearProgress,
  Paper,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  Tooltip,
  Collapse,
  IconButton,
} from "@mui/material";
import { DataGrid, GridToolbar } from "@mui/x-data-grid";
import { Play, RefreshCw, Package, MapPin, Trash } from "lucide-react";
import {
  generateTilePackage,
  getAvailableTileRegions,
  refreshAllTilePackages,
  startProgressiveGeneration,
  getGenerationProgress,
  repairRegionManifest,
} from "@/services/tileAdmin";
import { 
  REGION_PACKAGES, 
  getAllPackages, 
  getPackagesByRegion, 
  getSeasonalRecommendation 
} from "@/config";

const LOG_STORAGE_KEY = "tile_management_activity_log_v1";
const LOG_LIMIT = 100;
const SPOTS_CANONICAL_REGIONS = [
  "Caribbean",
  "Mediterranean",
  "Pacific",
  "US East Coast",
  "US Gulf",
  "US West",
  "Southern Ocean",
  "Global",
];

const REGION_ALIASES = {
  caribbean: "Caribbean",
  carribbean: "Caribbean",
  mediterranean: "Mediterranean",
  pacific: "Pacific",
  useast: "US East Coast",
  "us-east": "US East Coast",
  "us east": "US East Coast",
  eastcoast: "US East Coast",
  "east-coast": "US East Coast",
  "east coast": "US East Coast",
  useastcoast: "US East Coast",
  "us east coast": "US East Coast",
  usgulf: "US Gulf",
  "us-gulf": "US Gulf",
  "us gulf": "US Gulf",
  uswest: "US West",
  "us-west": "US West",
  "us west": "US West",
  southernocean: "Southern Ocean",
  "southern-ocean": "Southern Ocean",
  "southern ocean": "Southern Ocean",
  global: "Global",
};

function formatBytes(bytes) {
  if (!bytes || Number.isNaN(bytes)) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
}

function normalizeRegionKey(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

function mapToSpotsRegionName(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const normalized = normalizeRegionKey(raw);
  const aliasMatch = REGION_ALIASES[normalized];
  if (aliasMatch) return aliasMatch;

  const directMatch = SPOTS_CANONICAL_REGIONS.find(
    (region) => normalizeRegionKey(region) === normalized
  );
  return directMatch ?? null;
}

function splitCompositeRegionLabel(value) {
  const raw = String(value ?? "").trim();
  if (!raw.includes(":")) return null;
  const [regionLabel, ...rest] = raw.split(":").map((part) => part.trim());
  const packageLabel = rest.join(": ").trim();
  if (!regionLabel || !packageLabel) return null;
  return { regionLabel, packageLabel };
}

function extractRegionPackageParts(regionId, data) {
  const explicitRegion = mapToSpotsRegionName(data?.region) ?? null;
  const explicitPackage = String(data?.package ?? "").trim() || null;

  if (explicitRegion && explicitPackage) {
    return { regionLabel: explicitRegion, packageLabel: explicitPackage, source: "explicit" };
  }

  const candidates = [data?.name, data?.title, regionId];
  for (const candidate of candidates) {
    const composite = splitCompositeRegionLabel(candidate);
    if (composite) {
      return {
        regionLabel: mapToSpotsRegionName(composite.regionLabel) ?? composite.regionLabel,
        packageLabel: composite.packageLabel,
        source: "composite",
      };
    }
  }

  return { regionLabel: explicitRegion, packageLabel: explicitPackage, source: "none" };
}

function toDisplayName(id, data) {
  const mappedFromName = mapToSpotsRegionName(data?.name);
  if (mappedFromName) return mappedFromName;

  const mappedFromTitle = mapToSpotsRegionName(data?.title);
  if (mappedFromTitle) return mappedFromTitle;

  const mappedFromId = mapToSpotsRegionName(id);
  if (mappedFromId) return mappedFromId;

  if (data?.name) return data.name;
  if (data?.title) return data.title;
  if (!id) return "Unknown";
  return String(id)
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function pickCanonicalId(groups, id) {
  const lower = String(id ?? "").toLowerCase();
  return groups.get(lower) ?? id;
}

function TileManagement() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Formatting functions
  const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return "—";
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  };

  const formatDate = (dateString) => {
    console.log('🔧 [TILE_MGMT] formatDate called with:', dateString);
    if (!dateString) {
      console.log('🔧 [TILE_MGMT] formatDate: no dateString, returning —');
      return "—";
    }
    try {
      const result = new Date(dateString).toLocaleDateString();
      console.log('🔧 [TILE_MGMT] formatDate result:', result);
      return result;
    } catch (error) {
      console.log('🔧 [TILE_MGMT] formatDate error:', error);
      return "—";
    }
  };

  // Test formatting functions
  console.log('🧪 [TILE_MGMT] Testing formatBytes:', formatBytes(20553728));
  console.log('🧪 [TILE_MGMT] Testing formatDate:', formatDate('2026-03-25T18:16:29.914Z'));
  const [regions, setRegions] = useState({});
  const [running, setRunning] = useState({});
  const [activityFilter, setActivityFilter] = useState("all");
  const [activityLogs, setActivityLogs] = useState(() => {
    try {
      const raw = localStorage.getItem(LOG_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  });

  // Progressive generation state
  const [activeGenerations, setActiveGenerations] = useState({}); // sessionId -> progress data
  const [refreshTrigger, setRefreshTrigger] = useState(0); // Force grid re-renders

  useEffect(() => {
    try {
      localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(activityLogs));
    } catch (_) {
      // no-op
    }
  }, [activityLogs]);

  const appendLog = useCallback((entry) => {
    setActivityLogs((prev) => {
      const updated = [entry, ...prev].slice(0, LOG_LIMIT);
      return updated;
    });
  }, []);

  // Progressive generation handlers
  const handleProgressiveGeneration = useCallback(async (regionId, includeSubRegions = false, targetName) => {
    try {
      setError(null);
      
      appendLog({
        action: includeSubRegions ? "Update Region + Subregions (Progressive)" : "Update Package (Progressive)",
        targetScope: includeSubRegions ? "region" : "package",
        targetName,
        regionId,
        status: "running",
        message: "Progressive generation started",
        timestamp: new Date().toISOString(),
      });

      const result = await startProgressiveGeneration(regionId, includeSubRegions);
      
      if (result.success) {
        // Start polling for progress
        const sessionId = result.sessionId;
        setActiveGenerations(prev => ({
          ...prev,
          [sessionId]: {
            regionId,
            targetName,
            includeSubRegions,
            status: 'generating',
            progress: 0,
            startedAt: new Date().toISOString()
          }
        }));

        // Start progress polling
        pollProgress(sessionId, regionId, includeSubRegions, targetName);
        
        setSuccess(`Progressive generation started for ${targetName}`);
      } else {
        throw new Error(result.message || 'Failed to start generation');
      }
    } catch (e) {
      const message = e?.message ?? String(e);
      setError(message);
      appendLog({
        action: includeSubRegions ? "Update Region + Subregions (Progressive)" : "Update Package (Progressive)",
        targetScope: includeSubRegions ? "region" : "package",
        targetName,
        regionId,
        status: "error",
        message,
      });
    }
  }, [appendLog]);

  const pollProgress = useCallback(async (sessionId, regionId, includeSubRegions, targetName) => {
    let pollCount = 0;
    const maxPolls = 1800; // 30 minutes max (1800 * 2 seconds)
    
    const pollInterval = setInterval(async () => {
      try {
        pollCount++;
        
        // Timeout after 30 minutes
        if (pollCount > maxPolls) {
          clearInterval(pollInterval);
          
          appendLog({
            action: includeSubRegions ? "Update Region + Subregions (Progressive)" : "Update Package (Progressive)",
            targetScope: includeSubRegions ? "region" : "package",
            targetName,
            regionId,
            status: "error",
            message: "Generation timed out after 30 minutes",
          });

          setError(`Generation timed out for ${targetName}`);
          
          setActiveGenerations(prev => {
            const updated = { ...prev };
            delete updated[sessionId];
            return updated;
          });
          return;
        }

        console.log(`📊 [PROGRESS] Polling ${sessionId}, attempt ${pollCount}/${maxPolls}`);
        
        const result = await getGenerationProgress(sessionId);
        
        console.log(`📊 [PROGRESS] Result:`, result);
        
        if (result.success && result.progress) {
          const progress = result.progress;
          
          console.log(`📊 [PROGRESS] Progress object:`, {
            status: progress.status,
            currentPhase: progress.currentPhase,
            totalPhases: progress.totalPhases,
            tilesGenerated: progress.tilesGenerated,
            totalTiles: progress.totalTiles,
            error: progress.error
          });
          
          setActiveGenerations(prev => ({
            ...prev,
            [sessionId]: {
              ...prev[sessionId],
              ...progress
            }
          }));

          // Update log with progress
          if (progress.status === 'completed') {
            clearInterval(pollInterval);
            
            appendLog({
              action: includeSubRegions ? "Update Region + Subregions (Progressive)" : "Update Package (Progressive)",
              targetScope: includeSubRegions ? "region" : "package",
              targetName,
              regionId,
              status: "success",
              tilesGenerated: progress.tilesGenerated,
              message: `Progressive generation completed: ${progress.tilesGenerated} tiles generated`,
            });

            setSuccess(`Progressive generation completed for ${targetName}`);
            
            // Remove from active generations after a delay
            setTimeout(() => {
              setActiveGenerations(prev => {
                const updated = { ...prev };
                delete updated[sessionId];
                return updated;
              });
            }, 5000);

            // Refresh regions to show new data
            setTimeout(async () => {
              try {
                const result = await getAvailableTileRegions();
                setRegions(result?.regions ?? {});
              } catch (error) {
                console.error('Failed to refresh regions:', error);
              }
            }, 2000);

          } else if (progress.status === 'failed') {
            clearInterval(pollInterval);
            
            appendLog({
              action: includeSubRegions ? "Update Region + Subregions (Progressive)" : "Update Package (Progressive)",
              targetScope: includeSubRegions ? "region" : "package",
              targetName,
              regionId,
              status: "error",
              message: progress.error || 'Generation failed',
            });

            setError(`Generation failed for ${targetName}: ${progress.error || 'Unknown error'}`);
            
            // Remove from active generations
            setActiveGenerations(prev => {
              const updated = { ...prev };
              delete updated[sessionId];
              return updated;
            });
          }
          // For 'generating' status, just continue polling
        } else {
          console.warn(`📊 [PROGRESS] No progress data returned for session ${sessionId}`);
          // Continue polling even if no data, but add a warning after many failed attempts
          if (pollCount % 30 === 0) { // Every minute
            console.warn(`📊 [PROGRESS] No progress data for ${pollCount * 2} seconds for session ${sessionId}`);
          }
        }
      } catch (e) {
        console.error('Error polling progress:', e);
        // Continue polling even on error, but log it
        if (pollCount % 15 === 0) { // Every 30 seconds
          appendLog({
            action: includeSubRegions ? "Update Region + Subregions (Progressive)" : "Update Package (Progressive)",
            targetScope: includeSubRegions ? "region" : "package",
            targetName,
            regionId,
            status: "running",
            message: `Still running... (polling error: ${e.message})`,
          });
        }
      }
    }, 2000); // Poll every 2 seconds

    // Auto-cleanup after 30 minutes max
    setTimeout(() => {
      clearInterval(pollInterval);
      setActiveGenerations(prev => {
        const updated = { ...prev };
        delete updated[sessionId];
        return updated;
      });
    }, 30 * 60 * 1000);
  }, [appendLog]);

  const loadRegions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      console.log('🔄 [TILE_MGMT] Loading regions from backend...');
      const result = await getAvailableTileRegions();
      console.log('📊 [TILE_MGMT] Backend result:', result);
      console.log('🔍 [TILE_MGMT] Raw regions data:', JSON.stringify(result?.regions, null, 2));
      
      setRegions(result?.regions ?? {});
      console.log('🗺️ [TILE_MGMT] Regions set:', result?.regions ?? {});
      
      // Log each region's manifests
      if (result?.regions) {
        Object.entries(result.regions).forEach(([regionName, regionData]) => {
          console.log(`📋 [TILE_MGMT] Region ${regionName}:`, {
            manifests: regionData.manifests,
            manifestKeys: regionData.manifests ? Object.keys(regionData.manifests) : 'none'
          });
          
          if (regionData.manifests) {
            Object.entries(regionData.manifests).forEach(([pkgId, manifest]) => {
              console.log(`📦 [TILE_MGMT] Package ${pkgId} manifest:`, {
                sizeBytes: manifest.sizeBytes,
                tileCount: manifest.tileCount,
                lastUpdated: manifest.lastUpdated,
                version: manifest.version,
                checksum: manifest.checksum
              });
            });
          }
        });
      }
    } catch (e) {
      console.error('❌ [TILE_MGMT] Error loading regions:', e);
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
      // Trigger grid refresh after data loads
      setRefreshTrigger(prev => prev + 1);
    }
  }, []);

  useEffect(() => {
    loadRegions();
  }, [loadRegions]);

  const handleUpdatePackage = useCallback(
    async (regionId, targetName) => {
      const runningKey = `package-${regionId}`;
      setRunning((prev) => ({ ...prev, [runningKey]: true }));
      setError(null);
      setSuccess(null);
      try {
        appendLog({
          action: "Update Package",
          targetScope: "package",
          targetName,
          regionId,
          status: "running",
          message: "Update request submitted",
        });
        await generateTilePackage(regionId, false);
        setSuccess(`Update completed for package ${targetName}`);
        appendLog({
          action: "Update Package",
          targetScope: "package",
          targetName,
          regionId,
          status: "success",
          message: "Package generated and uploaded successfully",
        });
        // Wait a moment for the manifest to be available, then refresh
        setTimeout(() => {
          loadRegions();
        }, 2000);
      } catch (e) {
        const message = e?.message ?? String(e);
        setError(message);
        appendLog({
          action: "Update Package",
          targetScope: "package",
          targetName,
          regionId,
          status: "error",
          message,
        });
      } finally {
        setRunning((prev) => ({ ...prev, [runningKey]: false }));
      }
    },
    [appendLog, loadRegions]
  );

  const handleUpdateRegion = useCallback(
    async (regionId, targetName) => {
      const runningKey = `region-${regionId}`;
      setRunning((prev) => ({ ...prev, [runningKey]: true }));
      setError(null);
      setSuccess(null);
      try {
        appendLog({
          action: "Update Region + Subregions",
          targetScope: "region",
          targetName,
          regionId,
          status: "running",
          message: "Region cascade request submitted",
        });
        await generateTilePackage(regionId, true);
        setSuccess(`Region cascade completed for ${targetName}`);
        appendLog({
          action: "Update Region + Subregions",
          targetScope: "region",
          targetName,
          regionId,
          status: "success",
          message: "All packages generated and uploaded successfully",
        });
        // Wait a moment for manifests to be available, then refresh
        setTimeout(() => {
          loadRegions();
        }, 3000);
      } catch (e) {
        const message = e?.message ?? String(e);
        setError(message);
        appendLog({
          action: "Update Region + Subregions",
          targetScope: "region",
          targetName,
          regionId,
          status: "error",
          message,
        });
      } finally {
        setRunning((prev) => ({ ...prev, [runningKey]: false }));
      }
    },
    [appendLog, loadRegions]
  );

  const handleRepairManifest = useCallback(
    async (regionId, targetName) => {
      const runningKey = `repair-${regionId}`;
      setRunning((prev) => ({ ...prev, [runningKey]: true }));
      setError(null);
      setSuccess(null);
      try {
        appendLog({
          action: "Repair Manifest",
          targetScope: "package",
          targetName,
          regionId,
          status: "running",
          message: "Scanning R2 for existing merged package…",
        });
        const result = await repairRegionManifest(regionId);
        setSuccess(
          `Manifest repaired for ${targetName}: ${(result.sizeBytes / 1024 / 1024).toFixed(1)} MB, ${result.tileCount.toLocaleString()} tiles`
        );
        appendLog({
          action: "Repair Manifest",
          targetScope: "package",
          targetName,
          regionId,
          status: "success",
          tilesGenerated: result.tileCount,
          message: `Repaired — ${(result.sizeBytes / 1024 / 1024).toFixed(1)} MB, ${result.tileCount.toLocaleString()} tiles, key: ${result.r2Key}`,
        });
        await loadRegions();
      } catch (e) {
        const message = e?.message ?? String(e);
        setError(message);
        appendLog({
          action: "Repair Manifest",
          targetScope: "package",
          targetName,
          regionId,
          status: "error",
          message,
        });
      } finally {
        setRunning((prev) => ({ ...prev, [runningKey]: false }));
      }
    },
    [appendLog, loadRegions]
  );

  const handleUpdateAllRegions = useCallback(async () => {
    const shouldContinue = window.confirm(
      "Update all regions and packages? This queues a full sweep for all region packages."
    );
    if (!shouldContinue) return;

    setRunning((prev) => ({ ...prev, updateAll: true }));
    setError(null);
    setSuccess(null);
    try {
      appendLog({
        action: "Update All Regions",
        targetScope: "all",
        targetName: "All Regions",
        regionId: "all",
        status: "running",
        message: "Full sweep request submitted",
      });
      await refreshAllTilePackages();
      setSuccess("Update queued for all regions and packages");
      appendLog({
        action: "Update All Regions",
        targetScope: "all",
        targetName: "All Regions",
        regionId: "all",
        status: "success",
        message: "Full sweep accepted by backend",
      });
      await loadRegions();
    } catch (e) {
      const message = e?.message ?? String(e);
      setError(message);
      appendLog({
        action: "Update All Regions",
        targetScope: "all",
        targetName: "All Regions",
        regionId: "all",
        status: "error",
        message,
      });
    } finally {
      setRunning((prev) => ({ ...prev, updateAll: false }));
    }
  }, [appendLog]);

  const handleClearCache = useCallback(() => {
    // Clear local storage
    localStorage.removeItem(LOG_STORAGE_KEY);
    
    // Clear activity logs state
    setActivityLogs([]);
    
    // Trigger refresh
    setRefreshTrigger(prev => prev + 1);
    
    // Force refresh regions
    loadRegions();
    
    setSuccess("Cache cleared and data refreshed");
  }, [loadRegions]);

  const latestRunByRegion = useMemo(() => {
    const map = {};
    for (const item of activityLogs) {
      if (!item.regionId || item.regionId === "all") continue;
      if (!map[item.regionId]) {
        map[item.regionId] = item;
      }
    }
    return map;
  }, [activityLogs]);

  const rows = useMemo(() => {
    console.log('🏗️ [TILE_MGMT] Building rows...');
    console.log('📋 [TILE_MGMT] Available regions:', Object.keys(regions ?? {}));
    console.log('📦 [TILE_MGMT] REGION_PACKAGES keys:', Object.keys(REGION_PACKAGES));
    
    const rawEntries = Object.entries(regions ?? {});
    if (rawEntries.length === 0) {
      console.log('⚠️ [TILE_MGMT] No backend regions, will use predefined packages only');
    }

    const canonicalByLower = new Map();
    for (const [regionId] of rawEntries) {
      const lower = String(regionId).toLowerCase();
      if (!canonicalByLower.has(lower)) canonicalByLower.set(lower, regionId);
    }

    const canonicalIds = Array.from(canonicalByLower.values());
    const canonicalIdSet = new Set(canonicalIds);
    const childrenByParent = new Map();
    const parentByChild = new Map();
    const canonicalByDisplayName = new Map();
    const parsedPartsById = new Map();

    // Process existing regions from backend
    for (const regionId of canonicalIds) {
      const label = toDisplayName(regionId, regions[regionId]);
      canonicalByDisplayName.set(normalizeRegionKey(label), regionId);
      parsedPartsById.set(regionId, extractRegionPackageParts(regionId, regions[regionId] ?? {}));
    }

    // Add predefined packages to the structure
    const predefinedPackages = new Map();
    Object.entries(REGION_PACKAGES).forEach(([regionName, packages]) => {
      packages.forEach(pkg => {
        predefinedPackages.set(pkg.id, {
          ...pkg,
          regionName,
          isPredefined: true,
        });
      });
    });

    const addChild = (parentId, childId) => {
      if (!parentId || !childId || parentId === childId) return;
      if (!childrenByParent.has(parentId)) childrenByParent.set(parentId, new Set());
      childrenByParent.get(parentId).add(childId);
      parentByChild.set(childId, parentId);
    };

    // Build hierarchy from existing backend data
    for (const parentId of canonicalIds) {
      const data = regions[parentId] ?? {};

      const explicitParent = data?.parentRegionId
        ? pickCanonicalId(canonicalByLower, data.parentRegionId)
        : null;
      if (explicitParent && canonicalIdSet.has(explicitParent)) {
        addChild(explicitParent, parentId);
      }

      for (const subId of data?.subregions ?? []) {
        const childId = pickCanonicalId(canonicalByLower, subId);
        if (canonicalIdSet.has(childId)) {
          addChild(parentId, childId);
        }
      }
    }

    for (const regionId of canonicalIds) {
      const parsed = parsedPartsById.get(regionId);
      if (!parsed?.regionLabel || !parsed?.packageLabel) continue;
      const regionLabel = mapToSpotsRegionName(parsed.regionLabel);
      if (!regionLabel) continue;
      const packageLabel = parsed.packageLabel;
      const regionIdCandidate = canonicalByDisplayName.get(normalizeRegionKey(regionLabel));
      if (!regionIdCandidate || regionIdCandidate === regionId) continue;

      addChild(regionIdCandidate, regionId);
    }

    // Add predefined packages as children of their regions
    Object.entries(REGION_PACKAGES).forEach(([regionName, packages]) => {
      const regionId = canonicalByDisplayName.get(normalizeRegionKey(regionName));
      if (regionId) {
        packages.forEach(pkg => {
          addChild(regionId, pkg.id);
        });
      }
    });

    // Build parent list (regions without parents)
    const parentIds = canonicalIds.filter((id) => !parentByChild.has(id));

    const rowsBuilt = [];
    const pushed = new Set();

    const pushRow = (regionId, nodeType, parentId = null, predefinedPkg = null) => {
      if (pushed.has(regionId)) return;
      
      let data, selfName, parentName, isPackage, inferredParentName, inferredPackageName;
      
      console.log(`🔨 [TILE_MGMT] Building row for ${regionId} (${nodeType})`);
      
      if (predefinedPkg) {
        // Use predefined package data
        data = predefinedPkg;
        selfName = predefinedPkg.name;
        parentName = parentId ? toDisplayName(parentId, regions[parentId]) : predefinedPkg.regionName;
        isPackage = true;
        inferredParentName = predefinedPkg.regionName;
        inferredPackageName = predefinedPkg.name;
      } else {
        // Use backend data
        data = regions[regionId];
        selfName = data?.displayName ?? data?.name ?? regionId;
        parentName = parentId ? toDisplayName(parentId, regions[parentId]) : data?.regionName;
        isPackage = parentByChild.has(regionId);
        inferredParentName = data?.regionName;
        inferredPackageName = data?.name;
      }

      const latestRun = latestRunByRegion[regionId];
      const rowParentId = isPackage ? (parentByChild.get(regionId) ?? null) : null;

      // Get manifest from parent region for packages
      let manifest = null;
      if (isPackage && rowParentId) {
        console.log(`🔍 [TILE_MGMT] Looking for manifest in parent region: ${rowParentId}`);
        console.log(`🔍 [TILE_MGMT] Available parent regions:`, Object.keys(regions));
        console.log(`🔍 [TILE_MGMT] Parent region manifests:`, regions[rowParentId]?.manifests ? Object.keys(regions[rowParentId].manifests) : 'none');
        manifest = regions[rowParentId]?.manifests?.[regionId];
      } else {
        manifest = data?.manifest;
      }

      // Use progressive generation tile count if available, otherwise use manifest tile count
      // Find the active generation session for this region
      const regionGeneration = Object.values(activeGenerations).find(gen => gen.regionId === regionId);
      const progressiveTileCount = regionGeneration?.tilesGenerated || latestRun?.tilesGenerated;
      const displayTileCount = progressiveTileCount && progressiveTileCount > 0 ? progressiveTileCount : (manifest?.tileCount ?? 0);
      
      console.log(`📊 [TILE_MGMT] Row data for ${regionId}:`, {
        isPackage,
        data,
        rowParentId,
        manifest,
        latestRun,
        regionGeneration,
        activeGenerationsCount: Object.keys(activeGenerations).length,
        progressiveTileCount,
        displayTileCount,
        sizeBytes: manifest?.sizeBytes,
        tileCount: manifest?.tileCount,
        lastUpdated: manifest?.lastUpdated,
        version: manifest?.version,
        checksum: manifest?.checksum
      });

      rowsBuilt.push({
        id: regionId,
        regionId,
        name: selfName,
        regionName: isPackage ? parentName ?? inferredParentName ?? "—" : inferredParentName ?? selfName,
        packageName: isPackage ? inferredPackageName ?? selfName : "—",
        packageId: isPackage ? regionId : "—",
        description: predefinedPkg?.description ?? data?.description ?? "—",
        available: predefinedPkg ? true : (data?.available === true),
        version: predefinedPkg?.version ?? manifest?.version ?? "—",
        sizeBytes: manifest?.sizeBytes || 0,
        tileCount: displayTileCount,
        lastUpdated: manifest?.lastUpdated ?? null,
        checksum: manifest?.checksum ?? "—",
        lastRunStatus: latestRun?.status ?? "—",
        lastRunAt: latestRun?.timestamp ?? null,
        nodeType,
        parentRegionId: parentId,
        hasSubregions: !predefinedPkg && (Array.from(childrenByParent.get(regionId) ?? []).length > 0),
        packageCount: Array.from(childrenByParent.get(regionId) ?? []).length,
        parentName,
        isPredefined: predefinedPkg?.isPredefined ?? false,
        seasonalInfo: predefinedPkg?.seasonalInfo ?? null,
        includedAreas: predefinedPkg?.includedAreas ?? [],
      });

      // Debug: Log the actual row data that will be passed to DataGrid
      if (regionId === 'us_east_mid_atlantic') {
        console.log('🎯 [TILE_MGMT] FINAL ROW DATA FOR MID-ATLANTIC:', rowsBuilt[rowsBuilt.length - 1]);
        console.log('🎯 [TILE_MGMT] Size value:', rowsBuilt[rowsBuilt.length - 1].sizeBytes);
        console.log('🎯 [TILE_MGMT] Tile count value:', rowsBuilt[rowsBuilt.length - 1].tileCount);
        console.log('🎯 [TILE_MGMT] Last updated value:', rowsBuilt[rowsBuilt.length - 1].lastUpdated);
      }

      pushed.add(regionId);
    };

    // Track which REGION_PACKAGES region names are covered by a backend region row
    const coveredRegionNames = new Set();

    // Push region rows first
    for (const parentId of parentIds) {
      pushRow(parentId, "region", null);

      // Push predefined packages for this region
      const regionName = toDisplayName(parentId, regions[parentId]);
      const packages = REGION_PACKAGES[regionName] || [];
      if (packages.length > 0) coveredRegionNames.add(regionName);
      packages.forEach(pkg => {
        pushRow(pkg.id, "package", parentId, pkg);
      });

      // Push existing backend subregions
      const childIds = Array.from(childrenByParent.get(parentId) ?? []);
      childIds.sort((a, b) =>
        toDisplayName(a, regions[a]).localeCompare(toDisplayName(b, regions[b]), undefined, {
          sensitivity: "base",
        })
      );

      for (const childId of childIds) {
        if (!predefinedPackages.has(childId)) {
          pushRow(childId, "package", parentId);
        }
      }
    }

    // Always ensure every REGION_PACKAGES region appears — add synthetic rows for any
    // region not covered by backend data.
    for (const [regionName, packages] of Object.entries(REGION_PACKAGES)) {
      if (coveredRegionNames.has(regionName)) continue;

      const syntheticId = `synthetic_${normalizeRegionKey(regionName)}`;
      if (!pushed.has(syntheticId)) {
        rowsBuilt.push({
          id: syntheticId,
          regionId: syntheticId,
          name: regionName,
          regionName: regionName,
          packageName: "—",
          packageId: "—",
          description: "—",
          available: false,
          version: "N/A",
          sizeBytes: 0,
          tileCount: 0,
          lastUpdated: null,
          checksum: "N/A",
          lastRunStatus: "N/A",
          lastRunAt: null,
          nodeType: "region",
          parentRegionId: null,
          hasSubregions: packages.length > 0,
          packageCount: packages.length,
          parentName: null,
          isPredefined: true,
          isSynthetic: true,
          seasonalInfo: null,
          includedAreas: [],
        });
        pushed.add(syntheticId);
      }

      packages.forEach(pkg => {
        pushRow(pkg.id, "package", syntheticId, pkg);
      });
    }

    // Push any remaining predefined packages not yet in the grid
    for (const [pkgId, pkg] of predefinedPackages) {
      if (!pushed.has(pkgId)) {
        pushRow(pkgId, "package", null, pkg);
      }
    }

    console.log('✅ [TILE_MGMT] Final rows built:', rowsBuilt.length);
    console.log('📊 [TILE_MGMT] Row sample:', rowsBuilt.slice(0, 3));
    
    return rowsBuilt;
  }, [latestRunByRegion, regions, activeGenerations]);

  const activityFilterCounts = useMemo(() => {
    return {
      all: activityLogs.length,
      running: activityLogs.filter((item) => item.status === "running").length,
      success: activityLogs.filter((item) => item.status === "success").length,
      error: activityLogs.filter((item) => item.status === "error").length,
    };
  }, [activityLogs]);

  const filteredActivityLogs = useMemo(() => {
    if (activityFilter === "all") return activityLogs;
    return activityLogs.filter((item) => item.status === activityFilter);
  }, [activityFilter, activityLogs]);

  const parentRegionCount = useMemo(
    () => rows.filter((row) => row.nodeType === "region").length,
    [rows]
  );

  const packageCount = useMemo(
    () => rows.filter((row) => row.nodeType === "package").length,
    [rows]
  );

  const predefinedPackageCount = useMemo(
    () => rows.filter((row) => row.isPredefined).length,
    [rows]
  );

  const generatedCount = useMemo(
    () => rows.filter((row) => row.available).length,
    [rows]
  );

  const runningCount = useMemo(
    () => Object.values(running).filter(Boolean).length,
    [running]
  );

  const columns = useMemo(
    () => [
      {
        field: "regionName",
        headerName: "Region",
        minWidth: 200,
        flex: 0.8,
        renderCell: ({ row }) => {
          const isPackage = row.nodeType === "package";
          return (
            <Stack spacing={0.25}>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                {row.regionName}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {isPackage ? row.parentRegionId ?? "—" : row.regionId}
              </Typography>
            </Stack>
          );
        },
      },
      {
        field: "packageName",
        headerName: "Package",
        minWidth: 200,
        flex: 0.8,
        renderCell: ({ row }) => {
          const isPackage = row.nodeType === "package";
          if (!isPackage) {
            return <Typography variant="body2" color="text.secondary">—</Typography>;
          }
          return (
            <Stack spacing={0.25}>
              <Stack direction="row" spacing={0.5} alignItems="center">
                {row.isPredefined && <Package size={14} />}
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  {row.packageName}
                </Typography>
              </Stack>
              <Typography variant="caption" color="text.secondary">
                {row.packageId}
              </Typography>
            </Stack>
          );
        },
      },
      {
        field: "description",
        headerName: "Description",
        minWidth: 180,
        flex: 0.7,
        renderCell: ({ row }) => (
          <Typography variant="body2" noWrap title={row.description}>
            {row.description}
          </Typography>
        ),
      },
      {
        field: "lastUpdated",
        headerName: "Last Updated",
        minWidth: 165,
        renderCell: ({ value }) => {
          console.log('🔧 [TILE_MGMT] LastUpdated renderCell called with:', value);
          return formatDate(value ?? null);
        },
      },
      {
        field: "sizeBytes",
        headerName: "Size",
        minWidth: 90,
        renderCell: ({ value }) => {
          console.log('🔧 [TILE_MGMT] SizeBytes renderCell called with:', value);
          return formatBytes(value ?? null);
        },
      },
      {
        field: "tileCount",
        headerName: "Tiles",
        minWidth: 80,
        renderCell: ({ value, row }) => {
          if (!value && !row.lastUpdated) return "N/A";
          return (value ?? 0).toLocaleString();
        },
      },
      {
        field: "actions",
        headerName: "Actions",
        minWidth: 300,
        maxWidth: 360,
        sortable: false,
        filterable: false,
        renderCell: ({ row }) => {
          const isRegion = row.nodeType === "region";
          const isSynthetic = !!row.isSynthetic;
          const packageLoading = !!running[`package-${row.regionId}`];
          const regionLoading = !!running[`region-${row.regionId}`];

          if (isSynthetic) {
            return (
              <Typography variant="body2" color="text.disabled" sx={{ fontStyle: "italic" }}>
                Not generated
              </Typography>
            );
          }

          return (
            <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
              <Tooltip title={`Build package for ${row.name} (handles large packages without timeouts)`}>
                <span>
                  <Button
                    size="small"
                    variant="contained"
                    color="secondary"
                    onClick={() => handleProgressiveGeneration(row.regionId, false, row.name)}
                    disabled={packageLoading || regionLoading || !!running.updateAll}
                    startIcon={packageLoading ? <CircularProgress size={12} color="inherit" /> : <Package size={14} />}
                  >
                    Build Package
                  </Button>
                </span>
              </Tooltip>

              {isRegion && row.hasSubregions && (
                <Tooltip title={`Build packages for ${row.name} and all subregions`}>
                  <span>
                    <Button
                      size="small"
                      variant="contained"
                      onClick={() => handleProgressiveGeneration(row.regionId, true, row.name)}
                      disabled={regionLoading || packageLoading || !!running.updateAll}
                      startIcon={regionLoading ? <CircularProgress size={12} color="inherit" /> : <Package size={14} />}
                    >
                      Build Region
                    </Button>
                  </span>
                </Tooltip>
              )}

              {!isRegion && (
                (() => {
                  console.log('🔧 [REPAIR] Rendering Repair button for row:', { 
                    id: row.id, 
                    name: row.name, 
                    nodeType: row.nodeType, 
                    isRegion,
                    shouldShow: !isRegion 
                  });
                  return (
                    <Tooltip title="Repair manifest from existing R2 file — no regeneration needed">
                      <span>
                        <Button
                          size="small"
                          variant="outlined"
                          color="warning"
                          onClick={() => handleRepairManifest(row.regionId, row.name)}
                          disabled={!!running[`repair-${row.regionId}`] || packageLoading || !!running.updateAll}
                          startIcon={running[`repair-${row.regionId}`] ? <CircularProgress size={12} color="inherit" /> : <RefreshCw size={14} />}
                        >
                          Repair
                        </Button>
                      </span>
                    </Tooltip>
                  );
                })()
              )}
            </Stack>
          );
        },
      },
      // Remaining columns after Actions
      {
        field: "seasonalInfo",
        headerName: "Seasonal",
        minWidth: 140,
        flex: 0.6,
        renderCell: ({ row }) => {
          if (!row.seasonalInfo) {
            return <Typography variant="body2" color="text.secondary">—</Typography>;
          }
          const recommendation = getSeasonalRecommendation(row.seasonalInfo);
          return (
            <Typography variant="body2" noWrap title={recommendation}>
              {recommendation}
            </Typography>
          );
        },
      },
      {
        field: "includedAreas",
        headerName: "Areas",
        minWidth: 120,
        flex: 0.5,
        renderCell: ({ row }) => {
          if (!row.includedAreas || row.includedAreas.length === 0) {
            return <Typography variant="body2" color="text.secondary">—</Typography>;
          }
          const areasText = `${row.includedAreas.length} area${row.includedAreas.length === 1 ? '' : 's'}`;
          return (
            <Tooltip title={row.includedAreas.join(', ')}>
              <Typography variant="body2">
                {areasText}
              </Typography>
            </Tooltip>
          );
        },
      },
      {
        field: "available",
        headerName: "Status",
        minWidth: 110,
        renderCell: ({ value, row }) => {
          let color = "default";
          let label = "Pending";
          
          if (row.isPredefined) {
            color = "primary";
            label = "Predefined";
          } else if (value) {
            color = "success";
            label = "Ready";
          }
          
          return <Chip size="small" color={color} label={label} />;
        },
      },
      {
        field: "version",
        headerName: "Version",
        minWidth: 100,
      },
      {
        field: "lastRunStatus",
        headerName: "Last Run",
        minWidth: 120,
        renderCell: ({ value }) => {
          if (value === "success") return <Chip size="small" color="success" label="Success" />;
          if (value === "error") return <Chip size="small" color="error" label="Error" />;
          if (value === "running") return <Chip size="small" color="warning" label="Running" />;
          return <Chip size="small" label="—" />;
        },
      },
      {
        field: "lastRunAt",
        headerName: "Last Run At",
        minWidth: 170,
        renderCell: ({ value }) => formatDate(value ?? null),
      },
      {
        field: "checksum",
        headerName: "Checksum",
        minWidth: 200,
        renderCell: ({ value }) => (
          <Typography variant="caption" sx={{ fontFamily: "monospace" }}>
            {value === "—" ? "—" : `${value}`.slice(0, 20) + "…"}
          </Typography>
        ),
      },
    ],
    [handleProgressiveGeneration, handleRepairManifest, running]
  );

  return (
    <React.Fragment>
      <Helmet title="Tile Management" />

      <Box display="flex" alignItems="flex-start" justifyContent="space-between" flexWrap="wrap" gap={2} mb={3}>
        <Box>
          <Typography variant="h4" gutterBottom>
            Tile Management
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage offline tile packages by region and subregion package. Manifest metadata updates automatically after update actions.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            startIcon={<RefreshCw size={16} />}
            onClick={loadRegions}
            disabled={loading}
          >
            Refresh Status
          </Button>
          <Button
            variant="outlined"
            color="warning"
            startIcon={<Trash size={16} />}
            onClick={handleClearCache}
            disabled={loading}
          >
            Clear Cache
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={handleUpdateAllRegions}
            disabled={!!running.updateAll}
            startIcon={running.updateAll ? <CircularProgress size={14} color="inherit" /> : <Play size={16} />}
          >
            Update All Regions
          </Button>
        </Stack>
      </Box>

      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" gap={1}>
        <Chip label={`${parentRegionCount} Regions`} color="primary" variant="outlined" />
        <Chip label={`${packageCount} Packages (${predefinedPackageCount} predefined)`} color="default" variant="outlined" />
        <Chip label={`${generatedCount}/${rows.length} Ready`} color="success" variant="outlined" />
        <Chip label={`${runningCount} Running`} color={runningCount > 0 ? "warning" : "default"} variant="outlined" />
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {success}
        </Alert>
      )}

      <Paper sx={{ p: 2 }}>
        <Box sx={{ height: "calc(100vh - 260px)", minHeight: 420 }}>
          {/* Debug: Log what rows DataGrid is actually receiving */}
          {(() => {
            const midAtlanticRow = rows.find(r => r.id === 'us_east_mid_atlantic');
            console.log('🎯 [TILE_MGMT] DATAGRID ROWS DEBUG:', {
              totalRows: rows.length,
              midAtlanticRow: midAtlanticRow ? {
                id: midAtlanticRow.id,
                sizeBytes: midAtlanticRow.sizeBytes,
                tileCount: midAtlanticRow.tileCount,
                lastUpdated: midAtlanticRow.lastUpdated,
                version: midAtlanticRow.version
              } : 'NOT FOUND'
            });
            return null;
          })()}
          <DataGrid
            key={`tile-management-${refreshTrigger}-${Date.now()}`} // Force re-render with timestamp
            rows={rows}
            columns={columns}
            loading={loading}
            disableRowSelectionOnClick
            rowHeight={64}
            slots={{ toolbar: GridToolbar }}
            slotProps={{
              toolbar: {
                showQuickFilter: true,
                quickFilterProps: { debounceMs: 250 },
              },
            }}
            pageSizeOptions={[10, 25, 50]}
            initialState={{
              pagination: {
                paginationModel: { pageSize: 10, page: 0 },
              },
            }}
            getRowClassName={({ row }) => row.nodeType === "region" ? "region-header-row" : ""}
            sx={{
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 2,
              "& .MuiDataGrid-cell": {
                alignItems: "center",
              },
              "& .region-header-row": {
                backgroundColor: "rgba(33, 150, 243, 0.08)",
                fontWeight: 600,
              },
              "& .region-header-row:hover": {
                backgroundColor: "rgba(33, 150, 243, 0.15)",
              },
            }}
          />
        </Box>
      </Paper>

      {/* Progressive Generation Progress */}
      {Object.keys(activeGenerations).length > 0 && (
        <Paper sx={{ p: 2, mt: 2 }}>
          <Typography variant="h6" mb={2}>Progressive Generation Progress</Typography>
          <Stack spacing={2}>
            {Object.entries(activeGenerations).map(([sessionId, generation]) => (
              <Box key={sessionId} sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 2 }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1}>
                  <Typography variant="subtitle2">
                    {generation.targetName} {generation.includeSubRegions ? '(Region + Subregions)' : '(Package)'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {generation.status}
                  </Typography>
                </Stack>
                
                <LinearProgress 
                  variant="determinate" 
                  value={generation.progress || 0} 
                  sx={{ mb: 1 }}
                />
                
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">
                    Phase: {generation.currentPhase}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {generation.tilesGenerated || 0} tiles generated
                  </Typography>
                </Stack>
              </Box>
            ))}
          </Stack>
        </Paper>
      )}

      <Paper sx={{ p: 2, mt: 2 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1} flexWrap="wrap" gap={1}>
          <Typography variant="h6">Update Activity</Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            <ToggleButtonGroup
              exclusive
              size="small"
              value={activityFilter}
              onChange={(_, value) => {
                if (value) setActivityFilter(value);
              }}
            >
              <ToggleButton value="all">All ({activityFilterCounts.all})</ToggleButton>
              <ToggleButton value="running">Running ({activityFilterCounts.running})</ToggleButton>
              <ToggleButton value="success">Success ({activityFilterCounts.success})</ToggleButton>
              <ToggleButton value="error">Error ({activityFilterCounts.error})</ToggleButton>
            </ToggleButtonGroup>
            <Button
              size="small"
              variant="text"
              onClick={() => setActivityLogs([])}
              disabled={activityLogs.length === 0}
            >
              Clear Log
            </Button>
          </Stack>
        </Stack>
        <Divider sx={{ mb: 1 }} />
        {filteredActivityLogs.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No activity for the current filter.
          </Typography>
        ) : (
          <Stack spacing={1} sx={{ maxHeight: 260, overflowY: "auto", pr: 1 }}>
            {filteredActivityLogs.slice(0, 25).map((item) => (
              <Box
                key={item.id}
                sx={{
                  p: 1,
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 1,
                  backgroundColor: "background.paper",
                }}
              >
                <Stack direction="row" spacing={1} alignItems="center" mb={0.5}>
                  <Chip
                    size="small"
                    color={
                      item.status === "success"
                        ? "success"
                        : item.status === "error"
                          ? "error"
                          : item.status === "running"
                            ? "warning"
                            : "default"
                    }
                    label={item.status}
                  />
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {item.action}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {(item.targetName || item.regionId) ?? "—"}
                  </Typography>
                  <Chip size="small" variant="outlined" label={item.targetScope ?? "package"} />
                  <Typography variant="caption" color="text.secondary">
                    {formatDate(item.timestamp)}
                  </Typography>
                </Stack>
                <Typography variant="caption" color="text.secondary">
                  {item.message}
                </Typography>
              </Box>
            ))}
          </Stack>
        )}
      </Paper>
    </React.Fragment>
  );
}

export default TileManagement;
