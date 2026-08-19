import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { UserProfile } from "../lib/db";

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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (currentUser: User) => {
    try {
      const userRef = doc(db, "users", currentUser.uid);
      const prefRef = doc(db, "userPreferences", currentUser.uid);

      const [userSnap, prefSnap] = await Promise.all([
        getDoc(userRef),
        getDoc(prefRef),
      ]);

      let profileData: UserProfile = {
        uid: currentUser.uid,
        email: currentUser.email,
        displayName: currentUser.displayName,
        photoURL: currentUser.photoURL,
      };

      if (userSnap.exists()) {
        profileData = { ...profileData, ...userSnap.data() };
      }
      if (prefSnap.exists()) {
        profileData = { ...profileData, ...prefSnap.data() };
      }

      setProfile(profileData);
    } catch (err) {
      console.error("Error fetching user profile", err);
      // Fallback
      setProfile({
        uid: currentUser.uid,
        email: currentUser.email,
        displayName: currentUser.displayName,
        photoURL: currentUser.photoURL,
      });
    }
  };

  const refreshProfile = async () => {
    if (auth.currentUser) {
      await fetchProfile(auth.currentUser);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        await fetchProfile(currentUser);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, loading, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
