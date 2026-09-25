import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAnalytics, isSupported } from "firebase/analytics";

const firebaseConfig = {
  // Firebase web API keys are public client identifiers (restricted via Google Cloud Console).
  // Set VITE_FIREBASE_* variables in your .env file — see .env.example for required keys.
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "dummy-api-key-for-local-dev",
  authDomain: "advenzaa7.firebaseapp.com",
  projectId: "advenzaa7",
  storageBucket: "advenzaa7.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

// Initialize Firebase only once
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

let auth: any = null;
let db: any = null;
let storage: any = null;
const googleProvider = new GoogleAuthProvider();

try {
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);
} catch (error) {
  console.warn("Firebase initialization warning (safe to ignore if using mock data):", error);
  // Provide mock implementations to prevent SSR and client crashes
  db = { type: "mock-db" };
  storage = { type: "mock-storage" };
}

// Initialize Analytics safely (only runs in browser environment)
isSupported().then((supported) => {
  if (supported) {
    try {
      getAnalytics(app);
    } catch (e) {}
  }
});

export { app, auth, db, googleProvider, storage };
