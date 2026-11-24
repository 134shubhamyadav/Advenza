import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  Check,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Zap,
  Gift,
  Smile,
  Compass,
  Heart,
  Plane,
  Train,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/brand-logo";

export const Route = createFileRoute("/pricing")({
  component: PricingPage,
});

function PricingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col selection:bg-primary/20 overflow-x-clip">
      {/* Top Navigation */}
      <header className="border-b border-border/40 backdrop-blur-xl bg-background/80 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-2">
          <BrandLogo />
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <Button asChild variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground text-xs sm:text-sm px-2.5 sm:px-3">
              <Link to="/login">Sign in</Link>
            </Button>
            <Button asChild size="sm" className="rounded-full shadow-sm text-xs sm:text-sm px-3 sm:px-4">
              <Link to="/trips/new">
                Plan a Trip
                <ArrowRight className="ml-1 h-3.5 w-3.5 hidden sm:inline" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero / Big Announcement */}
      <main className="flex-1 max-w-5xl mx-auto px-4 sm:px-6 py-12 md:py-20 text-center w-full">
        {/* Sleek Preview Badge */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-primary/20 bg-primary/10 text-primary text-xs font-semibold tracking-wide mb-6 shadow-sm"
        >
          <Compass className="h-3.5 w-3.5" />
          <span>Public Preview — All Features Unlocked</span>
        </motion.div>

        {/* Humorous Title - perfectly sized with no text clipping */}
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="font-display text-3xl sm:text-5xl md:text-6xl font-bold tracking-tight text-foreground leading-[1.15] sm:leading-tight max-w-3xl mx-auto px-2"
        >
          <span className="block">Wait... you actually</span>
          <span className="block mt-1 sm:mt-2">
            wanted to{" "}
            <span className="italic inline-block px-1.5 pb-1 bg-gradient-to-r from-primary via-emerald-500 to-accent bg-clip-text text-transparent">
              pay us?
            </span>
          </span>
        </motion.h1>

        {/* Subtitle with proper mobile spacing */}
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-5 sm:mt-6 text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed px-2"
        >
          Our investors told us to build paywalls and monetize. Our engineering team said{" "}
          <strong className="text-foreground font-semibold">&ldquo;Let people travel first!&rdquo;</strong>{" "}
          So while we build out our future tiers,{" "}
          <span className="text-emerald-600 dark:text-emerald-400 font-semibold underline decoration-emerald-500/40 underline-offset-4">
            every single feature is completely free
          </span>
          . Enjoy exploring to the fullest!
        </motion.p>

        {/* The Card */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-10 sm:mt-12 relative rounded-3xl border border-primary/25 bg-gradient-to-b from-card/95 to-card/50 backdrop-blur-2xl p-5 sm:p-10 shadow-2xl overflow-hidden text-left"
        >
          {/* Subtle glowing gradient backdrop */}
          <div className="absolute -top-32 -right-32 w-64 h-64 bg-primary/15 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute -bottom-32 -left-32 w-64 h-64 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 sm:pb-8 border-b border-border/40">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-3 py-0.5 rounded-full text-xs font-semibold tracking-wider bg-primary/10 text-primary border border-primary/20">
                  Preview Explorer Pass
                </span>
                <span className="text-xs text-muted-foreground font-medium">· No Credit Card Required</span>
              </div>
              <h2 className="mt-3 text-xl sm:text-3xl font-bold text-foreground">
                The &ldquo;Enjoy It While It&apos;s Free&rdquo; Plan
              </h2>
              <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
                Full unlimited access to every AI agent, transit simulation, and itinerary feature.
              </p>
            </div>

            <div className="flex flex-row md:flex-col items-baseline md:items-end justify-between md:justify-start shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-border/30">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl sm:text-5xl font-extrabold text-foreground font-display">₹0</span>
                <span className="text-muted-foreground text-xs sm:text-sm line-through">₹499/mo</span>
              </div>
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5">
                100% Free during Public Preview
              </span>
            </div>
          </div>

          {/* Grid of Unlocked Features */}
          <div className="mt-8 grid sm:grid-cols-2 gap-4">
            {[
              {
                title: "8-Agent Autonomous AI Network",
                desc: "Uncapped, full-speed travel research via Groq Qwen 27B & Nvidia NIM.",
                icon: Sparkles,
              },
              {
                title: "12-Stage Vector Transit Scenes",
                desc: "Flight takeoff/cruise/landing simulations, Vande Bharat, sleeper bus & ferry.",
                icon: Plane,
              },
              {
                title: "Grounded IRCTC & OSRM Math",
                desc: "Authoritative Indian Railways schedules and turn-by-turn driving distances.",
                icon: Train,
              },
              {
                title: "Deterministic ₹0-Drift Budgeting",
                desc: "Mathematical summation with strict ₹0 own-home stay constraints.",
                icon: ShieldCheck,
              },
              {
                title: "Smart Packing & Risk Radar",
                desc: "Context-aware meteorological screening and packing checklists.",
                icon: Compass,
              },
              {
                title: "Collaborative Trip Twin & Voting",
                desc: "Invite your entire crew, vote on activities, and split expenses seamlessly.",
                icon: Heart,
              },
            ].map((f, i) => (
              <div
                key={i}
                className="flex items-start gap-3 p-3.5 rounded-2xl bg-muted/30 border border-border/40 hover:bg-muted/50 transition-colors"
              >
                <div className="h-8 w-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                  <f.icon className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                    {f.title}
                    <Check className="h-3.5 w-3.5 text-emerald-500" />
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Action Row */}
          <div className="mt-10 pt-6 border-t border-border/40 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="h-4 w-4 text-primary shrink-0" />
              <span>Paid subscription tiers coming later this year. Enjoy free access till then!</span>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <Button asChild variant="outline" className="w-full sm:w-auto rounded-xl">
                <Link to="/dashboard">Go to Dashboard</Link>
              </Button>
              <Button asChild className="w-full sm:w-auto rounded-xl shadow-lg shadow-primary/20">
                <Link to="/trips/new">
                  Create a Free Trip Now
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </motion.div>

        {/* Fun FAQ / Humor Accordion */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="mt-16 text-left max-w-3xl mx-auto"
        >
          <h2 className="text-xl font-bold text-center text-foreground mb-6">Frequently Asked Questions</h2>
          <div className="space-y-3">
            {[
              {
                q: "Why is Advenza free right now?",
                a: "Because we genuinely love building great travel software, and we want you to experience full autonomous multi-agent planning without hesitation. We'll introduce premium business features later, but core planning is completely free.",
              },
              {
                q: "Will you ask for my credit card later?",
                a: "No! There are no sneaky trials, surprise charges, or hidden cancellation traps. When paid plans launch, you'll still have a generous free tier.",
              },
              {
                q: "What should I do right now?",
                a: "Create your next weekend trip or vacation, test the flight progress animation, invite your friends, and enjoy planning beyond the map!",
              },
            ].map((item, idx) => (
              <div key={idx} className="p-4 rounded-2xl border border-border/60 bg-card/60">
                <h3 className="font-semibold text-sm text-foreground">{item.q}</h3>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1.5 leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/40 py-8 text-center text-xs text-muted-foreground">
        <p>© {new Date().getFullYear()} Advenza. Plan Beyond the Map. Crafted for adventurous travelers.</p>
      </footer>
    </div>
  );
}
