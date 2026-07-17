import firebase from "firebase/app";
import "firebase/firestore";
import { firebaseConfig } from "@/config";

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const firestore = firebase.firestore();

// One doc per authored message — draft, live, or previously-live (unpublished).
// This is the history the admin UI lists.
const MESSAGES_REF = firestore.collection("admin_messages");

// Single pointer doc the mobile app watches for the current live message.
// Shape is unchanged from before so the mobile client needs no changes.
const LIVE_POINTER_REF = firestore.collection("app_config").doc("admin_message");

function toMessage(doc) {
  const data = doc.data() ?? {};
  return {
    id: doc.id,
    body: data.body ?? "",
    status: data.status ?? "draft",
    liveVersion: data.liveVersion ?? null,
    liveUntil: data.liveUntil?.toDate() ?? null,
    createdAt: data.createdAt?.toDate() ?? null,
    updatedAt: data.updatedAt?.toDate() ?? null,
    publishedAt: data.publishedAt?.toDate() ?? null,
    unpublishedAt: data.unpublishedAt?.toDate() ?? null,
    createdBy: data.createdBy ?? null,
    updatedBy: data.updatedBy ?? null,
  };
}

export async function listMessages() {
  const snap = await MESSAGES_REF.orderBy("createdAt", "desc").get();
  return snap.docs.map(toMessage);
}

// Always creates a new history entry — drafts are never edited in place.
export async function saveDraft(body, updatedBy) {
  await MESSAGES_REF.add({
    body,
    status: "draft",
    liveVersion: null,
    liveUntil: null,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    createdBy: updatedBy,
    updatedBy,
  });
}

// Supersedes any currently-live message, creates a new live entry, and
// updates the pointer doc the mobile app reads.
export async function publishMessage(body, updatedBy, liveUntilDate) {
  const liveUntil = liveUntilDate
    ? firebase.firestore.Timestamp.fromDate(liveUntilDate)
    : null;

  // Firestore v8 transactions only support get() on document refs, not
  // queries, so find the currently-live doc(s) outside the transaction.
  const currentLiveSnap = await MESSAGES_REF.where("status", "==", "live").get();

  await firestore.runTransaction(async (tx) => {
    const pointerDoc = await tx.get(LIVE_POINTER_REF);

    const nextVersion = (pointerDoc.data()?.liveVersion ?? 0) + 1;
    const now = firebase.firestore.FieldValue.serverTimestamp();

    currentLiveSnap.docs.forEach((doc) => {
      tx.set(
        doc.ref,
        { status: "unpublished", unpublishedAt: now, updatedAt: now },
        { merge: true }
      );
    });

    const newMessageRef = MESSAGES_REF.doc();
    tx.set(newMessageRef, {
      body,
      status: "live",
      liveVersion: nextVersion,
      liveUntil,
      createdAt: now,
      updatedAt: now,
      publishedAt: now,
      createdBy: updatedBy,
      updatedBy,
    });

    tx.set(
      LIVE_POINTER_REF,
      {
        liveBody: body,
        liveVersion: nextVersion,
        liveUntil,
        liveUpdatedAt: now,
        liveUpdatedBy: updatedBy,
      },
      { merge: true }
    );
  });
}

export async function unpublishLive() {
  const now = firebase.firestore.FieldValue.serverTimestamp();
  const currentLiveSnap = await MESSAGES_REF.where("status", "==", "live").get();

  const batch = firestore.batch();
  currentLiveSnap.docs.forEach((doc) => {
    batch.set(
      doc.ref,
      { status: "unpublished", unpublishedAt: now, updatedAt: now },
      { merge: true }
    );
  });
  batch.set(
    LIVE_POINTER_REF,
    { liveBody: null, liveUntil: null, liveUpdatedAt: now },
    { merge: true }
  );
  await batch.commit();
}
