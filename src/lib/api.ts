import { auth } from './firebase';

const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

/**
 * Authenticated fetch — automatically attaches Firebase ID token
 * Falls back to unauthenticated if no user is logged in.
 */
export const apiFetch = async (path: string, options: RequestInit = {}) => {
  let headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };

  const user = auth.currentUser;
  if (user) {
    try {
      const token = await user.getIdToken();
      headers['Authorization'] = `Bearer ${token}`;
    } catch {
      // Token refresh failed, continue without auth
    }
  }

  const res = await fetch(`${BACKEND}${path}`, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `API error ${res.status}`);
  }
  return res.json();
};

export const BACKEND_URL = BACKEND;
