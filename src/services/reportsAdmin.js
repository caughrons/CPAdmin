import firebase from "firebase/app";
import "firebase/firestore";
import "firebase/functions";
import { firebaseConfig } from "@/config";

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const firestore = firebase.firestore();
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

/**
 * Content reports (User Reporting tab) created within the last `days` days,
 * newest first.
 */
export async function getReports({ days = 365, limit = 2000 } = {}) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const snap = await firestore
    .collection("content_reports")
    .where("createdAt", ">=", since)
    .orderBy("createdAt", "desc")
    .limit(limit)
    .get();

  return snap.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      createdAt: data.createdAt?.toDate?.() ?? null,
      resolvedAt: data.resolvedAt?.toDate?.() ?? null,
    };
  });
}

/**
 * Resolve a report: 'removeContent' | 'removeComment' | 'allow'.
 * Deletes the underlying content/comment (if applicable) and emails the
 * reporter with the disposition.
 */
export async function resolveReport(reportId, action) {
  return callFunction("resolveReport", { reportId, action });
}
