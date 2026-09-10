import React, {
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";
import { Helmet } from "react-helmet-async";
import {
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { Play, Square } from "lucide-react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { fetchRegionAisStats } from "@/services/aisStats";
import { AIS_REGION_BOXES } from "@/config";
import firebase from "firebase/app";
import "firebase/database";
import "firebase/auth";
import { AuthContext } from "@/contexts/FirebaseAuthContext";

const rtdb = firebase.database();

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;

const POLL_MS = 20000; // re-poll /vessels while a region is selected
const HEARTBEAT_MS = 45000; // re-write the admin viewport (keeps coverage alive)
const ACTIVATION_GRACE_MS = 60000; // "activating" window before "no vessels" is real

const SRC_BOXES = "coverage-boxes";
const SRC_VESSELS = "vessels";

// ── All coverage boxes as a GeoJSON FeatureCollection ─────────────────────────

function boxesFeatureCollection(selectedId) {
  return {
    type: "FeatureCollection",
    features: AIS_REGION_BOXES.map((b) => ({
      type: "Feature",
      properties: {
        id: b.id,
        label: b.label,
        selected: b.id === selectedId,
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [b.west, b.south],
            [b.east, b.south],
            [b.east, b.north],
            [b.west, b.north],
            [b.west, b.south],
          ],
        ],
      },
    })),
  };
}

function vesselsFeatureCollection(list) {
  return {
    type: "FeatureCollection",
    features: (list || [])
      .filter((v) => v.lat != null && v.lng != null)
      .map((v) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [v.lng, v.lat] },
        properties: { source: v.source },
      })),
  };
}

// ── Map ──────────────────────────────────────────────────────────────────────

function RegionMap({ vessels, selectedBox, onSelectBox }) {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const styleReady = useRef(false);
  const onSelectRef = useRef(onSelectBox);

  useEffect(() => {
    onSelectRef.current = onSelectBox;
  }, [onSelectBox]);

  useEffect(() => {
    if (map.current) return;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/light-v11",
      center: [-80, 30],
      zoom: 2.2,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), "top-right");
    map.current.addControl(new mapboxgl.FullscreenControl(), "top-right");
    map.current.addControl(new mapboxgl.ScaleControl(), "bottom-left");

    map.current.on("load", () => {
      styleReady.current = true;

      map.current.addSource(SRC_BOXES, {
        type: "geojson",
        data: boxesFeatureCollection(null),
      });
      map.current.addLayer({
        id: "box-fill",
        type: "fill",
        source: SRC_BOXES,
        paint: {
          "fill-color": "#1976d2",
          "fill-opacity": [
            "case",
            ["boolean", ["get", "selected"], false],
            0.08,
            0.02,
          ],
        },
      });
      map.current.addLayer({
        id: "box-outline",
        type: "line",
        source: SRC_BOXES,
        paint: {
          "line-color": [
            "case",
            ["boolean", ["get", "selected"], false],
            "#1565c0",
            "#90a4ae",
          ],
          "line-width": [
            "case",
            ["boolean", ["get", "selected"], false],
            2,
            0.8,
          ],
          "line-dasharray": [
            "case",
            ["boolean", ["get", "selected"], false],
            ["literal", [1, 0]],
            ["literal", [2, 2]],
          ],
        },
      });

      map.current.addSource(SRC_VESSELS, {
        type: "geojson",
        data: vesselsFeatureCollection([]),
      });
      map.current.addLayer({
        id: "vessel-circles",
        type: "circle",
        source: SRC_VESSELS,
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

      map.current.on("click", "box-fill", (e) => {
        const id = e.features?.[0]?.properties?.id;
        if (id && onSelectRef.current) onSelectRef.current(id);
      });
      map.current.on("mouseenter", "box-fill", () => {
        map.current.getCanvas().style.cursor = "pointer";
      });
      map.current.on("mouseleave", "box-fill", () => {
        map.current.getCanvas().style.cursor = "";
      });
    });

    return () => {
      map.current?.remove();
      map.current = null;
      styleReady.current = false;
    };
  }, []);

  // Vessels
  useEffect(() => {
    const m = map.current;
    if (!m || !styleReady.current) return;
    m.getSource(SRC_VESSELS)?.setData(vesselsFeatureCollection(vessels));
  }, [vessels]);

  // Selection: recolour boxes + fit to the selected one
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const apply = () => {
      m.getSource(SRC_BOXES)?.setData(
        boxesFeatureCollection(selectedBox?.id ?? null)
      );
      if (selectedBox) {
        const { north, south, east, west } = selectedBox;
        m.fitBounds(
          [
            [west, south],
            [east, north],
          ],
          { padding: 60, duration: 800 }
        );
      }
    };
    if (styleReady.current) apply();
    else m.once("load", apply);
  }, [selectedBox]);

  return (
    <div
      ref={mapContainer}
      style={{ width: "100%", height: "100%", borderRadius: 8 }}
    />
  );
}

