import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useAuth } from "../context/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Plus,
  Map,
  MessageCircle,
  Wallet,
  Users,
  CalendarDays,
  User,
  Search,
  Bell,
  Sparkles,
  Radar,
  SlidersHorizontal,
  ShieldAlert,
  Album,
  Backpack,
  Users2,
} from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/commander", label: "Trip Commander", icon: Radar },
  { to: "/simulator", label: "What-If", icon: SlidersHorizontal },
  { to: "/consensus", label: "Consensus", icon: Users2 },
  { to: "/risk", label: "Risk Radar", icon: ShieldAlert },
  { to: "/memory", label: "Memories", icon: Album },
  { to: "/packing", label: "Packing", icon: Backpack },
  { to: "/trips/new", label: "New trip", icon: Plus },
  { to: "/trips/santorini", label: "My trips", icon: Map },
  { to: "/itinerary", label: "Itinerary", icon: CalendarDays },
  { to: "/chat", label: "Aventra AI", icon: MessageCircle },
  { to: "/budget", label: "Budget", icon: Wallet },
  { to: "/group", label: "Group", icon: Users },
  { to: "/profile", label: "Profile", icon: User },
] as const;

// A scenic, low-opacity Indian palette photo drifts behind the aurora — evocative but never noisy.
const BACKDROP_IMG =
  "https://images.unsplash.com/photo-1695956353120-54ce5e91632b?fm=jpg&q=60&w=1800&auto=format&fit=crop";

export function AppShell({ children, title, subtitle, actions }: {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user } = useAuth();
  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      {/* ============ Cinematic backdrop ============ */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        {/* Faint Indian scenic — Udaipur palace on lake */}
        <div
          className="absolute inset-0 bg-cover bg-center opacity-[0.10]"
          style={{ backgroundImage: `url(${BACKDROP_IMG})`, filter: "saturate(1.2)" }}
        />
        {/* Warm saffron → deep-lake gradient wash, drifting */}
        <div className="absolute inset-0 animate-drift bg-[linear-gradient(120deg,oklch(0.92_0.09_75_/_0.55),oklch(0.85_0.06_25_/_0.35),oklch(0.75_0.13_230_/_0.4),oklch(0.7_0.14_165_/_0.35))]" />
        {/* Aurora blobs (Rajasthan sunset + monsoon emerald + royal blue) */}
        <div className="absolute -left-40 top-16 h-[30rem] w-[30rem] rounded-full bg-[oklch(0.78_0.16_55)]/30 blur-3xl animate-blob" />
        <div className="absolute right-0 top-1/3 h-[34rem] w-[34rem] rounded-full bg-[oklch(0.68_0.14_165)]/25 blur-3xl animate-blob" style={{ animationDelay: "-6s" }} />
        <div className="absolute bottom-0 left-1/3 h-[28rem] w-[28rem] rounded-full bg-[oklch(0.55_0.16_265)]/30 blur-3xl animate-blob" style={{ animationDelay: "-10s" }} />
        {/* Fine grain / vignette to marry it all */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,transparent_15%,var(--background)_95%)]" />
        <div className="absolute inset-0 opacity-[0.05] mix-blend-overlay [background-image:radial-gradient(rgba(0,0,0,0.4)_1px,transparent_1px)] [background-size:3px_3px]" />
      </div>

      <div className="mx-auto flex w-full max-w-[1440px]">
        {/* ============ Sidebar ============ */}
        <aside className="glass-panel sticky top-0 hidden h-screen w-64 shrink-0 flex-col rounded-none border-l-0 border-t-0 border-b-0 px-4 py-6 md:flex">
          <BrandLogo />
          <nav className="mt-8 flex flex-1 flex-col gap-1">
            {nav.map((item) => {
              const active =
                item.to === "/dashboard"
                  ? pathname === "/dashboard"
                  : pathname.startsWith(item.to);
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-300",
                    active
                      ? "bg-gradient-to-r from-primary/15 to-accent/10 text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]"
                      : "text-muted-foreground hover:bg-white/40 hover:text-foreground",
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="nav-active"
                      className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-gradient-to-b from-primary to-accent"
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    />
                  )}
                  <Icon
                    className={cn(
                      "h-4.5 w-4.5 shrink-0 transition-transform duration-300 group-hover:scale-110",
                      active && "text-primary",
                    )}
                    strokeWidth={2}
                  />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
          <div className="glass-panel sheen-on-hover mt-4 rounded-2xl p-4">
            <p className="flex items-center gap-1.5 text-xs font-medium text-primary">
              <Sparkles className="h-3.5 w-3.5" /> Aventra Pro
            </p>
            <p className="mt-1 text-sm text-foreground">Unlimited AI trips, offline maps &amp; priority support.</p>
            <Button size="sm" className="mt-3 w-full bg-gradient-to-r from-primary to-accent shadow-lg transition-transform hover:scale-[1.02]">
              Upgrade
            </Button>
          </div>
        </aside>

        {/* ============ Main ============ */}
        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-30 border-b border-white/40 bg-white/40 backdrop-blur-xl">
            <div className="flex h-16 items-center gap-3 px-5 md:px-8">
              <div className="md:hidden"><BrandLogo showWord={false} /></div>
              <div className="relative hidden max-w-md flex-1 md:block">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Search destinations, trips, notes…" className="h-10 rounded-xl border-white/60 bg-white/60 pl-9 backdrop-blur-md transition-all focus-visible:bg-white/90 focus-visible:ring-primary/40" />
              </div>
              <div className="ml-auto flex items-center gap-2">
                <Button variant="ghost" size="icon" className="relative rounded-full hover:bg-white/60">
                  <Bell className="h-4.5 w-4.5" />
                  <span className="absolute right-2 top-2 h-2 w-2 animate-pulse rounded-full bg-accent" />
                </Button>
                <Link to="/profile" className="glass-tile flex items-center gap-2 rounded-full pl-1 pr-3 py-1">
                  <Avatar className="h-8 w-8">
                    {user?.photoURL ? (
                      <img src={user.photoURL} alt={user.displayName || "User"} className="h-full w-full rounded-full object-cover" />
                    ) : (
                      <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-primary-foreground text-xs">
                        {user?.displayName ? user.displayName.substring(0, 2).toUpperCase() : "ME"}
                      </AvatarFallback>
                    )}
                  </Avatar>
                  <span className="hidden text-sm font-medium sm:inline">{user?.displayName?.split(" ")[0] || "Profile"}</span>
                </Link>
              </div>
            </div>
            {(title || actions) && (
              <div className="flex flex-col gap-3 border-t border-white/40 px-5 py-5 md:flex-row md:items-end md:justify-between md:px-8">
                <div>
                  {title && (
                    <motion.h1
                      key={title}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
                      className="font-display text-3xl leading-tight md:text-4xl"
                    >
                      {title}
                    </motion.h1>
                  )}
                  {subtitle && (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.6, delay: 0.15 }}
                      className="mt-1 text-sm text-muted-foreground"
                    >
                      {subtitle}
                    </motion.p>
                  )}
                </div>
                {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
              </div>
            )}
          </header>

          <AnimatePresence mode="wait">
            <motion.main
              key={pathname}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.45, ease: [0.2, 0.8, 0.2, 1] }}
              className="px-5 py-8 md:px-8"
            >
              {children}
            </motion.main>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
