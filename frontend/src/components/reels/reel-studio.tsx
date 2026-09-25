import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Film,
  Download,
  Share2,
  Sparkles,
  Check,
  Copy,
  RefreshCw,
  Video,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Play,
  Pause,
  Music,
  Maximize2,
  Clock,
  Sliders,
  Type,
  ExternalLink,
  ChevronRight,
  Flame,
  Volume2
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";

export const REEL_TEMPLATES = [
  {
    id: "cinematic",
    label: "Cinematic Film",
    icon: "🎬",
    description: "Subtle slow zoom & pan, warm tint, and gentle crossfade transitions"
  },
  {
    id: "fast-paced",
    label: "Fast Beat Sync",
    icon: "⚡",
    description: "Snappy 2-second cuts with energetic rhythm and punchy title badge"
  },
  {
    id: "polaroid-memories",
    label: "Polaroid Retro",
    icon: "📷",
    description: "Nostalgic film look with vintage tones and clean caption styling"
  },
  {
    id: "wanderlust",
    label: "Wanderlust",
    icon: "🧭",
    description: "Panoramic travel motion with modern explorer badge and smooth dissolves"
  }
];

export const ASPECT_RATIOS = [
  { id: "9:16", label: "9:16 Vertical", sub: "Reels / TikTok / Shorts" },
  { id: "16:9", label: "16:9 Landscape", sub: "YouTube / Widescreen" },
  { id: "1:1", label: "1:1 Square", sub: "Instagram Feed" }
];

export const MUSIC_PRESETS = [
  { id: "lofi-chill", label: "Lo-Fi Sunset", genre: "Chillhop", desc: "Mellow vibes for sunset & cafes" },
  { id: "summer-acoustic", label: "Summer Roadtrip", genre: "Acoustic", desc: "Sunny guitar and breezy rhythm" },
  { id: "cinematic-epic", label: "Cinematic Odyssey", genre: "Orchestral", desc: "Grand emotional build for landscapes" },
  { id: "travel-beat", label: "City Explorer", genre: "Electronic", desc: "Upbeat modern bounce for city walks" },
  { id: "ambient-wander", label: "Ambient Horizon", genre: "Atmospheric", desc: "Peaceful chords for mountains & sea" }
];

export const DURATION_OPTIONS = [
  { id: 15, label: "15s", sub: "Quick Teaser" },
  { id: 30, label: "30s", sub: "Classic Story" },
  { id: 45, label: "45s", sub: "Deep Recap" }
];

export interface ReelStudioProps {
  tripId?: string;
  allMemories?: any[];
  initialSelectedIds?: string[];
  destinationName?: string;
  onClose?: () => void;
  onReelCreated?: (reel: any) => void;
}

