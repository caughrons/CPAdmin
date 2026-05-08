import firebase from "firebase/app";
import "firebase/auth";
import "firebase/functions";
import { firebaseConfig } from "@/config";

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const functions = firebase.functions();

async function callShop(name, data) {
  try {
    const result = await functions.httpsCallable(name)(data);
    return result.data;
  } catch (error) {
    console.error(`${name} error:`, error);
    throw new Error(error.message || "Shop function call failed");
  }
}

export async function upsertCategory(data) {
  return callShop("shopUpsertCategory", data);
}

export async function upsertProduct(data) {
  return callShop("shopUpsertProduct", data);
}

export async function archiveProduct(productId) {
  return callShop("shopArchiveProduct", { productId });
}

export async function setFeaturedProduct(productId) {
  return callShop("shopSetFeaturedProduct", { productId });
}

export async function clearFeaturedProduct() {
  return callShop("shopSetFeaturedProduct", { productId: null });
}

export async function rebuildCatalogState() {
  return callShop("shopRebuildCatalogState", {});
}

export async function uploadProductImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64 = reader.result.split(",")[1];
        const result = await callShop("shopUploadProductImage", {
          base64,
          filename: file.name,
        });
        resolve(result.url);
      } catch (e) {
        reject(e);
      }
    };
    reader.onerror = () => reject(new Error("Failed to read file."));
    reader.readAsDataURL(file);
  });
}
