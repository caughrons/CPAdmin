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

const ROLES = ["user", "sponsor", "partner", "official", "admin"];

const ROLE_COLORS = {
  user: "default",
  sponsor: "info",
  partner: "success",
  official: "warning",
  admin: "error",
};

const ROLE_LABELS = {
  user: "User",
  sponsor: "Sponsor",
  partner: "Partner",
  official: "Official",
  admin: "Admin",
};

// ── Shared table for one community type ──────────────────────────────────────

const EMPTY_FILTERS = {
  name: "",
  role: "",
  owner: "",
  cpid: "",
  privacy: "",
  groupType: "",
};

function CommunityTable({
  targetType,
  groups,
  loading,
  onTypeChange,
  onSetOfficial,
  savedId,
}) {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const setF = (key, value) => setFilters((f) => ({ ...f, [key]: value }));
  const anyFilter = Object.values(filters).some((v) => v !== "");

  const hasActions =
    targetType === "partner" ||
    targetType === "sponsor" ||
    targetType === "official";
  const colCount = 7 + (hasActions ? 1 : 0);

  const privacyOptions = [
    ...new Set(groups.map((g) => g.privacy).filter((p) => p && p !== "—")),
  ].sort();

  const filtered = groups.filter((g) => {
    const owner = `${g.ownerFirstName ?? ""} ${g.ownerLastName ?? ""}`
      .trim()
      .toLowerCase();
    const cpid = (g.ownerCpid ?? "").toLowerCase().replace(/^~/, "");
    if (
      filters.name &&
      !g.name.toLowerCase().includes(filters.name.toLowerCase())
    )
      return false;
    if (filters.role && (g.ownerRole ?? "user") !== filters.role) return false;
    if (filters.owner && !owner.includes(filters.owner.toLowerCase()))
      return false;
    if (
      filters.cpid &&
      !cpid.includes(filters.cpid.toLowerCase().replace(/^~/, ""))
    )
      return false;
    if (filters.privacy && g.privacy !== filters.privacy) return false;
    if (filters.groupType && g.groupType !== filters.groupType) return false;
    return true;
  });

  const filterCellSx = { py: 0.5, verticalAlign: "top" };

  return (
    <Box>
      <Stack direction="row" spacing={2} mb={2} alignItems="center">
        <Typography variant="body2" color="text.secondary">
          {filtered.length} of {groups.length} communities
        </Typography>
        {anyFilter && (
          <Button size="small" onClick={() => setFilters(EMPTY_FILTERS)}>
            Clear filters
          </Button>
        )}
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
                <TableCell>User Role</TableCell>
                <TableCell>Owner</TableCell>
                <TableCell>CP Handle</TableCell>
                <TableCell>Privacy</TableCell>
                <TableCell>Members</TableCell>
                <TableCell>Group Type</TableCell>
                {hasActions && <TableCell>Actions</TableCell>}
              </TableRow>
              <TableRow>
                <TableCell sx={filterCellSx}>
                  <TextField
                    variant="standard"
                    placeholder="Filter name…"
                    value={filters.name}
                    onChange={(e) => setF("name", e.target.value)}
                    fullWidth
                  />
                </TableCell>
                <TableCell sx={filterCellSx}>
                  <Select
                    variant="standard"
                    displayEmpty
                    value={filters.role}
                    onChange={(e) => setF("role", e.target.value)}
                    fullWidth
                    sx={{ fontSize: 13 }}
                  >
                    <MenuItem value="">Any</MenuItem>
                    {ROLES.map((r) => (
                      <MenuItem key={r} value={r}>
                        {ROLE_LABELS[r] ?? r}
                      </MenuItem>
                    ))}
                  </Select>
                </TableCell>
                <TableCell sx={filterCellSx}>
                  <TextField
                    variant="standard"
                    placeholder="Filter owner…"
                    value={filters.owner}
                    onChange={(e) => setF("owner", e.target.value)}
                    fullWidth
                  />
                </TableCell>
                <TableCell sx={filterCellSx}>
                  <TextField
                    variant="standard"
                    placeholder="Filter handle…"
                    value={filters.cpid}
                    onChange={(e) => setF("cpid", e.target.value)}
                    fullWidth
                  />
                </TableCell>
                <TableCell sx={filterCellSx}>
                  <Select
                    variant="standard"
                    displayEmpty
                    value={filters.privacy}
                    onChange={(e) => setF("privacy", e.target.value)}
                    fullWidth
                    sx={{ fontSize: 13 }}
                  >
                    <MenuItem value="">Any</MenuItem>
                    {privacyOptions.map((p) => (
                      <MenuItem key={p} value={p}>
                        {p}
                      </MenuItem>
                    ))}
                  </Select>
                </TableCell>
                <TableCell sx={filterCellSx} />
                <TableCell sx={filterCellSx}>
                  <Select
                    variant="standard"
                    displayEmpty
                    value={filters.groupType}
                    onChange={(e) => setF("groupType", e.target.value)}
                    fullWidth
                    sx={{ fontSize: 13 }}
                  >
                    <MenuItem value="">Any</MenuItem>
                    {GROUP_TYPES.map((t) => (
                      <MenuItem key={t} value={t}>
                        {t}
                      </MenuItem>
                    ))}
                  </Select>
                </TableCell>
                {hasActions && <TableCell sx={filterCellSx} />}
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={colCount}
                    align="center"
                    sx={{ py: 4, color: "text.secondary" }}
                  >
                    No communities found.
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((group) => {
                const isAlreadyOfficial =
                  (targetType === "partner" &&
                    group.communityType === "provider") ||
                  (targetType === "sponsor" &&
                    group.communityType === "sponsor") ||
                  (targetType === "official" &&
                    group.communityType === "cpofficial");

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
                      <Typography
                        variant="caption"
                        color="text.disabled"
                        sx={{ fontFamily: "monospace" }}
                      >
                        {group.id}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={
                          ROLE_LABELS[group.ownerRole] ?? group.ownerRole ?? "—"
                        }
                        color={ROLE_COLORS[group.ownerRole] ?? "default"}
                        size="small"
                        sx={{ fontWeight: 600, minWidth: 70 }}
                      />
                    </TableCell>
                    <TableCell>
                      {group.ownerLastName || group.ownerFirstName ? (
                        <Tooltip title={group.createdBy}>
                          <Typography variant="body2">
                            {[group.ownerLastName, group.ownerFirstName]
                              .filter(Boolean)
                              .join(", ")}
                          </Typography>
                        </Tooltip>
                      ) : (
                        <Tooltip
                          title={`No profile name — UID ${group.createdBy}`}
                        >
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ fontFamily: "monospace" }}
                          >
                            {group.createdBy}
                          </Typography>
                        </Tooltip>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography
                        variant="body2"
                        sx={{ fontFamily: "monospace" }}
                      >
                        {group.ownerCpid || "—"}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{group.privacy}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {group.memberCount}
                      </Typography>
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
                    {(targetType === "partner" ||
                      targetType === "sponsor" ||
                      targetType === "official") && (
                      <TableCell>
                        <Tooltip
                          title={
                            isAlreadyOfficial
                              ? "Already the official designation for this owner"
                              : targetType === "sponsor"
                              ? "Set as Sponsor Community (calls adminSetOfficialCommunity — clears previous)"
                              : targetType === "official"
                              ? "Set as CP Official Community — mandatory broadcast channel: owner-only posts, every user subscribed, cannot be hidden or left (calls adminSetOfficialCommunity — clears previous)"
                              : "Set as Provider Community (calls adminSetOfficialCommunity — clears previous)"
                          }
                        >
                          <span>
                            <Button
                              size="small"
                              variant={
                                isAlreadyOfficial ? "contained" : "outlined"
                              }
                              color={
                                targetType === "sponsor"
                                  ? "success"
                                  : targetType === "official"
                                  ? "warning"
                                  : "primary"
                              }
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
        const p =
          typeof val.rolloutPercent === "number" ? val.rolloutPercent : 10;
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

  const percentDirty =
    percent !== null && percentDraft !== "" && Number(percentDraft) !== percent;
  const nextDueAt =
    lastRunAt !== null && frequencyDays !== null
      ? lastRunAt + frequencyDays * 24 * 60 * 60 * 1000
      : null;

  return (
    <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
      <Typography variant="subtitle1" fontWeight={600}>
        Community Recommendations
      </Typography>

      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ maxWidth: 680, mt: 1 }}
      >
        <strong>Rollout percentage</strong> — the recommendation job only
        computes "Recommended" communities for this percentage of active users.{" "}
        <strong>This is intentional, not a malfunction</strong> — it caps
        compute/read cost while the feature is new and unvalidated. Each user's
        inclusion is decided by a deterministic hash of their UID, so raising
        the percentage only adds users, it never drops or reshuffles who's
        already seeing recommendations. Suggested path: 10 → 50 → 100, moving up
        once the run's Cloud Functions logs (
        <code>communityRecommendationJob</code>) show a low failure rate and
        reasonable candidate counts. Default if unset: 10%.
      </Typography>
      <Stack
        direction="row"
        spacing={2}
        alignItems="center"
        sx={{ mt: 1, mb: 2 }}
      >
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

      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ maxWidth: 680, mt: 1 }}
      >
        <strong>Recommendation frequency</strong> — how often the whole pipeline
        recomputes, from daily up to monthly. Separate from the 7-day activity
        window used to decide who's "active" each time it runs, which stays
        fixed regardless of this setting. If community creation picks up,
        switching to Daily refreshes recommendations faster and can help drive
        more app usage. Under the hood the job still checks in every 24 hours,
        but only does real work once this interval has elapsed since the last
        full run — a change here takes effect within at most 24 hours, not
        instantly.
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
              {lastRunAt
                ? `Last full run: ${new Date(lastRunAt).toLocaleString()}`
                : "Last full run: never"}
              {nextDueAt
                ? ` · Next due: ${new Date(nextDueAt).toLocaleString()}`
                : ""}
            </Typography>
          </>
        )}
      </Stack>
    </Paper>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

