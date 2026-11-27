// AIS feed power control. Turning the feed on/off also powers the
// ais-ingestion Cloud Run server up/down, so it costs nothing while off.
// Server side: CruisaPalooza/functions/src/index.ts (adminSetAisFeed,
// adminGetAisServerStatus) + aisServerControl.ts.
import firebase from "firebase/compat/app";
import "firebase/compat/functions";

import { firebaseConfig } from "@/config";

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const functions = firebase.functions();

/** Turn the AIS feed (and its server) on or off. */
export async function setAisFeed(enabled) {
  const { data } = await functions.httpsCallable("adminSetAisFeed")({
    enabled,
  });
  return data;
}

/**
 * Server state: { enabled, alwaysOn, rolling, ready, revision, uri,
 * health: { uptimeSec, connected, messageCount, lastMessageAt,
 * boundingBoxes, vessels, activeRegions } | null, checkedAt }.
 * Health is only fetched when the server is fully up, so polling this
 * never wakes a stopped server.
 */
export async function getAisServerStatus() {
  const { data } = await functions.httpsCallable("adminGetAisServerStatus")();
  return data;
}

/**
 * Turn a status (plus recent vessel counts) into one display phase:
 * off | running_while_off | stopping | server_off_while_on | starting |
 * connecting | populating | live.
 */
export function aisPhase(status, vesselHistory) {
  if (!status) return null;
  const { enabled, alwaysOn, rolling, health } = status;

  if (!enabled) {
    if (rolling) return "stopping";
    if (alwaysOn) return "running_while_off";
    return "off";
  }
  // Feed on but the server isn't set to stay up (e.g. redeployed powered
  // down) and nothing is rolling out: it needs a Start Server click.
  if (!alwaysOn && !rolling) return "server_off_while_on";
  if (rolling || !health) return "starting";
  if (!health.connected) return "connecting";

  // Live once the count has stopped climbing: 3 samples within 2%.
  const recent = vesselHistory.slice(-3);
  const settled =
    recent.length === 3 &&
    recent[0] > 0 &&
    (recent[2] - recent[0]) / recent[0] < 0.02;
  return settled ? "live" : "populating";
}
