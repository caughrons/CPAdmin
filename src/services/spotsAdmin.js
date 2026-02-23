import firebase from "firebase/app";
import "firebase/auth";
import { firebaseConfig } from "@/config";

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const PROJECT_ID = firebaseConfig.projectId;
const REGION = 'us-central1';

function getFunctionUrl(functionName) {
  return `https://${REGION}-${PROJECT_ID}.cloudfunctions.net/${functionName}`;
}

async function waitForUser() {
  return new Promise((resolve) => {
    const unsubscribe = firebase.auth().onAuthStateChanged((user) => {
      unsubscribe();
      resolve(user);
    });
  });
}

async function callFunction(functionName, data) {
  const user = await waitForUser();
  if (!user) {
    throw new Error('Not authenticated');
  }

  const token = await user.getIdToken();
  const url = getFunctionUrl(functionName);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ data }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `HTTP ${response.status}`);
  }

  const result = await response.json();
  if (result.error) {
    throw new Error(result.error.message || 'Function error');
  }

  return result.result;
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

export async function fixSpotIds() {
  return callFunction('fixSpotIds', {});
}

export async function bulkUpdateRegion(region) {
  return callFunction('bulkUpdateRegion', { region });
}
