import firebase from "firebase/app";
import "firebase/firestore";
import "firebase/database";
import { firebaseConfig } from "@/config";

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const db = firebase.firestore();
const rtdb = firebase.database();

async function safeGet(label, fn) {
  try {
    return await fn();
  } catch (e) {
    console.error(`[aisStats] ${label} failed:`, e);
    return null;
  }
}

/**
 * Fetch AIS/GPS vessel stats and positions for the admin AIS page.
 *
 * Returns:
 *   totalTargets   — total unique vessels (AIS + GPS combined, deduplicated)
 *   aisOnly        — vessels with AIS data but no linked GPS user
 *   gpsOnly        — GPS users with no AIS match
 *   both           — vessels with both AIS and GPS (linkedUserId set)
 *   lastAisUpdate  — Date of the most recent lastUpdated in ais_vessels
 *   vessels        — array of { lat, lng, source: 'ais'|'gps'|'merged' }
 */
export async function fetchAisStats() {
  // Fetch all ais_vessels (no bounds filter — global view for admin)
  const [aisSnap, locSnap] = await Promise.all([
    safeGet("ais_vessels", () =>
      db.collection("ais_vessels").get()
    ),
    safeGet("user_locations", () => rtdb.ref("user_locations").get()),
  ]);

  const vessels = [];
  let aisOnly = 0;
  let both = 0;
  let lastAisUpdate = null;

  // Track MMSI/linkedUserId of AIS vessels to detect GPS-only users
  const linkedUserIds = new Set();

  if (aisSnap !== null) {
    for (const doc of aisSnap.docs) {
      const d = doc.data();
      const lat = d.latitude;
      const lng = d.longitude;
      if (lat == null || lng == null) continue;

      // Parse lastUpdated
      let updatedAt = null;
      if (d.lastUpdated) {
        if (typeof d.lastUpdated.toDate === "function") {
          updatedAt = d.lastUpdated.toDate();
        } else if (typeof d.lastUpdated === "number") {
          updatedAt = new Date(d.lastUpdated);
        } else if (typeof d.lastUpdated === "string") {
          updatedAt = new Date(d.lastUpdated);
        }
      }
      if (updatedAt && (!lastAisUpdate || updatedAt > lastAisUpdate)) {
        lastAisUpdate = updatedAt;
      }

      if (d.linkedUserId) {
        // Merged: has both AIS and GPS
        linkedUserIds.add(d.linkedUserId);
        both++;
        vessels.push({ lat, lng, source: "merged" });
      } else {
        // AIS only
        aisOnly++;
        vessels.push({ lat, lng, source: "ais" });
      }
    }
  }

  // GPS-only: users in user_locations that are NOT in linkedUserIds
  let gpsOnly = 0;
  if (locSnap !== null && locSnap.exists()) {
    const locs = locSnap.val();
    for (const [uid, loc] of Object.entries(locs)) {
      if (!loc || loc.privacyEnabled === true) continue;
      if (linkedUserIds.has(uid)) continue; // already counted as merged
      const lat = loc.latitude;
      const lng = loc.longitude;
      if (lat == null || lng == null) continue;
      gpsOnly++;
      vessels.push({ lat, lng, source: "gps" });
    }
  }

  const totalTargets = aisOnly + gpsOnly + both;

  console.log("[aisStats]", { totalTargets, aisOnly, gpsOnly, both, lastAisUpdate, vesselDots: vessels.length, aisSnapDocs: aisSnap?.docs?.length ?? "null" });

  return { totalTargets, aisOnly, gpsOnly, both, lastAisUpdate, vessels };
}
