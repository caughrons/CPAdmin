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
    throw new Error(error.message || "Function call failed");
  }
}

export async function listVoyages() {
  return callFunction("listVoyagesAdmin", {});
}

export async function getVoyageDetail(voyageId) {
  return callFunction("getVoyageDetailAdmin", { voyageId });
}

export async function deleteVoyage(voyageId) {
  return callFunction("manageVoyageAdmin", { voyageId, action: "delete" });
}

export async function reassignVoyage(voyageId, email) {
  return callFunction("manageVoyageAdmin", {
    voyageId,
    action: "reassign",
    data: { email },
  });
}
