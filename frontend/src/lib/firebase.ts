import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAnalytics, isSupported } from "firebase/analytics";

const firebaseConfig = {
<<<<<<< HEAD
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyAZslnjBBrXbMHfssH3w3YwejJxwLyak-Y",
  authDomain: "advenzaa7.firebaseapp.com",
  projectId: "advenzaa7",
  storageBucket: "advenzaa7.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "702798834479",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:702798834479:web:d408d85b6ab5b8e4b88fda",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-WZM1KGKRSH",
=======
  // advenza-7 — matches backend service account in backend/.env
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyATv5NrcX1vICZJph9IgnQwv9vzX8Os2kQ",
  authDomain: "advenza-7.firebaseapp.com",
  projectId: "advenza-7",
  storageBucket: "advenza-7.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "1058178919887",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:1058178919887:web:c2711df2037e66c36276ba",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-RLQPYWKFHR",
>>>>>>> 6cf8129f1b59a8dafea26d19fadc7d6e6c81c6f4
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
