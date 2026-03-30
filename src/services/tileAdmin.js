import firebase from "firebase/app";
import "firebase/auth";
import "firebase/functions";
import { firebaseConfig } from "@/config";

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const functions = firebase.functions();

async function callFunction(functionName, data = {}) {
  try {
    // Add cache-busting timestamp to force fresh data
    const cacheBustingData = {
      ...data,
      _cacheBust: Date.now()
    };
    
    const callable = functions.httpsCallable(functionName, { timeout: 540000 }); // 540 seconds in milliseconds
    const result = await callable(cacheBustingData);
    return result.data;
  } catch (error) {
    console.error(`Function ${functionName} error:`, error);
    throw new Error(error.message || "Function call failed");
  }
}

export async function getAvailableTileRegions() {
  return callFunction("getAvailableRegions", {});
}

export async function getTileRegionManifest(regionId) {
  return callFunction("getRegionManifest", { regionId });
}

export async function generateTilePackage(regionId, includeSubRegions = true) {
  return callFunction("generateTilePackage", { regionId, includeSubRegions });
}

export async function refreshAllTilePackages() {
  return callFunction("refreshAllTiles", {});
}

export async function startProgressiveGeneration(regionId, includeSubRegions = false) {
  return callFunction("startProgressiveGeneration", { regionId, includeSubRegions });
}

export async function getGenerationProgress(sessionId) {
  return callFunction("getGenerationProgress", { sessionId });
}

export async function repairRegionManifest(regionId) {
  return callFunction("repairRegionManifest", { regionId });
}
