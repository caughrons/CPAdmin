// Live progress for the current (or most recent) CruisNews generation run.
// Data: cruisnews_config/run_status, written by the generator as it goes
// (CruisaPalooza/functions/src/cruisnews/runStatus.ts).
import React, { useEffect, useState } from "react";
import {
  Box,
  Chip,
  CircularProgress,
  Collapse,
  LinearProgress,
  Link,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { isRunActive } from "@/services/cruisnewsAdmin";

const STAGES = [
  { key: "research", label: "Research" },
  { key: "writing", label: "Writing" },
  { key: "saving", label: "Saving" },
  { key: "images", label: "Images" },
  { key: "done", label: "Done" },
];

// finalize is part of research; starting comes before it.
function stageIndex(stage) {
  if (stage === "starting" || stage === "finalize") return 0;
  const i = STAGES.findIndex((s) => s.key === stage);
  return i === -1 ? 0 : i;
}

const IMAGE_CHIP = {
  none: { label: "No image", color: "default", variant: "outlined" },
  queued: { label: "Queued", color: "default", variant: "outlined" },
  generating: { label: "Generating…", color: "info", variant: "outlined" },
  done: { label: "Done", color: "success", variant: "filled" },
  failed: { label: "Failed", color: "error", variant: "filled" },
};

function toMillis(v) {
  return v?.toMillis?.() ?? (typeof v === "number" ? v : null);
}

function elapsed(fromMs, toMs) {
  if (!fromMs) return "";
  const s = Math.max(0, Math.round(((toMs ?? Date.now()) - fromMs) / 1000));
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
}

function CruisnewsRunPanel({ status }) {
  const [now, setNow] = useState(Date.now());
  const [showLeads, setShowLeads] = useState(false);
  const active = isRunActive(status, now);

  // Tick the elapsed timer while a run is active.
  useEffect(() => {
    if (!active) return undefined;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active]);

  if (!status?.runId) return null;

  const started = toMillis(status.startedAt);
  const finished = toMillis(status.finishedAt);
  // Hide a finished run after 24h; the stories list already shows its output.
  if (!active && finished && now - finished > 24 * 60 * 60 * 1000) return null;

  const stalled = status.state === "running" && !active;
  const failed = status.state === "failed";
  const current =
    status.state === "done" ? STAGES.length - 1 : stageIndex(status.stage);
  const leads = Array.isArray(status.leads) ? status.leads : [];
  const stories = Array.isArray(status.stories) ? status.stories : [];
  const expected = status.imagesExpected ?? 0;
  const imgDone = status.imagesDone ?? 0;
  const imgFailed = status.imagesFailed ?? 0;

  const headline = active
    ? "CruisNews run in progress"
    : stalled
    ? "Last run stopped reporting (likely timed out)"
    : failed
    ? "Last run failed"
    : "Last run finished";

  return (
    <Paper sx={{ p: 2, mb: 2 }}>
      <Stack
        direction="row"
        spacing={1.5}
        alignItems="center"
        flexWrap="wrap"
        useFlexGap
      >
        {active && <CircularProgress size={16} />}
        <Typography variant="subtitle1" fontWeight={600}>
          {headline}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {status.trigger === "scheduled" ? "Scheduled" : "Manual"} ·{" "}
          {active
            ? `running ${elapsed(started, now)}`
            : `took ${elapsed(started, finished)}`}
          {status.costEstimate ? ` · ${status.costEstimate}` : ""}
        </Typography>
      </Stack>

      {/* Stage track */}
      <Stack
        direction="row"
        spacing={1}
        sx={{ mt: 1.5 }}
        flexWrap="wrap"
        useFlexGap
      >
        {STAGES.map((s, i) => {
          const isCurrent = i === current && active;
          const isDone =
            i < current || (status.state === "done" && i === current);
          const isFailedHere = (failed || stalled) && i === current;
          return (
            <Chip
              key={s.key}
              size="small"
              label={s.label}
              color={
                isFailedHere
                  ? "error"
                  : isDone
                  ? "success"
                  : isCurrent
                  ? "primary"
                  : "default"
              }
              variant={
                isDone || isCurrent || isFailedHere ? "filled" : "outlined"
              }
              icon={
                isCurrent ? (
                  <CircularProgress size={12} color="inherit" />
                ) : undefined
              }
            />
          );
        })}
      </Stack>

      {status.message && (
        <Typography variant="body2" sx={{ mt: 1 }}>
          {status.message}
        </Typography>
      )}
      {(failed || stalled) && status.error && (
        <Typography variant="body2" color="error" sx={{ mt: 0.5 }}>
          {status.error}
        </Typography>
      )}

      {/* Counts */}
      <Stack
        direction="row"
        spacing={3}
        sx={{ mt: 1 }}
        flexWrap="wrap"
        useFlexGap
      >
        <Typography variant="body2" color="text.secondary">
          Leads: <b>{leads.length}</b>
        </Typography>
        {status.generatedCount != null && (
          <Typography variant="body2" color="text.secondary">
            Written: <b>{status.generatedCount}</b>
            {status.duplicateCount
              ? ` (${status.duplicateCount} already published)`
              : ""}
          </Typography>
        )}
        <Typography variant="body2" color="text.secondary">
          Saved: <b>{stories.length}</b>
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Images: <b>{imgDone}</b> / {expected}
          {imgFailed ? ` (${imgFailed} failed)` : ""}
        </Typography>
      </Stack>

      {expected > 0 && status.stage === "images" && active && (
        <LinearProgress
          variant="determinate"
          value={Math.round(((imgDone + imgFailed) / expected) * 100)}
          sx={{ mt: 1 }}
        />
      )}

      {/* Leads found in research */}
      {leads.length > 0 && (
        <Box sx={{ mt: 1.5 }}>
          <Link
            component="button"
            variant="body2"
            onClick={() => setShowLeads((v) => !v)}
          >
            {showLeads ? "Hide" : "Show"} {leads.length} leads found
          </Link>
          <Collapse in={showLeads}>
            <Box component="ul" sx={{ m: 0, mt: 1, pl: 3 }}>
              {leads.map((l, i) => (
                <Typography component="li" variant="body2" key={i}>
                  {l.headline}
                  <Typography
                    component="span"
                    variant="caption"
                    color="text.secondary"
                  >
                    {" "}
                    {[l.section, l.date].filter(Boolean).join(" · ")}
                  </Typography>
                </Typography>
              ))}
            </Box>
          </Collapse>
        </Box>
      )}

      {/* Stories saved, with each image's status */}
      {stories.length > 0 && (
        <Table size="small" sx={{ mt: 1.5 }}>
          <TableHead>
            <TableRow>
              <TableCell>Story</TableCell>
              <TableCell>Section</TableCell>
              <TableCell align="right">Image</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {stories.map((s) => {
              const chip = IMAGE_CHIP[s.image] ?? IMAGE_CHIP.none;
              return (
                <TableRow key={s.id ?? s.headline}>
                  <TableCell>{s.headline}</TableCell>
                  <TableCell>{s.section ?? ""}</TableCell>
                  <TableCell align="right">
                    <Chip
                      size="small"
                      label={chip.label}
                      color={chip.color}
                      variant={chip.variant}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </Paper>
  );
}

export default CruisnewsRunPanel;
