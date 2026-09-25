import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Wand2,
  Download,
  Share2,
  Sparkles,
  Check,
  Copy,
  RefreshCw,
  LayoutGrid,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Calendar,
  MapPin,
  Eye,
  Layers,
  X,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";

export const LAYOUT_OPTIONS = [
  {
    id: "grid",
    label: "Balanced Grid",
    icon: "🪟",
    description: "Evenly balanced tiles across rows and columns",
  },
  {
    id: "hero",
    label: "Hero Spotlight",
    icon: "⭐",
    description: "One prominent lead photo with supporting moments",
  },
  {
    id: "editorial",
    label: "Travel Journal",
    icon: "📰",
    description: "Magazine layout with stylized typography & borders",
  },
  {
    id: "polaroid",
    label: "Polaroid Scrapbook",
    icon: "📷",
    description: "Classic white photo cards with subtle natural tilt",
  },
  {
    id: "masonry",
    label: "Dynamic Masonry",
    icon: "🧱",
    description: "Staggered multi-column collage preserving orientations",
  },
];

export const ASPECT_RATIOS = [
  { id: "1:1", label: "1:1 Square", sub: "Instagram Feed" },
  { id: "4:5", label: "4:5 Portrait", sub: "Instagram Post" },
  { id: "3:4", label: "3:4 Classic", sub: "Photo Album" },
  { id: "16:9", label: "16:9 Landscape", sub: "Desktop & TV" },
  { id: "9:16", label: "9:16 Vertical", sub: "Stories & Reels" },
];

export const THEME_OPTIONS = [
  { id: "dark", label: "Deep Slate", color: "#090D16" },
  { id: "light", label: "Clean White", color: "#F8FAFC" },
  { id: "warm", label: "Warm Cream", color: "#FAF6F0" },
  { id: "ocean", label: "Deep Ocean", color: "#0B192C" },
  { id: "sand", label: "Desert Sand", color: "#EFE9DF" },
  { id: "sunset", label: "Sunset Glow", color: "#281424" },
  { id: "blur", label: "Blurred Canvas", color: "linear-gradient(135deg, #1e293b, #0f172a)" },
];

export interface CollageCreatorProps {
  tripId?: string;
  memory?: any;
  allMemories?: any[];
  initialSelectedIds?: string[];
  onClose?: () => void;
  onCollageCreated?: (collage: any) => void;
}

