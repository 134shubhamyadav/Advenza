import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import {
  Sparkles,
  Compass,
  Map as MapIcon,
  Wallet,
  Users,
  ArrowRight,
  Star,
  Plane,
  Menu,
  X,
  Play,
  Globe,
  MessageCircle,
  Check,
} from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  component: Landing,
});

const featuredDestinations = [
  {
    id: "udaipur",
    name: "Udaipur",
    country: "Rajasthan, India",
    image: "https://images.unsplash.com/photo-1695956353120-54ce5e91632b?fm=jpg&q=75&w=1400&auto=format&fit=crop",
    rating: 4.9,
    price: 74000,
    tag: "City of Lakes",
    days: 6,
  },
  {
    id: "varanasi",
    name: "Varanasi",
    country: "Uttar Pradesh, India",
    image: "https://images.unsplash.com/photo-1768123668769-a575ec482e39?fm=jpg&q=75&w=1400&auto=format&fit=crop",
    rating: 4.8,
    price: 60000,
    tag: "Spiritual",
    days: 5,
  },
  {
    id: "ladakh",
    name: "Ladakh",
    country: "Himalayas, India",
    image: "https://images.unsplash.com/photo-1772165075119-a427cb258651?fm=jpg&q=75&w=1400&auto=format&fit=crop",
    rating: 4.9,
    price: 118000,
    tag: "Adventure",
    days: 9,
  },
  {
    id: "jaipur",
    name: "Jaipur",
    country: "Rajasthan, India",
    image: "https://images.unsplash.com/photo-1772533254933-ee692487aba2?fm=jpg&q=75&w=1400&auto=format&fit=crop",
    rating: 4.7,
    price: 54000,
    tag: "Pink City",
    days: 4,
  },
];

const heroVideos = [
  {
    label: "Golden Hour",
    src: "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260702_081127_0992a171-d3c6-4978-8213-0ec5df8b6d63.mp4",
  },
  {
    label: "Still Water",
    src: "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260702_092026_dd05b805-ea0f-40b2-8c52-332b88502592.mp4",
  },
  {
    label: "Deep Woods",
    src: "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260702_081042_df7202bf-bd80-4b2b-bbc6-1f09ba2870e9.mp4",
  },
  {
    label: "Quiet Dawn",
    src: "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260702_080959_4cac5234-3573-464e-a5b7-76b94b8a7d61.mp4",
  },
];

