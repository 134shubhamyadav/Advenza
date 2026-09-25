import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { updateProfile } from "firebase/auth";
import { db, storage, auth } from "./firebase";
import { apiFetch } from "./api";

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

const LOCAL_STORAGE_KEY_PREFIX = "advenza_user_profile_";

/**
 * Helper to execute Firestore operations with a hard timeout and safe catch
 */
async function safeFirestoreOperation<T>(promise: Promise<T>, timeoutMs = 1500): Promise<T | null> {
  if (!db || db.type === "mock-db") return null;
  try {
    const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs));
    return await Promise.race([promise, timeout]);
  } catch (err) {
    // Non-blocking Firestore warning
    console.warn("Firestore sync skipped:", (err as any)?.message || err);
    return null;
  }
}

/**
 * Saves or updates a user profile in MongoDB, local storage, and optionally Firestore
 */
export async function saveUserProfile(user: {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}) {
  // 1. Instant local storage cache
  try {
    const existing = localStorage.getItem(`${LOCAL_STORAGE_KEY_PREFIX}${user.uid}`);
    const parsed = existing ? JSON.parse(existing) : {};
    const merged = { ...parsed, ...user, lastLogin: new Date().toISOString() };
    localStorage.setItem(`${LOCAL_STORAGE_KEY_PREFIX}${user.uid}`, JSON.stringify(merged));
  } catch (e) {
    console.warn("Could not cache profile in localStorage:", e);
  }

  // 2. Persist to MongoDB backend API
  try {
    await apiFetch("/api/users/profile", {
      method: "PUT",
      body: JSON.stringify({
        displayName: user.displayName,
        photoURL: user.photoURL,
        email: user.email,
      }),
    });
  } catch (apiErr) {
    console.warn("Backend user profile sync warning:", apiErr);
  }

  // 3. Non-blocking Firestore fallback
  safeFirestoreOperation(
    (async () => {
      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        await setDoc(userRef, {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          createdAt: serverTimestamp(),
          lastLogin: serverTimestamp(),
        });
      } else {
        await setDoc(
          userRef,
          {
            lastLogin: serverTimestamp(),
            photoURL: user.photoURL || userSnap.data()?.photoURL,
          },
          { merge: true }
        );
      }
    })()
  );
}

/**
 * Updates an existing user profile in MongoDB, syncs with Firebase Auth,
 * caches in localStorage, and attempts non-blocking Firestore sync.
 */
export async function updateUserProfile(
  uid: string,
  data: Partial<Omit<UserProfile, "uid" | "email" | "createdAt" | "lastLogin">>
) {
  // 1. Instant local cache update for snappy UX
  try {
    const existing = localStorage.getItem(`${LOCAL_STORAGE_KEY_PREFIX}${uid}`);
    const parsed = existing ? JSON.parse(existing) : {};
    const merged = { ...parsed, ...data };
    localStorage.setItem(`${LOCAL_STORAGE_KEY_PREFIX}${uid}`, JSON.stringify(merged));
  } catch (e) {
    console.warn("Could not update local storage cache:", e);
  }

  // 2. Persist to MongoDB backend (primary source of truth)
  let backendUpdated = false;
  try {
    await apiFetch("/api/users/profile", {
      method: "PUT",
      body: JSON.stringify(data),
      timeoutMs: 10000,
    });
    backendUpdated = true;
  } catch (apiErr) {
    console.warn("MongoDB profile update error:", apiErr);
  }

  // 3. Sync to Firebase Auth if this is the currently signed-in user
  const currentUser = auth?.currentUser;
  if (currentUser && currentUser.uid === uid) {
    const updates: { displayName?: string | null; photoURL?: string | null } = {};
    if (data.displayName !== undefined) updates.displayName = data.displayName;
    if (data.photoURL !== undefined) updates.photoURL = data.photoURL;

    if (Object.keys(updates).length > 0) {
      try {
        await updateProfile(currentUser, updates);
      } catch (authErr) {
        console.warn("Firebase Auth displayName sync warning:", authErr);
      }
    }
  }

  // 4. Non-blocking Firestore sync (guarded by timeout so it never hangs)
  void safeFirestoreOperation(
    (async () => {
      const userRef = doc(db, "users", uid);
      await setDoc(userRef, data, { merge: true });
    })(),
    1500
  );

  return { success: true, backendUpdated };
}

/**
 * Uploads a profile picture to Firebase Storage or falls back to data URI/object URL
 */
export async function uploadProfilePicture(uid: string, file: File): Promise<string> {
  // Try Firebase Storage with a strict 6s timeout
  try {
    if (storage && storage.type !== "mock-storage") {
      const fileRef = ref(storage, `profiles/${uid}/profile_pic`);
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Storage upload timeout")), 6000)
      );
      const snapshot = await Promise.race([uploadBytes(fileRef, file), timeoutPromise]);
      return await getDownloadURL((snapshot as any).ref);
    }
  } catch (err) {
    console.warn("Firebase storage upload unavailable, using base64 fallback:", err);
  }

  // Fallback: Read as base64 data URI so user avatar is preserved
  return new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      resolve(reader.result as string);
    };
    reader.readAsDataURL(file);
  });
}
