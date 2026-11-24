import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Share2,
  Copy,
  Check,
  Instagram,
  Download,
  ExternalLink,
  MessageCircle,
  Facebook,
  Send,
  Sparkles,
  Smartphone,
  MapPin,
  Calendar,
  Image as ImageIcon,
  Layers,
  Loader2,
  RefreshCw,
  Eye,
  WandSparkles,
  X,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { type MemoryMediaItem } from "./memory-lightbox";

// ─────────────────────────── Types ───────────────────────────

interface MemoryShareData {
  _id?: string;
  id?: string;
  place: string;
  date?: string;
  weather?: string;
  highlight?: string;
  caption?: string;
  media?: MemoryMediaItem[];
  mediaUrl?: string;
  photo?: string;
  category?: string;
}

interface PhotoCaption {
  id: string;
  style: string;
  tag: string;
  caption: string;
  focus?: string;
}

interface MemoryShareDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  memory: MemoryShareData | null;
}

// Tag colour palette (matches style IDs)
const TAG_COLORS: Record<string, string> = {
  Aesthetic: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  Storytelling: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
  Poetic: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  Adventure: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  Cinematic: "bg-slate-100 text-slate-700 dark:bg-slate-800/60 dark:text-slate-300",
  Casual: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  Emotional: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
  Trending: "bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300",
};

// ─────────────────────────── Component ───────────────────────────

