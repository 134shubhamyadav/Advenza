import { Link, useRouterState } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { useAuth } from "../context/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Plus,
  Map,
  MessageCircle,
  Wallet,
  CalendarDays,
  User,
  Search,
  Bell,
  Sparkles,
  SlidersHorizontal,
  ShieldAlert,
  Backpack,
  Users2,
  Camera,
  Menu,
  X,
} from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface NavItem {
  to: string;
  label: string;
  icon: any;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    title: "Trip Planning",
    items: [
      { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { to: "/trips/new", label: "New trip", icon: Plus },
      { to: "/itinerary", label: "Itinerary", icon: CalendarDays },
      { to: "/budget", label: "Budget", icon: Wallet },
      { to: "/packing", label: "Packing", icon: Backpack },
      { to: "/consensus", label: "Consensus", icon: Users2 },
      { to: "/memory", label: "Scrapbook", icon: Camera },
    ],
  },
  {
    title: "Live Operations",
    items: [
      { to: "/risk", label: "Risk Radar", icon: ShieldAlert },
      { to: "/simulator", label: "Plan B", icon: SlidersHorizontal },
    ],
  },
  {
    title: "Travel Intelligence",
    items: [
      { to: "/chat", label: "Advenza AI", icon: MessageCircle },
    ],
  },
  {
    title: "Account",
    items: [
      { to: "/profile", label: "Profile", icon: User },
    ],
  },
];

// Flat navigation list
const nav: NavItem[] = navSections.flatMap((s) => s.items);

// A scenic, low-opacity Indian palette photo drifts behind the aurora — evocative but never noisy.
const BACKDROP_IMG =
  "https://images.unsplash.com/photo-1695956353120-54ce5e91632b?fm=jpg&q=60&w=1800&auto=format&fit=crop";

