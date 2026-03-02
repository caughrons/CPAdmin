import React, { useEffect, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import {
  Box,
  Button,
  CircularProgress,
  Divider,
  Grid,
  Paper,
  Tooltip,
  Typography,
} from "@mui/material";
import { Radio, Satellite, GitMerge, Layers, Clock, Play, Square } from "lucide-react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { fetchAisStats } from "@/services/aisStats";
import firebase from "firebase/app";
import "firebase/database";
import { firebaseConfig } from "@/config";

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const rtdb = firebase.database();

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;

// ── Stat chip ────────────────────────────────────────────────────────────────

function StatChip({ icon: Icon, label, value, color }) {
  return (
    <Paper
      variant="outlined"
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        px: 2,
        py: 1.5,
        borderRadius: 2,
        minWidth: 180,
      }}
    >
      <Box
        sx={{
          width: 36,
          height: 36,
          borderRadius: "50%",
          bgcolor: `${color}.lighter`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Icon size={18} color={`var(--mui-palette-${color}-main, #1976d2)`} />
      </Box>
      <Box>
        <Typography variant="caption" color="text.secondary" display="block">
          {label}
        </Typography>
        <Typography variant="h6" fontWeight={600} lineHeight={1.2}>
          {value === null ? "—" : value}
        </Typography>
      </Box>
    </Paper>
  );
}

// ── World map with vessel dots ─────────────────────────────────────────────────

function WorldMap({ vessels, onMapMoveEnd }) {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const moveEndTimeout = useRef(null);
  const onMapMoveEndRef = useRef(onMapMoveEnd);
  const colorMap = { ais: "#2196f3", gps: "#4caf50", merged: "#e040fb" };

  // Keep callback ref up to date
  useEffect(() => {
    onMapMoveEndRef.current = onMapMoveEnd;
  }, [onMapMoveEnd]);

  // Initialize map
  useEffect(() => {
    if (map.current) return; // Initialize only once

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [0, 20],
      zoom: 1.5,
    });

    // Add controls
    map.current.addControl(new mapboxgl.NavigationControl(), "top-right");
    map.current.addControl(new mapboxgl.FullscreenControl(), "top-right");
    map.current.addControl(new mapboxgl.ScaleControl(), "bottom-left");

    // Add vessel source and layer when map loads
    map.current.on("load", () => {
      map.current.addSource("vessels", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: [],
        },
      });

      map.current.addLayer({
        id: "vessel-circles",
        type: "circle",
        source: "vessels",
        paint: {
          "circle-radius": 4,
          "circle-color": [
            "match",
            ["get", "source"],
            "ais",
            "#2196f3",
            "gps",
            "#4caf50",
            "merged",
            "#e040fb",
            "#999999",
          ],
          "circle-opacity": 0.85,
          "circle-stroke-width": 1,
          "circle-stroke-color": "#ffffff",
        },
      });
    });

    // Listen for map movement and trigger refresh after 3 seconds of inactivity
    const handleMoveEnd = () => {
      if (moveEndTimeout.current) {
        clearTimeout(moveEndTimeout.current);
      }
      moveEndTimeout.current = setTimeout(() => {
        if (onMapMoveEndRef.current) {
          onMapMoveEndRef.current();
        }
      }, 3000);
    };

    map.current.on("moveend", handleMoveEnd);
    map.current.on("zoomend", handleMoveEnd);

    return () => {
      if (moveEndTimeout.current) {
        clearTimeout(moveEndTimeout.current);
      }
      map.current?.remove();
    };
  }, []);

  // Update vessel markers when data changes
  useEffect(() => {
    if (!map.current || !map.current.isStyleLoaded()) return;

    const dots = vessels.filter((v) => v.lat != null && v.lng != null);

    const geojson = {
      type: "FeatureCollection",
      features: dots.map((vessel) => ({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [vessel.lng, vessel.lat],
        },
        properties: {
          source: vessel.source,
        },
      })),
    };

    const source = map.current.getSource("vessels");
    if (source) {
      source.setData(geojson);
    }
  }, [vessels]);

  return (
    <Box
      sx={{
        width: "100%",
        height: "500px",
        borderRadius: 2,
        overflow: "hidden",
        border: "1px solid",
        borderColor: "divider",
      }}
    >
      <div ref={mapContainer} style={{ width: "100%", height: "100%" }} />
    </Box>
  );
}

// ── Legend ────────────────────────────────────────────────────────────────────

