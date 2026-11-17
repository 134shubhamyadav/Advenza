import { type ReactNode } from "react";
import { useNavigate, useLocation } from "@tanstack/react-router";
import { useAuth } from "@/context/AuthContext";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";

/** Routes that do NOT require authentication. */
const PUBLIC_PATHS = new Set(["/", "/login", "/signup"]);

/**
 * RequireAuth — wraps the router outlet and enforces Firebase auth state.
 *
 * Behaviour:
 *  - Auth loading  → renders a full-screen spinner (never flashes protected UI)
 *  - Unauthenticated + protected path → redirects to /login (replace history)
 *  - Authenticated + auth-only path (/login, /signup) → redirects to /dashboard
 *  - Otherwise → renders children normally
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const isPublic = PUBLIC_PATHS.has(pathname);
  const isAuthOnly = pathname === "/login" || pathname === "/signup";
  const hasCachedSession = typeof window !== "undefined" && localStorage.getItem("advenza_auth_session") === "true";
  const isResolvingAuth = loading || (!user && hasCachedSession);

  useEffect(() => {
    if (loading) return; // wait until Firebase resolves auth state
    if (!user && hasCachedSession) return; // wait until Firebase finishes restoring active session

    if (!user && !isPublic) {
      // Unauthenticated user trying to access a protected page
      void navigate({ to: "/login", replace: true });
    } else if (user && isAuthOnly) {
      // Already-authenticated user visiting login/signup
      void navigate({ to: "/dashboard", replace: true });
    }
  }, [user, loading, hasCachedSession, isPublic, isAuthOnly, navigate]);

  // While Firebase is resolving the auth state, show spinner ONLY on protected pages.
  // Public pages (e.g. landing page "/") render instantly without blocking.
  if (isResolvingAuth && !isPublic) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading Advenza…</p>
        </div>
      </div>
    );
  }

  // Unauthenticated on a protected page — redirect is in flight, render nothing.
  if (!user && !isPublic) return null;

  // Authenticated on login/signup — redirect is in flight, render nothing.
  if (user && isAuthOnly) return null;

  return <>{children}</>;
}