export function ReelStudio({
  tripId,
  allMemories = [],
  initialSelectedIds = [],
  destinationName = "Travel Memories",
  onClose,
  onReelCreated
}: ReelStudioProps) {
  // Config states
  const [template, setTemplate] = useState("cinematic");
  const [aspectRatio, setAspectRatio] = useState("9:16");
  const [duration, setDuration] = useState(15);
  const [musicPreset, setMusicPreset] = useState("lofi-chill");
  const [titleText, setTitleText] = useState(destinationName);
  const [subtitleText, setSubtitleText] = useState("Advenza Moments");
  const [titlePosition, setTitlePosition] = useState<"bottom" | "center" | "top">("bottom");
  const [titleStyle, setTitleStyle] = useState<"cinematic" | "bold" | "minimal" | "vintage">("cinematic");

  // Candidates & selection
  const [candidates, setCandidates] = useState<any[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Generation status
  const [generating, setGenerating] = useState(false);
  const [currentReelId, setCurrentReelId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState<string>("queued");
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [completedReel, setCompletedReel] = useState<any | null>(null);
  const [copiedShare, setCopiedShare] = useState(false);

  // Existing reels history
  const [recentReels, setRecentReels] = useState<any[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(false);

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Load memories if not provided
  useEffect(() => {
    if (allMemories && allMemories.length > 0) {
      const normalized = allMemories.map((m: any) => ({
        id: m._id || m.id,
        url: m.mediaUrl || m.thumbnailUrl || m.imageUrl || m.url || (m.mediaItems?.[0]?.storageUrl),
        type: m.type || m.mediaType || (m.mediaItems?.[0]?.type) || "photo",
        place: m.place || m.location?.name || "",
        date: m.date || ""
      })).filter((m: any) => Boolean(m.url));

      setCandidates(normalized);
      if (initialSelectedIds.length > 0) {
        setSelectedIds(initialSelectedIds);
      } else {
        setSelectedIds(normalized.slice(0, 6).map((m: any) => m.id));
      }
    } else if (tripId) {
      setLoadingCandidates(true);
      apiFetch(`/api/memories?tripId=${tripId}`)
        .then((res: any) => {
          const list = Array.isArray(res) ? res : res.memories || res.items || [];
          const normalized = list.map((m: any) => ({
            id: m._id || m.id,
            url: m.mediaUrl || m.thumbnailUrl || m.imageUrl || m.url || (m.mediaItems?.[0]?.storageUrl),
            type: m.type || m.mediaType || "photo",
            place: m.place || m.location?.name || "",
            date: m.date || ""
          })).filter((m: any) => Boolean(m.url));

          setCandidates(normalized);
          setSelectedIds(normalized.slice(0, 6).map((m: any) => m.id));
        })
        .catch((err) => {
          console.error("Failed to load memories for reel:", err);
          toast.error("Could not load trip memories");
        })
        .finally(() => setLoadingCandidates(false));
    }
  }, [tripId, allMemories, initialSelectedIds]);

  // Load recent reels for this trip/user
  const fetchRecentReels = async () => {
    try {
      setLoadingRecent(true);
      const url = tripId ? `/api/reels?tripId=${tripId}&limit=5` : `/api/reels?limit=5`;
      const res: any = await apiFetch(url);
      if (res.reels) {
        setRecentReels(res.reels);
      }
    } catch (e) {
      console.warn("Failed to load recent reels:", e);
    } finally {
      setLoadingRecent(false);
    }
  };

  useEffect(() => {
    fetchRecentReels();
  }, [tripId]);

  // Polling for generation progress
  const startPolling = (reelId: string) => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

    pollIntervalRef.current = setInterval(async () => {
      try {
        const res: any = await apiFetch(`/api/reels/${reelId}`);
        const r = res.reel;
        if (!r) return;

        setProgress(r.progress || 0);
        setStage(r.stage || r.status);
        setStatusMessage(r.statusMessage || "");

        if (r.status === "completed") {
          clearInterval(pollIntervalRef.current!);
          setGenerating(false);
          setCompletedReel(r);
          toast.success("Travel Reel rendered successfully!");
          fetchRecentReels();
          if (onReelCreated) onReelCreated(r);
        } else if (r.status === "failed") {
          clearInterval(pollIntervalRef.current!);
          setGenerating(false);
          toast.error(`Reel generation failed: ${r.error || "Unknown error"}`);
        }
      } catch (err) {
        console.error("Error polling reel status:", err);
      }
    }, 2000);
  };

  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  const toggleSelectMemory = (id: string) => {
    if (selectedIds.includes(id)) {
      if (selectedIds.length <= 2) {
        toast.info("A reel requires at least 2 memories");
        return;
      }
      setSelectedIds(selectedIds.filter((item) => item !== id));
    } else {
      if (selectedIds.length >= 12) {
        toast.info("Maximum 12 memories per reel for best pacing");
        return;
      }
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleCreateReel = async () => {
    if (!tripId && candidates.length === 0) {
      toast.error("Please select a trip or memories to create a reel");
      return;
    }
    if (selectedIds.length < 2) {
      toast.error("Select at least 2 photos or videos");
      return;
    }

    try {
      setGenerating(true);
      setProgress(5);
      setStage("queued");
      setStatusMessage("Enqueuing video rendering pipeline...");
      setCompletedReel(null);

      const payload = {
        tripId,
        memoryIds: selectedIds,
        template,
        aspectRatio,
        targetDuration: duration,
        musicPreset,
        text: {
          title: titleText || destinationName,
          subtitle: subtitleText,
          position: titlePosition,
          style: titleStyle
        }
      };

      const res: any = await apiFetch("/api/reels", {
        method: "POST",
        body: JSON.stringify(payload)
      });

      if (res?.reel?.id) {
        setCurrentReelId(res.reel.id);
        toast.info("Video rendering engine started. Processing in background...");
        startPolling(res.reel.id);
      } else {
        throw new Error(res.message || "Failed to start reel generation");
      }
    } catch (err: any) {
      setGenerating(false);
      toast.error(err.message || "Failed to create reel");
    }
  };

  const handleShare = async () => {
    if (!completedReel?._id && !completedReel?.id) return;
    const rId = completedReel._id || completedReel.id;

    try {
      const res: any = await apiFetch(`/api/reels/${rId}/share`, { method: "POST" });
      if (res.shareToken) {
        const fullShareUrl = `${window.location.origin}/share/reel/${res.shareToken}`;
        await navigator.clipboard.writeText(fullShareUrl);
        setCopiedShare(true);
        toast.success("Public share link copied to clipboard!");
        setTimeout(() => setCopiedShare(false), 3000);
      }
    } catch (e: any) {
      toast.error("Failed to generate share link");
    }
  };

  const getStageLabel = (stg: string) => {
    switch (stg) {
      case "queued":
        return "In Queue";
      case "initializing":
        return "Setting Up Video Canvas";
      case "downloading":
        return "Downloading Media Assets";
      case "processing_clips":
        return "Rendering & Normalizing Clips";
      case "assembling":
        return "Concatenating Sequence";
      case "overlays":
        return "Compositing Title Typography";
      case "audio":
        return "Scoring & Mixing Audio";
      case "encoding":
        return "Encoding H.264 MP4";
      case "uploading":
        return "Finalizing Storage";
      case "completed":
        return "Ready!";
      default:
        return "Processing Video";
    }
  };

  return (
    <div className="flex flex-col h-full space-y-6 text-foreground">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-border/40 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-tr from-primary/30 to-violet-500/20 text-primary border border-primary/20 shadow-sm">
            <Film className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
              AI Travel Reels Studio
              <Badge variant="secondary" className="text-[11px] font-semibold bg-primary/10 text-primary border-primary/20">
                PRO ENGINE
              </Badge>
            </h2>
            <p className="text-xs text-muted-foreground">
              Real server-side MP4 generation with cinematic transitions, music & typography
            </p>
          </div>
        </div>

        {onClose && (
          <Button variant="ghost" size="sm" onClick={onClose} className="text-muted-foreground">
            Close
          </Button>
        )}
      </div>

      {/* Main Studio Body */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0">
        {/* Left Controls Column */}
        <div className="lg:col-span-7 space-y-5 overflow-y-auto pr-1">
          {/* 1. Template Chooser */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Sliders className="h-3.5 w-3.5" /> 1. Style & Pacing Template
            </Label>
            <div className="grid grid-cols-2 gap-2.5">
              {REEL_TEMPLATES.map((tmpl) => (
                <button
                  key={tmpl.id}
                  type="button"
                  onClick={() => setTemplate(tmpl.id)}
                  disabled={generating}
                  className={`flex flex-col text-left p-3 rounded-xl border transition-all ${
                    template === tmpl.id
                      ? "border-primary bg-primary/10 shadow-sm ring-1 ring-primary/40"
                      : "border-border/60 bg-card hover:bg-muted/50 hover:border-border"
                  }`}
                >
                  <div className="flex items-center gap-2 font-medium text-sm">
                    <span className="text-base">{tmpl.icon}</span>
                    <span>{tmpl.label}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                    {tmpl.description}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* 2. Format & Duration */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Aspect Ratio
              </Label>
              <div className="grid grid-cols-3 gap-1.5">
                {ASPECT_RATIOS.map((ar) => (
                  <button
                    key={ar.id}
                    type="button"
                    onClick={() => setAspectRatio(ar.id)}
                    disabled={generating}
                    className={`py-2 px-1 text-center rounded-lg border text-xs font-medium transition-all ${
                      aspectRatio === ar.id
                        ? "border-primary bg-primary/10 text-primary font-semibold"
                        : "border-border/50 bg-card text-muted-foreground hover:bg-muted/40"
                    }`}
                  >
                    <div>{ar.id}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" /> Target Duration
              </Label>
              <div className="grid grid-cols-3 gap-1.5">
                {DURATION_OPTIONS.map((dur) => (
                  <button
                    key={dur.id}
                    type="button"
                    onClick={() => setDuration(dur.id)}
                    disabled={generating}
                    className={`py-2 px-1 text-center rounded-lg border text-xs font-medium transition-all ${
                      duration === dur.id
                        ? "border-primary bg-primary/10 text-primary font-semibold"
                        : "border-border/50 bg-card text-muted-foreground hover:bg-muted/40"
                    }`}
                  >
                    <div>{dur.label}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 3. Audio & Music Presets */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Music className="h-3.5 w-3.5" /> 2. Soundtrack & Audio Vibe
            </Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {MUSIC_PRESETS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMusicPreset(m.id)}
                  disabled={generating}
                  className={`flex items-start gap-2.5 p-2.5 rounded-lg border text-left transition-all ${
                    musicPreset === m.id
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border/50 bg-card hover:bg-muted/30 text-foreground"
                  }`}
                >
                  <div className="p-1.5 rounded-md bg-muted text-muted-foreground shrink-0 mt-0.5">
                    <Volume2 className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold truncate flex items-center gap-1.5">
                      {m.label}
                      <span className="text-[10px] font-normal text-muted-foreground px-1 py-0.2 rounded bg-muted/60">
                        {m.genre}
                      </span>
                    </div>
                    <div className="text-[10px] text-muted-foreground truncate">{m.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* 4. Title Card Overlays */}
          <div className="space-y-2.5 p-3.5 rounded-xl border border-border/50 bg-card/60">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Type className="h-3.5 w-3.5" /> 3. Title Card & Typography Overlay
            </Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <span className="text-[11px] text-muted-foreground block mb-1">Headline Text</span>
                <Input
                  value={titleText}
                  onChange={(e) => setTitleText(e.target.value)}
                  placeholder="e.g. TOKYO 2026"
                  disabled={generating}
                  className="h-8 text-xs bg-background"
                />
              </div>
              <div>
                <span className="text-[11px] text-muted-foreground block mb-1">Subtitle / Subtext</span>
                <Input
                  value={subtitleText}
                  onChange={(e) => setSubtitleText(e.target.value)}
                  placeholder="e.g. Unforgettable Memories"
                  disabled={generating}
                  className="h-8 text-xs bg-background"
                />
              </div>
            </div>

            <div className="flex items-center gap-4 pt-1 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground text-[11px]">Position:</span>
                {(["bottom", "center", "top"] as const).map((pos) => (
                  <button
                    key={pos}
                    type="button"
                    onClick={() => setTitlePosition(pos)}
                    className={`px-2 py-0.5 rounded text-[11px] capitalize border transition-all ${
                      titlePosition === pos
                        ? "border-primary bg-primary/10 text-primary font-semibold"
                        : "border-border/40 text-muted-foreground hover:bg-muted/40"
                    }`}
                  >
                    {pos}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground text-[11px]">Style:</span>
                {(["cinematic", "bold", "minimal", "vintage"] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setTitleStyle(st)}
                    className={`px-2 py-0.5 rounded text-[11px] capitalize border transition-all ${
                      titleStyle === st
                        ? "border-primary bg-primary/10 text-primary font-semibold"
                        : "border-border/40 text-muted-foreground hover:bg-muted/40"
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 5. Memory Clip Selection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Video className="h-3.5 w-3.5" /> 4. Included Media ({selectedIds.length} of {candidates.length} selected)
              </Label>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-[11px] text-primary hover:text-primary"
                onClick={() => setSelectedIds(candidates.slice(0, 8).map((c) => c.id))}
                disabled={generating || candidates.length === 0}
              >
                Auto-Pick Best
              </Button>
            </div>

            {loadingCandidates ? (
              <div className="py-8 flex flex-col items-center justify-center text-muted-foreground text-xs gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Loading trip memories...</span>
              </div>
            ) : candidates.length === 0 ? (
              <div className="py-6 text-center text-xs text-muted-foreground border border-dashed rounded-lg">
                No memories available. Upload photos or videos to your trip first!
              </div>
            ) : (
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-48 overflow-y-auto p-1 border rounded-lg bg-card/40">
                {candidates.map((mem) => {
                  const isSel = selectedIds.includes(mem.id);
                  return (
                    <div
                      key={mem.id}
                      onClick={() => !generating && toggleSelectMemory(mem.id)}
                      className={`group relative aspect-square rounded-md overflow-hidden cursor-pointer border-2 transition-all ${
                        isSel
                          ? "border-primary ring-2 ring-primary/30"
                          : "border-transparent opacity-60 hover:opacity-100"
                      }`}
                    >
                      <img src={mem.url} alt="Memory" className="w-full h-full object-cover" />
                      <div className="absolute top-1 left-1">
                        {mem.type === "video" ? (
                          <span className="p-0.5 rounded bg-black/70 text-white text-[9px] flex items-center gap-0.5">
                            <Video className="h-2.5 w-2.5" />
                          </span>
                        ) : (
                          <span className="p-0.5 rounded bg-black/70 text-white text-[9px] flex items-center gap-0.5">
                            <ImageIcon className="h-2.5 w-2.5" />
                          </span>
                        )}
                      </div>
                      {isSel && (
                        <div className="absolute top-1 right-1 p-0.5 rounded-full bg-primary text-primary-foreground">
                          <Check className="h-2.5 w-2.5 stroke-[3]" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Action Button */}
          <div className="pt-2">
            <Button
              onClick={handleCreateReel}
              disabled={generating || selectedIds.length < 2}
              className="w-full h-11 text-sm font-semibold bg-gradient-to-r from-primary via-indigo-500 to-violet-600 hover:from-primary/90 hover:to-violet-700 shadow-md transition-all gap-2"
            >
              {generating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Rendering Travel Reel ({progress}%)
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Render Real Travel Reel ({duration}s MP4)
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Right Output & Preview Column */}
        <div className="lg:col-span-5 flex flex-col items-center justify-center p-4 rounded-2xl border border-border/50 bg-card/30 backdrop-blur-sm min-h-[420px]">
          {generating ? (
            /* Progress & Rendering State */
            <div className="w-full max-w-sm space-y-6 text-center py-8">
              <div className="relative mx-auto w-24 h-24 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                <Film className="h-10 w-10 text-primary animate-pulse" />
                <div className="absolute inset-0 rounded-2xl border-2 border-primary border-t-transparent animate-spin" />
              </div>

              <div className="space-y-2">
                <Badge variant="outline" className="px-3 py-1 text-xs font-semibold border-primary/30 text-primary bg-primary/5">
                  {getStageLabel(stage)}
                </Badge>
                <h3 className="text-base font-bold">FFmpeg Media Pipeline Active</h3>
                <p className="text-xs text-muted-foreground">
                  {statusMessage || "Processing video streams, transitions & audio ducking..."}
                </p>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="font-bold text-primary">{progress}%</span>
                </div>
                <Progress value={progress} className="h-2.5 bg-muted" />
              </div>
            </div>
          ) : completedReel?.output?.videoUrl ? (
            /* Completed Video Player */
            <div className="w-full flex flex-col items-center space-y-4">
              <div
                className={`relative rounded-xl overflow-hidden border border-border/80 shadow-2xl bg-black ${
                  aspectRatio === "9:16"
                    ? "w-[240px] aspect-[9/16]"
                    : aspectRatio === "1:1"
                    ? "w-[300px] aspect-square"
                    : "w-full max-w-[380px] aspect-[16/9]"
                }`}
              >
                <video
                  ref={videoRef}
                  src={completedReel.output.videoUrl}
                  controls
                  autoPlay
                  loop
                  playsInline
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="w-full max-w-sm space-y-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                  <span>Duration: {completedReel.duration || duration}s</span>
                  <span>Rendered in {((completedReel.output?.renderTimeMs || 0) / 1000).toFixed(1)}s</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs font-medium"
                    onClick={() => {
                      const a = document.createElement("a");
                      a.href = completedReel.output.videoUrl;
                      a.download = `reel_${completedReel._id || "advenza"}.mp4`;
                      a.target = "_blank";
                      a.click();
                    }}
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download MP4
                  </Button>

                  <Button
                    variant="default"
                    size="sm"
                    className="gap-1.5 text-xs font-medium"
                    onClick={handleShare}
                  >
                    {copiedShare ? <Check className="h-3.5 w-3.5" /> : <Share2 className="h-3.5 w-3.5" />}
                    {copiedShare ? "Link Copied!" : "Share Link"}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            /* Empty / Standby Placeholder */
            <div className="text-center p-6 space-y-4 max-w-xs">
              <div className="mx-auto w-16 h-16 rounded-2xl bg-muted/60 flex items-center justify-center text-muted-foreground">
                <Film className="h-8 w-8 opacity-70" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-semibold">Your Video Canvas</h4>
                <p className="text-xs text-muted-foreground">
                  Pick your favorite memories and music, then click Render to generate a real high-definition MP4 reel.
                </p>
              </div>

              {recentReels.length > 0 && (
                <div className="pt-4 border-t border-border/40 text-left w-full">
                  <span className="text-[11px] font-semibold text-muted-foreground block mb-2">
                    Recent Trip Reels ({recentReels.length})
                  </span>
                  <div className="space-y-2">
                    {recentReels.slice(0, 2).map((r) => (
                      <div
                        key={r._id}
                        onClick={() => setCompletedReel(r)}
                        className="flex items-center justify-between p-2 rounded-lg border border-border/50 bg-card hover:bg-muted/40 cursor-pointer text-xs"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <Play className="h-3 w-3 text-primary shrink-0" />
                          <span className="truncate font-medium">{r.text?.title || "Reel"}</span>
                        </div>
                        <Badge variant="outline" className="text-[10px] shrink-0">
                          {r.duration}s
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
