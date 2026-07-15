import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Sparkles, Share2, Copy, Check, Instagram, Music } from "lucide-react";
import { AiBadge } from "@/components/ai/ai-badge";

interface InstagramModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  dayData: any | null;
}

const filters = [
  { name: "Normal", class: "" },
  { name: "Vintage", class: "sepia-[.4] contrast-125 brightness-90" },
  { name: "Warm", class: "sepia-[.2] contrast-110 saturate-150" },
  { name: "B&W", class: "grayscale contrast-125" },
];

const songs = [
  { name: "Kesariya", artist: "Pritam, Arijit Singh", match: 98 },
  { name: "Kabira", artist: "Pritam, Tochi Raina", match: 92 },
  { name: "Chaudhary", artist: "Amit Trivedi, Mame Khan", match: 88 },
];

export function InstagramModal({ isOpen, onOpenChange, dayData }: InstagramModalProps) {
  const [activeFilter, setActiveFilter] = useState(filters[0]);
  const [copied, setCopied] = useState<number | null>(null);

  if (!dayData) return null;

  const captions = [
    `Lost in the magic of ${dayData.place}. ✨ Aventra knew exactly where I needed to be today.`,
    `${dayData.weather.split(",")[1]?.trim() || "Beautiful"} days and unforgettable views in ${dayData.place}. 🏰🤍`,
    `A quiet moment at ${dayData.place}. Planned by AI, lived by me. 🌅`,
  ];

  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopied(index);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Instagram className="h-5 w-5 text-pink-500" />
            Share to Instagram
            <AiBadge className="ml-auto">AI Crafted</AiBadge>
          </DialogTitle>
          <DialogDescription>
            Aventra has curated your best photos and generated captions for {dayData.place}.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="story" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="story">Story Collage</TabsTrigger>
            <TabsTrigger value="post">Feed Post</TabsTrigger>
          </TabsList>

          <TabsContent value="story" className="mt-4 flex flex-col items-center">
            {/* Story Layout (9:16 approx) */}
            <div className="relative w-[240px] h-[426px] bg-black rounded-xl overflow-hidden shadow-xl border border-border/50">
              <img
                src={dayData.photo}
                alt="Main"
                className="absolute inset-0 w-full h-full object-cover opacity-60 blur-sm scale-110"
              />
              <div className="absolute inset-0 p-4 flex flex-col justify-center gap-3">
                <img
                  src={dayData.photo}
                  alt="Collage 1"
                  className="w-full h-40 object-cover rounded-lg shadow-lg border-2 border-white/20 -rotate-2"
                />
                <div className="flex gap-2">
                  <img
                    src={dayData.photo}
                    alt="Collage 2"
                    className="w-1/2 h-28 object-cover rounded-lg shadow-lg border-2 border-white/20 rotate-3"
                  />
                  <div className="w-1/2 h-28 bg-white/10 backdrop-blur-md rounded-lg border border-white/30 flex flex-col justify-center items-center text-center p-2 shadow-lg -rotate-1">
                    <MapPinIcon className="h-4 w-4 mb-1 text-white" />
                    <span className="text-xs font-bold text-white leading-tight">
                      {dayData.place}
                    </span>
                    <span className="text-[10px] text-white/80">{dayData.date}</span>
                  </div>
                </div>
              </div>
            </div>

            <Button className="w-full mt-6 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white border-0">
              <Share2 className="mr-2 h-4 w-4" /> Share to Story
            </Button>
          </TabsContent>

          <TabsContent value="post" className="mt-4">
            {/* Post Layout */}
            <div className="rounded-xl overflow-hidden shadow-md">
              <img
                src={dayData.photo}
                alt="Post Preview"
                className={`w-full aspect-square object-cover transition-all duration-300 ${activeFilter.class}`}
              />
            </div>

            <div className="mt-4 flex gap-2 overflow-x-auto pb-2 scrollbar-none">
              {filters.map((filter) => (
                <button
                  key={filter.name}
                  onClick={() => setActiveFilter(filter)}
                  className={`flex flex-col items-center gap-1 min-w-[60px] ${activeFilter.name === filter.name ? "opacity-100" : "opacity-50 hover:opacity-100"}`}
                >
                  <img
                    src={dayData.photo}
                    className={`w-12 h-12 rounded-md object-cover ${filter.class}`}
                    alt={filter.name}
                  />
                  <span className="text-[10px] font-medium">{filter.name}</span>
                </button>
              ))}
            </div>

            <div className="mt-4 space-y-3">
              <h4 className="text-sm font-semibold flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-primary" /> AI Captions
              </h4>
              <div className="space-y-2">
                {captions.map((cap, i) => (
                  <div
                    key={i}
                    className="group relative rounded-lg bg-muted/50 p-3 pr-10 text-xs text-foreground/90 border border-border/50"
                  >
                    {cap}
                    <button
                      onClick={() => handleCopy(cap, i)}
                      className="absolute right-2 top-2 p-1.5 rounded-md hover:bg-background transition-colors text-muted-foreground"
                    >
                      {copied === i ? (
                        <Check className="h-3.5 w-3.5 text-green-500" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-5">
              <h4 className="text-sm font-semibold flex items-center gap-1 mb-2">
                <Music className="h-3 w-3 text-primary" /> Suggested Audio
              </h4>
              <div className="space-y-2">
                {songs.map((song) => (
                  <div
                    key={song.name}
                    className="flex items-center justify-between rounded-lg border border-border/40 bg-card p-2 text-sm"
                  >
                    <div className="flex flex-col">
                      <span className="font-medium text-xs">{song.name}</span>
                      <span className="text-[10px] text-muted-foreground">{song.artist}</span>
                    </div>
                    <span className="text-[10px] font-semibold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                      {song.match}% match
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <Button className="w-full mt-6">Download assets & copy caption</Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function MapPinIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}
