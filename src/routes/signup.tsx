import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
const hero = "https://images.unsplash.com/photo-1772165075119-a427cb258651?fm=jpg&q=75&w=1400&auto=format&fit=crop";
import { Check } from "lucide-react";

export const Route = createFileRoute("/signup")({ component: Signup });

const styles = ["Slow & scenic", "Culture", "Foodie", "Adventure", "Beach", "City", "Off-grid", "Family"];

function Signup() {
  const nav = useNavigate();
  const [step, setStep] = useState(1);
  const [picked, setPicked] = useState<string[]>(["Foodie", "Slow & scenic"]);
  const toggle = (s: string) => setPicked((p) => p.includes(s) ? p.filter((x) => x !== s) : [...p, s]);

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="relative hidden lg:block">
        <img src={hero} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/50" />
        <div className="absolute bottom-10 left-10 right-10 text-primary-foreground">
          <p className="font-display text-4xl leading-tight">Your travel personality, in three questions.</p>
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
                <div className="grid gap-3 sm:grid-cols-2">
                  <div><Label className="text-xs">First name</Label><Input className="mt-1.5 h-11 rounded-xl" placeholder="Aditi" /></div>
                  <div><Label className="text-xs">Last name</Label><Input className="mt-1.5 h-11 rounded-xl" placeholder="Kim" /></div>
                </div>
                <div><Label className="text-xs">Email</Label><Input type="email" className="mt-1.5 h-11 rounded-xl" placeholder="you@aventra.travel" /></div>
                <div><Label className="text-xs">Password</Label><Input type="password" className="mt-1.5 h-11 rounded-xl" /></div>
              </div>
            )}
            {step === 2 && (
              <div>
                <h1 className="font-display text-4xl">What kind of trips do you love?</h1>
                <p className="mt-2 text-sm text-muted-foreground">Pick a few — we'll tune Aventra to your taste.</p>
                <div className="mt-6 flex flex-wrap gap-2">
                  {styles.map((s) => {
                    const on = picked.includes(s);
                    return (
                      <button key={s} onClick={() => toggle(s)} type="button"
                        className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm transition ${on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-foreground/30"}`}>
                        {on && <Check className="h-3.5 w-3.5" />}{s}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {step === 3 && (
              <div className="space-y-5">
                <h1 className="font-display text-4xl">One last thing.</h1>
                <p className="text-sm text-muted-foreground">Where are you based? We'll suggest trips from the best departure airport.</p>
                <div><Label className="text-xs">Home city</Label><Input className="mt-1.5 h-11 rounded-xl" placeholder="Bengaluru" /></div>
                <div><Label className="text-xs">Currency</Label><Input className="mt-1.5 h-11 rounded-xl" placeholder="USD" /></div>
              </div>
            )}
          </div>
          <div className="mt-10 flex items-center justify-between">
            <Button variant="ghost" onClick={() => setStep((s) => Math.max(1, s - 1))} disabled={step === 1}>Back</Button>
            {step < 3 ? (
              <Button onClick={() => setStep((s) => s + 1)}>Continue</Button>
            ) : (
              <Button onClick={() => nav({ to: "/dashboard" })}>Finish & explore</Button>
            )}
          </div>
          <p className="mt-6 text-center text-sm text-muted-foreground">
            Have an account? <Link to="/login" className="font-medium text-primary hover:underline">Sign in</Link>
          </p>
        </div>
        <p className="text-xs text-muted-foreground">© 2026 Aventra</p>
      </div>
    </div>
  );
}
