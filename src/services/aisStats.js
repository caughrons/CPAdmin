import firebase from "firebase/app";
import "firebase/database";
import { firebaseConfig, AIS_INGESTION_URL } from "@/config";

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

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
 * Fetch AIS + GPS vessel stats for one AIS coverage box, for the admin AIS
 * page. Reads live vessels straight from the ingestion service's in-memory
 * store (GET /vessels) — Firestore is no longer in this path — and overlays
 * GPS broadcasters from RTDB user_locations.
 *
 * @param {{north:number,south:number,east:number,west:number}} box
 * Returns:
 *   totalTargets   — unique vessels in the box (AIS + GPS, deduped)
 *   aisOnly        — AIS vessels with no linked CruisaPalooza account
 *   gpsOnly        — GPS broadcasters with no AIS match
 *   both           — vessels with both (linkedUserId set)
 *   lastAisUpdate  — Date of the most recent lastUpdated among AIS vessels
 *   truncated      — true if the box holds more vessels than were returned
 *   vessels        — [{ lat, lng, source: 'ais'|'gps'|'merged' }]
 */
export async function fetchRegionAisStats(box) {
  if (!box) {
    return {
      totalTargets: 0,
      aisOnly: 0,
      gpsOnly: 0,
      both: 0,
      lastAisUpdate: null,
      truncated: false,
      vessels: [],
    };
  }

  const centerLat = (box.north + box.south) / 2;
  const centerLng = (box.east + box.west) / 2;
  const params = new URLSearchParams({
    north: String(box.north),
    south: String(box.south),
    east: String(box.east),
    west: String(box.west),
    lat: String(centerLat),
    lng: String(centerLng),
    limit: "2500",
  });

  const [aisResp, locSnap] = await Promise.all([
    safeGet("GET /vessels", async () => {
      const r = await fetch(
        `${AIS_INGESTION_URL}/vessels?${params.toString()}`
      );
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    }),
    safeGet("user_locations", () => rtdb.ref("user_locations").get()),
  ]);

  const vessels = [];
  let aisOnly = 0;
  let both = 0;
  let lastAisUpdate = null;
  const linkedUserIds = new Set();

  const aisVessels =
    aisResp && Array.isArray(aisResp.vessels) ? aisResp.vessels : [];

  for (const v of aisVessels) {
    const lat = v.latitude;
    const lng = v.longitude;
    if (lat == null || lng == null) continue;

    if (typeof v.lastUpdated === "number") {
      const t = new Date(v.lastUpdated);
      if (!lastAisUpdate || t > lastAisUpdate) lastAisUpdate = t;
    }

    if (v.linkedUserId) {
      linkedUserIds.add(v.linkedUserId);
      both++;
      vessels.push({ lat, lng, source: "merged" });
    } else {
      aisOnly++;
      vessels.push({ lat, lng, source: "ais" });
    }
  }

  // GPS-only: user_locations inside the box, not already matched via AIS.
  let gpsOnly = 0;
  const inBox = (lat, lng) =>
    lat >= box.south && lat <= box.north && lng >= box.west && lng <= box.east;

  if (locSnap && locSnap.exists()) {
    const locs = locSnap.val();
    for (const [uid, loc] of Object.entries(locs)) {
      if (!loc || loc.privacyEnabled === true) continue;
      if (linkedUserIds.has(uid)) continue;
      // Mirror the client's dual-read: prefer the arbitrated `selected` point.
      const sel =
        loc.selected && typeof loc.selected === "object" ? loc.selected : loc;
      const lat = sel.latitude;
      const lng = sel.longitude;
      if (lat == null || lng == null) continue;
      if (!inBox(lat, lng)) continue;
      gpsOnly++;
      vessels.push({ lat, lng, source: "gps" });
    }
  }

  return {
    totalTargets: aisOnly + gpsOnly + both,
    aisOnly,
    gpsOnly,
    both,
    lastAisUpdate,
    truncated: Boolean(aisResp && aisResp.truncated),
    vessels,
  };
}
