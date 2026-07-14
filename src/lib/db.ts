import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  createdAt?: any;
  lastLogin?: any;
}

/**
 * Saves or updates a user profile in Firestore
 */
export async function saveUserProfile(user: {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}) {
  const userRef = doc(db, "users", user.uid);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    // Create new user profile
    await setDoc(userRef, {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
      createdAt: serverTimestamp(),
      lastLogin: serverTimestamp(),
    });
  } else {
    // Update last login
    await setDoc(
      userRef,
      {
        lastLogin: serverTimestamp(),
        // Potentially update other fields if they changed, e.g., photoURL
        photoURL: user.photoURL || userSnap.data().photoURL,
      },
      { merge: true }
    );
  }
}
