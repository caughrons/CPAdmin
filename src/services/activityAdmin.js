// Admin-only callables for activity data the admin client can't read
// directly (database rules block whole /feeds and /chats reads, and chats
// hold private messages). Server side: functions/src/adminActivity.ts.
import firebase from "firebase/compat/app";
import "firebase/compat/functions";

import { firebaseConfig } from "@/config";

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const functions = firebase.functions();

const HOUR_MS = 60 * 60 * 1000;

/** Time ranges offered on the Feed Posts and Chats pages; first is the default. */
export const TIME_RANGES = [
  { key: "24h", label: "Past 24 hours", ms: 24 * HOUR_MS },
  { key: "7d", label: "Past 7 days", ms: 7 * 24 * HOUR_MS },
  { key: "30d", label: "Past 30 days", ms: 30 * 24 * HOUR_MS },
  { key: "90d", label: "Past 90 days", ms: 90 * 24 * HOUR_MS },
];

export async function fetchActivityCounts() {
  const { data } = await functions.httpsCallable("adminActivityCounts")();
  return data;
}

export async function fetchFeedPosts(rangeMs) {
  const { data } = await functions.httpsCallable("adminListFeedPosts")({
    sinceMs: Date.now() - rangeMs,
  });
  return data;
}

export async function fetchChats(rangeMs) {
  const { data } = await functions.httpsCallable("adminListChats")({
    sinceMs: Date.now() - rangeMs,
  });
  return data;
}

/** "~cpid (Name)" — whatever parts exist. */
export function userLabel(u) {
  if (!u) return "—";
  const cpid = u.cpid ? `~${u.cpid}` : null;
  if (cpid && u.name) return `${cpid} (${u.name})`;
  return cpid || u.name || u.uid?.slice(0, 8) || "—";
}

export function formatTime(ms) {
  return ms ? new Date(ms).toLocaleString() : "—";
}
