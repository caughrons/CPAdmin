import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import styled from "@emotion/styled";
import { Line } from "react-chartjs-2";
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Popover,
  Select,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import { spacing } from "@mui/system";
import { useTheme } from "@mui/material/styles";
import { RefreshCw, Trash2 } from "lucide-react";
import {
  fetchCruisnewsStories,
  getCruisnewsPrompt,
  deleteCruisnewsStory,
  runCruisnewsPrompt,
  saveCruisnewsPrompt,
} from "@/services/cruisnewsAdmin";

const ChartCard = styled(Paper)(spacing);
const ChartWrapper = styled.div`
  height: 280px;
`;

const STATUS_OPTIONS = [
  { value: "all", label: "All" },
  { value: "released", label: "Released" },
  { value: "unreleased", label: "Unreleased" },
];

const IMAGE_OPTIONS = [
  { value: "all", label: "All" },
  { value: "with", label: "With Image" },
  { value: "without", label: "Without Image" },
];

function toDate(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  if (typeof value === "number") return new Date(value);
  if (value?._seconds) return new Date(value._seconds * 1000);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDateTime(value) {
  const date = toDate(value);
  if (!date) return "—";
  return date.toLocaleString();
}

function formatDate(value) {
  const date = toDate(value);
  if (!date) return "—";
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function getDayKey(date) {
  return date.toISOString().slice(0, 10);
}

function News() {
  const theme = useTheme();
  const [tab, setTab] = useState(0);
  const [stories, setStories] = useState([]);
  const [storiesLoading, setStoriesLoading] = useState(false);
  const [storiesError, setStoriesError] = useState(null);
  const [storyDeleteError, setStoryDeleteError] = useState(null);
  const [deleteSelectedLoading, setDeleteSelectedLoading] = useState(false);
  const [deleteSelectedAnchorEl, setDeleteSelectedAnchorEl] = useState(null);
  const [selectedStoryIds, setSelectedStoryIds] = useState([]);
  const [filters, setFilters] = useState({
    status: "all",
    image: "all",
    region: "",
    section: "",
  });

  const [promptLoading, setPromptLoading] = useState(false);
  const [promptSaving, setPromptSaving] = useState(false);
  const [promptError, setPromptError] = useState(null);
  const [promptSuccess, setPromptSuccess] = useState(false);
  const [promptLoaded, setPromptLoaded] = useState(false);
  const [promptTab, setPromptTab] = useState(0);
  const [promptText, setPromptText] = useState("");
  const [savedPrompt, setSavedPrompt] = useState("");
  const [previousPrompt, setPreviousPrompt] = useState(null);
  const [promptUpdatedAt, setPromptUpdatedAt] = useState(null);
  const [imageBoilerplate, setImageBoilerplate] = useState("");
  const [savedImageBoilerplate, setSavedImageBoilerplate] = useState("");
  const [previousImageBoilerplate, setPreviousImageBoilerplate] = useState(null);
  const [imagePromptConfig, setImagePromptConfig] = useState("");
  const [savedImagePromptConfig, setSavedImagePromptConfig] = useState("");
  const [previousImagePromptConfig, setPreviousImagePromptConfig] = useState(null);
  const [provider, setProvider] = useState("claude");
  const [savedProvider, setSavedProvider] = useState("claude");
  const [previousProvider, setPreviousProvider] = useState(null);
  const [providerModel, setProviderModel] = useState("claude-sonnet-4-6");
  const [savedProviderModel, setSavedProviderModel] = useState("claude-sonnet-4-6");
  const [previousProviderModel, setPreviousProviderModel] = useState(null);
  const [runLoading, setRunLoading] = useState(false);
  const [runError, setRunError] = useState(null);
  const [runSuccess, setRunSuccess] = useState(null);
  const [runMetrics, setRunMetrics] = useState({
    storyCount: null,
    imageCount: null,
    message: null,
  });

  const loadStories = useCallback(async () => {
    setStoriesLoading(true);
    setStoriesError(null);
    try {
      const result = await fetchCruisnewsStories();
      setStories(result);
    } catch (e) {
      setStoriesError(e?.message ?? String(e));
    } finally {
      setStoriesLoading(false);
    }
  }, []);

  const loadPrompt = useCallback(async () => {
    if (promptLoaded) return;
    setPromptLoading(true);
    setPromptError(null);
    try {
      const data = await getCruisnewsPrompt();
      const currentPrompt = data?.prompt ?? "";
      const currentImageBoilerplate = data?.imageBoilerplate ?? "";
      const currentImagePromptConfig = data?.imagePromptConfig ?? "";
      const currentProvider = data?.provider ?? "claude";
      const currentProviderModel = data?.providerModel ?? "claude-sonnet-4-6";

      setPromptText(currentPrompt);
      setSavedPrompt(currentPrompt);
      setPreviousPrompt(data?.previousPrompt ?? null);
      setPromptUpdatedAt(data?.updatedAt ?? null);

      setImageBoilerplate(currentImageBoilerplate);
      setSavedImageBoilerplate(currentImageBoilerplate);
      setPreviousImageBoilerplate(null);

      setImagePromptConfig(currentImagePromptConfig);
      setSavedImagePromptConfig(currentImagePromptConfig);
      setPreviousImagePromptConfig(null);

      setProvider(currentProvider);
      setSavedProvider(currentProvider);
      setPreviousProvider(null);
      setProviderModel(currentProviderModel);
      setSavedProviderModel(currentProviderModel);
      setPreviousProviderModel(null);
      setPromptLoaded(true);
    } catch (e) {
      setPromptError(e?.message ?? String(e));
    } finally {
      setPromptLoading(false);
    }
  }, [promptLoaded]);

  useEffect(() => {
    loadStories();
  }, [loadStories]);

  const openDeleteSelected = useCallback((event) => {
    setDeleteSelectedAnchorEl(event.currentTarget);
  }, []);

  const closeDeleteSelected = useCallback(() => {
    setDeleteSelectedAnchorEl(null);
  }, []);

  const handleDeleteSelected = useCallback(async () => {
    if (!selectedStoryIds.length) return;
    setDeleteSelectedLoading(true);
    setStoryDeleteError(null);
    try {
      const results = await Promise.allSettled(
        selectedStoryIds.map((storyId) => deleteCruisnewsStory(storyId))
      );
      const failed = results.filter((result) => result.status === "rejected");
      if (failed.length) {
        setStoryDeleteError(
          `Failed to delete ${failed.length} stor${failed.length === 1 ? "y" : "ies"}.`
        );
      }
      await loadStories();
      setSelectedStoryIds([]);
    } catch (e) {
      setStoryDeleteError(e?.message ?? String(e));
    } finally {
      setDeleteSelectedLoading(false);
      closeDeleteSelected();
    }
  }, [closeDeleteSelected, loadStories, selectedStoryIds]);

  useEffect(() => {
    if (tab === 1) {
      loadPrompt();
    }
  }, [tab, loadPrompt]);

  const handleSavePrompt = useCallback(async () => {
    const trimmedBoilerplate = imageBoilerplate.trim();
    const trimmedImagePromptConfig = imagePromptConfig.trim();
    if (!trimmedBoilerplate) {
      setPromptError("Image boilerplate is required.");
      return;
    }
    if (!trimmedImagePromptConfig) {
      setPromptError("Image prompt config JSON is required.");
      return;
    }
    try {
      JSON.parse(trimmedImagePromptConfig);
    } catch (error) {
      setPromptError(`Invalid image prompt config JSON: ${error?.message ?? String(error)}`);
      return;
    }
    setPromptSaving(true);
    setPromptError(null);
    setPromptSuccess(false);
    try {
      await saveCruisnewsPrompt(
        promptText,
        savedPrompt,
        provider,
        providerModel,
        trimmedBoilerplate,
        trimmedImagePromptConfig,
      );
      setPreviousPrompt(savedPrompt);
      setSavedPrompt(promptText);
      setPreviousImageBoilerplate(savedImageBoilerplate);
      setSavedImageBoilerplate(trimmedBoilerplate);
      setPreviousImagePromptConfig(savedImagePromptConfig);
      setSavedImagePromptConfig(trimmedImagePromptConfig);
      setPreviousProvider(savedProvider);
      setSavedProvider(provider);
      setPreviousProviderModel(savedProviderModel);
      setSavedProviderModel(providerModel);
      setPromptUpdatedAt(new Date());
      setPromptSuccess(true);
    } catch (e) {
      setPromptError(e?.message ?? String(e));
    } finally {
      setPromptSaving(false);
    }
  }, [
    imageBoilerplate,
    imagePromptConfig,
    promptText,
    provider,
    providerModel,
    savedImageBoilerplate,
    savedImagePromptConfig,
    savedPrompt,
    savedProvider,
    savedProviderModel,
  ]);

  const handleRevertPrompt = useCallback(async () => {
    if (!previousPrompt) return;
    const nextImageBoilerplate = previousImageBoilerplate ?? savedImageBoilerplate;
    const nextImagePromptConfig = previousImagePromptConfig ?? savedImagePromptConfig;
    const nextProvider = previousProvider ?? savedProvider;
    const nextProviderModel = previousProviderModel ?? savedProviderModel;
    setPromptSaving(true);
    setPromptError(null);
    setPromptSuccess(false);
    try {
      await saveCruisnewsPrompt(
        previousPrompt,
        savedPrompt,
        nextProvider,
        nextProviderModel,
        nextImageBoilerplate,
        nextImagePromptConfig,
      );
      setPromptText(previousPrompt);
      setSavedPrompt(previousPrompt);
      setPreviousPrompt(savedPrompt);
      setImageBoilerplate(nextImageBoilerplate);
      setSavedImageBoilerplate(nextImageBoilerplate);
      setPreviousImageBoilerplate(savedImageBoilerplate);
      setImagePromptConfig(nextImagePromptConfig);
      setSavedImagePromptConfig(nextImagePromptConfig);
      setPreviousImagePromptConfig(savedImagePromptConfig);
      setProvider(nextProvider);
      setSavedProvider(nextProvider);
      setPreviousProvider(savedProvider);
      setProviderModel(nextProviderModel);
      setSavedProviderModel(nextProviderModel);
      setPreviousProviderModel(savedProviderModel);
      setPromptUpdatedAt(new Date());
      setPromptSuccess(true);
    } catch (e) {
      setPromptError(e?.message ?? String(e));
    } finally {
      setPromptSaving(false);
    }
  }, [
    previousImageBoilerplate,
    previousImagePromptConfig,
    previousPrompt,
    previousProvider,
    previousProviderModel,
    savedImageBoilerplate,
    savedImagePromptConfig,
    savedPrompt,
    savedProvider,
    savedProviderModel,
  ]);

  const handleRunPrompt = useCallback(async () => {
    setRunLoading(true);
    setRunError(null);
    setRunSuccess(null);
    setRunMetrics({ storyCount: null, imageCount: null, message: null });
    try {
      const result = await runCruisnewsPrompt();
      const storyCount = result?.storyCount ?? 0;
      const stories = Array.isArray(result?.stories) ? result.stories : [];
      const fallbackImageCount = stories.filter((story) => story?.generateImage === true).length;
      const imageCount = result?.imageCount ?? result?.imagesCreated ?? fallbackImageCount;
      setRunSuccess(`Generated ${storyCount} stor${storyCount === 1 ? "y" : "ies"}.`);
      setRunMetrics({ storyCount, imageCount, message: null });
      await loadStories();
    } catch (e) {
      const errorMessage = e?.message ?? String(e);
      setRunError(errorMessage);
      setRunMetrics({ storyCount: 0, imageCount: 0, message: null });
    } finally {
      setRunLoading(false);
    }
  }, [loadStories]);

  const runSummaryVisible =
    !runLoading && (runError || runMetrics.storyCount !== null || runMetrics.imageCount !== null);
  const runSummaryLabel = runError
    ? `Run failed • Stories: ${runMetrics.storyCount ?? 0} • Images: ${runMetrics.imageCount ?? 0}`
    : `Stories: ${runMetrics.storyCount ?? 0} • Images: ${runMetrics.imageCount ?? 0}`;
  const runSummaryBackground = runError
    ? "error.main"
    : runMetrics.storyCount === 0
      ? "warning.main"
      : "success.main";
  const runSummaryColor = runError || runMetrics.storyCount !== 0 ? "common.white" : "text.primary";

  const regions = useMemo(() => {
    const values = new Set();
    stories.forEach((story) => {
      if (story.region) values.add(story.region);
    });
    return Array.from(values).sort();
  }, [stories]);

  const hasPromptChanges =
    promptText.trim() !== savedPrompt.trim() ||
    imageBoilerplate.trim() !== savedImageBoilerplate.trim() ||
    imagePromptConfig.trim() !== savedImagePromptConfig.trim() ||
    provider !== savedProvider ||
    providerModel !== savedProviderModel;

  const sections = useMemo(() => {
    const values = new Set();
    stories.forEach((story) => {
      if (story.section) values.add(story.section);
    });
    return Array.from(values).sort();
  }, [stories]);

  const sortedStories = useMemo(() => {
    const unreleased = [];
    const released = [];

    stories.forEach((story) => {
      if (story.status === "released") {
        released.push(story);
      } else {
        unreleased.push(story);
      }
    });

    const toMs = (value) => {
      const date = toDate(value);
      return date ? date.getTime() : 0;
    };

    unreleased.sort((a, b) => toMs(a.scheduledRelease) - toMs(b.scheduledRelease));
    released.sort((a, b) => {
      const aDate = toMs(a.actualRelease) || toMs(a.createdAt);
      const bDate = toMs(b.actualRelease) || toMs(b.createdAt);
      return bDate - aDate;
    });

    return [...unreleased, ...released];
  }, [stories]);

  const filteredStories = useMemo(() => {
    return sortedStories.filter((story) => {
      if (filters.status === "released" && story.status !== "released") {
        return false;
      }
      if (filters.status === "unreleased" && story.status === "released") {
        return false;
      }
      if (filters.image === "with" && !story.imageUrl) {
        return false;
      }
      if (filters.image === "without" && story.imageUrl) {
        return false;
      }
      if (filters.region && story.region !== filters.region) {
        return false;
      }
      if (filters.section && story.section !== filters.section) {
        return false;
      }
      return true;
    });
  }, [sortedStories, filters]);

  const chartData = useMemo(() => {
    const days = [];
    const now = new Date();
    for (let i = 29; i >= 0; i -= 1) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      d.setHours(0, 0, 0, 0);
      days.push(d);
    }

    const storiesCount = {};
    const imagesCount = {};
    days.forEach((d) => {
      const key = getDayKey(d);
      storiesCount[key] = 0;
      imagesCount[key] = 0;
    });

    stories.forEach((story) => {
      const created = toDate(story.createdAt);
      if (!created) return;
      const key = getDayKey(new Date(created.getFullYear(), created.getMonth(), created.getDate()));
      if (storiesCount[key] === undefined) return;
      storiesCount[key] += 1;
      if (story.imageUrl) {
        imagesCount[key] += 1;
      }
    });

    return {
      labels: days.map((d) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" })),
      datasets: [
        {
          label: "Stories",
          data: days.map((d) => storiesCount[getDayKey(d)] || 0),
          borderColor: theme.palette.primary.main,
          backgroundColor: "transparent",
          tension: 0.35,
        },
        {
          label: "Images",
          data: days.map((d) => imagesCount[getDayKey(d)] || 0),
          borderColor: theme.palette.secondary.main,
          backgroundColor: "transparent",
          borderDash: [4, 4],
          tension: 0.35,
        },
      ],
    };
  }, [stories, theme]);

  const chartOptions = useMemo(() => {
    return {
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: "bottom",
          labels: {
            boxWidth: 12,
            usePointStyle: true,
          },
        },
      },
      scales: {
        x: {
          grid: { color: "rgba(0,0,0,0.05)" },
        },
        y: {
          beginAtZero: true,
          grid: { color: "rgba(0,0,0,0.05)" },
        },
      },
    };
  }, []);

  const columns = useMemo(() => {
    return [
      {
        field: "headline",
        headerName: "Headline",
        flex: 1,
        minWidth: 240,
        renderCell: (params) => (
          <Typography
            variant="body2"
            fontWeight={600}
            sx={{
              display: "-webkit-box",
              WebkitLineClamp: 3,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              whiteSpace: "normal",
              lineHeight: 1.4,
            }}
          >
            {params.value || "—"}
          </Typography>
        ),
      },
      {
        field: "content",
        headerName: "Content",
        flex: 1.4,
        minWidth: 320,
        renderCell: (params) => (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              display: "-webkit-box",
              WebkitLineClamp: 3,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              whiteSpace: "normal",
              lineHeight: 1.4,
            }}
          >
            {params.value || "—"}
          </Typography>
        ),
      },
      {
        field: "status",
        headerName: "Status",
        width: 120,
        renderCell: (params) => (
          <Chip
            label={params.value || "pending"}
            color={params.value === "released" ? "success" : "warning"}
            size="small"
          />
        ),
      },
      {
        field: "scheduledRelease",
        headerName: "Scheduled",
        width: 190,
        renderCell: (params) => formatDateTime(params.value),
      },
      {
        field: "imageUrl",
        headerName: "Image",
        width: 140,
        renderCell: (params) =>
          params.value ? (
            <Tooltip
              arrow
              placement="right"
              title={
                <Box
                  sx={{
                    p: 1,
                    backgroundColor: "background.paper",
                    borderRadius: 1,
                    boxShadow: 3,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    maxWidth: 240,
                    maxHeight: 240,
                  }}
                >
                  <Box
                    component="img"
                    src={params.value}
                    alt="CruisNews preview"
                    sx={{
                      display: "block",
                      maxWidth: "100%",
                      maxHeight: "100%",
                      width: "auto",
                      height: "auto",
                      objectFit: "contain",
                      borderRadius: 1,
                    }}
                  />
                </Box>
              }
            >
              <Button
                variant="text"
                size="small"
                href={params.value}
                target="_blank"
                rel="noreferrer"
              >
                Open
              </Button>
            </Tooltip>
          ) : (
            "—"
          ),
      },
      {
        field: "region",
        headerName: "Region",
        width: 140,
      },
      {
        field: "section",
        headerName: "Section",
        width: 210,
      },
      {
        field: "source",
        headerName: "Source",
        width: 220,
        renderCell: (params) =>
          params.value ? (
            <Button
              variant="text"
              size="small"
              href={params.value}
              target="_blank"
              rel="noreferrer"
            >
              {params.row.sourceDisplayName || "Source"}
            </Button>
          ) : (
            "—"
          ),
      },
      {
        field: "createdAt",
        headerName: "Created",
        width: 150,
        renderCell: (params) => formatDate(params.value),
      },
      {
        field: "tier",
        headerName: "Tier",
        width: 90,
      },
      {
        field: "generateImage",
        headerName: "Image Flag",
        width: 120,
        renderCell: (params) => (params.value ? "Yes" : "No"),
      },
      {
        field: "actualRelease",
        headerName: "Released",
        width: 170,
        renderCell: (params) => formatDateTime(params.value),
      },
      {
        field: "storyId",
        headerName: "Story ID",
        width: 220,
      },
    ];
  }, []);

  return (
    <React.Fragment>
      <Helmet title="News" />
      <Box sx={{ mb: 3 }}>
        <Typography variant="h3" gutterBottom>
          CruisNews
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Manage daily stories, publishing schedule, imagery, and the generation prompt.
        </Typography>
      </Box>

      {storiesError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setStoriesError(null)}>
          {storiesError}
        </Alert>
      )}

      {storyDeleteError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setStoryDeleteError(null)}>
          {storyDeleteError}
        </Alert>
      )}

      <Popover
        open={Boolean(deleteSelectedAnchorEl)}
        anchorEl={deleteSelectedAnchorEl}
        onClose={closeDeleteSelected}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        transformOrigin={{ vertical: "top", horizontal: "center" }}
      >
        <Box sx={{ p: 2, maxWidth: 320 }}>
          <Typography variant="subtitle2">Delete selected stories?</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            {selectedStoryIds.length} stor{selectedStoryIds.length === 1 ? "y" : "ies"} will be
            removed along with any associated images.
          </Typography>
          <Box sx={{ mt: 2, display: "flex", justifyContent: "flex-end", gap: 1 }}>
            <Button size="small" onClick={closeDeleteSelected}>
              Cancel
            </Button>
            <Button
              size="small"
              variant="contained"
              color="error"
              onClick={handleDeleteSelected}
              disabled={!selectedStoryIds.length || deleteSelectedLoading}
            >
              {deleteSelectedLoading ? "Deleting..." : "Delete"}
            </Button>
          </Box>
        </Box>
      </Popover>

      <Paper sx={{ mb: 3 }}>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Tabs value={tab} onChange={(_, next) => setTab(next)}>
            <Tab label="Stories" />
            <Tab label="Prompt & Analytics" />
          </Tabs>
          <Box sx={{ pr: 2, display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
            {runSummaryVisible && (
              <Chip
                size="small"
                label={runSummaryLabel}
                sx={{
                  bgcolor: runSummaryBackground,
                  color: runSummaryColor,
                }}
              />
            )}
            <Button
              variant="contained"
              color="secondary"
              onClick={handleRunPrompt}
              disabled={runLoading}
            >
              {runLoading ? "Running..." : "Run Prompt"}
            </Button>
          </Box>
        </Box>
      </Paper>

      {tab === 0 && (
        <Paper>
          <Box sx={{ p: 2, borderBottom: 1, borderColor: "divider" }}>
            <Box display="flex" flexWrap="wrap" gap={2} alignItems="center">
              <FormControl size="small" sx={{ minWidth: 160 }}>
                <InputLabel>Status</InputLabel>
                <Select
                  value={filters.status}
                  label="Status"
                  onChange={(event) =>
                    setFilters((prev) => ({ ...prev, status: event.target.value }))
                  }
                >
                  {STATUS_OPTIONS.map((opt) => (
                    <MenuItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl size="small" sx={{ minWidth: 160 }}>
                <InputLabel>Image</InputLabel>
                <Select
                  value={filters.image}
                  label="Image"
                  onChange={(event) =>
                    setFilters((prev) => ({ ...prev, image: event.target.value }))
                  }
                >
                  {IMAGE_OPTIONS.map((opt) => (
                    <MenuItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl size="small" sx={{ minWidth: 170 }}>
                <InputLabel>Region</InputLabel>
                <Select
                  value={filters.region}
                  label="Region"
                  onChange={(event) =>
                    setFilters((prev) => ({ ...prev, region: event.target.value }))
                  }
                >
                  <MenuItem value="">All</MenuItem>
                  {regions.map((region) => (
                    <MenuItem key={region} value={region}>
                      {region}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl size="small" sx={{ minWidth: 220 }}>
                <InputLabel>Section</InputLabel>
                <Select
                  value={filters.section}
                  label="Section"
                  onChange={(event) =>
                    setFilters((prev) => ({ ...prev, section: event.target.value }))
                  }
                >
                  <MenuItem value="">All</MenuItem>
                  {sections.map((section) => (
                    <MenuItem key={section} value={section}>
                      {section}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <Box sx={{ flexGrow: 1 }} />
              <Button
                variant="outlined"
                size="small"
                startIcon={<RefreshCw size={16} />}
                onClick={loadStories}
                disabled={storiesLoading}
              >
                Refresh
              </Button>
            </Box>

            {selectedStoryIds.length > 0 && (
              <Box
                display="flex"
                alignItems="center"
                justifyContent="space-between"
                sx={{ mt: 2 }}
              >
                <Typography variant="body2" color="text.secondary">
                  {selectedStoryIds.length} selected
                </Typography>
                <Button
                  variant="contained"
                  color="error"
                  size="small"
                  startIcon={<Trash2 size={16} />}
                  onClick={openDeleteSelected}
                  disabled={deleteSelectedLoading}
                >
                  Delete Selected
                </Button>
              </Box>
            )}

            <Typography variant="body2" sx={{ mt: 2 }}>
              Showing {filteredStories.length} of {stories.length} stories
            </Typography>
          </Box>

          <Box sx={{ height: 700, width: "100%" }}>
            <DataGrid
              rows={filteredStories}
              columns={columns}
              getRowId={(row) => row.id}
              loading={storiesLoading}
              checkboxSelection
              rowSelectionModel={selectedStoryIds}
              onRowSelectionModelChange={(newSelection) =>
                setSelectedStoryIds(newSelection)
              }
              disableRowSelectionOnClick
              pageSizeOptions={[25, 50, 100]}
              getRowHeight={() => "auto"}
              sx={{
                "& .MuiDataGrid-cell": {
                  alignItems: "flex-start",
                  py: 1,
                },
              }}
              initialState={{
                pagination: { paginationModel: { pageSize: 25, page: 0 } },
              }}
            />
          </Box>
        </Paper>
      )}

      {tab === 1 && (
        <Box display="flex" flexDirection="column" gap={3}>
          {promptError && (
            <Alert severity="error" onClose={() => setPromptError(null)}>
              {promptError}
            </Alert>
          )}

          {runError && (
            <Alert severity="error" onClose={() => setRunError(null)}>
              {runError}
            </Alert>
          )}

          {runSuccess && (
            <Alert severity="success" onClose={() => setRunSuccess(null)}>
              {runSuccess}
            </Alert>
          )}

          {promptSuccess && (
            <Alert severity="success" onClose={() => setPromptSuccess(false)}>
              Prompt saved.
            </Alert>
          )}

          <ChartCard sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Last 30 Days
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Daily stories created and images generated.
            </Typography>
            <ChartWrapper>
              <Line data={chartData} options={chartOptions} />
            </ChartWrapper>
          </ChartCard>

          <Paper sx={{ p: 1 }}>
            <Tabs
              value={promptTab}
              onChange={(_, next) => setPromptTab(next)}
              indicatorColor="primary"
              textColor="primary"
              variant="scrollable"
            >
              <Tab label="Story Prompt" />
              <Tab label="Image Prompt Config" />
            </Tabs>
          </Paper>

          {promptTab === 0 && (
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                CruisNews Prompt
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                This prompt controls story generation. Revert restores the last saved prompt.
              </Typography>

              <Divider sx={{ my: 2 }} />

              <Box display="flex" flexWrap="wrap" gap={2} mb={2} alignItems="center">
                <FormControl size="small" sx={{ minWidth: 220 }}>
                  <InputLabel>Story Provider</InputLabel>
                  <Select
                    value={provider}
                    label="Story Provider"
                    onChange={(event) => setProvider(event.target.value)}
                  >
                    <MenuItem value="claude">Claude (Sonnet 4.6)</MenuItem>
                    <MenuItem value="openai">OpenAI (Responses API)</MenuItem>
                  </Select>
                </FormControl>
                <Typography variant="caption" color="text.secondary">
                  Model: {provider === "claude" ? providerModel : "gpt-4o"}
                </Typography>
              </Box>

              <TextField
                fullWidth
                multiline
                minRows={12}
                value={promptText}
                onChange={(event) => setPromptText(event.target.value)}
                placeholder={promptLoading ? "Loading prompt..." : ""}
                disabled={promptLoading}
              />
              <Box display="flex" flexWrap="wrap" gap={2} mt={2} alignItems="center">
                <Button
                  variant="contained"
                  onClick={handleSavePrompt}
                  disabled={promptSaving || !hasPromptChanges}
                >
                  Save Prompt
                </Button>
                <Button
                  variant="outlined"
                  onClick={handleRevertPrompt}
                  disabled={promptSaving || !previousPrompt}
                >
                  Revert to Previous
                </Button>
                <Box sx={{ flexGrow: 1 }} />
                <Typography variant="caption" color="text.secondary">
                  Last updated: {formatDateTime(promptUpdatedAt)}
                </Typography>
              </Box>
            </Paper>
          )}

          {promptTab === 1 && (
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Image Prompt Config
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Configure image boilerplate and JSON style rules used for gpt-image-1.5 prompts.
              </Typography>
              <Divider sx={{ my: 2 }} />

              <Box display="flex" flexDirection="column" gap={2}>
                <TextField
                  fullWidth
                  multiline
                  minRows={10}
                  label="Image Boilerplate"
                  value={imageBoilerplate}
                  onChange={(event) => setImageBoilerplate(event.target.value)}
                  placeholder={promptLoading ? "Loading image boilerplate..." : ""}
                  disabled={promptLoading}
                />
                <TextField
                  fullWidth
                  multiline
                  minRows={12}
                  label="Image Prompt Config (JSON)"
                  value={imagePromptConfig}
                  onChange={(event) => setImagePromptConfig(event.target.value)}
                  placeholder={promptLoading ? "Loading image prompt config..." : ""}
                  disabled={promptLoading}
                  inputProps={{
                    style: {fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"},
                  }}
                />
                <Box display="flex" flexWrap="wrap" gap={2} mt={1} alignItems="center">
                  <Button
                    variant="contained"
                    onClick={handleSavePrompt}
                    disabled={promptSaving || !hasPromptChanges}
                  >
                    Save Prompt
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={handleRevertPrompt}
                    disabled={promptSaving || !previousPrompt}
                  >
                    Revert to Previous
                  </Button>
                  <Box sx={{ flexGrow: 1 }} />
                  <Typography variant="caption" color="text.secondary">
                    Last updated: {formatDateTime(promptUpdatedAt)}
                  </Typography>
                </Box>
              </Box>
            </Paper>
          )}
        </Box>
      )}
    </React.Fragment>
  );
}

export default News;
