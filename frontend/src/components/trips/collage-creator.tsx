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

export interface CandidatePhoto {
  id: string; // unique ID for selection in UI: `${memId}_${index}` or item._id
  url: string;
  thumbnailUrl: string;
  memoryId: string;
  place?: string;
  date?: string;
  caption?: string;
}

export interface CollageCreatorProps {
  tripId?: string;
  memory?: any;
  allMemories?: any[];
  initialSelectedIds?: string[];
  onClose?: () => void;
  onCollageCreated?: (collage: any) => void;
}

/**
 * Extracts all non-video photos from a memory document, supporting
 * `media` (Cloudinary array), `mediaItems` (Firebase array), or legacy `mediaUrl`.
 */
export function extractPhotosFromMemory(mem: any): CandidatePhoto[] {
  if (!mem) return [];
  const memId = String(mem._id || mem.id || "mem");
  const photos: CandidatePhoto[] = [];

  // Check mem.media array (Cloudinary multi-media)
  if (Array.isArray(mem.media) && mem.media.length > 0) {
    mem.media.forEach((item: any, idx: number) => {
      if (item && item.url && item.resourceType !== "video") {
        photos.push({
          id: item._id ? String(item._id) : `${memId}_media_${idx}`,
          url: item.url,
          thumbnailUrl: item.thumbnailUrl || item.url,
          memoryId: memId,
          place: mem.place,
          date: mem.date,
          caption: mem.caption || mem.highlight,
        });
      }
    });
  }

  // Check mem.mediaItems array (used in trip-memories-tab)
  if (photos.length === 0 && Array.isArray(mem.mediaItems) && mem.mediaItems.length > 0) {
    mem.mediaItems.forEach((item: any, idx: number) => {
      const url = item.storageUrl || item.url;
      if (url && item.type !== "video" && item.resourceType !== "video") {
        photos.push({
          id: item.id ? String(item.id) : `${memId}_item_${idx}`,
          url,
          thumbnailUrl: url,
          memoryId: memId,
          place: mem.place,
          date: mem.date,
          caption: mem.highlight,
        });
      }
    });
  }

  // Fallback single image
  if (photos.length === 0) {
    const singleUrl = mem.thumbnailUrl || mem.mediaUrl || mem.photo;
    if (singleUrl && mem.mediaType !== "video") {
      photos.push({
        id: `${memId}_single_0`,
        url: singleUrl,
        thumbnailUrl: singleUrl,
        memoryId: memId,
        place: mem.place,
        date: mem.date,
        caption: mem.highlight || mem.caption,
      });
    }
  }

  return photos;
}