export function MemoryShareDialog({
  isOpen,
  onOpenChange,
  memory,
}: MemoryShareDialogProps) {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCaptionId, setCopiedCaptionId] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  // Caption state
  const [captions, setCaptions] = useState<PhotoCaption[]>([]);
  const [visualSummary, setVisualSummary] = useState("");
  const [captionState, setCaptionState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [captionError, setCaptionError] = useState("");
  const [captionProvider, setCaptionProvider] = useState("");

  if (!memory) return null;

  const memoryId = memory._id || memory.id || "";
  const place = memory.place || "Unforgettable Destination";
  const date = memory.date || "";
  const rawStory = memory.highlight || memory.caption || `Making memories in ${place}.`;

  const primaryPhoto =
    memory.media?.[0]?.url ||
    (memory as any).mediaItems?.[0]?.storageUrl ||
    memory.mediaUrl ||
    memory.photo ||
    "";

  // All image URLs from the memory (photos only, no videos)
  const allImageUrls = (() => {
    const urls: string[] = [];
    if (Array.isArray(memory.media)) {
      memory.media.forEach((m) => {
        if (m.resourceType !== "video" && m.url) urls.push(m.url);
      });
    }
    if (Array.isArray((memory as any).mediaItems)) {
      (memory as any).mediaItems.forEach((m: any) => {
        const u = m.storageUrl || m.url || m.mediaUrl;
        if (u && m.mediaType !== "video" && m.resourceType !== "video") urls.push(u);
      });
    }
    if (urls.length === 0 && memory.mediaUrl) urls.push(memory.mediaUrl);
    if (urls.length === 0 && memory.photo) urls.push(memory.photo);
    return [...new Set(urls)];
  })();

  const mediaCount =
    Array.isArray(memory.media) && memory.media.length > 0
      ? memory.media.length
      : Array.isArray((memory as any).mediaItems) && (memory as any).mediaItems.length > 0
      ? (memory as any).mediaItems.length
      : 1;

  const origin = typeof window !== "undefined" ? window.location.origin : "https://advenza.travel";
  const shareUrl = memoryId ? `${origin}/memory?id=${memoryId}` : origin;

  // ─── Caption Generation ───────────────────────────────────────

  const generateCaptions = useCallback(async () => {
    setCaptionState("loading");
    setCaptionError("");
    setCaptions([]);
    setVisualSummary("");
    setCaptionProvider("");

    try {
      const payload: Record<string, any> = {
        place,
        highlight: rawStory,
        date,
        category: memory.category || "",
      };

      if (memoryId) {
        payload.memoryId = memoryId;
      }
      if (allImageUrls.length > 0) {
        payload.imageUrls = allImageUrls;
      }

      const res = await apiFetch("/api/memories/generate-captions", {
        method: "POST",
        body: JSON.stringify(payload),
        timeoutMs: 50_000,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.message || err?.error || `AI caption generation failed (${res.status})`);
      }

      const data = await res.json();

      if (!data.success || !Array.isArray(data.captions) || data.captions.length < 8) {
        throw new Error("AI returned an unexpected caption format. Please retry.");
      }

      setCaptions(data.captions);
      setVisualSummary(data.visualSummary || "");
      setCaptionProvider(data.provider || "");
      setCaptionState("done");
    } catch (err: any) {
      console.error("[MemoryShare] Caption generation error:", err);
      setCaptionError(err?.message || "Failed to analyze photos and generate captions.");
      setCaptionState("error");
    }
  }, [memoryId, allImageUrls, place, rawStory, date, memory.category]);

  // ─── Sharing Handlers ─────────────────────────────────────────

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedLink(true);
      toast.success("Shareable memory link copied!");
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      toast.error("Failed to copy link. Please copy manually.");
    }
  };

  const handleCopyCaption = async (caption: PhotoCaption) => {
    try {
      await navigator.clipboard.writeText(caption.caption);
      setCopiedCaptionId(caption.id);
      toast.success("Caption copied to clipboard!");
      setTimeout(() => setCopiedCaptionId(null), 2500);
    } catch {
      toast.error("Failed to copy caption.");
    }
  };

  const handleShareWhatsApp = () => {
    const message = `Check out this travel memory from ${place}: "${rawStory}"\n\nView full memory on Advenza: ${shareUrl}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
  };

  const handleShareFacebook = () => {
    const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${encodeURIComponent(`Travel memory from ${place}: "${rawStory}"`)}`;
    window.open(url, "_blank", "width=600,height=500,noopener,noreferrer");
  };

  const handleShareTwitter = () => {
    const tweetText = `Travel memories in ${place} on @AdvenzaTravel 🌍✨ "${rawStory.slice(0, 100)}"`;
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}&url=${encodeURIComponent(shareUrl)}`, "_blank", "width=600,height=500,noopener,noreferrer");
  };

  const handleShareTelegram = () => {
    const text = `Travel memory in ${place}: "${rawStory}"`;
    window.open(`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(text)}`, "_blank", "width=600,height=500,noopener,noreferrer");
  };

  const handleDownloadAndInstagram = async () => {
    if (!primaryPhoto) {
      toast.error("No media file available to save.");
      return;
    }
    setDownloading(true);
    try {
      // Copy best available caption
      const bestCaption = captions.find((c) => c.tag === "Aesthetic")?.caption ||
        captions[0]?.caption ||
        `Memories from ${place}. 🌍`;
      await navigator.clipboard.writeText(bestCaption).catch(() => {});

      const response = await fetch(primaryPhoto);
      const blob = await response.blob();
      const ext = blob.type.includes("video") ? "mp4" : "jpg";
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `advenza-${place.toLowerCase().replace(/\s+/g, "-")}.${ext}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);

      toast.success("Media downloaded & caption copied! Opening Instagram…");

      const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      setTimeout(() => {
        if (isMobile) {
          window.location.href = "instagram://camera";
        } else {
          window.open("https://www.instagram.com", "_blank", "noopener,noreferrer");
        }
      }, 600);
    } catch (err: any) {
      console.warn("Instagram download flow:", err);
      window.open(primaryPhoto, "_blank");
      toast.info("Opened media in new tab. Save it and open Instagram!");
    } finally {
      setDownloading(false);
    }
  };

  const canNativeShare = typeof navigator !== "undefined" && typeof navigator.share === "function";
  const handleNativeShare = async () => {
    if (!canNativeShare) { handleCopyLink(); return; }
    try {
      let filesToShare: File[] = [];
      if (primaryPhoto && navigator.canShare) {
        try {
          const resp = await fetch(primaryPhoto);
          const blob = await resp.blob();
          const ext = blob.type.includes("video") ? "mp4" : "jpg";
          const file = new File([blob], `memory-${place.toLowerCase()}.${ext}`, { type: blob.type });
          if (navigator.canShare({ files: [file] })) filesToShare = [file];
        } catch {}
      }
      await navigator.share({
        title: `Memory: ${place}`,
        text: `"${rawStory}" from my trip to ${place} via Advenza`,
        url: shareUrl,
        ...(filesToShare.length > 0 ? { files: filesToShare } : {}),
      });
    } catch (err: any) {
      if (err.name !== "AbortError") {
        toast.info("Share sheet closed or unsupported; link copied instead.");
        handleCopyLink();
      }
    }
  };

  // ─── Render ───────────────────────────────────────────────────

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-[580px] md:max-w-[640px] max-h-[90vh] overflow-hidden flex flex-col p-0 rounded-2xl border border-border/70 bg-background shadow-2xl">

        {/* ── Header ── */}
        <DialogHeader className="px-5 sm:px-6 pt-5 pb-3.5 border-b border-border/40 shrink-0 pr-12 text-left">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0 shadow-sm">
              <Share2 className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-base sm:text-lg font-semibold tracking-tight text-foreground truncate">
                Share Travel Memory
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5 truncate">
                Share this memory or generate AI captions from your photos.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* ── Scrollable Body ── */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-5 sm:px-6 py-4 space-y-4">

          {/* Memory Preview Card */}
          <div className="flex items-center gap-3.5 rounded-xl border border-border/60 bg-muted/20 p-3 transition-colors hover:bg-muted/30">
            <div className="relative h-16 w-16 sm:h-20 sm:w-20 shrink-0 overflow-hidden rounded-xl bg-muted border border-border/40 shadow-sm">
              {primaryPhoto ? (
                <img
                  src={primaryPhoto}
                  alt={place}
                  className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
                  loading="lazy"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                  <ImageIcon className="h-6 w-6" />
                </div>
              )}
              {mediaCount > 1 && (
                <span className="absolute bottom-1 right-1 inline-flex items-center gap-0.5 rounded-md bg-black/80 backdrop-blur-sm px-1.5 py-0.5 text-[9px] font-semibold text-white shadow-sm border border-white/20 pointer-events-none">
                  <Layers className="h-2.5 w-2.5" />
                  +{mediaCount - 1}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
                <h4 className="text-sm font-semibold text-foreground truncate">{place}</h4>
              </div>
              {date && (
                <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                  <Calendar className="h-3 w-3 shrink-0" />
                  <span>{date}</span>
                </p>
              )}
              <p className="text-xs text-muted-foreground/90 line-clamp-2 mt-1 leading-relaxed">
                "{rawStory}"
              </p>
            </div>
          </div>

          {/* Social Platforms Grid */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Share to Platforms
            </Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-2.5">
              {/* WhatsApp */}
              <button type="button" onClick={handleShareWhatsApp}
                className="group flex items-center gap-2.5 h-11 px-3 rounded-xl border border-border/60 bg-background hover:bg-muted/40 hover:border-[#25D366]/50 transition-all text-left shadow-sm min-w-0">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#25D366] text-white shadow-sm transition-transform group-hover:scale-105">
                  <MessageCircle className="h-3.5 w-3.5 fill-white" />
                </div>
                <span className="text-xs font-medium text-foreground truncate">WhatsApp</span>
              </button>

              {/* Instagram */}
              <button type="button" onClick={handleDownloadAndInstagram} disabled={downloading}
                className="group flex items-center gap-2.5 h-11 px-3 rounded-xl border border-border/60 bg-background hover:bg-muted/40 hover:border-pink-500/50 transition-all text-left shadow-sm min-w-0">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-tr from-amber-500 via-pink-500 to-purple-600 text-white shadow-sm transition-transform group-hover:scale-105">
                  <Instagram className="h-3.5 w-3.5" />
                </div>
                <span className="text-xs font-medium text-foreground truncate">Instagram</span>
              </button>

              {/* Facebook */}
              <button type="button" onClick={handleShareFacebook}
                className="group flex items-center gap-2.5 h-11 px-3 rounded-xl border border-border/60 bg-background hover:bg-muted/40 hover:border-[#1877F2]/50 transition-all text-left shadow-sm min-w-0">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#1877F2] text-white shadow-sm transition-transform group-hover:scale-105">
                  <Facebook className="h-3.5 w-3.5 fill-white" />
                </div>
                <span className="text-xs font-medium text-foreground truncate">Facebook</span>
              </button>

              {/* X (Twitter) */}
              <button type="button" onClick={handleShareTwitter}
                className="group flex items-center gap-2.5 h-11 px-3 rounded-xl border border-border/60 bg-background hover:bg-muted/40 hover:border-foreground/40 transition-all text-left shadow-sm min-w-0">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-black text-white dark:bg-white dark:text-black shadow-sm transition-transform group-hover:scale-105">
                  <span className="text-xs font-bold leading-none">𝕏</span>
                </div>
                <span className="text-xs font-medium text-foreground truncate">X (Twitter)</span>
              </button>

              {/* Telegram */}
              <button type="button" onClick={handleShareTelegram}
                className="group flex items-center gap-2.5 h-11 px-3 rounded-xl border border-border/60 bg-background hover:bg-muted/40 hover:border-[#0088cc]/50 transition-all text-left shadow-sm min-w-0">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#0088cc] text-white shadow-sm transition-transform group-hover:scale-105">
                  <Send className="h-3 w-3 fill-white ml-[-1px]" />
                </div>
                <span className="text-xs font-medium text-foreground truncate">Telegram</span>
              </button>

              {/* Device Share / Copy Link */}
              <button type="button" onClick={canNativeShare ? handleNativeShare : handleCopyLink}
                className="group flex items-center gap-2.5 h-11 px-3 rounded-xl border border-border/60 bg-background hover:bg-muted/40 hover:border-primary/50 transition-all text-left shadow-sm min-w-0">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary shadow-sm transition-transform group-hover:scale-105">
                  {canNativeShare ? <Smartphone className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                </div>
                <span className="text-xs font-medium text-foreground truncate">
                  {canNativeShare ? "Device Share" : "Copy Link"}
                </span>
              </button>
            </div>
          </div>

          {/* Shareable Link */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <ExternalLink className="h-3 w-3 text-primary" />
              Shareable Memory Link
            </Label>
            <div className="flex items-center gap-2 rounded-xl border border-border/70 bg-muted/20 p-1 pl-3 transition-colors focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20">
              <input
                type="text"
                readOnly
                value={shareUrl}
                className="w-full min-w-0 bg-transparent text-xs text-foreground/90 font-mono truncate focus:outline-none select-all"
              />
              <Button type="button" size="sm" onClick={handleCopyLink}
                className="h-8 px-3 shrink-0 rounded-lg text-xs gap-1.5 font-medium shadow-sm">
                {copiedLink ? (
                  <><Check className="h-3.5 w-3.5 text-emerald-400" /><span>Copied</span></>
                ) : (
                  <><Copy className="h-3.5 w-3.5" /><span>Copy</span></>
                )}
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Anyone with this link can view this memory and its full photo collage.
            </p>
          </div>

          {/* ── Photo-Aware Instagram Caption Studio ── */}
          <div className="rounded-2xl border border-pink-500/20 bg-gradient-to-br from-pink-500/[0.04] to-purple-500/[0.04] overflow-hidden">

            {/* Caption Studio Header */}
            <div className="px-4 py-3 border-b border-pink-500/15 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-pink-500/20 to-purple-500/20 text-pink-600 dark:text-pink-400">
                  <Sparkles className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-foreground">AI Caption Studio</p>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {allImageUrls.length > 0
                      ? `Analyzes your ${allImageUrls.length} photo${allImageUrls.length > 1 ? "s" : ""} · 8 styles`
                      : "Visual photo analysis · 8 unique styles"}
                  </p>
                </div>
              </div>

              {/* Generate / Regenerate button */}
              {captionState !== "loading" && (
                <Button
                  type="button"
                  size="sm"
                  onClick={generateCaptions}
                  variant={captionState === "idle" ? "default" : "outline"}
                  className={`h-8 px-3 text-xs gap-1.5 shrink-0 rounded-xl font-medium shadow-sm ${
                    captionState === "idle"
                      ? "bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white border-0"
                      : "border-pink-500/40 text-pink-600 dark:text-pink-400 hover:bg-pink-500/10"
                  }`}
                >
                  {captionState === "idle" ? (
                    <><WandSparkles className="h-3.5 w-3.5" /><span>Generate Captions</span></>
                  ) : (
                    <><RefreshCw className="h-3.5 w-3.5" /><span>Regenerate</span></>
                  )}
                </Button>
              )}
            </div>

            {/* Caption Body */}
            <div className="px-4 py-3">

              {/* IDLE — not yet generated */}
              {captionState === "idle" && (
                <div className="flex flex-col items-center justify-center gap-2.5 py-5 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-500/15 to-purple-500/15">
                    <Eye className="h-5 w-5 text-pink-500 dark:text-pink-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {allImageUrls.length > 0
                        ? `Generate captions from your ${allImageUrls.length} photo${allImageUrls.length > 1 ? "s" : ""}`
                        : "Generate photo-aware captions"}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-1 max-w-xs mx-auto leading-relaxed">
                      AI visually analyzes the actual images and writes 8 meaningfully different captions — Aesthetic, Poetic, Cinematic, Casual, and more.
                    </p>
                  </div>
                </div>
              )}

              {/* LOADING */}
              {captionState === "loading" && (
                <div className="flex flex-col items-center justify-center gap-3 py-6 text-center">
                  <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-500/15 to-purple-500/15">
                    <Loader2 className="h-5 w-5 animate-spin text-pink-500 dark:text-pink-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground animate-pulse">
                      Analyzing your photos…
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                      AI is reading the lighting, materials, atmosphere, and mood of each image to write truly visual captions.
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1">
                    {["Aesthetic", "Cinematic", "Poetic", "Trending"].map((s) => (
                      <span key={s} className="text-[10px] text-muted-foreground/70 bg-muted/60 rounded-full px-2 py-0.5 animate-pulse">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* ERROR */}
              {captionState === "error" && (
                <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3.5 space-y-2">
                  <div className="flex items-center gap-2 text-destructive">
                    <X className="h-4 w-4 shrink-0" />
                    <p className="text-xs font-semibold">Caption Generation Failed</p>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    {captionError}
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={generateCaptions}
                    className="h-8 px-3 text-xs gap-1.5 rounded-xl border-destructive/40 text-destructive hover:bg-destructive/10 mt-1"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Try Again
                  </Button>
                </div>
              )}

              {/* DONE — Captions displayed */}
              {captionState === "done" && captions.length > 0 && (
                <div className="space-y-2.5">
                  {/* Visual summary from AI */}
                  {visualSummary && (
                    <div className="flex items-start gap-2 rounded-lg bg-primary/5 border border-primary/15 px-3 py-2.5">
                      <Eye className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                      <p className="text-[11px] text-foreground/80 leading-relaxed italic">
                        {visualSummary}
                      </p>
                    </div>
                  )}

                  {/* Caption cards */}
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-0.5">
                    {captions.map((cap) => {
                      const tagColor = TAG_COLORS[cap.tag] || "bg-muted text-muted-foreground";
                      const isCopied = copiedCaptionId === cap.id;
                      return (
                        <div
                          key={cap.id}
                          className="group flex items-start gap-2.5 rounded-xl bg-background/90 p-3 border border-border/50 transition-all hover:border-pink-500/40 hover:shadow-sm"
                        >
                          <div className="flex-1 min-w-0 space-y-1.5">
                            <div className="flex items-center gap-1.5">
                              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${tagColor}`}>
                                {cap.tag}
                              </span>
                              {cap.focus && (
                                <span className="text-[10px] text-muted-foreground/70 truncate hidden sm:block">
                                  · {cap.focus}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-foreground/90 leading-relaxed">
                              {cap.caption}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleCopyCaption(cap)}
                            className="shrink-0 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors mt-0.5"
                            title="Copy caption"
                          >
                            {isCopied ? (
                              <Check className="h-3.5 w-3.5 text-emerald-500" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  {/* Provider attribution & tip */}
                  <div className="flex items-center justify-between pt-1">
                    <p className="text-[10px] text-muted-foreground leading-snug">
                      Tap copy → paste into Instagram caption field.
                    </p>
                    {captionProvider && (
                      <span className="text-[9px] text-muted-foreground/50 uppercase tracking-wide">
                        via {captionProvider}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="px-5 sm:px-6 py-3.5 border-t border-border/40 bg-muted/20 shrink-0 flex flex-wrap items-center justify-between gap-2.5">
          <div className="text-[11px] text-muted-foreground hidden sm:flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
            <span>High-res media ready to share</span>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {primaryPhoto && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                asChild
                className="h-8 text-xs gap-1.5 rounded-xl border-border/60"
              >
                <a href={primaryPhoto} target="_blank" rel="noopener noreferrer" download>
                  <Download className="h-3.5 w-3.5" />
                  <span>Download</span>
                </a>
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              onClick={handleDownloadAndInstagram}
              disabled={downloading}
              className="h-8 text-xs gap-1.5 rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white shadow-sm"
            >
              {downloading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Instagram className="h-3.5 w-3.5" />
              )}
              <span>Open in Instagram</span>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default MemoryShareDialog;
