import { auth } from "./firebase";

// In development, VITE_BACKEND_URL should be left unset so all /api/* requests
// go through Vite's dev-server proxy (port 3000 → port 5000).
// In production, set VITE_BACKEND_URL to your deployed API base URL.
const BACKEND = import.meta.env.VITE_BACKEND_URL ?? "";

/**
 * Authenticated fetch — automatically attaches Firebase ID token.
 * Falls back to unauthenticated if no user is logged in.
 */
export const apiFetch = async (path: string, options: RequestInit = {}) => {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) || {}),
  };

  const user = auth.currentUser;
  if (user) {
    try {
      const token = await user.getIdToken();
      headers["Authorization"] = `Bearer ${token}`;
    } catch {
      // Token refresh failed — continue without auth header
    }
  }

  let res: Response;
  try {
    res = await fetch(`${BACKEND}${path}`, { ...options, headers });
  } catch (networkErr: any) {
    // Network-level failure (backend not running, DNS error, etc.)
    throw new Error(
      "Cannot reach the Aventra server. Make sure the backend is running on port 5000."
    );
  }

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(errBody.error || `Server error ${res.status}`);
  }

  return res.json();
};

export const BACKEND_URL = BACKEND;
