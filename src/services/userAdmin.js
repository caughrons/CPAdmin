import firebase from "firebase/app";
import "firebase/auth";
import { firebaseConfig } from "@/config";

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const PROJECT_ID = firebaseConfig.projectId;
const REGION = "us-central1";

// ── v2 callable helper ───────────────────────────────────────────────────────
// Firebase v8 compat SDK's httpsCallable targets v1 URLs; v2 callable functions
// live at a different endpoint. We call them directly via fetch with the auth token.

function waitForUser() {
  return new Promise((resolve, reject) => {
    const current = firebase.auth().currentUser;
    if (current) { resolve(current); return; }
    const unsub = firebase.auth().onAuthStateChanged((user) => {
      unsub();
      if (user) resolve(user);
      else reject(new Error("Not authenticated"));
    });
  });
}

async function callFunction(name, data) {
  const user = await waitForUser();
  const token = await user.getIdToken();
  const url = `https://${REGION}-${PROJECT_ID}.cloudfunctions.net/${name}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify({ data }),
  });

  const json = await res.json();

  if (!res.ok || json.error) {
    const msg = json.error?.message ?? json.error ?? `HTTP ${res.status}`;
    throw new Error(msg);
  }

  return json.result;
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetch ALL users from Firebase Auth by paging through listUsers.
 * Returns a flat array of user records.
 */
export async function listAllUsers() {
  const allUsers = [];
  let pageToken = undefined;

  do {
    const result = await callFunction("listUsers", { pageSize: 1000, pageToken });
    allUsers.push(...result.users);
    pageToken = result.pageToken ?? undefined;
  } while (pageToken);

  return allUsers;
}

/** Set a user's role (user | sponsor | partner | admin). */
export async function setUserRole(uid, role) {
  await callFunction("manageUser", { uid, action: "setRole", role });
}

/** Disable a user's Firebase Auth account (suspend). */
export async function suspendUser(uid) {
  await callFunction("manageUser", { uid, action: "suspend" });
}

/** Re-enable a suspended user's Firebase Auth account. */
export async function unsuspendUser(uid) {
  await callFunction("manageUser", { uid, action: "unsuspend" });
}

/** Soft-delete: disable Auth + mark deleted in RTDB. */
export async function deleteUser(uid) {
  await callFunction("manageUser", { uid, action: "delete" });
}

/** Restore a soft-deleted user. */
export async function restoreUser(uid) {
  await callFunction("manageUser", { uid, action: "restore" });
}

/** Fetch RTDB profile + activity counts for a single user. */
export async function getUserDetail(uid) {
  return await callFunction("getUserDetail", { uid });
}
