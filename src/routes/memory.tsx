import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { AiBadge } from "@/components/ai/ai-badge";
import { inr } from "@/lib/utils";
import { Camera, CloudSun, MapPin, Instagram } from "lucide-react";
import { InstagramModal } from "@/components/ai/instagram-modal";

export const Route = createFileRoute("/memory")({ component: Memory });

const days = [
  {
    n: 1, date: "Jun 12", place: "Udaipur, Arrival",
    weather: "32°C, clear", spend: 18400,
    photo: "https://images.unsplash.com/photo-1695956353120-54ce5e91632b?fm=jpg&q=75&w=1400&auto=format&fit=crop",
    highlight: "You arrived to the smell of jasmine and 5 PM lake light. The first walk to Gangaur Ghat felt like Aventra had scripted it, unhurried and warm.",
    moments: ["Landed 12:10", "Boat to Taj at 14:20", "Ambrai dinner at 20:15"],
  },
  {
    n: 2, date: "Jun 13", place: "City Palace, Old Town",
    weather: "34°C, hazy", spend: 6800,
    photo: "https://images.unsplash.com/photo-1772533254933-ee692487aba2?fm=jpg&q=75&w=1400&auto=format&fit=crop",
    highlight: "Crystal Gallery took your breath, the cooking class in Hanuman Ghat made you laugh. Aventra rearranged the afternoon around your favorite thing, food.",
    moments: ["Guided City Palace, 3 h", "Thali workshop", "Sitar at Jheel's"],
  },
  {
    n: 3, date: "Jun 14", place: "Lake Pichola",
    weather: "31°C, breezy", spend: 4200,
    photo: "https://images.unsplash.com/photo-1772165075119-a427cb258651?fm=jpg&q=75&w=1400&auto=format&fit=crop",
    highlight: "Sunrise cruise beat the rain forecast (Aventra moved it a day early). Lunch on Jag Mandir was the trip's quietest hour.",
    moments: ["Sunrise cruise", "Jag Mandir lunch", "Free evening"],
  },
];

function Memory() {
  const [selectedDay, setSelectedDay] = useState<any>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const openShareModal = (day: any) => {
    setSelectedDay(day);
    setModalOpen(true);
  };

  return (
    <AppShell
      title="Memory Timeline"
      subtitle="An interactive scrapbook Aventra writes as your trip happens."
      actions={<AiBadge>Auto-generated</AiBadge>}
    >
      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        {[
          ["Days", "6"],
          ["Photos", "84"],
          ["Places visited", "18"],
          ["Total spend", inr(1_42_000)],
        ].map(([k, v]) => (
          <div key={k} className="rounded-2xl glass-panel p-5">
            <p className="text-xs text-muted-foreground">{k}</p>
            <p className="mt-1 font-display text-3xl">{v}</p>
          </div>
        ))}
      </div>

      <div className="space-y-6">
        {days.map((d) => (
          <article 
            key={d.n} 
            onClick={() => openShareModal(d)}
            className="grid gap-0 overflow-hidden rounded-2xl glass-panel md:grid-cols-[280px_1fr] cursor-pointer hover:ring-2 hover:ring-pink-500/50 transition-all hover:-translate-y-1 group"
          >
            <div className="relative h-56 md:h-full">
              <img src={d.photo} alt={d.place} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
              <span className="absolute left-3 top-3 rounded-full bg-background/90 px-2.5 py-1 text-[11px] font-semibold">
                Day {d.n} · {d.date}
              </span>
            </div>
            <div className="p-6 flex flex-col h-full">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold">{d.place}</h3>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1"><CloudSun className="h-3.5 w-3.5" />{d.weather}</span>
                  <span className="inline-flex items-center gap-1"><Camera className="h-3.5 w-3.5" />32 photos</span>
                  <span>Spend {inr(d.spend)}</span>
                </div>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-foreground">{d.highlight}</p>
              
              <div className="mt-auto pt-6 flex flex-wrap items-center justify-between gap-4">
                <ul className="flex flex-wrap gap-2 text-xs">
                  {d.moments.map((m) => (
                    <li key={m} className="rounded-full border border-border/70 bg-background/60 px-2.5 py-1 text-muted-foreground">
                      {m}
                    </li>
                  ))}
                </ul>
                <button className="flex items-center gap-2 text-xs font-semibold text-pink-500 hover:text-pink-600 bg-pink-500/10 px-3 py-1.5 rounded-full transition-colors opacity-0 group-hover:opacity-100">
                  <Instagram className="h-3.5 w-3.5" />
                  Create Reel/Post
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
      
      <InstagramModal 
        isOpen={modalOpen} 
        onOpenChange={setModalOpen} 
        dayData={selectedDay} 
      />
    </AppShell>
  );
}
