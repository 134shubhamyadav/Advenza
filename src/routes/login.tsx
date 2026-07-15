import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { signInWithPopup, signInWithEmailAndPassword, getAdditionalUserInfo } from "firebase/auth";
import { auth, googleProvider } from "../lib/firebase";
import { saveUserProfile } from "../lib/db";
import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import hero from "@/assets/hero.jpg";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      setError("");
      const result = await signInWithPopup(auth, googleProvider);
      const details = getAdditionalUserInfo(result);

      await saveUserProfile({
        uid: result.user.uid,
        email: result.user.email,
        displayName: result.user.displayName,
        photoURL: result.user.photoURL,
      });

      if (details?.isNewUser) {
        nav({ to: "/signup" });
      } else {
        nav({ to: "/dashboard" });
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to log in with Google.");
    } finally {
      setLoading(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError("");
      const result = await signInWithEmailAndPassword(auth, email, password);
      // Ensure profile exists in db (signup usually handles creation, but safe to update lastLogin)
      await saveUserProfile({
        uid: result.user.uid,
        email: result.user.email,
        displayName: result.user.displayName,
        photoURL: result.user.photoURL,
      });
      nav({ to: "/dashboard" });
    } catch (err: any) {
      console.error(err);
      setError("Invalid email or password.");
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setEmail("demo@aventra.travel");
    setPassword("demo1234");
    // Just filling the form isn't enough, we actually trigger login
    try {
      setLoading(true);
      setError("");
      // Using a predefined demo account. Note: You must create this account in Firebase console.
      const result = await signInWithEmailAndPassword(auth, "demo@aventra.travel", "demo1234");
      await saveUserProfile({
        uid: result.user.uid,
        email: result.user.email,
        displayName: "Demo User",
        photoURL: null,
      });
      nav({ to: "/dashboard" });
    } catch (err: any) {
      console.error(err);
      setError("Demo account is not set up on this Firebase instance yet.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="flex flex-col justify-between p-8 md:p-12">
        <BrandLogo />
        <div className="mx-auto w-full max-w-sm">
          <h1 className="font-display text-4xl">Welcome back.</h1>
          <p className="mt-2 text-muted-foreground">Sign in to continue planning.</p>

          {error && (
            <div className="mt-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <Button
            variant="outline"
            className="mt-8 h-11 w-full rounded-xl"
            onClick={handleGoogleLogin}
            disabled={loading}
          >
            <GoogleIcon /> Continue with Google
          </Button>

          <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" /> or <div className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={handleEmailLogin} className="space-y-4">
            <div>
              <Label className="text-xs">Email</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@aventra.travel"
                className="mt-1.5 h-11 rounded-xl"
                required
                disabled={loading}
              />
            </div>
            <div>
              <div className="flex justify-between">
                <Label className="text-xs">Password</Label>
                <a href="#" className="text-xs text-primary hover:underline">
                  Forgot?
                </a>
              </div>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1.5 h-11 rounded-xl"
                required
                disabled={loading}
              />
            </div>
            <Button type="submit" className="h-11 w-full rounded-xl" disabled={loading}>
              {loading ? "Signing in..." : "Sign in"}
            </Button>
          </form>

          <div className="mt-6">
            <Button
              variant="secondary"
              className="h-11 w-full rounded-xl border border-border/50"
              onClick={handleDemoLogin}
              disabled={loading}
            >
              Try Demo Account
            </Button>
          </div>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            New to Aventra?{" "}
            <Link to="/signup" className="font-medium text-primary hover:underline">
              Create an account
            </Link>
          </p>
        </div>
        <p className="text-xs text-muted-foreground">© 2026 Aventra</p>
      </div>
      <div className="relative hidden lg:block">
        <img src={hero} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-primary/40 to-transparent" />
        <div className="absolute bottom-10 left-10 right-10 text-primary-foreground">
          <p className="font-display text-4xl leading-tight">
            "The pacing was perfect. It felt planned by a friend, not a machine."
          </p>
          <p className="mt-4 text-sm opacity-80">— Aditi K., Ladakh '25</p>
        </div>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="mr-2 h-4 w-4">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path fill="#FBBC05" d="M5.84 14.1a6.9 6.9 0 010-4.2V7.07H2.18a11 11 0 000 9.86l3.66-2.83z" />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.83C6.71 7.31 9.14 5.38 12 5.38z"
      />
    </svg>
  );
}