function Landing() {
  const navigate = useNavigate();
  const [heroDestination, setHeroDestination] = useState("");
  const [active, setActive] = useState(0);
  const [transitioning, setTransitioning] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const heroY = useTransform(scrollYProgress, [0, 1], [0, 120]);
  const heroOpacity = useTransform(scrollYProgress, [0, 1], [1, 0.4]);
  const { user } = useAuth();

  const switchTo = (i: number) => {
    if (i === active || transitioning) return;
    setTransitioning(true);
    setActive(i);
    setTimeout(() => setTransitioning(false), 1000);
  };

  useEffect(() => {
    const t = setInterval(() => setActive((a) => (a + 1) % heroVideos.length), 7000);
    return () => clearInterval(t);
  }, []);

  const isDark = active === 2;
  const heroText = isDark ? "text-[#182C41]" : "text-white";

  return (
    <div className="min-h-screen bg-black text-white">
      {/* ================= HERO ================= */}
      <section ref={heroRef} className="relative h-screen w-full overflow-hidden bg-black">
        {/* Video stack */}
        <motion.div style={{ y: heroY, opacity: heroOpacity }} className="absolute inset-0">
          {heroVideos.map((v, i) => (
            <video
              key={v.src}
              src={v.src}
              autoPlay
              muted
              loop
              playsInline
              preload="auto"
              className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-[1400ms] ease-in-out ${i === active ? "opacity-100" : "opacity-0"
                }`}
            />
          ))}
          {/* Cinematic vignette + gradient wash */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/60" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(0,0,0,0.55)_100%)]" />
        </motion.div>

        {/* Content */}
        <div className="relative z-10 flex h-full flex-col px-5 py-5 md:px-10 md:py-7">
          {/* Nav */}
          <nav className="flex items-center justify-between">
            <Link
              to="/"
              className="font-display italic text-2xl text-white text-shadow-hero md:text-3xl"
            >
              Advenza
            </Link>
            <div className="liquid-glass hidden items-center gap-1 rounded-full px-2 py-2 md:flex">
              {["How It Works", "Features", "Destinations", "Pricing"].map((l) =>
                l === "Pricing" ? (
                  <Link
                    key={l}
                    to="/pricing"
                    className="rounded-full px-4 py-1.5 text-sm text-white/85 transition hover:bg-white/10 hover:text-white"
                  >
                    {l}
                  </Link>
                ) : (
                  <a
                    key={l}
                    href={`#${l.toLowerCase().replace(/\s/g, "-")}`}
                    className="rounded-full px-4 py-1.5 text-sm text-white/85 transition hover:bg-white/10 hover:text-white"
                  >
                    {l}
                  </a>
                )
              )}
              {user ? (
                <Link
                  to="/dashboard"
                  className="ml-1 rounded-full bg-white px-4 py-1.5 text-sm font-medium text-black transition hover:bg-white/90"
                >
                  Dashboard
                </Link>
              ) : (
                <Link
                  to="/signup"
                  className="ml-1 rounded-full bg-white px-4 py-1.5 text-sm font-medium text-black transition hover:bg-white/90"
                >
                  Get Started
                </Link>
              )}
            </div>
            <button
              onClick={() => setMenuOpen((o) => !o)}
              className="liquid-glass grid h-11 w-11 place-items-center rounded-full md:hidden"
              aria-label="Toggle menu"
            >
              <span className="relative block h-5 w-5">
                <Menu
                  className={`absolute inset-0 h-5 w-5 text-white transition-all duration-300 ${menuOpen ? "rotate-90 scale-75 opacity-0" : "rotate-0 opacity-100"
                    }`}
                />
                <X
                  className={`absolute inset-0 h-5 w-5 text-white transition-all duration-300 ${menuOpen ? "rotate-0 opacity-100" : "-rotate-90 opacity-0"
                    }`}
                />
              </span>
            </button>
          </nav>

          {/* Hero body */}
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, ease: [0.2, 0.8, 0.2, 1] }}
              className={`liquid-glass inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs transition-colors duration-700 ${heroText}`}
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              12,400 trips planned this month
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, delay: 0.1, ease: [0.2, 0.8, 0.2, 1] }}
              className={`font-display mt-6 max-w-5xl text-5xl leading-[1.02] tracking-tight text-shadow-hero transition-colors duration-700 sm:text-6xl md:text-7xl lg:text-[6rem] ${heroText}`}
            >
              Plan beyond
              <br />
              <span className="italic">the map.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, delay: 0.3 }}
              className={`mt-6 max-w-xl text-base leading-relaxed transition-colors duration-700 sm:text-lg ${isDark ? "text-[#182C41]/80" : "text-white/85"
                }`}
              style={{ fontFamily: "system-ui, sans-serif" }}
            >
              An AI travel companion that designs trips as thoughtfully as you would, real budgets,
              gentle pacing, the quiet corners guidebooks miss.
            </motion.p>

            {/* Destination Search Pill */}
            <motion.form
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, delay: 0.45 }}
              onSubmit={(e) => {
                e.preventDefault();
                const clean = heroDestination.trim();
                if (clean) {
                  navigate({
                    to: "/trips/new",
                    search: { destination: clean },
                  });
                } else {
                  navigate({ to: "/trips/new" });
                }
              }}
              className="liquid-glass mt-8 flex w-full max-w-md items-center gap-1.5 rounded-full p-1.5 shadow-2xl backdrop-blur-xl"
            >
              <input
                type="text"
                value={heroDestination}
                onChange={(e) => setHeroDestination(e.target.value)}
                placeholder="Where to? (e.g. Udaipur, Goa, Ladakh...)"
                className={`flex-1 bg-transparent px-4 py-2 text-sm outline-none placeholder:text-white/60 ${isDark ? "text-[#182C41] placeholder:text-[#182C41]/50" : "text-white"
                  }`}
                style={{ fontFamily: "system-ui, sans-serif" }}
              />
              <button
                type="submit"
                className="whitespace-nowrap rounded-full bg-white px-5 py-2 text-sm font-medium text-black transition hover:bg-white/90 cursor-pointer shadow-sm hover:scale-[1.02] active:scale-95"
              >
                Plan Trip
              </button>
            </motion.form>

            {/* Video switcher */}
            <div className="mt-10 flex flex-wrap items-center justify-center gap-1 md:gap-2">
              {heroVideos.map((v, i) => (
                <button
                  key={v.label}
                  onClick={() => switchTo(i)}
                  className={`border-b-2 px-3 py-1 text-xs uppercase tracking-widest transition-all duration-500 sm:text-sm ${i === active
                      ? `${isDark ? "border-[#182C41] text-[#182C41]" : "border-white text-white"}`
                      : `border-transparent ${isDark ? "text-[#182C41]/50 hover:text-[#182C41]/80" : "text-white/50 hover:text-white/80"}`
                    }`}
                  style={{ fontFamily: "system-ui, sans-serif" }}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>

          {/* Bottom stats */}
          <div
            className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 pb-6 text-center text-xs text-white/70 sm:text-sm relative z-20"
            style={{ fontFamily: "system-ui, sans-serif" }}
          >
            {["120+ Destinations", "12,400+ Travelers", "4.9 Rating", "Human‑crafted AI"].map(
              (s, i) => (
                <span key={s} className="flex items-center gap-4">
                  {s}
                  {i < 3 && <span className="hidden text-white/30 sm:inline">|</span>}
                </span>
              ),
            )}
          </div>
        </div>

        {/* Seamless bottom transition fade from dark hero photo to light/dark page body */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-background via-background/70 to-transparent z-10" />

        {/* Mobile menu overlay */}
        <AnimatePresence>
          {menuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="fixed inset-0 z-50 flex flex-col bg-[#07131e]/98 backdrop-blur-3xl md:hidden overflow-y-auto px-6 py-6"
            >
              {/* Top Header inside overlay */}
              <div className="flex items-center justify-between border-b border-white/10 pb-5">
                <BrandLogo className="text-white [&_span]:text-white" />
                <button
                  onClick={() => setMenuOpen(false)}
                  className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
                  aria-label="Close menu"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Navigation items - cleanly aligned near top */}
              <div className="flex flex-col gap-2.5 pt-6">
                {[
                  { label: "How It Works", href: "#how-it-works", desc: "3 simple steps from spark to boarding pass" },
                  { label: "Features", href: "#features", desc: "Autonomous AI travel agents & risk radar" },
                  { label: "Destinations", href: "#destinations", desc: "Curated places & local hidden gems" },
                  { label: "Pricing", href: "/pricing", isRoute: true, desc: "100% Free Public Preview", badge: "Free" },
                ].map((item, idx) => (
                  <motion.div
                    key={item.label}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.04 + idx * 0.03, duration: 0.25 }}
                  >
                    {item.isRoute ? (
                      <Link
                        to="/pricing"
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center justify-between p-4 rounded-2xl bg-white/5 hover:bg-white/10 text-white transition-colors border border-white/5"
                      >
                        <div>
                          <span className="text-lg font-medium">{item.label}</span>
                          <p className="text-xs text-white/60 mt-0.5">{item.desc}</p>
                        </div>
                        {item.badge && (
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            {item.badge}
                          </span>
                        )}
                      </Link>
                    ) : (
                      <a
                        href={item.href}
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center justify-between p-4 rounded-2xl bg-white/5 hover:bg-white/10 text-white transition-colors border border-white/5"
                      >
                        <div>
                          <span className="text-lg font-medium">{item.label}</span>
                          <p className="text-xs text-white/60 mt-0.5">{item.desc}</p>
                        </div>
                      </a>
                    )}
                  </motion.div>
                ))}
              </div>

              {/* Action buttons at bottom of menu */}
              <div className="mt-8 pt-6 border-t border-white/10 flex flex-col gap-3 pb-8">
                {user ? (
                  <Button asChild size="lg" className="w-full rounded-2xl bg-white text-black hover:bg-white/90">
                    <Link to="/dashboard" onClick={() => setMenuOpen(false)}>
                      Go to Dashboard
                    </Link>
                  </Button>
                ) : (
                  <>
                    <Button asChild size="lg" className="w-full rounded-2xl bg-white text-black hover:bg-white/90 shadow-lg">
                      <Link to="/trips/new" onClick={() => setMenuOpen(false)}>
                        Plan a Trip Now
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                    <Button asChild variant="outline" size="lg" className="w-full rounded-2xl border-white/20 text-white hover:bg-white/10">
                      <Link to="/login" onClick={() => setMenuOpen(false)}>
                        Sign In
                      </Link>
                    </Button>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* ================= REST (light theme) ================= */}
      <div className="relative bg-background text-foreground">
        {/* Aurora blobs */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[900px] overflow-hidden">
          <div className="absolute -left-40 top-40 h-96 w-96 rounded-full bg-primary/20 blur-3xl animate-blob" />
          <div
            className="absolute right-0 top-96 h-[28rem] w-[28rem] rounded-full bg-accent/20 blur-3xl animate-blob"
            style={{ animationDelay: "-6s" }}
          />
        </div>

        {/* Features marquee */}
        <div className="relative overflow-hidden border-y border-border/40 bg-card/40 py-6 backdrop-blur">
          <div className="flex animate-marquee gap-16 whitespace-nowrap text-sm font-medium text-muted-foreground will-change-transform">
            {[...Array(2)].flatMap((_, k) =>
              [
                "Autonomous Travel Network",
                "Decision Engine",
                "What-If Simulator",
                "AI Risk Radar",
                "Travel Intelligence",
                "Smart Packing",
                "Trip Twin",
              ].map((n) => (
                <span
                  key={`${k}-${n}`}
                  className="tracking-widest uppercase opacity-70 hover:opacity-100"
                >
                  {n}
                </span>
              )),
            )}
          </div>
        </div>

        {/* Features */}
        <section id="features" className="relative mx-auto max-w-7xl px-6 py-28">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="max-w-2xl"
          >
            <p className="text-sm font-medium text-accent">Why Advenza</p>
            <h2 className="mt-2 font-display text-5xl md:text-6xl">
              Every detail,
              <br />
              <span className="italic text-primary">quietly considered.</span>
            </h2>
          </motion.div>
          <div className="mt-16 grid gap-5 md:grid-cols-3">
            {[
              {
                icon: Sparkles,
                title: "AI itineraries",
                body: "Multi-day plans that pace your energy, not just fill your calendar.",
              },
              {
                icon: Wallet,
                title: "Real budgets",
                body: "Live cost tracking with alerts before you overspend, not after.",
              },
              {
                icon: Users,
                title: "Group planning",
                body: "Vote on stops, split expenses, keep everyone in the loop.",
              },
              {
                icon: MapIcon,
                title: "AI Risk Radar",
                body: "Real-time safety signals — weather, crowds, transport delays — monitored 24/7.",
              },
              {
                icon: Plane,
                title: "Price watch",
                body: "We track flights and stays and ping you the moment they drop.",
              },
              {
                icon: Compass,
                title: "Local intel",
                body: "The quiet café, the shortcut, the sunset spot, curated, not crowded.",
              },
            ].map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.6, delay: i * 0.06 }}
                className="hover-lift group relative overflow-hidden rounded-3xl border border-border/60 bg-card/70 p-7 backdrop-blur-xl"
              >
                <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-primary/8 blur-2xl transition-opacity group-hover:opacity-80" />
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-lift">
                  <f.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-6 text-xl font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="relative overflow-hidden">
          <div className="gradient-aurora absolute inset-0 opacity-70" />
          {/* Seamless soft top & bottom transitions */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-background to-transparent z-10" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-background to-transparent z-10" />
          <div className="relative mx-auto max-w-7xl px-6 py-28 z-20">
            <div className="grid gap-16 md:grid-cols-[1fr_1.4fr]">
              <div>
                <p className="text-sm font-medium text-accent">How it works</p>
                <h2 className="mt-2 font-display text-5xl md:text-6xl">
                  Three steps from spark to boarding pass.
                </h2>
                <p className="mt-4 max-w-md text-muted-foreground">
                  Tell Advenza what you love. Refine what it drafts. Travel with confidence.
                </p>
                <Button asChild size="lg" className="mt-8 rounded-xl">
                  <Link to="/trips/new">
                    <Play className="mr-2 h-4 w-4" /> Try it in 30s
                  </Link>
                </Button>
              </div>
              <ol className="space-y-5">
                {[
                  {
                    n: "01",
                    t: "Describe the trip",
                    d: "Destination, days, vibe. Or say 'surprise me', we've got taste.",
                  },
                  {
                    n: "02",
                    t: "Refine with AI",
                    d: "Swap a museum for a hike. Move a night. The plan re-optimizes instantly.",
                  },
                  {
                    n: "03",
                    t: "Book and go",
                    d: "One-tap checkout for flights, stays, and reservations that hold.",
                  },
                ].map((s, i) => (
                  <motion.li
                    key={s.n}
                    initial={{ opacity: 0, x: 30 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6, delay: i * 0.1 }}
                    className="hover-lift group relative flex gap-6 rounded-3xl border border-white/40 bg-white/60 p-7 backdrop-blur-xl"
                  >
                    <span className="font-display bg-gradient-to-br from-primary to-accent bg-clip-text text-5xl text-transparent">
                      {s.n}
                    </span>
                    <div>
                      <h3 className="text-xl font-semibold">{s.t}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">{s.d}</p>
                    </div>
                  </motion.li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        {/* Destinations */}
        <section id="destinations" className="mx-auto max-w-7xl px-6 py-28">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-sm font-medium text-accent">Popular right now</p>
              <h2 className="mt-2 font-display text-5xl md:text-6xl">
                Places worth
                <br />
                <span className="italic">the flight.</span>
              </h2>
            </div>
            <Button asChild variant="ghost" className="hidden md:inline-flex">
              <Link to="/dashboard">
                Browse all <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </div>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {featuredDestinations.map((d, i) => (
              <motion.div
                key={d.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.6, delay: i * 0.08 }}
              >
                <Link
                  to="/trips/new"
                  search={{ destination: d.name }}
                  className="group hover-lift block overflow-hidden rounded-3xl border border-border/60 bg-card cursor-pointer"
                >
                  <div className="relative aspect-[4/5] overflow-hidden">
                    <img
                      loading="lazy"
                      src={d.image}
                      alt={d.name}
                      className="h-full w-full object-cover transition-transform duration-[1200ms] group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                    <span className="absolute left-3 top-3 rounded-full bg-white/20 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-md">
                      {d.tag}
                    </span>
                    <div className="absolute bottom-0 left-0 right-0 p-5 text-white">
                      <p className="font-display text-2xl">{d.name}</p>
                      <p className="text-xs opacity-85">
                        {d.country} · {d.days} days
                      </p>
                      <div className="mt-3 flex items-center justify-between text-sm">
                        <span className="flex items-center gap-1">
                          <Star className="h-3.5 w-3.5 fill-warning text-warning" /> {d.rating}
                        </span>
                        <span className="font-semibold">₹{d.price.toLocaleString("en-IN")}</span>
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Testimonials */}
        <section
          id="reviews"
          className="relative overflow-hidden bg-gradient-to-b from-muted/30 to-background"
        >
          <div className="mx-auto max-w-7xl px-6 py-28">
            <p className="text-sm font-medium text-accent">Traveler stories</p>
            <h2 className="mt-2 max-w-3xl font-display text-5xl md:text-6xl">
              The trip planned itself.
              <br />
              <span className="italic text-primary">All I did was pack.</span>
            </h2>
            <div className="mt-14 grid gap-5 md:grid-cols-3">
              {[
                {
                  q: "Advenza saved me a weekend of spreadsheets. The Ladakh plan was better than what my agency in Delhi quoted me for.",
                  n: "Aditi K.",
                  r: "Solo, 10 days · Ladakh",
                  a: "AK",
                },
                {
                  q: "It nailed the pacing, one big thing per day, room to wander. That's exactly how I travel through Kerala.",
                  n: "Rohan M.",
                  r: "Couple, 7 days · Kerala",
                  a: "RM",
                },
                {
                  q: "The group voting solved every argument before it started. We all wanted to go back to the same havelis.",
                  n: "Meera P.",
                  r: "Friends, 5 days · Rajasthan",
                  a: "MP",
                },
              ].map((t, i) => (
                <motion.figure
                  key={t.n}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: i * 0.1 }}
                  className="hover-lift rounded-3xl border border-border/50 bg-card/70 p-7 backdrop-blur-xl"
                >
                  <div className="flex gap-0.5 text-warning">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className="h-3.5 w-3.5 fill-current" />
                    ))}
                  </div>
                  <blockquote className="mt-5 text-[15px] leading-relaxed">"{t.q}"</blockquote>
                  <figcaption className="mt-6 flex items-center gap-3 text-sm">
                    <span className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-primary to-accent text-xs font-semibold text-primary-foreground">
                      {t.a}
                    </span>
                    <span>
                      <span className="block font-semibold">{t.n}</span>
                      <span className="text-xs text-muted-foreground">{t.r}</span>
                    </span>
                  </figcaption>
                </motion.figure>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="mx-auto max-w-7xl px-6 py-28">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-3 border border-primary/20 shadow-sm">
              <Compass className="h-3.5 w-3.5" /> Public Preview — All Features Unlocked
            </div>
            <p className="text-sm font-medium text-accent">Transparent Pricing</p>
            <h2 className="mt-2 font-display text-5xl md:text-6xl">
              Free to start. <span className="italic">Fair to scale.</span>
            </h2>
          </div>
          <div className="mt-14 grid gap-5 md:grid-cols-3">
            {[
              {
                name: "Explorer",
                price: "₹0",
                tag: "Forever free",
                features: [
                  "3 AI trips / month",
                  "Basic itineraries",
                  "Group invite (up to 3)",
                  "Price drop alerts",
                ],
                cta: "Start free",
                variant: "outline" as const,
              },
              {
                name: "Voyager",
                price: "₹499",
                tag: "Most loved",
                features: [
                  "Unlimited AI trips",
                  "Real-time price watch",
                  "Group planning + voting",
                  "AI Risk Radar · 24/7",
                  "Priority support",
                ],
                cta: "Go Voyager",
                variant: "default" as const,
                featured: true,
              },
              {
                name: "Concierge",
                price: "₹1,999",
                tag: "For teams & businesses",
                features: [
                  "Everything in Voyager",
                  "Human travel expert on call",
                  "Corporate billing & GST invoice",
                  "SSO + team admin dashboard",
                  "Dedicated account manager",
                ],
                cta: "Contact sales",
                variant: "outline" as const,
              },
            ].map((p) => (
              <motion.div
                key={p.name}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
                className={`hover-lift relative rounded-3xl border p-8 backdrop-blur-xl ${p.featured
                    ? "border-primary/40 bg-gradient-to-br from-primary/8 to-accent/8 shadow-lift"
                    : "border-border/60 bg-card/70"
                  }`}
              >
                {p.featured && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-[11px] font-medium text-primary-foreground">
                    Most popular
                  </span>
                )}
                <p className="text-sm text-muted-foreground">{p.tag}</p>
                <p className="mt-1 text-xl font-semibold">{p.name}</p>
                <p className="mt-4 font-display text-5xl">
                  {p.price}
                  <span className="text-lg text-muted-foreground">/mo</span>
                </p>
                <ul className="mt-6 space-y-2 text-sm">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-center gap-2">
                      <span className="grid h-4 w-4 place-items-center rounded-full bg-accent/20 text-accent">
                        <Check className="h-2.5 w-2.5" />
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>
                <Button asChild variant={p.variant} className="mt-8 w-full rounded-xl">
                  <Link to="/pricing">{p.cta}</Link>
                </Button>
              </motion.div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="mx-auto max-w-7xl px-6 pb-28">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
            className="gradient-ocean relative overflow-hidden rounded-[2rem] px-8 py-24 text-center text-primary-foreground md:px-16"
          >
            <div className="absolute inset-0 opacity-40 gradient-aurora" />
            <div className="pointer-events-none absolute -left-20 -top-20 h-72 w-72 rounded-full bg-white/10 blur-3xl animate-blob" />
            <div
              className="pointer-events-none absolute -bottom-20 -right-20 h-96 w-96 rounded-full bg-accent/30 blur-3xl animate-blob"
              style={{ animationDelay: "-8s" }}
            />
            <div className="relative">
              <Globe className="mx-auto h-10 w-10 opacity-80" />
              <h2 className="mt-6 font-display text-5xl md:text-7xl">
                Your next trip,
                <br />
                <span className="italic">ready by morning.</span>
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-primary-foreground/85">
                Start a free plan. Cancel with a swipe. Travel with intention.
              </p>
              <div className="mt-10 flex flex-wrap justify-center gap-3">
                <Button asChild size="lg" variant="secondary" className="rounded-xl">
                  <Link to="/signup">Start planning free</Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="ghost"
                  className="rounded-xl text-primary-foreground hover:bg-white/10"
                >
                  <Link to="/chat">
                    <MessageCircle className="mr-2 h-4 w-4" />
                    Chat with Advenza
                  </Link>
                </Button>
              </div>
            </div>
          </motion.div>
        </section>

        {/* Footer */}
        <footer className="border-t border-border/60 bg-card">
          <div className="mx-auto grid max-w-7xl gap-8 px-6 py-16 md:grid-cols-4">
            <div>
              <BrandLogo />
              <p className="mt-4 max-w-xs text-sm text-muted-foreground">
                Plan beyond the map. Advenza is an AI travel companion for people who care about the
                details.
              </p>
            </div>
            {[
              { h: "Product", l: ["Features", "Pricing", "Mobile app", "Changelog"] },
              { h: "Company", l: ["About", "Careers", "Press", "Contact"] },
              { h: "Legal", l: ["Privacy", "Terms", "Cookies", "Security"] },
            ].map((c) => (
              <div key={c.h}>
                <p className="text-sm font-semibold">{c.h}</p>
                <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                  {c.l.map((i) => (
                    <li key={i}>
                      {i === "Pricing" ? (
                        <Link to="/pricing" className="hover:text-foreground">
                          {i}
                        </Link>
                      ) : (
                        <a href="#" className="hover:text-foreground">
                          {i}
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="border-t border-border/60">
            <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-6 py-6 text-xs text-muted-foreground sm:flex-row">
              <p>© 2026 Advenza Travel Inc.</p>
              <p>Made with care in Bengaluru, Mumbai & Jaipur.</p>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
