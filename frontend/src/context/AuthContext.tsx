import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, onAuthStateChanged } from "firebase/auth";
import { auth } from "../lib/firebase";
import { UserProfile } from "../lib/db";
import { apiFetch } from "../lib/api";

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  refreshProfile: async () => {},
});

const LOCAL_STORAGE_KEY_PREFIX = "advenza_user_profile_";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (currentUser: User) => {
    let profileData: UserProfile = {
      uid: currentUser.uid,
      email: currentUser.email,
      displayName: currentUser.displayName,
      photoURL: currentUser.photoURL,
    };

    // 1. Instant local storage cache check
    try {
      const cached = localStorage.getItem(`${LOCAL_STORAGE_KEY_PREFIX}${currentUser.uid}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        profileData = { ...profileData, ...parsed };
        setProfile({ ...profileData });
      }
    } catch (e) {
      console.warn("Error reading profile from localStorage cache:", e);
    }

    // 2. Fetch authoritative profile from MongoDB backend API
    try {
      const data = await apiFetch("/api/users/profile", { timeoutMs: 5000 });
      if (data?.success && data.profile) {
        profileData = {
          ...profileData,
          ...data.profile,
          displayName: data.profile.displayName || profileData.displayName,
          photoURL: data.profile.photoURL || profileData.photoURL,
          email: data.profile.email || profileData.email,
        };
        setProfile(profileData);
        try {
          localStorage.setItem(`${LOCAL_STORAGE_KEY_PREFIX}${currentUser.uid}`, JSON.stringify(profileData));
        } catch {}
      }
    } catch (err) {
      console.warn("Backend profile fetch warning (using cached/auth state):", (err as any)?.message || err);
      setProfile(profileData);
    }
  };

  const refreshProfile = async () => {
    if (auth && auth.currentUser) {
      await fetchProfile(auth.currentUser);
    }
  };

  useEffect(() => {
    if (!auth) {
      setUser(null);
      setProfile(null);
      setLoading(false);
      return;
    }

    let isSubscribed = true;

    // Use authStateReady if available in Firebase SDK
    if (typeof auth.authStateReady === "function") {
      auth.authStateReady().then(() => {
        if (!isSubscribed) return;
        const current = auth.currentUser;
        setUser(current);
        if (current) {
          setProfile({
            uid: current.uid,
            email: current.email,
            displayName: current.displayName,
            photoURL: current.photoURL,
          });
          try {
            localStorage.setItem("advenza_auth_session", "true");
          } catch {}
          void fetchProfile(current);
        } else {
          setProfile(null);
          try {
            localStorage.removeItem("advenza_auth_session");
          } catch {}
        }
        setLoading(false);
      }).catch(() => {
        if (isSubscribed) setLoading(false);
      });
    }

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (!isSubscribed) return;
      setUser(currentUser);
      if (currentUser) {
        // Set basic profile instantly so UI resolves in milliseconds
        setProfile({
          uid: currentUser.uid,
          email: currentUser.email,
          displayName: currentUser.displayName,
          photoURL: currentUser.photoURL,
        });
        try {
          localStorage.setItem("advenza_auth_session", "true");
        } catch {}
        setLoading(false);
        // Fetch deeper Firestore preferences in background
        void fetchProfile(currentUser);
      } else {
        setProfile(null);
        try {
          localStorage.removeItem("advenza_auth_session");
        } catch {}
        setLoading(false);
      }
    });

    // 6.0s safety fallback timeout (replaces overly aggressive 1.5s timeout)
    const timeout = setTimeout(() => {
      if (isSubscribed) {
        setLoading(false);
      }
    }, 6000);

    return () => {
      isSubscribed = false;
      clearTimeout(timeout);
      unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, loading, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
