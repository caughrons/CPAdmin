import React, { useCallback, useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  FormControlLabel,
  Paper,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import firebase from "firebase/app";
import "firebase/firestore";
import { firebaseConfig } from "@/config";

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const firestore = firebase.firestore();

const DEFAULT_INTERVAL = 4;

function parseInterval(value) {
  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) return DEFAULT_INTERVAL;
  return parsed;
}

function Ads() {
  const [values, setValues] = useState({
    feedInterval: DEFAULT_INTERVAL,
    cruisnewsInterval: DEFAULT_INTERVAL,
    rendezvousInterval: DEFAULT_INTERVAL,
    spotsInterval: DEFAULT_INTERVAL,
    adsEnabled: true,
    useTestAds: true,
    androidNativeAdUnitId: "",
    iosNativeAdUnitId: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const doc = await firestore.collection("app_config").doc("ads").get();
      const data = doc.data() ?? {};
      setValues({
        feedInterval: parseInterval(data.feedInterval ?? DEFAULT_INTERVAL),
        cruisnewsInterval: parseInterval(data.cruisnewsInterval ?? DEFAULT_INTERVAL),
        rendezvousInterval: parseInterval(data.rendezvousInterval ?? DEFAULT_INTERVAL),
        spotsInterval: parseInterval(data.spotsInterval ?? DEFAULT_INTERVAL),
        adsEnabled: data.adsEnabled ?? true,
        useTestAds: data.useTestAds ?? true,
        androidNativeAdUnitId: data.androidNativeAdUnitId ?? "",
        iosNativeAdUnitId: data.iosNativeAdUnitId ?? "",
      });
    } catch (e) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleChange = (key) => (event) => {
    setValues((prev) => ({ ...prev, [key]: event.target.value }));
  };

  const handleToggle = (key) => (event) => {
    setValues((prev) => ({ ...prev, [key]: event.target.checked }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      await firestore.collection("app_config").doc("ads").set(
        {
          feedInterval: parseInterval(values.feedInterval),
          cruisnewsInterval: parseInterval(values.cruisnewsInterval),
          rendezvousInterval: parseInterval(values.rendezvousInterval),
          spotsInterval: parseInterval(values.spotsInterval),
          adsEnabled: values.adsEnabled,
          useTestAds: values.useTestAds,
          androidNativeAdUnitId: values.androidNativeAdUnitId.trim() || null,
          iosNativeAdUnitId: values.iosNativeAdUnitId.trim() || null,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      setSuccess(true);
    } catch (e) {
      setError(e?.message ?? String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <React.Fragment>
      <Helmet title="Ads" />
      <Box display="flex" flexDirection="column" gap={2}>
        <Box>
          <Typography variant="h4" gutterBottom>Ads</Typography>
          <Typography variant="body2" color="text.secondary">
            Configure native ad frequency (every N items). Default is {DEFAULT_INTERVAL} if unset.
          </Typography>
        </Box>

        {error && (
          <Alert severity="error">{error}</Alert>
        )}
        {success && (
          <Alert severity="success">Saved.</Alert>
        )}

        <Paper sx={{ p: 3 }}>
          {loading ? (
            <Box display="flex" alignItems="center" gap={1}>
              <CircularProgress size={18} />
              <Typography variant="body2">Loading…</Typography>
            </Box>
          ) : (
            <Stack spacing={3}>
              <Box
                display="grid"
                gap={2}
                gridTemplateColumns={{ xs: "1fr", md: "repeat(4, 1fr)" }}
              >
                <Box
                  display="flex"
                  flexDirection="column"
                  gap={2}
                  gridColumn={{ xs: "1 / -1", md: "1 / span 1" }}
                >
                  <Box
                    sx={{
                      border: "1px solid",
                      borderColor: "divider",
                      borderRadius: 2,
                      p: 2,
                    }}
                  >
                    <Typography variant="subtitle2" gutterBottom>
                      Global controls
                    </Typography>
                    <Stack spacing={1}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={values.adsEnabled}
                            onChange={handleToggle("adsEnabled")}
                          />
                        }
                        label="Ads enabled for all users"
                      />
                      <FormControlLabel
                        control={
                          <Switch
                            checked={values.useTestAds}
                            onChange={handleToggle("useTestAds")}
                          />
                        }
                        label="Use test ads"
                      />
                    </Stack>
                  </Box>
                  <Box
                    sx={{
                      border: "1px solid",
                      borderColor: "divider",
                      borderRadius: 2,
                      p: 2,
                    }}
                  >
                    <Typography variant="subtitle2" gutterBottom>
                      Live ad unit IDs
                    </Typography>
                    <Stack spacing={2}>
                      <TextField
                        label="Android native ad unit ID (live)"
                        value={values.androidNativeAdUnitId}
                        onChange={handleChange("androidNativeAdUnitId")}
                        helperText="Leave blank to keep using test IDs."
                      />
                      <TextField
                        label="iOS native ad unit ID (live)"
                        value={values.iosNativeAdUnitId}
                        onChange={handleChange("iosNativeAdUnitId")}
                        helperText="Leave blank to keep using test IDs."
                      />
                    </Stack>
                  </Box>
                </Box>
                <Box
                  sx={{
                    border: "1px solid",
                    borderColor: "divider",
                    borderRadius: 2,
                    p: 2,
                  }}
                  display="flex"
                  flexDirection="column"
                  gap={2}
                  gridColumn={{ xs: "1 / -1", md: "2 / span 1" }}
                >
                  <Typography variant="subtitle2" gutterBottom>
                    Ad frequency
                  </Typography>
                  <TextField
                    label="Feed interval"
                    value={values.feedInterval}
                    onChange={handleChange("feedInterval")}
                    helperText="Show an ad every N items (default 4)."
                    type="number"
                    inputProps={{ min: 1 }}
                  />
                  <TextField
                    label="CruisNews interval"
                    value={values.cruisnewsInterval}
                    onChange={handleChange("cruisnewsInterval")}
                    helperText="Show an ad every N items (default 4)."
                    type="number"
                    inputProps={{ min: 1 }}
                  />
                  <TextField
                    label="Rendezvous interval"
                    value={values.rendezvousInterval}
                    onChange={handleChange("rendezvousInterval")}
                    helperText="Show an ad every N items (default 4)."
                    type="number"
                    inputProps={{ min: 1 }}
                  />
                  <TextField
                    label="Spots interval"
                    value={values.spotsInterval}
                    onChange={handleChange("spotsInterval")}
                    helperText="Show an ad every N items (default 4)."
                    type="number"
                    inputProps={{ min: 1 }}
                  />
                </Box>
              </Box>
              <Box display="flex" justifyContent="flex-end" gap={1}>
                <Button variant="outlined" onClick={load} disabled={saving}>
                  Reload
                </Button>
                <Button variant="contained" onClick={handleSave} disabled={saving}>
                  {saving ? "Saving…" : "Save"}
                </Button>
              </Box>
            </Stack>
          )}
        </Paper>
      </Box>
    </React.Fragment>
  );
}

export default Ads;
