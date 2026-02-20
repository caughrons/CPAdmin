import firebase from "firebase/app";
import "firebase/firestore";
import "firebase/database";
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

  const [usersSnap, feedsSnap, chatsSnap, newsSnap] =
    await Promise.all([
      safeGet("users", () => rtdb.ref("users").get()),
      safeGet("feeds", () => rtdb.ref("feeds").get()),
      safeGet("chats", () => rtdb.ref("chats").get()),
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

  // Feed posts in last 24h — field is 'timestamp' (or 'createdAt' fallback)
  let feedPosts24h = null;
  if (feedsSnap !== null) {
    feedPosts24h = feedsSnap.exists()
      ? Object.values(feedsSnap.val()).filter((post) =>
          parseToMs(post.timestamp ?? post.createdAt) >= twentyFourHoursAgo
        ).length
      : 0;
  }

  // Chats active in last 24h
  let chats24h = null;
  if (chatsSnap !== null) {
    chats24h = chatsSnap.exists()
      ? Object.values(chatsSnap.val()).filter((chat) =>
          parseToMs(chat.lastMessageAt ?? chat.updatedAt) >= twentyFourHoursAgo
        ).length
      : 0;
  }

  // CruisNews stories last 24h
  const newsStories24h = newsSnap !== null ? newsSnap.size : null;

  console.log("[activityStats]", { totalUsers, activeUsers, feedPosts24h, chats24h, newsStories24h });

  return { totalUsers, activeUsers, feedPosts24h, chats24h, newsStories24h };
}
