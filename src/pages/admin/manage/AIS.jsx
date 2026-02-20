import React, { useEffect, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import {
  Box,
  CircularProgress,
  Divider,
  Grid,
  Paper,
  Typography,
} from "@mui/material";
import { Radio, Satellite, GitMerge, Layers, Clock } from "lucide-react";
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
} from "react-simple-maps";
import { fetchAisStats } from "@/services/aisStats";

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

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

function WorldMap({ vessels }) {
  const colorMap = { ais: "#2196f3", gps: "#4caf50", merged: "#e040fb" };

  const dots = vessels.filter((v) => v.lat != null && v.lng != null);

  return (
    <Box
      sx={{
        width: "75%",
        borderRadius: 2,
        overflow: "hidden",
        border: "1px solid",
        borderColor: "divider",
        bgcolor: "#cfe8f7",
      }}
    >
      <ComposableMap
        projection="geoNaturalEarth1"
        projectionConfig={{ scale: 153, center: [0, 0] }}
        viewBox="0 80 800 400"
        style={{ width: "100%", height: "auto" }}
      >
          <Geographies geography={GEO_URL}>
            {({ geographies }) =>
              geographies.map((geo) => (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill="#e3eaef"
                  stroke="#b0bec5"
                  strokeWidth={0.5}
                  style={{ default: { outline: "none" }, hover: { outline: "none" }, pressed: { outline: "none" } }}
                />
              ))
            }
          </Geographies>
          {dots.map((d, i) => (
            <Marker key={i} coordinates={[d.lng, d.lat]}>
              <circle
                r={3}
                fill={colorMap[d.source] ?? "#999"}
                fillOpacity={0.85}
                stroke="#fff"
                strokeWidth={0.5}
              />
            </Marker>
          ))}
      </ComposableMap>
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

      <Box mb={3}>
        <Typography variant="h4" gutterBottom>
          AIS &amp; GPS Targets
        </Typography>
        {lastRefresh && (
          <Typography variant="caption" color="text.secondary">
            Refreshed {lastRefresh.toLocaleTimeString()} · auto-updates every 30s
          </Typography>
        )}
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

          <WorldMap vessels={stats?.vessels ?? []} />
        </>
      )}
    </React.Fragment>
  );
}

export default AIS;
