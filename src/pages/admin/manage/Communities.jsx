import React, { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  MenuItem,
  Paper,
  Select,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { RefreshCw, Star } from "lucide-react";
import firebase from "firebase/app";
import "firebase/database";
import "firebase/functions";

const rtdb = firebase.database();
const functions = firebase.app().functions("us-central1");

const GROUP_TYPES = ["user", "partner", "official", "sponsor"];

const TYPE_COLORS = {
  partner: "success",
  official: "warning",
  sponsor: "info",
  user: "default",
};

const COMMUNITY_TYPE_COLORS = {
  provider: "primary",
  sponsor: "success",
  standard: "default",
};

// ── Shared table for one community type ──────────────────────────────────────

function CommunityTable({ targetType, groups, loading, onTypeChange, onSetOfficial, savedId }) {
  const [search, setSearch] = useState("");

  const filtered = groups.filter((g) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      g.name.toLowerCase().includes(q) ||
      g.id.toLowerCase().includes(q) ||
      g.createdBy.toLowerCase().includes(q) ||
      g.groupType.toLowerCase().includes(q)
    );
  });

  return (
    <Box>
      <Stack direction="row" spacing={2} mb={2} alignItems="center">
        <TextField
          size="small"
          placeholder="Search by name, ID, creator, or type…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ width: 360 }}
        />
        <Typography variant="body2" color="text.secondary">
          {filtered.length} of {groups.length} communities
        </Typography>
      </Stack>

      <Paper variant="outlined">
        {loading ? (
          <Box p={4} textAlign="center">
            <CircularProgress />
          </Box>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>ID</TableCell>
                <TableCell>Created By (UID)</TableCell>
                <TableCell>Privacy</TableCell>
                <TableCell>Members</TableCell>
                <TableCell>Group Type</TableCell>
                <TableCell>
                  <Tooltip title="communityType: 'standard' | 'provider' | 'sponsor' — the official designation set via Cloud Function.">
                    <span>Official Designation</span>
                  </Tooltip>
                </TableCell>
                {(targetType === "partner" || targetType === "sponsor") && (
                  <TableCell>Actions</TableCell>
                )}
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 4, color: "text.secondary" }}>
                    No communities found.
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((group) => {
                const isAlreadyOfficial =
                  (targetType === "partner" && group.communityType === "provider") ||
                  (targetType === "sponsor" && group.communityType === "sponsor");

                return (
                  <TableRow
                    key={group.id}
                    sx={{
                      backgroundColor:
                        savedId === group.id ? "action.selected" : undefined,
                      transition: "background-color 0.5s",
                    }}
                  >
                    <TableCell>
                      <Typography variant="body2" fontWeight={500}>
                        {group.name}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary" sx={{ fontFamily: "monospace" }}>
                        {group.id}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary" sx={{ fontFamily: "monospace" }}>
                        {group.createdBy}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{group.privacy}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{group.memberCount}</Typography>
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <Chip
                          label={group.groupType}
                          color={TYPE_COLORS[group.groupType] ?? "default"}
                          size="small"
                          sx={{ minWidth: 72 }}
                        />
                        <Select
                          size="small"
                          value={group.groupType}
                          onChange={(e) => onTypeChange(group, e.target.value)}
                          sx={{ minWidth: 110, fontSize: 13 }}
                        >
                          {GROUP_TYPES.map((t) => (
                            <MenuItem key={t} value={t}>
                              {t}
                            </MenuItem>
                          ))}
                        </Select>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={group.communityType ?? "standard"}
                        color={COMMUNITY_TYPE_COLORS[group.communityType] ?? "default"}
                        size="small"
                        variant={group.communityType && group.communityType !== "standard" ? "filled" : "outlined"}
                      />
                    </TableCell>
                    {(targetType === "partner" || targetType === "sponsor") && (
                      <TableCell>
                        <Tooltip
                          title={
                            isAlreadyOfficial
                              ? "Already the official designation for this owner"
                              : targetType === "sponsor"
                              ? "Set as Sponsor Community (calls setProviderCommunity — clears previous)"
                              : "Set as Provider Community (calls setProviderCommunity — clears previous)"
                          }
                        >
                          <span>
                            <Button
                              size="small"
                              variant={isAlreadyOfficial ? "contained" : "outlined"}
                              color={targetType === "sponsor" ? "success" : "primary"}
                              disabled={isAlreadyOfficial}
                              startIcon={<Star size={14} />}
                              onClick={() => onSetOfficial(group)}
                              sx={{ whiteSpace: "nowrap", fontSize: 11 }}
                            >
                              {isAlreadyOfficial ? "Official" : "Set Official"}
                            </Button>
                          </span>
                        </Tooltip>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Paper>
    </Box>
  );
}

// ── Recommendation settings (rollout % + frequency) ───────────────────────────
//
// Controls community_recommendation_config/{rolloutPercent,frequencyDays},
// read live (no redeploy needed) by the communityRecommendationJob Cloud
// Function. Rollout percentage bounds compute/read cost while the feature is
// unproven (deterministic UID hash decides inclusion, so raising it only adds
// users). Frequency controls how often the whole pipeline recomputes — the
// underlying Cloud Scheduler trigger actually still fires every 24h (Cloud
// Scheduler's own interval can't be changed at runtime without a redeploy),
// but the job self-throttles against lastRunAt + frequencyDays, so this
// dropdown is the real control despite the fixed daily tick underneath.

const FREQUENCY_OPTIONS = [
  { value: 1, label: "Daily" },
  { value: 7, label: "Weekly (default)" },
  { value: 14, label: "Every 2 weeks" },
  { value: 30, label: "Monthly" },
];

function RecommendationSettings() {
  const [percent, setPercent] = useState(null); // null = still loading
  const [percentDraft, setPercentDraft] = useState("");
  const [savingPercent, setSavingPercent] = useState(false);
  const [percentSaved, setPercentSaved] = useState(false);
  const [percentError, setPercentError] = useState(null);

  const [frequencyDays, setFrequencyDays] = useState(null);
  const [savingFrequency, setSavingFrequency] = useState(false);
  const [frequencySaved, setFrequencySaved] = useState(false);

  const [lastRunAt, setLastRunAt] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const snap = await rtdb.ref("community_recommendation_config").get();
        const val = snap.exists() ? snap.val() : {};
        const p = typeof val.rolloutPercent === "number" ? val.rolloutPercent : 10;
        const f = typeof val.frequencyDays === "number" ? val.frequencyDays : 7;
        setPercent(p);
        setPercentDraft(String(p));
        setFrequencyDays(f);
        setLastRunAt(typeof val.lastRunAt === "number" ? val.lastRunAt : null);
      } catch (e) {
        console.error("Failed to load community_recommendation_config:", e);
        setPercent(10);
        setPercentDraft("10");
        setFrequencyDays(7);
      }
    })();
  }, []);

  const handleSavePercent = async () => {
    const num = Number(percentDraft);
    if (!Number.isFinite(num) || num < 0 || num > 100) {
      setPercentError("Enter a whole number between 0 and 100.");
      return;
    }
    setPercentError(null);
    setSavingPercent(true);
    try {
      await rtdb.ref("community_recommendation_config/rolloutPercent").set(num);
      setPercent(num);
      setPercentSaved(true);
      setTimeout(() => setPercentSaved(false), 2500);
    } catch (e) {
      console.error("Failed to save rolloutPercent:", e);
      setPercentError("Save failed: " + e.message);
    } finally {
      setSavingPercent(false);
    }
  };

  const handleFrequencyChange = async (num) => {
    setSavingFrequency(true);
    try {
      await rtdb.ref("community_recommendation_config/frequencyDays").set(num);
      setFrequencyDays(num);
      setFrequencySaved(true);
      setTimeout(() => setFrequencySaved(false), 2500);
    } catch (e) {
      console.error("Failed to save frequencyDays:", e);
      alert("Save failed: " + e.message);
    } finally {
      setSavingFrequency(false);
    }
  };

  const percentDirty = percent !== null && percentDraft !== "" && Number(percentDraft) !== percent;
  const nextDueAt =
    lastRunAt !== null && frequencyDays !== null ? lastRunAt + frequencyDays * 24 * 60 * 60 * 1000 : null;

  return (
    <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
      <Typography variant="subtitle1" fontWeight={600}>
        Community Recommendations
      </Typography>

      <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 680, mt: 1 }}>
        <strong>Rollout percentage</strong> — the recommendation job only computes "Recommended"
        communities for this percentage of active users.{" "}
        <strong>This is intentional, not a malfunction</strong> — it caps compute/read cost while
        the feature is new and unvalidated. Each user's inclusion is decided by a deterministic
        hash of their UID, so raising the percentage only adds users, it never drops or reshuffles
        who's already seeing recommendations. Suggested path: 10 → 50 → 100, moving up once the
        run's Cloud Functions logs (<code>communityRecommendationJob</code>) show a low failure
        rate and reasonable candidate counts. Default if unset: 10%.
      </Typography>
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mt: 1, mb: 2 }}>
        {percent === null ? (
          <CircularProgress size={20} />
        ) : (
          <>
            <TextField
              size="small"
              label="Rollout %"
              type="number"
              inputProps={{ min: 0, max: 100, step: 1 }}
              value={percentDraft}
              onChange={(e) => setPercentDraft(e.target.value)}
              sx={{ width: 120 }}
            />
            <Button
              variant="contained"
              size="small"
              disabled={savingPercent || !percentDirty}
              onClick={handleSavePercent}
            >
              {savingPercent ? <CircularProgress size={16} /> : "Save"}
            </Button>
            {percentSaved && (
              <Typography variant="body2" color="success.main">
                Saved
              </Typography>
            )}
            {percentError && (
              <Typography variant="body2" color="error.main">
                {percentError}
              </Typography>
            )}
            <Typography variant="caption" color="text.secondary">
              Currently live: {percent}%
            </Typography>
          </>
        )}
      </Stack>

      <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 680, mt: 1 }}>
        <strong>Recommendation frequency</strong> — how often the whole pipeline recomputes, from
        daily up to monthly. Separate from the 7-day activity window used to decide who's "active"
        each time it runs, which stays fixed regardless of this setting. If community creation
        picks up, switching to Daily refreshes recommendations faster and can help drive more app
        usage. Under the hood the job still checks in every 24 hours, but only does real work once
        this interval has elapsed since the last full run — a change here takes effect within at
        most 24 hours, not instantly.
      </Typography>
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mt: 1 }}>
        {frequencyDays === null ? (
          <CircularProgress size={20} />
        ) : (
          <>
            <Select
              size="small"
              value={frequencyDays}
              onChange={(e) => handleFrequencyChange(e.target.value)}
              disabled={savingFrequency}
              sx={{ minWidth: 170 }}
            >
              {FREQUENCY_OPTIONS.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </Select>
            {savingFrequency && <CircularProgress size={16} />}
            {frequencySaved && (
              <Typography variant="body2" color="success.main">
                Saved
              </Typography>
            )}
            <Typography variant="caption" color="text.secondary">
              {lastRunAt ? `Last full run: ${new Date(lastRunAt).toLocaleString()}` : "Last full run: never"}
              {nextDueAt ? ` · Next due: ${new Date(nextDueAt).toLocaleString()}` : ""}
            </Typography>
          </>
        )}
      </Stack>
    </Paper>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

function Communities() {
  const [tab, setTab] = useState(0); // 0 = Users, 1 = Partners, 2 = Sponsors
  const [allGroups, setAllGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [confirmGroup, setConfirmGroup] = useState(null); // { id, name, groupType, newType }
  const [confirmOfficial, setConfirmOfficial] = useState(null); // { group, targetType }
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState(null);

  const loadGroups = async () => {
    setLoading(true);
    try {
      const snap = await rtdb.ref("feed_groups").get();
      if (!snap.exists()) {
        setAllGroups([]);
        return;
      }
      const raw = snap.val();
      const list = Object.entries(raw).map(([id, val]) => ({
        id,
        name: val.name ?? "(unnamed)",
        groupType: val.groupType ?? val.type ?? "user",
        communityType: val.communityType ?? "standard",
        privacy: val.privacy ?? "—",
        createdBy: val.createdBy ?? val.ownerId ?? "—",
        memberCount: val.memberCount ?? 0,
        ownerOnlyPosts: val.ownerOnlyPosts ?? null,
      }));
      list.sort((a, b) => a.name.localeCompare(b.name));
      setAllGroups(list);
    } catch (e) {
      console.error("Failed to load feed_groups:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGroups();
  }, []);

  const handleTypeChange = (group, newType) => {
    if (newType === group.groupType) return;
    setConfirmGroup({ ...group, newType });
  };

  const handleSetOfficial = (group) => {
    const targetType = tab === 1 ? "partner" : "sponsor";
    setConfirmOfficial({ group, targetType });
  };

  const confirmSaveType = async () => {
    if (!confirmGroup) return;
    setSaving(true);
    try {
      await rtdb.ref(`feed_groups/${confirmGroup.id}/groupType`).set(confirmGroup.newType);
      setAllGroups((prev) =>
        prev.map((g) => (g.id === confirmGroup.id ? { ...g, groupType: confirmGroup.newType } : g))
      );
      setSavedId(confirmGroup.id);
      setTimeout(() => setSavedId(null), 2000);
    } catch (e) {
      console.error("Failed to update groupType:", e);
      alert("Save failed: " + e.message);
    } finally {
      setSaving(false);
      setConfirmGroup(null);
    }
  };

  const confirmSaveOfficial = async () => {
    if (!confirmOfficial) return;
    const { group, targetType } = confirmOfficial;
    setSaving(true);
    try {
      const newCommunityType = targetType === "sponsor" ? "sponsor" : "provider";
      const adminSetOfficialCommunity = functions.httpsCallable("adminSetOfficialCommunity");
      await adminSetOfficialCommunity({
        groupId: group.id,
        ownerUid: group.createdBy,
        communityType: newCommunityType,
      });

      // Update local state: clear previous official for same owner + type, set new
      setAllGroups((prev) =>
        prev.map((g) => {
          if (g.id === group.id) return { ...g, communityType: newCommunityType };
          if (g.createdBy === group.createdBy && g.communityType === newCommunityType) {
            return { ...g, communityType: "standard" };
          }
          return g;
        })
      );
      setSavedId(group.id);
      setTimeout(() => setSavedId(null), 2000);
    } catch (e) {
      console.error("Failed to set official community:", e);
      alert("Save failed: " + (e.message ?? String(e)));
    } finally {
      setSaving(false);
      setConfirmOfficial(null);
    }
  };

  const userGroups = allGroups.filter((g) => g.groupType === "user");
  const partnerGroups = allGroups.filter((g) => g.groupType === "partner");
  const sponsorGroups = allGroups.filter((g) => g.groupType === "sponsor");

  return (
    <React.Fragment>
      <Helmet title="Communities" />

      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={3}>
        <Box>
          <Typography variant="h4" gutterBottom>
            Communities
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage feed communities by type. Use the dropdown to change <code>groupType</code>, or
            use <strong>Set Official</strong> to designate a partner's Provider Community or a
            sponsor's Sponsor Community.
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={loading ? <CircularProgress size={16} /> : <RefreshCw size={16} />}
          onClick={loadGroups}
          disabled={loading}
        >
          Refresh
        </Button>
      </Stack>

      <RecommendationSettings />

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3, borderBottom: 1, borderColor: "divider" }}>
        <Tab label={`Users (${userGroups.length})`} />
        <Tab label={`Partners (${partnerGroups.length})`} />
        <Tab label={`Sponsors (${sponsorGroups.length})`} />
      </Tabs>

      {tab === 0 && (
        <CommunityTable
          targetType="user"
          groups={userGroups}
          loading={loading}
          onTypeChange={handleTypeChange}
          onSetOfficial={handleSetOfficial}
          savedId={savedId}
        />
      )}
      {tab === 1 && (
        <CommunityTable
          targetType="partner"
          groups={partnerGroups}
          loading={loading}
          onTypeChange={handleTypeChange}
          onSetOfficial={handleSetOfficial}
          savedId={savedId}
        />
      )}
      {tab === 2 && (
        <CommunityTable
          targetType="sponsor"
          groups={sponsorGroups}
          loading={loading}
          onTypeChange={handleTypeChange}
          onSetOfficial={handleSetOfficial}
          savedId={savedId}
        />
      )}

      {/* Group type change confirmation */}
      <Dialog open={!!confirmGroup} onClose={() => setConfirmGroup(null)}>
        <DialogTitle>Change Group Type?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Change <strong>{confirmGroup?.name}</strong> from <code>{confirmGroup?.groupType}</code>{" "}
            to <code>{confirmGroup?.newType}</code>?
            <br />
            <br />
            This writes directly to <code>feed_groups/{confirmGroup?.id}/groupType</code> in RTDB.
            Mobile clients will pick up the change on next sync.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmGroup(null)} disabled={saving}>Cancel</Button>
          <Button onClick={confirmSaveType} variant="contained" disabled={saving}>
            {saving ? <CircularProgress size={16} /> : "Confirm"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Set official community confirmation */}
      <Dialog open={!!confirmOfficial} onClose={() => setConfirmOfficial(null)}>
        <DialogTitle>Set Official Community?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Designate <strong>{confirmOfficial?.group?.name}</strong> as the official{" "}
            <strong>{confirmOfficial?.targetType === "sponsor" ? "Sponsor Community" : "Provider Community"}</strong>{" "}
            for owner <code>{confirmOfficial?.group?.createdBy}</code>?
            <br />
            <br />
            Any existing official designation for this owner will be cleared. This writes{" "}
            <code>communityType</code> directly to RTDB and updates the owner index node.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOfficial(null)} disabled={saving}>Cancel</Button>
          <Button onClick={confirmSaveOfficial} variant="contained" color="primary" disabled={saving}>
            {saving ? <CircularProgress size={16} /> : "Set Official"}
          </Button>
        </DialogActions>
      </Dialog>
    </React.Fragment>
  );
}

export default Communities;
