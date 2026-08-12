import firebase from "firebase/app";
import "firebase/auth";
import "firebase/functions";
import { firebaseConfig } from "@/config";

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const functions = firebase.functions();

// The callable SDK defaults to a 70s client-side timeout regardless of how long
// the Cloud Function itself is configured to run — long-running admin operations
// need an explicit timeout matching (or exceeding) their server-side budget, or
// the client aborts with "deadline-exceeded" while the function is still working.
async function callFunction(functionName, data, timeoutMs) {
  try {
    const callable = timeoutMs
      ? functions.httpsCallable(functionName, { timeout: timeoutMs })
      : functions.httpsCallable(functionName);
    const result = await callable(data);
    return result.data;
  } catch (error) {
    console.error(`Function ${functionName} error:`, error);
    throw new Error(error.message || 'Function call failed');
  }
}

export async function listSpots(pageSize, pageToken, filters) {
  return callFunction('listSpots', { pageSize, pageToken, filters });
}

export async function manageSpot(spotId, action, data) {
  return callFunction('manageSpot', { spotId, action, data });
}

export async function listChangeRequests(status, pageSize, pageToken) {
  return callFunction('listChangeRequests', { status, pageSize, pageToken });
}

export async function reviewChangeRequest(requestId, action, reviewNotes, editedData) {
  return callFunction('reviewChangeRequest', { requestId, action, reviewNotes, editedData });
}

export async function moderateImage(spotId, r2Key, action) {
  return callFunction('moderateImage', { spotId, r2Key, action });
}

export async function listComments(spotId, includeDeleted) {
  return callFunction('listComments', { spotId, includeDeleted });
}

export async function moderateComment(commentId, action) {
  return callFunction('moderateComment', { commentId, action });
}

export async function importSpots(spots) {
  return callFunction('importSpots', { spots }, 540000); // matches server timeoutSeconds: 540
}

export async function getSpotDetail(spotId) {
  return callFunction('getSpotDetail', { spotId });
}

export async function deduplicateSpots(spotIds, dryRun) {
  return callFunction('deduplicateSpots', { spotIds, dryRun }, 540000); // matches server timeoutSeconds: 540
}

export async function purgeDeletedSpots(dryRun) {
  return callFunction('purgeDeletedSpots', { dryRun }, 540000); // matches server timeoutSeconds: 540
}

export async function bulkUpdateRegion(region) {
  return callFunction('bulkUpdateRegion', { region });
}

export async function generateSnapshotForSpot(latitude, longitude) {
  return callFunction('generateSnapshotForSpot', { latitude, longitude });
}

export async function bulkGenerateSnapshots() {
  return callFunction('bulkGenerateSnapshots', {}, 90000); // server timeoutSeconds: 60, some margin
}

export async function processSnapshotBatch(spotId) {
  return callFunction('processSnapshotBatch', { spotId }, 90000); // server timeoutSeconds: 60, some margin
}

export async function analyzeR2Storage() {
  return callFunction('analyzeR2Storage', {}, 540000); // matches server timeoutSeconds: 540
}

export async function quickStorageStats() {
  return callFunction('quickStorageStats', {}, 120000); // matches server timeoutSeconds: 120
}