export function CollageCreator({
  tripId,
  memory,
  allMemories = [],
  initialSelectedIds = [],
  onClose,
  onCollageCreated,
}: CollageCreatorProps) {
  // Candidate individual photos (extracted from memories)
  const [candidates, setCandidates] = useState<CandidatePhoto[]>([]);
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

  // Helper to extract photos from given memories
  const buildPhotoList = (primaryMemory: any, sourceMemories: any[]): CandidatePhoto[] => {
    const photos: CandidatePhoto[] = [];

    // 1. If a specific memory is provided, extract ALL its photos first
    if (primaryMemory) {
      const primaryPhotos = extractPhotosFromMemory(primaryMemory);
      photos.push(...primaryPhotos);
    }

    // 2. If other memories are available, also append their photos
    if (Array.isArray(sourceMemories) && sourceMemories.length > 0) {
      sourceMemories.forEach((mem) => {
        const primaryMemId = primaryMemory ? String(primaryMemory._id || primaryMemory.id) : null;
        const currentMemId = String(mem._id || mem.id);
        if (primaryMemId && currentMemId === primaryMemId) {
          // Already extracted as primary memory photos
          return;
        }
        const memPhotos = extractPhotosFromMemory(mem);
        photos.push(...memPhotos);
      });
    }

    return photos;
  };

  // Initialize candidate photos
  useEffect(() => {
    const effectiveTripId =
      tripId ||
      (typeof memory?.tripId === "object" ? memory?.tripId?._id : memory?.tripId) ||
      (allMemories.length > 0
        ? typeof allMemories[0]?.tripId === "object"
          ? allMemories[0]?.tripId?._id
          : allMemories[0]?.tripId
        : undefined);

    if (memory || (allMemories && allMemories.length > 0)) {
      const photoList = buildPhotoList(memory, allMemories);
      setCandidates(photoList);

      // Set initial selection
      if (initialSelectedIds && initialSelectedIds.length > 0) {
        const matched = photoList
          .filter((p) => initialSelectedIds.includes(p.id) || initialSelectedIds.includes(p.memoryId))
          .map((p) => p.id);
        setSelectedIds(matched.length > 0 ? matched : photoList.slice(0, 12).map((p) => p.id));
      } else if (memory) {
        // When opening for a specific memory, select ALL photos belonging to that memory by default
        const memId = String(memory._id || memory.id);
        const thisMemPhotoIds = photoList.filter((p) => p.memoryId === memId).map((p) => p.id);
        setSelectedIds(thisMemPhotoIds.slice(0, 20));
      } else {
        setSelectedIds(photoList.slice(0, 12).map((p) => p.id));
      }
    } else if (effectiveTripId) {
      setLoadingCandidates(true);
      apiFetch(`/api/memories?tripId=${effectiveTripId}`)
        .then((data: any) => {
          const list = Array.isArray(data) ? data : data.memories || data.items || [];
          const photoList = buildPhotoList(memory, list);
          setCandidates(photoList);
          setSelectedIds(photoList.slice(0, 12).map((p) => p.id));
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

  const toggleSelectPhoto = (id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((item) => item !== id);
      } else {
        if (prev.length >= 20) {
          toast.error("Maximum 20 photos allowed per collage");
          return prev;
        }
        return [...prev, id];
      }
    });
  };

  const handleSelectAllToggle = () => {
    if (selectedIds.length === candidates.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(candidates.slice(0, 20).map((c) => c.id));
    }
  };

  // Start Generation
  const handleGenerate = async () => {
    const selectedPhotos = candidates.filter((p) => selectedIds.includes(p.id));
    if (selectedPhotos.length < 2) {
      toast.error("Please select at least 2 photos to create a collage.");
      return;
    }

    const selectedImageUrls = selectedPhotos.map((p) => p.url);
    const selectedMemoryIds = [...new Set(selectedPhotos.map((p) => p.memoryId))];

    const effectiveTripId =
      tripId ||
      (typeof memory?.tripId === "object" ? memory?.tripId?._id : memory?.tripId) ||
      (allMemories.length > 0
        ? typeof allMemories[0]?.tripId === "object"
          ? allMemories[0]?.tripId?._id
          : allMemories[0]?.tripId
        : undefined) ||
      selectedPhotos[0]?.memoryId;

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
          memoryIds: selectedMemoryIds,
          imageUrls: selectedImageUrls,
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
          setGenerationError("Generation timed out. Please try again with fewer photos.");
        }
      } catch (err: any) {
        if (pollAttempts >= 3) {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          setGenerating(false);
          setGenerationError(err.message || "Polling connection error.");
        }
      }
    }, 1500);
  };

  const handleShareLink = async () => {
    if (!completedCollage?._id) return;

    try {
      const res = await apiFetch(`/api/collages/${completedCollage._id}/share`, {
        method: "POST",
      });
      if (res?.shareUrl) {
        await navigator.clipboard.writeText(res.shareUrl);
        setCopiedShare(true);
        toast.success("Public collage link copied to clipboard!");
        setTimeout(() => setCopiedShare(false), 3000);
      }
    } catch {
      toast.error("Could not copy share link.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Studio Header */}
      <div className="flex items-center justify-between border-b border-border/40 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <LayoutGrid className="h-5 w-5" />
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
          {/* Step 1: Select Photos */}
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
                    onClick={handleSelectAllToggle}
                    className="text-primary hover:underline text-[11px] font-medium"
                  >
                    {selectedIds.length === candidates.length ? "Deselect All" : "Select All"}
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
                No photos found in this memory.
              </div>
            ) : (
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-48 overflow-y-auto p-1.5 border border-border/40 rounded-xl bg-background/50">
                {candidates.map((photo, index) => {
                  const isSelected = selectedIds.includes(photo.id);
                  const selectedOrder = selectedIds.indexOf(photo.id) + 1;

                  return (
                    <div
                      key={photo.id}
                      onClick={() => toggleSelectPhoto(photo.id)}
                      className={`group relative aspect-square rounded-lg overflow-hidden cursor-pointer border-2 transition-all ${
                        isSelected
                          ? "border-primary ring-2 ring-primary/40 scale-95 shadow-md"
                          : "border-border/40 opacity-70 hover:opacity-100 hover:border-primary/50"
                      }`}
                      title={photo.place ? `${photo.place} (Photo ${index + 1})` : `Photo ${index + 1}`}
                    >
                      <img
                        src={photo.thumbnailUrl || photo.url}
                        alt={`Photo ${index + 1}`}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        loading="lazy"
                      />
                      {isSelected && (
                        <div className="absolute inset-0 bg-primary/20 backdrop-blur-[0.5px] flex items-center justify-center">
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md">
                            <Check className="h-3.5 w-3.5 stroke-[3]" />
                          </div>
                          {selectedIds.length > 1 && (
                            <span className="absolute top-1 left-1 flex h-4 w-4 items-center justify-center rounded-full bg-black/75 text-[9px] font-bold text-white shadow-sm">
                              {selectedOrder}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {selectedIds.length < 2 && (
              <p className="text-[11px] text-amber-500 font-medium">
                * Please select at least 2 photos to generate a collage.
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
                    <span className="text-base">{layout.icon}</span>
                    <span className="text-xs font-semibold">{layout.label}</span>
                  </div>
                  <p className="mt-1 text-[10px] text-muted-foreground line-clamp-1 leading-snug">
                    {layout.description}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Step 3: Aspect Ratio */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-primary" />
              3. Aspect Ratio
            </Label>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {ASPECT_RATIOS.map((ar) => (
                <button
                  key={ar.id}
                  type="button"
                  onClick={() => setSelectedAspectRatio(ar.id)}
                  className={`rounded-xl border p-2 text-center transition-all ${
                    selectedAspectRatio === ar.id
                      ? "border-primary bg-primary/10 shadow-sm"
                      : "border-border/60 bg-background/50 hover:bg-background/80"
                  }`}
                >
                  <div className="text-xs font-semibold">{ar.label}</div>
                  <div className="text-[10px] text-muted-foreground">{ar.sub}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Step 4: Background Palette */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold">4. Background Palette</Label>
            <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
              {THEME_OPTIONS.map((th) => (
                <button
                  key={th.id}
                  type="button"
                  onClick={() => setSelectedTheme(th.id)}
                  className={`flex items-center justify-center gap-1.5 rounded-xl border p-2 text-xs font-medium transition-all ${
                    selectedTheme === th.id
                      ? "border-primary bg-primary/10 ring-2 ring-primary/20 shadow-sm"
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
          <div className="relative rounded-2xl overflow-hidden border border-border/60 bg-muted/20 shadow-xl max-h-[480px] flex items-center justify-center">
            <img
              src={completedCollage.output?.url}
              alt={completedCollage.title || "Generated Collage"}
              className="max-h-[460px] w-auto object-contain rounded-lg shadow-inner"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                asChild
              >
                <a href={completedCollage.output?.url} target="_blank" rel="noopener noreferrer" download>
                  <Download className="mr-1.5 h-3.5 w-3.5" />
                  Download
                </a>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleShareLink}
              >
                {copiedShare ? (
                  <>
                    <Check className="mr-1.5 h-3.5 w-3.5 text-emerald-500" />
                    Copied
                  </>
                ) : (
                  <>
                    <Share2 className="mr-1.5 h-3.5 w-3.5" />
                    Share Link
                  </>
                )}
              </Button>
            </div>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setCompletedCollage(null);
                setGenerating(false);
              }}
            >
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              Create Another
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default CollageCreator;
