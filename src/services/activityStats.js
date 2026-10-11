import firebase from "firebase/compat/app";
import "firebase/compat/firestore";
import "firebase/compat/database";
import { fetchActivityCounts } from "@/services/activityAdmin";
import { firebaseConfig } from "@/config";

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const db = firebase.firestore();
const rtdb = firebase.database();

function parseToMs(val) {
  if (val == null) return 0;
  if (typeof val === "number") return val;
  const parsed = Date.parse(String(val));
  return isNaN(parsed) ? 0 : parsed;
}

async function safeGet(label, fn) {
  try {
    return await fn();
  } catch (e) {
    console.error(`[activityStats] ${label} failed:`, e);
    return null;
  }
}

export async function fetchActivityStats() {
  const now = Date.now();
  const tenMinutesAgo = now - 10 * 60 * 1000;
  const twentyFourHoursAgo = now - 24 * 60 * 60 * 1000;
  const dayAgoTimestamp = firebase.firestore.Timestamp.fromMillis(twentyFourHoursAgo);

  const [usersSnap, activityCounts, newsSnap] =
    await Promise.all([
      safeGet("users", () => rtdb.ref("users").get()),
      // Feed posts and chats can't be read whole by the admin client
      // (database rules); counted server-side instead.
      safeGet("activityCounts", () => fetchActivityCounts()),
      safeGet("cruisnews_stories", () =>
        db.collection("cruisnews_stories")
          .where("createdAt", ">=", dayAgoTimestamp)
          .get()
      ),
    ]);

  // Total users = number of uid keys under /users
  // Active users = users with lastSeen within last 10 min
  let totalUsers = null;
  let activeUsers = null;
  if (usersSnap !== null) {
    const users = usersSnap.exists() ? Object.values(usersSnap.val()) : [];
    totalUsers = users.length;
    activeUsers = users.filter((u) =>
      u && parseToMs(u.lastSeen) >= tenMinutesAgo
    ).length;
  }

  // Feed posts created / chats active in the last 24h (server-side counts)
  const feedPosts24h = activityCounts?.feedPosts24h ?? null;
  const chats24h = activityCounts?.chats24h ?? null;

  // CruisNews stories last 24h
  const newsStories24h = newsSnap !== null ? newsSnap.size : null;

  console.log("[activityStats]", { totalUsers, activeUsers, feedPosts24h, chats24h, newsStories24h });

  return { totalUsers, activeUsers, feedPosts24h, chats24h, newsStories24h };
}
