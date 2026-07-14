import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Plane, Hotel, Utensils, MapPin, Camera } from "lucide-react";
import { timeline } from "@/lib/mock-data";

export const Route = createFileRoute("/itinerary")({ component: Itinerary });

const GMAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

const icons: Record<string, typeof Plane> = { transport: Plane, stay: Hotel, food: Utensils, activity: Camera };

// Static map centered on Udaipur
const UDAIPUR_MAP_URL = GMAPS_KEY
  ? `https://maps.googleapis.com/maps/api/staticmap?center=Udaipur,Rajasthan&zoom=14&size=640x320&scale=2&maptype=roadmap&markers=color:blue%7CCity+Palace,Udaipur&markers=color:red%7CJag+Mandir,Udaipur&markers=color:green%7CSajjangarh,Udaipur&style=element:geometry%7Ccolor:0x242f3e&style=element:labels.text.fill%7Ccolor:0x746855&style=element:labels.text.stroke%7Ccolor:0x242f3e&key=${GMAPS_KEY}`
  : null;

function Itinerary() {
  return (
    <AppShell title="Itinerary" subtitle={`Udaipur · ${timeline.length} days · ${timeline.reduce((a, d) => a + d.items.length, 0)} activities`}>
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
                        {idx < d.items.length - 1 && (
                          <span className="absolute left-1/2 top-9 h-full w-px -translate-x-1/2 bg-border" />
                        )}
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
          {/* Google Maps Static Map */}
          <div className="overflow-hidden rounded-2xl glass-panel">
            {UDAIPUR_MAP_URL ? (
              <img
                src={UDAIPUR_MAP_URL}
                alt="Trip route map"
                className="h-56 w-full object-cover"
                onError={(e) => {
                  // Fallback to decorative if API fails
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            ) : (
              <div className="relative h-56 bg-gradient-to-br from-sky/40 via-primary/10 to-accent/20 flex items-center justify-center">
                <p className="text-xs text-muted-foreground">Add VITE_GOOGLE_MAPS_API_KEY to enable map</p>
              </div>
            )}
            <div className="p-4">
              <p className="text-sm font-medium">City Palace → Jag Mandir → Sajjangarh</p>
              <p className="mt-1 text-xs text-muted-foreground">11.4 km · 3 stops today</p>
            </div>
          </div>

          <div className="rounded-2xl glass-panel p-6">
            <h3 className="font-semibold">Hotel</h3>
            <p className="mt-2 text-sm">Taj Lake Palace, Udaipur</p>
            <p className="text-xs text-muted-foreground">Lake-view suite · Check-in Jun 12, 15:00</p>
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