export function CollageCreator({
  tripId,
  memory,
  allMemories = [],
  initialSelectedIds = [],
  onClose,
  onCollageCreated,
}: CollageCreatorProps) {
  // Candidate memories
  const [candidates, setCandidates] = useState<any[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Collage options
  const [selectedLayout, setSelectedLayout] = useState("grid");
  const [selectedAspectRatio, setSelectedAspectRatio] = useState("1:1");
  const [selectedTheme, setSelectedTheme] = useState("dark");
  const [customTitle, setCustomTitle] = useState("");
  const [customSubtitle, setCustomSubtitle] = useState("");

  // Generation & Polling State
  const [generating, setGenerating] = useState(false);
  const [activeCollageId, setActiveCollageId] = useState<string | null>(null);
  const [collageStatus, setCollageStatus] = useState<string>("");
  const [progressMessage, setProgressMessage] = useState<string>("");
  const [completedCollage, setCompletedCollage] = useState<any | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [copiedShare, setCopiedShare] = useState(false);

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize memories
  useEffect(() => {
    const effectiveTripId = tripId || memory?.tripId;

    if (allMemories.length > 0) {
      setCandidates(allMemories);
      const initialIds =
        initialSelectedIds.length > 0
          ? initialSelectedIds
          : memory
          ? [memory._id || memory.id]
          : allMemories.slice(0, 6).map((m) => m._id || m.id);
      setSelectedIds(initialIds.filter(Boolean));
    } else if (effectiveTripId) {
      setLoadingCandidates(true);
      apiFetch(`/api/memories?tripId=${effectiveTripId}`)
        .then((data: any) => {
          const list = Array.isArray(data) ? data : data.memories || data.items || [];
          setCandidates(list);
          const initialIds =
            initialSelectedIds.length > 0
              ? initialSelectedIds
              : memory
              ? [memory._id || memory.id]
              : list.slice(0, 6).map((m: any) => m._id || m.id);
          setSelectedIds(initialIds.filter(Boolean));
        })
        .catch((err) => {
          console.error("Failed to load candidate memories:", err);
        })
        .finally(() => setLoadingCandidates(false));
    }
  }, [tripId, memory, allMemories, initialSelectedIds]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  const toggleSelectMemory = (id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((item) => item !== id);
      } else {
        if (prev.length >= 20) {
          toast.error("Maximum 20 memories allowed per collage");
          return prev;
        }
        return [...prev, id];
      }
    });
  };

  // Start Generation
  const handleGenerate = async () => {
    if (selectedIds.length < 2) {
      toast.error("Please select at least 2 memories to create a collage.");
      return;
    }

    const effectiveTripId = tripId || memory?.tripId || candidates[0]?.tripId;
    if (!effectiveTripId) {
      toast.error("No valid trip found for collage generation.");
      return;
    }

    setGenerating(true);
    setGenerationError(null);
    setCompletedCollage(null);
    setCollageStatus("queued");
    setProgressMessage("1/3: Queuing collage generation job...");

    try {
      const response = await apiFetch("/api/collages", {
        method: "POST",
        body: JSON.stringify({
          tripId: effectiveTripId,
          memoryIds: selectedIds,
          layout: selectedLayout,
          aspectRatio: selectedAspectRatio,
          theme: selectedTheme,
          title: customTitle.trim(),
          subtitle: customSubtitle.trim(),
          format: "webp",
          quality: "standard",
        }),
      });

      const collageId = response.collageId;
      setActiveCollageId(collageId);

      // Start Polling loop every 1500ms
      startPolling(collageId);
    } catch (err: any) {
      setGenerating(false);
      setGenerationError(err.message || "Failed to start collage generation");
      toast.error(err.message || "Failed to create collage");
    }
  };

  const startPolling = (collageId: string) => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

    let pollAttempts = 0;
    const maxPolls = 40; // 60 seconds max

    pollIntervalRef.current = setInterval(async () => {
      pollAttempts++;

      try {
        const collage = await apiFetch(`/api/collages/${collageId}`);
        setCollageStatus(collage.status);

        if (collage.status === "processing") {
          setProgressMessage("2/3: Sharp engine compositing photo tiles & styling...");
        } else if (collage.status === "completed") {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          setCompletedCollage(collage);
          setGenerating(false);
          setProgressMessage("3/3: Collage generated successfully!");
          toast.success("Travel collage generated!");
          if (onCollageCreated) onCollageCreated(collage);
        } else if (collage.status === "failed") {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          setGenerating(false);
          setGenerationError(collage.error || "Collage generation failed.");
          toast.error(collage.error || "Failed to generate collage.");
        }

        if (pollAttempts >= maxPolls) {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          setGenerating(false);
          setGenerationError("Generation timed out. The server is still working in the background.");
        }
      } catch (pollErr: any) {
        console.error("Polling error:", pollErr);
      }
    }, 1500);
  };

  // Direct download
  const handleDownload = () => {
    if (!completedCollage?.output?.url) return;
    const link = document.createElement("a");
    link.href = completedCollage.output.url;
    link.download = `Advenza_Collage_${completedCollage.layout}_${Date.now()}.webp`;
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Native Web Share API with Link fallback
  const handleShare = async () => {
    if (!completedCollage) return;

    try {
      const shareRes = await apiFetch(`/api/collages/${completedCollage._id}/share`, {
        method: "POST",
      });

      const shareUrl = shareRes.shareUrl || completedCollage.output?.url;

      if (navigator.share) {
        await navigator.share({
          title: completedCollage.title || "Advenza Travel Collage",
          text: `Check out my travel collage for ${completedCollage.subtitle || "my trip"}!`,
          url: shareUrl,
        });
        toast.success("Shared successfully!");
      } else {
        await navigator.clipboard.writeText(shareUrl);
        setCopiedShare(true);
        toast.success("Share link copied to clipboard!");
        setTimeout(() => setCopiedShare(false), 2500);
      }
    } catch (shareErr) {
      console.warn("Share failed, falling back to copy:", shareErr);
      if (completedCollage.output?.url) {
        await navigator.clipboard.writeText(completedCollage.output.url);
        setCopiedShare(true);
        toast.success("Image URL copied to clipboard!");
        setTimeout(() => setCopiedShare(false), 2500);
      }
    }
  };

  return (
    <div className="flex flex-col gap-5 text-foreground">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/40 pb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Wand2 className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold text-base leading-tight">Server-Side Collage Studio</h3>
            <p className="text-xs text-muted-foreground">
              Composed with Sharp engine · Stored in Cloud Storage
            </p>
          </div>
        </div>
        {onClose && (
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 rounded-full">
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {!completedCollage ? (
        <div className="space-y-5">
          {/* Step 1: Select Memories */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <ImageIcon className="h-3.5 w-3.5 text-primary" />
                1. Select Photos ({selectedIds.length}/20)
              </Label>
              <div className="flex items-center gap-2 text-xs">
                {candidates.length > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedIds(
                        selectedIds.length === candidates.length
                          ? []
                          : candidates.slice(0, 12).map((c) => c._id || c.id)
                      )
                    }
                    className="text-primary hover:underline text-[11px]"
                  >
                    {selectedIds.length === candidates.length ? "Deselect All" : "Select First 12"}
                  </button>
                )}
              </div>
            </div>

            {loadingCandidates ? (
              <div className="flex items-center justify-center py-8 text-xs text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin text-primary" />
                Loading trip photos…
              </div>
            ) : candidates.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/60 p-6 text-center text-xs text-muted-foreground">
                No memories found. Add trip memories first to generate a collage.
              </div>
            ) : (
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-44 overflow-y-auto p-1 border border-border/40 rounded-xl bg-background/50">
                {candidates.map((mem) => {
                  const id = mem._id || mem.id;
                  const isSelected = selectedIds.includes(id);
                  const thumb = mem.thumbnailUrl || mem.mediaUrl || mem.photo;

                  return (
                    <div
                      key={id}
                      onClick={() => toggleSelectMemory(id)}
                      className={`relative aspect-square rounded-lg overflow-hidden cursor-pointer border-2 transition-all ${
                        isSelected
                          ? "border-primary ring-2 ring-primary/30 scale-95"
                          : "border-transparent opacity-75 hover:opacity-100"
                      }`}
                    >
                      <img src={thumb} alt={mem.place || "Photo"} className="h-full w-full object-cover" />
                      {isSelected && (
                        <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                          <Check className="h-4 w-4 text-white drop-shadow-md stroke-[3]" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {selectedIds.length < 2 && (
              <p className="text-[11px] text-amber-500 font-medium">
                * Please select at least 2 memories for collage composition.
              </p>
            )}
          </div>

          {/* Step 2: Choose Layout */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold flex items-center gap-1.5">
              <LayoutGrid className="h-3.5 w-3.5 text-primary" />
              2. Choose Layout
            </Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {LAYOUT_OPTIONS.map((layout) => (
                <button
                  key={layout.id}
                  type="button"
                  onClick={() => setSelectedLayout(layout.id)}
                  className={`rounded-xl border p-2.5 text-left transition-all ${
                    selectedLayout === layout.id
                      ? "border-primary bg-primary/10 shadow-sm"
                      : "border-border/60 bg-background/50 hover:bg-background/80"
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm">{layout.icon}</span>
                    <span className="text-xs font-semibold">{layout.label}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">
                    {layout.description}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Step 3: Choose Aspect Ratio */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-primary" />
              3. Aspect Ratio
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {ASPECT_RATIOS.map((ratio) => (
                <button
                  key={ratio.id}
                  type="button"
                  onClick={() => setSelectedAspectRatio(ratio.id)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium border transition-all ${
                    selectedAspectRatio === ratio.id
                      ? "border-primary bg-primary text-white shadow-sm"
                      : "border-border/60 bg-background/50 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <span>{ratio.label}</span>
                  <span className="ml-1 opacity-70 text-[10px]">({ratio.sub})</span>
                </button>
              ))}
            </div>
          </div>

          {/* Step 4: Choose Background Theme */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold">4. Background & Theme</Label>
            <div className="flex flex-wrap gap-2">
              {THEME_OPTIONS.map((th) => (
                <button
                  key={th.id}
                  type="button"
                  onClick={() => setSelectedTheme(th.id)}
                  className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-all ${
                    selectedTheme === th.id
                      ? "border-primary ring-2 ring-primary/30"
                      : "border-border/60 bg-background/50 opacity-80 hover:opacity-100"
                  }`}
                >
                  <span
                    className="h-3 w-3 rounded-full border border-black/20"
                    style={{ background: th.color }}
                  />
                  <span>{th.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Step 5: Optional Title / Subtitle */}
          {(selectedLayout === "editorial" || selectedLayout === "hero") && (
            <div className="grid grid-cols-2 gap-3 border-t border-border/40 pt-3">
              <div className="space-y-1">
                <Label className="text-xs">Journal Title</Label>
                <Input
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  placeholder="e.g. Rajasthan Horizons"
                  className="text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Destination & Dates</Label>
                <Input
                  value={customSubtitle}
                  onChange={(e) => setCustomSubtitle(e.target.value)}
                  placeholder="e.g. Jaipur & Udaipur · Oct 2026"
                  className="text-xs"
                />
              </div>
            </div>
          )}

          {/* Generating Progress State */}
          {generating && (
            <div className="space-y-2 rounded-xl bg-primary/5 border border-primary/20 p-4">
              <div className="flex items-center justify-between text-xs font-semibold text-primary">
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {progressMessage}
                </span>
                <Badge variant="outline" className="text-[10px] text-primary border-primary/30 animate-pulse">
                  {collageStatus.toUpperCase()}
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Your images are being composited, normalized, and encoded on the backend.
              </p>
            </div>
          )}

          {generationError && (
            <div className="flex items-center gap-2 rounded-xl bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive font-medium">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{generationError}</span>
            </div>
          )}

          {/* Action Trigger */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/40">
            {onClose && (
              <Button variant="outline" onClick={onClose} disabled={generating}>
                Cancel
              </Button>
            )}
            <Button
              onClick={handleGenerate}
              disabled={generating || selectedIds.length < 2}
              className="bg-gradient-to-r from-primary to-accent text-white shadow-md shadow-primary/20"
            >
              {generating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating Real Collage…
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generate Real Collage
                </>
              )}
            </Button>
          </div>
        </div>
      ) : (
        /* Completed State: Real Generated Image */
        <div className="space-y-4 animate-in fade-in zoom-in-95 duration-300">
          <div className="relative rounded-2xl overflow-hidden border border-border/70 shadow-xl bg-black/60 flex items-center justify-center max-h-[60vh]">
            <img
              src={completedCollage.output?.url}
              alt="Generated Travel Collage"
              className="w-full h-full object-contain max-h-[58vh]"
            />
          </div>

          {/* Metadata Card */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground border border-border/40">
            <div className="flex items-center gap-3">
              <span>
                <strong>Resolution:</strong> {completedCollage.output?.width} × {completedCollage.output?.height}px
              </span>
              <span>
                <strong>Format:</strong> {completedCollage.output?.format?.toUpperCase()}
              </span>
              <span>
                <strong>Size:</strong> {((completedCollage.output?.fileSize || 0) / 1024).toFixed(1)} KB
              </span>
            </div>
            {completedCollage.processingTimeMs > 0 && (
              <span className="text-[11px] text-primary font-medium">
                Rendered in {completedCollage.processingTimeMs}ms
              </span>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/40">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setCompletedCollage(null);
                setGenerating(false);
              }}
              className="text-xs"
            >
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              Adjust & Re-generate
            </Button>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleShare}
                className="text-xs"
              >
                {copiedShare ? (
                  <>
                    <Check className="mr-1.5 h-3.5 w-3.5 text-emerald-500" />
                    Link Copied
                  </>
                ) : (
                  <>
                    <Share2 className="mr-1.5 h-3.5 w-3.5" />
                    Share
                  </>
                )}
              </Button>

              <Button
                size="sm"
                onClick={handleDownload}
                className="bg-primary text-white text-xs shadow-md"
              >
                <Download className="mr-1.5 h-3.5 w-3.5" />
                Download Collage
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CollageCreator;
