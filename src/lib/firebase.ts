import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// NEXT_PUBLIC_* vars must be referenced statically so Next can inline them.
const firebaseConfig = {
  // placeholder keeps build/prerender working without env; missingConfig() flags it on /login
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "missing-api-key",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const OFFICIAL_AUTHOR_UID = process.env.NEXT_PUBLIC_OFFICIAL_AUTHOR_UID ?? "";

export function missingConfig(): string[] {
  const missing = Object.entries({ ...firebaseConfig, apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY })
    .filter(([, v]) => !v)
    .map(([k]) => `NEXT_PUBLIC_FIREBASE_${k.replace(/([A-Z])/g, "_$1").toUpperCase()}`);
  if (!OFFICIAL_AUTHOR_UID) missing.push("NEXT_PUBLIC_OFFICIAL_AUTHOR_UID");
  return missing;
}

const app: FirebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
