// Initializes the Firebase app and App Check once, before anything else.
//
// Imported first in index.jsx so it runs before the ~24 modules that each
// do `if (!firebase.apps.length) firebase.initializeApp(...)` — they then
// see the app already exists and reuse it, App Check included.
//
// App Check lets Firebase reject requests that don't come from this site or
// the mobile app. Until enforcement is switched on in the Firebase console
// it only reports, so this is safe to ship before then — but enforcement
// must NOT be enabled until this is deployed with a real site key, or
// CPAdmin's direct Realtime Database / Firestore access stops working.
//
// The rest of CPAdmin uses the namespaced compat API (firebase/compat/*).
// App Check is set up with the modular API on the same underlying app —
// getApp() returns the app the compat initializeApp() created — because
// classic reCAPTCHA v3 keys are no longer accepted by App Check; it needs
// the reCAPTCHA Enterprise (Google Cloud Fraud Defense) provider.
//
// VITE_RECAPTCHA_ENTERPRISE_SITE_KEY: the score-based reCAPTCHA Enterprise
// key registered for the CPAdmin web app under Firebase console → App Check.
// If unset, App Check is skipped with a console warning.
//
// Local dev: `npm run dev` turns on the App Check debug provider; the browser
// console prints a debug token once — register it under App Check → Manage
// debug tokens.

import firebase from "firebase/compat/app";
import { getApp } from "firebase/app";
import {
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
} from "firebase/app-check";

import { firebaseConfig } from "@/config";

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const siteKey = import.meta.env.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY;

if (import.meta.env.DEV) {
  // eslint-disable-next-line no-restricted-globals
  self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
}

if (siteKey) {
  try {
    initializeAppCheck(getApp(), {
      provider: new ReCaptchaEnterpriseProvider(siteKey),
      isTokenAutoRefreshEnabled: true,
    });
  } catch (e) {
    console.error("App Check activation failed", e);
  }
} else {
  console.warn(
    "App Check not activated: VITE_RECAPTCHA_ENTERPRISE_SITE_KEY is not set"
  );
}
