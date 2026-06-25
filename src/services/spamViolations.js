import firebase from "firebase/app";
import "firebase/firestore";
import { firebaseConfig } from "@/config";

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const firestore = firebase.firestore();

/**
 * Fetch spam violations ordered by most recent first.
 * @param {object} opts
 * @param {number} [opts.limit=200]
 * @param {string} [opts.violationType] - filter to a specific violation type
 * @param {string} [opts.eventType] - filter to a specific event type
 */
export async function getSpamViolations({ limit = 200, violationType, eventType } = {}) {
  let query = firestore
    .collection("spam_violations")
    .orderBy("timestamp", "desc")
    .limit(limit);

  if (violationType) {
    query = query.where("violationType", "==", violationType);
  }
  if (eventType) {
    query = query.where("eventType", "==", eventType);
  }

  const snap = await query.get();
  return snap.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      timestamp: data.timestamp?.toDate?.() ?? null,
    };
  });
}

/**
 * Delete a spam violation document (admin dismiss).
 * @param {string} docId
 */
export async function dismissSpamViolation(docId) {
  await firestore.collection("spam_violations").doc(docId).delete();
}
