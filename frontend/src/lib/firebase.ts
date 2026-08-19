import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAnalytics, isSupported } from "firebase/analytics";

const firebaseConfig = {
  // advenza-7 — matches backend service account in backend/.env
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyATv5NrcX1vICZJph9IgnQwv9vzX8Os2kQ",
  authDomain: "advenza-7.firebaseapp.com",
  projectId: "advenza-7",
  storageBucket: "advenza-7.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "1058178919887",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:1058178919887:web:c2711df2037e66c36276ba",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-RLQPYWKFHR",
};

// Initialize Firebase only once
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const googleProvider = new GoogleAuthProvider();

// Initialize Analytics safely (only runs in browser environment)
isSupported().then((supported) => {
  if (supported) {
    getAnalytics(app);
  }
});

export { app, auth, db, googleProvider, storage };
