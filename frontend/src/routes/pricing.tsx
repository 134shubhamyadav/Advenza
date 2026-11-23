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
    <div className="min-h-screen bg-background text-foreground flex flex-col selection:bg-primary/20">
      {/* Top Navigation */}
      <header className="border-b border-border/40 backdrop-blur-xl bg-background/80 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <BrandLogo />
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
              <Link to="/login">Sign in</Link>
            </Button>
            <Button asChild size="sm" className="rounded-full shadow-sm">
              <Link to="/trips/new">
                Plan a Trip
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero / Big Funny Announcement */}
      <main className="flex-1 max-w-5xl mx-auto px-6 py-16 md:py-24 text-center">
        {/* Animated Badge */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-6 shadow-sm"
        >
          <Gift className="h-4 w-4 animate-bounce" />
          <span>Surprise! It&apos;s 100% Free Right Now</span>
        </motion.div>

        {/* Humorous Title */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="font-display text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-foreground"
        >
          Wait... you actually wanted to{" "}
          <span className="italic bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            pay us?
          </span>
        </motion.h1>

        {/* Witty Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-6 text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed"
        >
          Our investors told us to build paywalls and monetize. Our engineering team said{" "}
          <strong className="text-foreground font-semibold">&ldquo;Let people travel first!&rdquo;</strong>
          <br className="hidden sm:inline" />
          So while we work on our subscription system,{" "}
          <span className="text-emerald-600 dark:text-emerald-400 font-semibold underline decoration-emerald-500/40 underline-offset-4">
            everything is completely free
          </span>
          . Enjoy it to the fullest till then!
        </motion.p>

        {/* The "Deal of the Century" Card */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-12 relative rounded-3xl border-2 border-primary/30 bg-gradient-to-b from-card/90 to-card/40 backdrop-blur-2xl p-8 sm:p-12 shadow-2xl overflow-hidden text-left"
        >
          {/* Decorative glowing gradient circle */}
          <div className="absolute -top-32 -right-32 w-72 h-72 bg-primary/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-32 -left-32 w-72 h-72 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-8 border-b border-border/40">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-primary/10 text-primary border border-primary/20">
                  Early Access Explorer Pass
                </span>
                <span className="text-xs text-muted-foreground font-medium">· No Credit Card Required</span>
              </div>
              <h2 className="mt-3 text-2xl sm:text-3xl font-bold text-foreground">
                The &ldquo;Enjoy It While It&apos;s Free&rdquo; Plan
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Full unlimited access to every AI agent, transit simulation, and itinerary feature.
              </p>
            </div>

            <div className="flex flex-col items-start md:items-end shrink-0">
              <div className="flex items-baseline gap-2">
                <span className="text-4xl sm:text-5xl font-extrabold text-foreground font-display">₹0</span>
                <span className="text-muted-foreground text-sm line-through">₹499/mo</span>
              </div>
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mt-1">
                100% Free during Early Beta
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
