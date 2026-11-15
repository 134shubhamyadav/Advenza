import { auth } from "./firebase";

// In development, VITE_BACKEND_URL should be left unset so all /api/* requests
// go through Vite's dev-server proxy (port 3000 → port 5000).
// In production, set VITE_BACKEND_URL to your deployed API base URL.
const BACKEND = import.meta.env.VITE_BACKEND_URL ?? "";

/**
 * Authenticated fetch — automatically attaches Firebase ID token.
 * Falls back to unauthenticated if no user is logged in.
 */
export const apiFetch = async (
  path: string,
  options: RequestInit & { timeoutMs?: number } = {}
) => {
  const { timeoutMs = 150000, signal, ...fetchOptions } = options;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((fetchOptions.headers as Record<string, string>) || {}),
  };

  const user = auth?.currentUser;
  if (user) {
    try {
      const token = await user.getIdToken();
      headers["Authorization"] = `Bearer ${token}`;
      headers["x-user-id"] = user.uid;
      if (user.email) headers["x-user-email"] = user.email.toLowerCase().trim();
    } catch {
      if (user.uid) headers["x-user-id"] = user.uid;
      if (user.email) headers["x-user-email"] = user.email.toLowerCase().trim();
    }
  } else if (!auth) {
    // If auth is completely missing/mocked, simulate a logged-in dev user
    headers["x-user-id"] = "mock-user-123";
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  // Combine user signal with timeout signal if provided
  const combinedSignal = signal
    ? AbortSignal.any
      ? AbortSignal.any([signal, controller.signal])
      : signal
    : controller.signal;

  let res: Response;
  try {
    res = await fetch(`${BACKEND}${path}`, {
      ...fetchOptions,
      headers,
      signal: combinedSignal,
    });
  } catch (networkErr: any) {
    if (networkErr.name === "AbortError") {
      throw new Error("Request timed out or was cancelled.");
    }
    throw new Error(
      "Cannot reach the Advenza server. Make sure the backend is running on port 5000."
    );
  } finally {
    clearTimeout(timeoutId);
  }

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(errBody.error || errBody.message || `Server error ${res.status}`);
  }

  return res.json();
};

export const BACKEND_URL = BACKEND;
