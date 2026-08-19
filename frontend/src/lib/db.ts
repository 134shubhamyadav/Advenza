import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { updateProfile } from "firebase/auth";
import { db, storage, auth } from "./firebase";

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  homeCity?: string;
  phoneNumber?: string;
  bio?: string;
  currency?: string;
  travelStyles?: string[];
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
      { merge: true },
    );
  }
}

/**
 * Updates an existing user profile in Firestore and syncs with Firebase Auth
 */
export async function updateUserProfile(
  uid: string,
  data: Partial<Omit<UserProfile, "uid" | "email" | "createdAt" | "lastLogin">>
) {
  const userRef = doc(db, "users", uid);
  await setDoc(userRef, data, { merge: true });

  // Sync to Firebase Auth if this is the currently signed-in user
  const currentUser = auth.currentUser;
  if (currentUser && currentUser.uid === uid) {
    const updates: { displayName?: string | null; photoURL?: string | null } = {};
    if (data.displayName !== undefined) updates.displayName = data.displayName;
    if (data.photoURL !== undefined) updates.photoURL = data.photoURL;

    if (Object.keys(updates).length > 0) {
      await updateProfile(currentUser, updates);
    }
  }
}

/**
 * Uploads a profile picture to Firebase Storage and returns its download URL
 */
export async function uploadProfilePicture(uid: string, file: File): Promise<string> {
  const fileRef = ref(storage, `profiles/${uid}/profile_pic`);
  const snapshot = await uploadBytes(fileRef, file);
  return await getDownloadURL(snapshot.ref);
}
