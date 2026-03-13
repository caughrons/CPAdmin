import firebase from "firebase/app";
import "firebase/firestore";
import "firebase/functions";
import { firebaseConfig } from "@/config";

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const firestore = firebase.firestore();
const functions = firebase.functions();

/**
 * Fetch Claude spend data for a specific month
 */
export async function fetchClaudeSpend(year, month) {
  try {
    const docId = `${year}-${month.toString().padStart(2, "0")}-claude_cruisnews`;
    const doc = await firestore.collection("financial_data").doc(docId).get();

    if (!doc.exists) {
      return null;
    }

    return doc.data();
  } catch (error) {
    // If permission denied or other Firestore error, return null
    // This allows the page to fall back to $0 for missing months
    return null;
  }
}

/**
 * Fetch Claude spend data for a range of months
 */
export async function fetchClaudeSpendRange(months = 12) {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setMonth(endDate.getMonth() - months + 1);
  startDate.setDate(1);

  const data = [];
  const current = new Date(startDate);

  while (current <= endDate) {
    const year = current.getFullYear();
    const month = current.getMonth() + 1;
    const monthData = await fetchClaudeSpend(year, month);

    data.push({
      year,
      month,
      totalUsd: monthData?.totalUsd || 0,
      cached: monthData ? true : false,
    });

    current.setMonth(current.getMonth() + 1);
  }

  return data;
}

/**
 * Sync historical Claude spend data (last 12 months)
 */
export async function syncHistoricalClaudeSpend() {
  console.log("🔵 Calling getClaudeSpend Cloud Function...");
  
  const callable = functions.httpsCallable("getClaudeSpend", {
    timeout: 300000, // 5 minutes for backfill
  });

  try {
    const result = await callable({
      backfillMonths: 3,
      forceRefresh: true,
    });

    console.log("✅ Cloud Function response:", result.data);
    return result.data;
  } catch (error) {
    console.error("❌ Cloud Function error:", error);
    throw error;
  }
}

/**
 * Sync current month Claude spend data
 */
export async function syncCurrentMonth() {
  const now = new Date();
  const callable = functions.httpsCallable("getClaudeSpend");

  const result = await callable({
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    forceRefresh: true,
  });

  return result.data;
}

/**
 * Get financial data for any category and time range
 * Generic function for future expansion to other categories
 */
export async function getFinancialData(category, months = 12) {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setMonth(endDate.getMonth() - months + 1);
  startDate.setDate(1);

  const data = [];
  const current = new Date(startDate);

  while (current <= endDate) {
    const year = current.getFullYear();
    const month = current.getMonth() + 1;
    const docId = `${year}-${month.toString().padStart(2, "0")}-${category}`;

    const doc = await firestore.collection("financial_data").doc(docId).get();

    data.push({
      year,
      month,
      totalUsd: doc.exists ? doc.data()?.totalUsd || 0 : 0,
    });

    current.setMonth(current.getMonth() + 1);
  }

  return data;
}
