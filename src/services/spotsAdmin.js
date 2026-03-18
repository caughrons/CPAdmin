import firebase from "firebase/app";
import "firebase/auth";
import "firebase/functions";
import { firebaseConfig } from "@/config";

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const functions = firebase.functions();

async function callFunction(functionName, data) {
  try {
    const callable = functions.httpsCallable(functionName);
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
  return callFunction('importSpots', { spots });
}

export async function getSpotDetail(spotId) {
  return callFunction('getSpotDetail', { spotId });
}

export async function deduplicateSpots(spotIds, dryRun) {
  return callFunction('deduplicateSpots', { spotIds, dryRun });
}

export async function purgeDeletedSpots(dryRun) {
  return callFunction('purgeDeletedSpots', { dryRun });
}

export async function bulkUpdateRegion(region) {
  return callFunction('bulkUpdateRegion', { region });
}

export async function migrateSpotSchema(dryRun) {
  return callFunction('migrateSpotSchema', { dryRun });
}

export async function generateSnapshotForSpot(latitude, longitude) {
  return callFunction('generateSnapshotForSpot', { latitude, longitude });
}

export async function bulkGenerateSnapshots() {
  return callFunction('bulkGenerateSnapshots', {});
}

export async function processSnapshotBatch(spotId) {
  return callFunction('processSnapshotBatch', { spotId });
}
