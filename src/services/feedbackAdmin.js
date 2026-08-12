import firebase from "firebase/app";
import "firebase/firestore";
import { firebaseConfig } from "@/config";

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const firestore = firebase.firestore();

/**
 * User feedback (Feedback > Comments tab) submitted within the last `days`
 * days, newest first.
 */
export async function getFeedback({ days = 365, limit = 2000 } = {}) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const snap = await firestore
    .collection("user_feedback")
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
    };
  });
}
