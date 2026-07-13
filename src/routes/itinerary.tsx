import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plane, Hotel, Utensils, MapPin, Camera } from "lucide-react";
import { timeline } from "@/lib/mock-data";

export const Route = createFileRoute("/itinerary")({ component: Itinerary });

const icons: Record<string, typeof Plane> = { transport: Plane, stay: Hotel, food: Utensils, activity: Camera };

function Itinerary() {
  return (
    <AppShell title="Itinerary" subtitle="Udaipur · 6 days · 18 activities">
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          {timeline.map((d) => (
            <div key={d.day} className="rounded-2xl glass-panel p-6">
              <div className="flex items-baseline justify-between">
                <div>
                  <span className="font-display text-3xl text-primary">Day {d.day}</span>
                  <span className="ml-3 text-sm text-muted-foreground">{d.date} · {d.title}</span>
                </div>
                <Badge variant="secondary">{d.items.length} activities</Badge>
              </div>
              <div className="mt-6 space-y-1">
                {d.items.map((i, idx) => {
                  const Icon = icons[i.type] ?? MapPin;
                  return (
                    <div key={idx} className="flex gap-4 rounded-xl px-3 py-3 hover:bg-muted/50">
                      <div className="w-14 shrink-0 text-sm font-semibold text-primary">{i.time}</div>
                      <div className="relative shrink-0">
                        <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/8 text-primary">
                          <Icon className="h-4 w-4" />
                        </span>
                        {idx < d.items.length - 1 && <span className="absolute left-1/2 top-9 h-full w-px -translate-x-1/2 bg-border" />}
                      </div>
                      <div className="min-w-0 flex-1 pb-2">
                        <p className="font-medium">{i.title}</p>
                        <p className="text-xs text-muted-foreground">{i.meta}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-6">
          <div className="overflow-hidden rounded-2xl glass-panel">
            <div className="relative h-56 bg-gradient-to-br from-sky/40 via-primary/10 to-accent/20">
              <svg className="absolute inset-0 h-full w-full opacity-40" viewBox="0 0 400 300" fill="none">
                <path d="M20 220 Q 120 100 200 180 T 380 120" stroke="var(--color-primary)" strokeWidth="2" strokeDasharray="4 4" />
                <circle cx="20" cy="220" r="6" fill="var(--color-primary)" />
                <circle cx="200" cy="180" r="6" fill="var(--color-accent)" />
                <circle cx="380" cy="120" r="6" fill="var(--color-primary)" />
              </svg>
              <div className="absolute bottom-3 left-3 rounded-lg bg-background/85 px-2.5 py-1 text-xs backdrop-blur">Route preview</div>
            </div>
            <div className="p-4">
              <p className="text-sm font-medium">City Palace → Jag Mandir → Sajjangarh</p>
              <p className="mt-1 text-xs text-muted-foreground">11.4 km · 3 stops today</p>

            </div>
          </div>

          <div className="rounded-2xl glass-panel p-6">
            <h3 className="font-semibold">Hotel</h3>
            <p className="mt-2 text-sm">Taj Lake Palace, Udaipur</p>
            <p className="text-xs text-muted-foreground">Lake-view suite · Check-in Jun 12, 15:00</p>

            <Button variant="outline" size="sm" className="mt-4 w-full">View reservation</Button>
          </div>

          <div className="rounded-2xl glass-panel p-6">
            <h3 className="font-semibold">Transport today</h3>
            <div className="mt-3 space-y-3 text-sm">
              <div className="flex justify-between"><span>Auto-rickshaw to City Palace</span><span className="text-muted-foreground">09:15</span></div>
              <div className="flex justify-between"><span>Boat to Jag Mandir</span><span className="text-muted-foreground">19:40</span></div>

            </div>
          </div>

          <div className="rounded-2xl border border-border/70 bg-gradient-to-br from-primary/5 to-accent/5 p-6">
            <h3 className="font-semibold">Notes</h3>
            <p className="mt-2 text-sm text-muted-foreground">Sunset at Ambrai Ghat fills fast — arrive by 18:30 to claim a riverside table.</p>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