export function AppShell({
  children,
  title,
  subtitle,
  actions,
}: {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user, profile } = useAuth();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const DEFAULT_AVATAR = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%239ca3af'><path d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 4c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm0 14c-2.03 0-4.43-.82-6.14-2.88C7.55 15.8 9.68 15 12 15s4.45.8 6.14 2.12C16.43 19.18 14.03 20 12 20z'/></svg>";

  const displayName = profile?.displayName || user?.displayName || user?.email || "User";
  const photoURL = profile?.photoURL || user?.photoURL;
  return (
    <div className="relative h-dvh min-h-dvh w-full overflow-hidden bg-background">
      {/* ============ Cinematic backdrop (hardware accelerated, 60fps locked) ============ */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden [contain:strict] [transform:translateZ(0)]">
        {/* Faint Indian scenic — Udaipur palace on lake */}
        <div
          className="absolute inset-0 bg-cover bg-center opacity-[0.08]"
          style={{ backgroundImage: `url(${BACKDROP_IMG})`, filter: "saturate(1.1)" }}
        />
        {/* Warm saffron → deep-lake subtle gradient wash */}
        <div className="absolute inset-0 bg-[linear-gradient(120deg,oklch(0.92_0.09_75_/_0.35),oklch(0.85_0.06_25_/_0.2),oklch(0.75_0.13_230_/_0.25),oklch(0.7_0.14_165_/_0.2))]" />
        {/* Hardware-accelerated soft aurora ambient glows (static to eliminate GPU lag & freezes) */}
        <div className="absolute -left-40 top-16 h-[26rem] w-[26rem] rounded-full bg-[oklch(0.78_0.16_55)]/15 blur-2xl transform-gpu pointer-events-none" />
        <div
          className="absolute right-0 top-1/3 h-[28rem] w-[28rem] rounded-full bg-[oklch(0.68_0.14_165)]/12 blur-2xl transform-gpu pointer-events-none"
        />
        <div
          className="absolute bottom-0 left-1/3 h-[24rem] w-[24rem] rounded-full bg-[oklch(0.55_0.16_265)]/15 blur-2xl transform-gpu pointer-events-none"
        />
        {/* Fine grain / vignette to marry it all */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,transparent_15%,var(--background)_95%)]" />
        <div className="absolute inset-0 opacity-[0.04] mix-blend-overlay [background-image:radial-gradient(rgba(0,0,0,0.4)_1px,transparent_1px)] [background-size:3px_3px]" />
      </div>

      <div className="mx-auto flex h-full w-full max-w-[1440px] overflow-hidden">
        {/* ============ Sidebar (Fixed / Non-scrolling with main content) ============ */}
        <aside className="glass-panel hidden h-full w-64 shrink-0 flex-col overflow-y-auto rounded-none border-l-0 border-t-0 border-b-0 px-4 py-6 md:flex">
          <BrandLogo />
          <nav className="mt-6 flex flex-1 flex-col gap-4">
            {navSections.map((section) => (
              <div key={section.title} className="space-y-1">
                <p className="px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 select-none">
                  {section.title}
                </p>
                <div className="flex flex-col gap-0.5">
                  {section.items.map((item) => {
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
                          "group relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-all duration-200",
                          active
                            ? "bg-gradient-to-r from-primary/15 to-accent/10 text-primary font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]"
                            : "text-muted-foreground hover:bg-white/40 hover:text-foreground",
                        )}
                      >
                        {active && (
                          <motion.span
                            layoutId="nav-active"
                            className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-gradient-to-b from-primary to-accent"
                            transition={{ type: "spring", stiffness: 400, damping: 30 }}
                          />
                        )}
                        <Icon
                          className={cn(
                            "h-4 w-4 shrink-0 transition-transform duration-200 group-hover:scale-110",
                            active && "text-primary",
                          )}
                          strokeWidth={2}
                        />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
          <div className="glass-panel sheen-on-hover mt-4 rounded-2xl p-4">
            <p className="flex items-center gap-1.5 text-xs font-medium text-primary">
              <Sparkles className="h-3.5 w-3.5" /> Advenza Pro
            </p>
            <p className="mt-1 text-sm text-foreground">
              Unlimited AI trips, offline maps &amp; priority support.
            </p>
            <Button
              size="sm"
              asChild
              className="mt-3 w-full bg-gradient-to-r from-primary to-accent shadow-lg transition-transform hover:scale-[1.02]"
            >
              <Link to="/pricing">Preview Details</Link>
            </Button>
          </div>
        </aside>

        {/* ============ Main (Scrollable independently from fixed sidebar) ============ */}
        <div className="flex h-full min-w-0 flex-1 flex-col overflow-y-auto overscroll-contain [transform:translateZ(0)]">
          <header className="sticky top-0 z-30 border-b border-white/40 bg-white/40 backdrop-blur-xl [contain:paint] [transform:translateZ(0)]">
            <div className="flex h-16 items-center gap-3 px-4 sm:px-6 md:px-8">
              <div className="md:hidden flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setMobileNavOpen(true)}
                  className="rounded-xl h-9 w-9 text-foreground hover:bg-white/60"
                  aria-label="Open menu"
                >
                  <Menu className="h-5 w-5" />
                </Button>
                <BrandLogo showWord={false} />
              </div>
              <div className="relative hidden max-w-md flex-1 md:block">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search destinations, trips, notes…"
                  className="h-10 rounded-xl border-white/60 bg-white/60 pl-9 backdrop-blur-md transition-all focus-visible:bg-white/90 focus-visible:ring-primary/40"
                />
              </div>
              <div className="ml-auto flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="relative rounded-full hover:bg-white/60"
                >
                  <Bell className="h-4.5 w-4.5" />
                  <span className="absolute right-2 top-2 h-2 w-2 animate-pulse rounded-full bg-accent" />
                </Button>
                <Link
                  to="/profile"
                  className="glass-tile flex items-center gap-2 rounded-full pl-1 pr-3 py-1"
                >
                  <Avatar className="h-8 w-8">
                    {photoURL ? (
                      <img
                        src={photoURL}
                        alt={displayName}
                        className="h-full w-full rounded-full object-cover"
                        onError={(e) => {
                          e.currentTarget.src = DEFAULT_AVATAR;
                        }}
                      />
                    ) : (
                      <img
                        src={DEFAULT_AVATAR}
                        alt={displayName}
                        className="h-full w-full rounded-full object-cover"
                      />
                    )}
                  </Avatar>
                  <span className="hidden text-sm font-medium sm:inline">
                    {displayName.split(" ")[0] || "Profile"}
                  </span>
                </Link>
              </div>
            </div>
            {(title || actions) && (
              <div className="flex flex-col gap-3 border-t border-white/40 px-4 sm:px-6 py-4 md:py-5 md:flex-row md:items-end md:justify-between md:px-8">
                <div>
                  {title && (
                    <motion.h1
                      key={title}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
                      className="font-display text-2xl sm:text-3xl leading-tight md:text-4xl"
                    >
                      {title}
                    </motion.h1>
                  )}
                  {subtitle && (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.6, delay: 0.15 }}
                      className="mt-1 text-xs sm:text-sm text-muted-foreground"
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
              className="px-4 sm:px-6 py-6 md:px-8 pb-28 md:pb-8"
            >
              {children}
            </motion.main>
          </AnimatePresence>
        </div>
      </div>

      {/* ============ Mobile Bottom Navigation Dock ============ */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-background/95 backdrop-blur-2xl border-t border-border/60 px-2 py-1.5 flex items-center justify-around pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-xl">
        {[
          { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
          { to: "/itinerary", label: "Itinerary", icon: CalendarDays },
          { to: "/trips/new", label: "New Trip", icon: Plus, isPrimary: true },
          { to: "/memory", label: "Scrapbook", icon: Camera },
          { to: "#menu", label: "More", icon: Menu, isAction: true },
        ].map((tab) => {
          if (tab.isAction) {
            return (
              <button
                key={tab.label}
                onClick={() => setMobileNavOpen(true)}
                className="flex flex-col items-center justify-center py-1 px-2.5 rounded-xl text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Open full menu"
              >
                <tab.icon className="h-5 w-5" />
                <span className="text-[10px] font-medium mt-0.5">{tab.label}</span>
              </button>
            );
          }
          if (tab.isPrimary) {
            return (
              <Link
                key={tab.label}
                to={tab.to}
                className="flex flex-col items-center justify-center -mt-5"
              >
                <span className="grid h-12 w-12 place-items-center rounded-full bg-gradient-to-tr from-primary to-accent text-white shadow-lg shadow-primary/30 transition-transform active:scale-95">
                  <Plus className="h-6 w-6 stroke-[2.5]" />
                </span>
                <span className="text-[10px] font-medium text-primary mt-0.5">{tab.label}</span>
              </Link>
            );
          }
          const active =
            tab.to === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(tab.to);
          return (
            <Link
              key={tab.label}
              to={tab.to}
              className={cn(
                "flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-colors",
                active ? "text-primary font-semibold" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <tab.icon className={cn("h-5 w-5", active && "stroke-[2.2]")} />
              <span className="text-[10px] mt-0.5">{tab.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* ============ Mobile Slide-Over Drawer ============ */}
      <AnimatePresence>
        {mobileNavOpen && (
          <div className="fixed inset-0 z-50 flex md:hidden">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setMobileNavOpen(false)}
            />

            {/* Drawer */}
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 360, damping: 32 }}
              className="relative w-4/5 max-w-xs h-full bg-background/98 backdrop-blur-3xl border-r border-border/60 flex flex-col p-5 overflow-y-auto z-10"
            >
              <div className="flex items-center justify-between pb-4 border-b border-border/40">
                <BrandLogo />
                <button
                  onClick={() => setMobileNavOpen(false)}
                  className="grid h-9 w-9 place-items-center rounded-xl bg-muted/60 text-foreground hover:bg-muted"
                  aria-label="Close menu"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Sections list */}
              <nav className="mt-4 flex-1 flex flex-col gap-4">
                {navSections.map((section) => (
                  <div key={section.title} className="space-y-1">
                    <p className="px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 select-none">
                      {section.title}
                    </p>
                    <div className="flex flex-col gap-1">
                      {section.items.map((item) => {
                        const active =
                          item.to === "/dashboard"
                            ? pathname === "/dashboard"
                            : pathname.startsWith(item.to);
                        const Icon = item.icon;
                        return (
                          <Link
                            key={item.to}
                            to={item.to}
                            onClick={() => setMobileNavOpen(false)}
                            className={cn(
                              "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                              active
                                ? "bg-primary/10 text-primary font-semibold"
                                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                            )}
                          >
                            <Icon className="h-4 w-4 shrink-0" />
                            <span>{item.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </nav>

              {/* Footer info */}
              <div className="mt-6 pt-4 border-t border-border/40 flex items-center justify-between">
                <Link
                  to="/profile"
                  onClick={() => setMobileNavOpen(false)}
                  className="flex items-center gap-2.5 truncate"
                >
                  <Avatar className="h-8 w-8 shrink-0">
                    {photoURL ? (
                      <img src={photoURL} alt={displayName} className="h-full w-full rounded-full object-cover" />
                    ) : (
                      <AvatarFallback>{displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
                    )}
                  </Avatar>
                  <span className="text-sm font-medium text-foreground truncate max-w-[130px]">
                    {displayName}
                  </span>
                </Link>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