// ── Compact inline stats ─────────────────────────────────────────────────────

function InlineStats({ stats, loading }) {
  const dot = (color) => (
    <Box
      component="span"
      sx={{
        width: 8,
        height: 8,
        borderRadius: "50%",
        bgcolor: color,
        display: "inline-block",
        mr: 0.5,
      }}
    />
  );
  if (loading && !stats) {
    return (
      <Typography variant="body2" color="text.secondary">
        Loading…
      </Typography>
    );
  }
  if (!stats) return null;
  const ago = stats.lastAisUpdate
    ? `${Math.max(
        0,
        Math.round((Date.now() - stats.lastAisUpdate.getTime()) / 1000)
      )}s`
    : "—";
  return (
    <Stack
      direction="row"
      spacing={2}
      alignItems="center"
      flexWrap="wrap"
      useFlexGap
    >
      <Typography variant="body2" fontWeight={600}>
        {stats.totalTargets.toLocaleString()} targets
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {dot("#2196f3")}
        {stats.aisOnly.toLocaleString()} AIS
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {dot("#4caf50")}
        {stats.gpsOnly.toLocaleString()} GPS
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {dot("#e040fb")}
        {stats.both.toLocaleString()} merged
      </Typography>
      <Typography variant="caption" color="text.secondary">
        last AIS {ago} ago
      </Typography>
    </Stack>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

function AIS() {
  const { isAuthenticated, isInitialized } = useContext(AuthContext);

  const [selectedBox, setSelectedBox] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [feedEnabled, setFeedEnabled] = useState(null);
  const [feedToggling, setFeedToggling] = useState(false);

  const pollRef = useRef(null);
  const heartbeatRef = useRef(null);
  const selectedAtRef = useRef(0);
  const feedEnabledRef = useRef(null);

  const adminViewportKey = () => {
    const uid = firebase.auth().currentUser?.uid;
    return uid ? `${uid}~admin` : null;
  };

  useEffect(() => {
    feedEnabledRef.current = feedEnabled;
  }, [feedEnabled]);

  useEffect(() => {
    const ref = rtdb.ref("ais_config/enabled");
    const handler = (snap) =>
      setFeedEnabled(snap.exists() ? snap.val() === true : false);
    ref.on("value", handler, () => setFeedEnabled(false));
    const timeout = setTimeout(
      () => setFeedEnabled((prev) => (prev === null ? false : prev)),
      3000
    );
    return () => {
      ref.off("value", handler);
      clearTimeout(timeout);
    };
  }, []);

  const toggleFeed = async () => {
    if (feedToggling || feedEnabled === null) return;
    if (!isAuthenticated) {
      alert("You must be signed in to control the AIS feed.");
      return;
    }
    const newValue = !feedEnabled;
    setFeedToggling(true);
    try {
      await rtdb.ref("ais_config/enabled").set(newValue);
    } catch (e) {
      console.error("[AIS feed toggle]", e);
      alert(`Failed to ${newValue ? "start" : "stop"} the AIS feed.`);
    } finally {
      setFeedToggling(false);
    }
  };

  const refresh = useCallback(async (box) => {
    if (!box) return;
    try {
      const data = await fetchRegionAisStats(box);
      setStats(data);
    } catch (e) {
      console.error("[AIS region]", e);
    } finally {
      setLoading(false);
    }
  }, []);

  const writeHeartbeat = useCallback((box) => {
    const key = adminViewportKey();
    if (!key || !box) return;
    rtdb
      .ref(`active_viewports/${key}`)
      .set({
        north: box.north,
        south: box.south,
        east: box.east,
        west: box.west,
        updatedAt: firebase.database.ServerValue.TIMESTAMP,
      })
      .catch((e) => console.error("[AIS heartbeat]", e));
  }, []);

  const stopRegion = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    pollRef.current = null;
    heartbeatRef.current = null;
    const key = adminViewportKey();
    if (key)
      rtdb
        .ref(`active_viewports/${key}`)
        .remove()
        .catch(() => {});
  }, []);

  const selectRegion = useCallback(
    (boxOrId) => {
      const box =
        typeof boxOrId === "string"
          ? AIS_REGION_BOXES.find((b) => b.id === boxOrId) || null
          : boxOrId;

      // Ignore map clicks while the feed is off (the picker is already disabled).
      if (box && feedEnabledRef.current === false) return;

      stopRegion();
      setSelectedBox(box);
      setStats(null);
      if (!box) return;

      selectedAtRef.current = Date.now();
      setLoading(true);
      writeHeartbeat(box);
      refresh(box);
      pollRef.current = setInterval(() => refresh(box), POLL_MS);
      heartbeatRef.current = setInterval(
        () => writeHeartbeat(box),
        HEARTBEAT_MS
      );
    },
    [refresh, stopRegion, writeHeartbeat]
  );

  useEffect(() => stopRegion, [stopRegion]);

  const inGrace =
    selectedBox &&
    Date.now() - selectedAtRef.current < ACTIVATION_GRACE_MS &&
    (stats?.totalTargets ?? 0) === 0;

  return (
    <React.Fragment>
      <Helmet title="AIS" />

      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          height: "calc(100vh - 170px)",
          minHeight: 520,
          gap: 1.5,
        }}
      >
        {/* Toolbar */}
        <Stack
          direction="row"
          spacing={2}
          alignItems="center"
          flexWrap="wrap"
          useFlexGap
        >
          <Typography variant="h5" sx={{ mr: 1 }}>
            AIS &amp; GPS
          </Typography>

          <Tooltip
            title={
              !isAuthenticated
                ? "Sign in required"
                : feedEnabled
                ? "Stop AIS feed ingestion"
                : "Start AIS feed ingestion"
            }
          >
            <span>
              <Button
                variant="contained"
                size="small"
                color={feedEnabled ? "error" : "success"}
                disabled={
                  !isInitialized ||
                  !isAuthenticated ||
                  feedEnabled === null ||
                  feedToggling
                }
                startIcon={
                  feedToggling ? (
                    <CircularProgress size={14} color="inherit" />
                  ) : feedEnabled ? (
                    <Square size={14} />
                  ) : (
                    <Play size={14} />
                  )
                }
                onClick={toggleFeed}
                sx={{ fontWeight: 600 }}
              >
                {feedEnabled === null
                  ? "…"
                  : feedEnabled
                  ? "Stop Feed"
                  : "Start Feed"}
              </Button>
            </span>
          </Tooltip>

          <Autocomplete
            size="small"
            options={AIS_REGION_BOXES}
            groupBy={(o) => o.region}
            getOptionLabel={(o) => o.label}
            isOptionEqualToValue={(o, v) => o.id === v.id}
            value={selectedBox}
            onChange={(_, v) => selectRegion(v)}
            disabled={feedEnabled === false}
            sx={{ width: 300 }}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Coverage region"
                placeholder="Pick a region to monitor"
              />
            )}
          />

          {feedEnabled === false && (
            <Typography variant="body2" color="text.secondary">
              Start the feed to monitor a region.
            </Typography>
          )}
          {inGrace && (
            <Chip
              size="small"
              color="info"
              variant="outlined"
              icon={<CircularProgress size={12} />}
              label="Activating coverage…"
            />
          )}

          <Box sx={{ flexGrow: 1 }} />
          <InlineStats stats={stats} loading={loading} />
        </Stack>

        {/* Map — always visible, fills the rest */}
        <Box
          sx={{
            flex: 1,
            minHeight: 0,
            borderRadius: 2,
            overflow: "hidden",
            border: "1px solid",
            borderColor: "divider",
            position: "relative",
          }}
        >
          <RegionMap
            vessels={stats?.vessels ?? []}
            selectedBox={selectedBox}
            onSelectBox={selectRegion}
          />
          {stats?.truncated && (
            <Chip
              size="small"
              color="warning"
              label="Showing first 2,500 vessels"
              sx={{ position: "absolute", bottom: 8, right: 8 }}
            />
          )}
          {!selectedBox && (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{
                position: "absolute",
                top: 8,
                left: 8,
                bgcolor: "background.paper",
                px: 1,
                py: 0.5,
                borderRadius: 1,
                boxShadow: 1,
              }}
            >
              Click a coverage box or use the region picker
            </Typography>
          )}
        </Box>
      </Box>
    </React.Fragment>
  );
}

export default AIS;
