import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAnalytics, isSupported } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyABP7ji7jJry_c9NYXsBfAwOEjt7qxIwqc",
  authDomain: "aventra-2fd33.firebaseapp.com",
  projectId: "aventra-2fd33",
  storageBucket: "aventra-2fd33.firebasestorage.app",
  messagingSenderId: "797689646264",
  appId: "1:797689646264:web:962ccc63e728e63646b84d",
  measurementId: "G-DMJ88QN305",
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