function Communities() {
  const [tab, setTab] = useState(0); // 0 = Users, 1 = Partners, 2 = Sponsors, 3 = Official
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

      // Enrich rows: owner role (Auth claims) + name + CP handle, and a real
      // member count per group — all resolved server-side in one call because
      // the admin client can't read most users' claims or group memberships.
      try {
        const ownerUids = [
          ...new Set(
            list.map((g) => g.createdBy).filter((u) => u && u !== "—")
          ),
        ];
        const groupIds = list.map((g) => g.id);
        const enrich = functions.httpsCallable("getCommunitiesEnrichment");
        const { data } = await enrich({ ownerUids, groupIds });
        const owners = data?.owners ?? {};
        const memberCounts = data?.memberCounts ?? {};
        setAllGroups((prev) =>
          prev.map((g) => {
            const o = owners[g.createdBy] ?? {};
            return {
              ...g,
              ownerRole: o.role ?? "user",
              ownerFirstName: o.firstName ?? "",
              ownerLastName: o.lastName ?? "",
              ownerCpid: o.cpid ?? "",
              memberCount: memberCounts[g.id] ?? g.memberCount ?? 0,
            };
          })
        );
      } catch (enrichErr) {
        console.error("getCommunitiesEnrichment failed:", enrichErr);
      }
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
    const targetType =
      tab === 1 ? "partner" : tab === 2 ? "sponsor" : "official";
    setConfirmOfficial({ group, targetType });
  };

  const confirmSaveType = async () => {
    if (!confirmGroup) return;
    setSaving(true);
    try {
      await rtdb
        .ref(`feed_groups/${confirmGroup.id}/groupType`)
        .set(confirmGroup.newType);
      setAllGroups((prev) =>
        prev.map((g) =>
          g.id === confirmGroup.id
            ? { ...g, groupType: confirmGroup.newType }
            : g
        )
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
      const newCommunityType =
        targetType === "sponsor"
          ? "sponsor"
          : targetType === "official"
          ? "cpofficial"
          : "provider";
      const adminSetOfficialCommunity = functions.httpsCallable(
        "adminSetOfficialCommunity"
      );
      await adminSetOfficialCommunity({
        groupId: group.id,
        ownerUid: group.createdBy,
        communityType: newCommunityType,
      });

      // Update local state: the CF stamps a matching groupType on the new
      // designated community and reverts the previous one to a normal
      // public 'user' community.
      const newGroupType =
        newCommunityType === "cpofficial"
          ? "official"
          : newCommunityType === "sponsor"
          ? "sponsor"
          : "partner";
      setAllGroups((prev) =>
        prev.map((g) => {
          if (g.id === group.id) {
            return {
              ...g,
              communityType: newCommunityType,
              groupType: newGroupType,
              ownerOnlyPosts: true,
            };
          }
          if (
            g.createdBy === group.createdBy &&
            g.communityType === newCommunityType
          ) {
            return {
              ...g,
              communityType: "standard",
              groupType: "user",
              ownerOnlyPosts: false,
            };
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
  const officialGroups = allGroups.filter((g) => g.groupType === "official");

  return (
    <React.Fragment>
      <Helmet title="Communities" />

      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        mb={3}
      >
        <Box>
          <Typography variant="h4" gutterBottom>
            Communities
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage feed communities by type. Use the dropdown to change{" "}
            <code>groupType</code>, or use <strong>Set Official</strong> to
            designate a partner's Provider Community, a sponsor's Sponsor
            Community, or the app owner's CP Official Community (a mandatory
            broadcast channel every user receives).
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={
            loading ? <CircularProgress size={16} /> : <RefreshCw size={16} />
          }
          onClick={loadGroups}
          disabled={loading}
        >
          Refresh
        </Button>
      </Stack>

      <RecommendationSettings />

      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        sx={{ mb: 3, borderBottom: 1, borderColor: "divider" }}
      >
        <Tab label={`Users (${userGroups.length})`} />
        <Tab label={`Partners (${partnerGroups.length})`} />
        <Tab label={`Sponsors (${sponsorGroups.length})`} />
        <Tab label={`Official (${officialGroups.length})`} />
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
      {tab === 3 && (
        <CommunityTable
          targetType="official"
          groups={officialGroups}
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
            Change <strong>{confirmGroup?.name}</strong> from{" "}
            <code>{confirmGroup?.groupType}</code> to{" "}
            <code>{confirmGroup?.newType}</code>?
            <br />
            <br />
            This writes directly to{" "}
            <code>feed_groups/{confirmGroup?.id}/groupType</code> in RTDB.
            Mobile clients will pick up the change on next sync.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmGroup(null)} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={confirmSaveType}
            variant="contained"
            disabled={saving}
          >
            {saving ? <CircularProgress size={16} /> : "Confirm"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Set official community confirmation */}
      <Dialog open={!!confirmOfficial} onClose={() => setConfirmOfficial(null)}>
        <DialogTitle>Set Official Community?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Designate <strong>{confirmOfficial?.group?.name}</strong> as the
            official{" "}
            <strong>
              {confirmOfficial?.targetType === "sponsor"
                ? "Sponsor Community"
                : confirmOfficial?.targetType === "official"
                ? "CP Official Community"
                : "Provider Community"}
            </strong>{" "}
            for owner{" "}
            <strong>
              {[
                confirmOfficial?.group?.ownerLastName,
                confirmOfficial?.group?.ownerFirstName,
              ]
                .filter(Boolean)
                .join(", ") || "(no profile name)"}
            </strong>{" "}
            {confirmOfficial?.group?.ownerCpid ? (
              <>({confirmOfficial.group.ownerCpid}) </>
            ) : null}
            <code>{confirmOfficial?.group?.createdBy}</code>?
            <br />
            <br />
            Any existing official designation for this owner will be cleared.
            This writes <code>communityType</code> directly to RTDB and updates
            the owner index node.
            {confirmOfficial?.targetType === "official" && (
              <>
                {" "}
                It also forces <code>groupType=official</code> and{" "}
                <code>ownerOnlyPosts=true</code> — every user then receives this
                community's posts and cannot hide or leave it.
              </>
            )}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOfficial(null)} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={confirmSaveOfficial}
            variant="contained"
            color="primary"
            disabled={saving}
          >
            {saving ? <CircularProgress size={16} /> : "Set Official"}
          </Button>
        </DialogActions>
      </Dialog>
    </React.Fragment>
  );
}

export default Communities;