function Legend() {
  const items = [
    { color: "#2196f3", label: "AIS Only" },
    { color: "#4caf50", label: "GPS Only" },
    { color: "#e040fb", label: "AIS + GPS" },
  ];
  return (
    <Box display="flex" gap={3} flexWrap="wrap">
      {items.map((item) => (
        <Box key={item.label} display="flex" alignItems="center" gap={0.75}>
          <Box
            sx={{
              width: 12,
              height: 12,
              borderRadius: "50%",
              bgcolor: item.color,
            }}
          />
          <Typography variant="caption" color="text.secondary">
            {item.label}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

function AIS() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [feedEnabled, setFeedEnabled] = useState(null); // null = loading
  const [feedToggling, setFeedToggling] = useState(false);
  const intervalRef = useRef(null);

  const load = async () => {
    try {
      const data = await fetchAisStats();
      setStats(data);
      setLastRefresh(new Date());
    } catch (e) {
      console.error("[AIS page]", e);
    } finally {
      setLoading(false);
    }
  };

  // Live listener on ais_config/enabled
  useEffect(() => {
    const ref = rtdb.ref("ais_config/enabled");
    const handler = (snap) => {
      setFeedEnabled(snap.exists() ? snap.val() === true : false);
    };
    ref.on("value", handler, () => {
      // Permission denied or other error — default to off so button is usable
      setFeedEnabled(false);
    });
    // Fallback: if listener hasn't fired after 3s, default to off
    const timeout = setTimeout(() => {
      setFeedEnabled((prev) => (prev === null ? false : prev));
    }, 3000);
    return () => {
      ref.off("value", handler);
      clearTimeout(timeout);
    };
  }, []);

  const toggleFeed = async () => {
    if (feedToggling || feedEnabled === null) return;
    setFeedToggling(true);
    try {
      await rtdb.ref("ais_config/enabled").set(!feedEnabled);
    } catch (e) {
      console.error("[AIS feed toggle]", e);
    } finally {
      setFeedToggling(false);
    }
  };

  useEffect(() => {
    load();
    intervalRef.current = setInterval(load, 30000);
    return () => clearInterval(intervalRef.current);
  }, []);

  // Format last AIS update as "Xs ago"
  const lastAisAgo = (() => {
    if (!stats?.lastAisUpdate) return "—";
    const secs = Math.round((Date.now() - stats.lastAisUpdate.getTime()) / 1000);
    if (secs < 60) return `${secs}s ago`;
    const mins = Math.round(secs / 60);
    return `${mins}m ago`;
  })();

  return (
    <React.Fragment>
      <Helmet title="AIS" />

      <Box mb={3} display="flex" alignItems="flex-start" justifyContent="space-between" flexWrap="wrap" gap={2}>
        <Box>
          <Typography variant="h4" gutterBottom>
            AIS &amp; GPS Targets
          </Typography>
          {lastRefresh && (
            <Typography variant="caption" color="text.secondary">
              Refreshed {lastRefresh.toLocaleTimeString()} · auto-updates every 30s
            </Typography>
          )}
        </Box>

        <Tooltip title={feedEnabled === null ? "Loading feed status..." : feedEnabled ? "Stop AIS feed ingestion" : "Start AIS feed ingestion"}>
          <span>
            <Button
              variant="contained"
              color={feedEnabled ? "error" : "success"}
              disabled={feedEnabled === null || feedToggling}
              startIcon={feedToggling ? <CircularProgress size={16} color="inherit" /> : feedEnabled ? <Square size={16} /> : <Play size={16} />}
              onClick={toggleFeed}
              sx={{ minWidth: 160, fontWeight: 600 }}
            >
              {feedEnabled === null
                ? "Loading..."
                : feedEnabled
                ? "Stop AIS Feed"
                : "Start AIS Feed"}
            </Button>
          </span>
        </Tooltip>
      </Box>

      {loading ? (
        <Box display="flex" justifyContent="center" py={6}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          {/* Stat chips */}
          <Grid container spacing={2} mb={4}>
            <Grid item>
              <StatChip
                icon={Layers}
                label="Total Targets"
                value={stats?.totalTargets?.toLocaleString() ?? "—"}
                color="primary"
              />
            </Grid>
            <Grid item>
              <StatChip
                icon={Radio}
                label="AIS Only"
                value={stats?.aisOnly?.toLocaleString() ?? "—"}
                color="info"
              />
            </Grid>
            <Grid item>
              <StatChip
                icon={Satellite}
                label="GPS Only"
                value={stats?.gpsOnly?.toLocaleString() ?? "—"}
                color="success"
              />
            </Grid>
            <Grid item>
              <StatChip
                icon={GitMerge}
                label="AIS + GPS"
                value={stats?.both?.toLocaleString() ?? "—"}
                color="secondary"
              />
            </Grid>
            <Grid item>
              <StatChip
                icon={Clock}
                label="Last AIS Update"
                value={lastAisAgo}
                color="warning"
              />
            </Grid>
          </Grid>

          <Divider sx={{ mb: 3 }} />

          {/* World map */}
          <Box mb={2}>
            <Typography variant="h6" gutterBottom>
              Global Vessel Map
            </Typography>
            <Legend />
          </Box>

          <WorldMap vessels={stats?.vessels ?? []} onMapMoveEnd={load} />
        </>
      )}
    </React.Fragment>
  );
}

export default AIS;
