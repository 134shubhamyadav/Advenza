import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { createUserWithEmailAndPassword, updateProfile, signInWithPopup } from "firebase/auth";
import { auth, googleProvider, db } from "../lib/firebase";
import { saveUserProfile } from "../lib/db";
import { doc, setDoc } from "firebase/firestore";
import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
const hero =
  "https://images.unsplash.com/photo-1772165075119-a427cb258651?fm=jpg&q=75&w=1400&auto=format&fit=crop";
import { Check } from "lucide-react";

export const Route = createFileRoute("/signup")({ component: Signup });

const styles = [
  "Slow & scenic",
  "Culture",
  "Foodie",
  "Adventure",
  "Beach",
  "City",
  "Off-grid",
  "Family",
];

function Signup() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [picked, setPicked] = useState<string[]>(["Foodie", "Slow & scenic"]);

  // Automatically skip to step 2 if they are already logged in (e.g. came from login page as new user)
  useEffect(() => {
    if (user && step === 1) {
      setStep(2);
    }
  }, [user, step]);

  // Form State
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [homeCity, setHomeCity] = useState("");
  const [currency, setCurrency] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const toggle = (s: string) =>
    setPicked((p) => (p.includes(s) ? p.filter((x) => x !== s) : [...p, s]));

  const handleGoogleSignup = async () => {
    try {
      setLoading(true);
      setError("");
      const result = await signInWithPopup(auth, googleProvider);

      // Save basic profile now so it exists
      await saveUserProfile({
        uid: result.user.uid,
        email: result.user.email,
        displayName: result.user.displayName,
        photoURL: result.user.photoURL,
      });

      // Advance to preferences
      setStep(2);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to sign up with Google.");
    } finally {
      setLoading(false);
    }
  };

  const handleFinish = async () => {
    try {
      setLoading(true);
      setError("");

      let user = auth.currentUser;

      if (!user) {
        if (!email || !password) {
          setError("Please fill out all required fields.");
          setLoading(false);
          return;
        }
        // 1. Create user in Firebase Auth
        const result = await createUserWithEmailAndPassword(auth, email, password);
        user = result.user;

        // 2. Update display name
        const displayName = `${firstName} ${lastName}`.trim();
        await updateProfile(user, { displayName });

        // 3. Save basic profile to Firestore
        await saveUserProfile({
          uid: user.uid,
          email: user.email,
          displayName: displayName,
          photoURL: null,
        });
      }

      // 4. Save travel preferences
      await setDoc(
        doc(db, "userPreferences", user.uid),
        {
          travelStyles: picked,
          homeCity,
          currency,
        },
        { merge: true },
      );

      nav({ to: "/dashboard" });
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to create account.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="relative hidden lg:block">
        <img src={hero} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/50" />
        <div className="absolute bottom-10 left-10 right-10 text-primary-foreground">
          <p className="font-display text-4xl leading-tight">
            Your travel personality, in three questions.
          </p>
        </div>
      </div>
      <div className="flex flex-col justify-between p-8 md:p-12">
        <div className="flex items-center justify-between">
          <BrandLogo />
          <p className="text-xs text-muted-foreground">Step {step} of 3</p>
        </div>
        <div className="mx-auto w-full max-w-md">
          <Progress value={(step / 3) * 100} className="h-1.5" />
          <div className="mt-8">
            {step === 1 && (
              <div className="space-y-5">
                <h1 className="font-display text-4xl">Create your account.</h1>
                {error && (
                  <div className="mt-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                    {error}
                  </div>
                )}
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label className="text-xs">First name</Label>
                    <Input
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="mt-1.5 h-11 rounded-xl"
                      placeholder="Aditi"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Last name</Label>
                    <Input
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="mt-1.5 h-11 rounded-xl"
                      placeholder="Kim"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Email</Label>
                  <Input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    type="email"
                    className="mt-1.5 h-11 rounded-xl"
                    placeholder="you@aventra.travel"
                  />
                </div>
                <div>
                  <Label className="text-xs">Password</Label>
                  <Input
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    type="password"
                    className="mt-1.5 h-11 rounded-xl"
                    disabled={loading}
                  />
                </div>

                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border/50" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">Or</span>
                  </div>
                </div>

                <Button
                  variant="outline"
                  className="h-11 w-full rounded-xl"
                  onClick={handleGoogleSignup}
                  disabled={loading}
                  type="button"
                >
                  <GoogleIcon /> Continue with Google
                </Button>
              </div>
            )}
            {step === 2 && (
              <div>
                <h1 className="font-display text-4xl">What kind of trips do you love?</h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  Pick a few — we'll tune Aventra to your taste.
                </p>
                <div className="mt-6 flex flex-wrap gap-2">
                  {styles.map((s) => {
                    const on = picked.includes(s);
                    return (
                      <button
                        key={s}
                        onClick={() => toggle(s)}
                        type="button"
                        className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm transition ${on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-foreground/30"}`}
                      >
                        {on && <Check className="h-3.5 w-3.5" />}
                        {s}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {step === 3 && (
              <div className="space-y-5">
                <h1 className="font-display text-4xl">One last thing.</h1>
                <p className="text-sm text-muted-foreground">
                  Where are you based? We'll suggest trips from the best departure airport.
                </p>
                <div>
                  <Label className="text-xs">Home city</Label>
                  <Input
                    value={homeCity}
                    onChange={(e) => setHomeCity(e.target.value)}
                    className="mt-1.5 h-11 rounded-xl"
                    placeholder="Bengaluru"
                  />
                </div>
                <div>
                  <Label className="text-xs">Currency</Label>
                  <Input
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="mt-1.5 h-11 rounded-xl"
                    placeholder="USD"
                  />
                </div>
              </div>
            )}
          </div>
          <div className="mt-10 flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={() => setStep((s) => Math.max(1, s - 1))}
              disabled={step === 1 || loading}
            >
              Back
            </Button>
            {step < 3 ? (
              <Button onClick={() => setStep((s) => s + 1)}>Continue</Button>
            ) : (
              <Button onClick={handleFinish} disabled={loading}>
                {loading ? "Creating account..." : "Finish & explore"}
              </Button>
            )}
          </div>
          <p className="mt-6 text-center text-sm text-muted-foreground">
            Have an account?{" "}
            <Link to="/login" className="font-medium text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </div>
        <p className="text-xs text-muted-foreground">© 2026 Aventra</p>
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
