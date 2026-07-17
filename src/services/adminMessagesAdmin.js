import firebase from "firebase/app";
import "firebase/firestore";
import { firebaseConfig } from "@/config";

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const firestore = firebase.firestore();
const DOC_REF = firestore.collection("app_config").doc("admin_message");

export async function getAdminMessageConfig() {
  const doc = await DOC_REF.get();
  const data = doc.data() ?? {};
  return {
    draftBody: data.draftBody ?? "",
    liveBody: data.liveBody ?? null,
    liveVersion: data.liveVersion ?? 0,
    liveUntil: data.liveUntil?.toDate() ?? null,
    liveUpdatedAt: data.liveUpdatedAt?.toDate() ?? null,
    draftUpdatedAt: data.draftUpdatedAt?.toDate() ?? null,
    liveUpdatedBy: data.liveUpdatedBy ?? null,
    draftUpdatedBy: data.draftUpdatedBy ?? null,
  };
}

export async function saveDraft(body, updatedBy) {
  await DOC_REF.set(
    {
      draftBody: body,
      draftUpdatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      draftUpdatedBy: updatedBy,
    },
    { merge: true }
  );
}

// Atomically increments liveVersion and copies draftBody → liveBody.
export async function publishDraft(updatedBy) {
  await firestore.runTransaction(async (tx) => {
    const doc = await tx.get(DOC_REF);
    const data = doc.data() ?? {};
    const nextVersion = (data.liveVersion ?? 0) + 1;
    tx.set(
      DOC_REF,
      {
        liveBody: data.draftBody ?? null,
        liveVersion: nextVersion,
        liveUntil: null,
        liveUpdatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        liveUpdatedBy: updatedBy,
      },
      { merge: true }
    );
  });
}

export async function setLiveUntil(date) {
  await DOC_REF.set(
    { liveUntil: date ? firebase.firestore.Timestamp.fromDate(date) : null },
    { merge: true }
  );
}

export async function unpublish() {
  await DOC_REF.set(
    {
      liveBody: null,
      liveUntil: null,
      liveUpdatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}
