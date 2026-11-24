import { useState, useEffect, useCallback, useRef } from "react";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Download,
  Share2,
  Film,
  Play,
  Maximize2,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export interface MemoryMediaItem {
  _id?: string;
  url: string;
  publicId?: string;
  resourceType?: "image" | "video";
  format?: string;
  width?: number;
  height?: number;
  duration?: number;
  originalName?: string;
}

interface MemoryLightboxProps {
  isOpen: boolean;
  onClose: () => void;
  media: MemoryMediaItem[];
  initialIndex?: number;
  place?: string;
  date?: string;
  onShare?: () => void;
}

export function MemoryLightbox({
  isOpen,
  onClose,
  media,
  initialIndex = 0,
  place = "Travel Memory",
  date = "",
  onShare,
}: MemoryLightboxProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    setCurrentIndex(initialIndex);
  }, [initialIndex, isOpen]);

  const total = media.length;
  const currentItem = media[currentIndex] || media[0];

  const handlePrev = useCallback(() => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : total - 1));
  }, [total]);

  const handleNext = useCallback(() => {
    setCurrentIndex((prev) => (prev < total - 1 ? prev + 1 : 0));
  }, [total]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowLeft") {
        handlePrev();
      } else if (e.key === "ArrowRight") {
        handleNext();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handlePrev, handleNext, onClose]);

  // Touch swipe support for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    touchStartX.current = null;

    if (Math.abs(diff) > 50) {
      if (diff > 0) {
        handleNext(); // Swiped left -> next
      } else {
        handlePrev(); // Swiped right -> prev
      }
    }
  };

  const handleDownload = async () => {
    if (!currentItem?.url) return;
    try {
      const response = await fetch(currentItem.url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      const ext = currentItem.resourceType === "video" ? "mp4" : "jpg";
      a.download = currentItem.originalName || `memory-${place.toLowerCase().replace(/\s+/g, "-")}-${currentIndex + 1}.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(currentItem.url, "_blank");
    }
  };

  if (!isOpen || total === 0 || !currentItem) return null;

  const isVideo = currentItem.resourceType === "video";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Media Lightbox"
      className="fixed inset-0 z-50 flex flex-col justify-between bg-black/95 backdrop-blur-md animate-in fade-in duration-200 select-none"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Top Controls Bar */}
      <div className="flex items-center justify-between p-4 z-10 bg-gradient-to-b from-black/80 to-transparent">
        <div className="flex flex-col">
          <h3 className="text-base font-semibold text-white truncate max-w-xs sm:max-w-md">
            {place}
          </h3>
          <span className="text-xs text-white/70">
            {date ? `${date} · ` : ""}
            Item {currentIndex + 1} of {total}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {onShare && (
            <Button
              size="sm"
              variant="ghost"
              onClick={onShare}
              className="text-white hover:bg-white/20 h-9 px-3 gap-1.5"
              title="Share Memory"
            >
              <Share2 className="h-4 w-4" />
              <span className="hidden sm:inline text-xs">Share</span>
            </Button>
          )}

          <Button
            size="sm"
            variant="ghost"
            onClick={handleDownload}
            className="text-white hover:bg-white/20 h-9 px-3 gap-1.5"
            title="Download Media"
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline text-xs">Download</span>
          </Button>

          <Button
            size="icon"
            variant="ghost"
            onClick={onClose}
            className="text-white hover:bg-white/20 h-9 w-9 rounded-full"
            title="Close Lightbox (Esc)"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Main Media Display Area */}
      <div className="relative flex-1 flex items-center justify-center p-2 sm:p-6 min-h-0">
        {isVideo ? (
          <div className="relative max-h-[78vh] max-w-full flex items-center justify-center">
            <video
              src={currentItem.url}
              controls
              autoPlay
              playsInline
              className="max-h-[78vh] max-w-full rounded-xl shadow-2xl bg-black"
            />
          </div>
        ) : (
          <div className="relative max-h-[78vh] max-w-full flex items-center justify-center">
            <img
              src={currentItem.url}
              alt={currentItem.originalName || `${place} photo ${currentIndex + 1}`}
              className="max-h-[78vh] max-w-full object-contain rounded-xl shadow-2xl transition-all duration-300"
            />
          </div>
        )}

        {/* Previous Button */}
        {total > 1 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handlePrev();
            }}
            className="absolute left-2 sm:left-6 top-1/2 -translate-y-1/2 flex h-11 w-11 items-center justify-center rounded-full bg-black/60 hover:bg-black/90 text-white backdrop-blur-md transition-all shadow-xl hover:scale-110 active:scale-95"
            title="Previous (Left Arrow)"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
        )}

        {/* Next Button */}
        {total > 1 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleNext();
            }}
            className="absolute right-2 sm:right-6 top-1/2 -translate-y-1/2 flex h-11 w-11 items-center justify-center rounded-full bg-black/60 hover:bg-black/90 text-white backdrop-blur-md transition-all shadow-xl hover:scale-110 active:scale-95"
            title="Next (Right Arrow)"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        )}
      </div>

      {/* Bottom Filmstrip Thumbnails */}
      {total > 1 && (
        <div className="p-3 z-10 bg-gradient-to-t from-black/90 via-black/60 to-transparent">
          <div className="flex items-center justify-center gap-2 overflow-x-auto py-1 px-2 no-scrollbar max-w-4xl mx-auto">
            {media.map((item, idx) => {
              const isActive = idx === currentIndex;
              const isItemVideo = item.resourceType === "video";
              return (
                <button
                  key={item.url || idx}
                  type="button"
                  onClick={() => setCurrentIndex(idx)}
                  className={`relative flex-shrink-0 w-14 h-14 sm:w-16 sm:h-16 rounded-lg overflow-hidden border-2 transition-all ${
                    isActive
                      ? "border-primary ring-2 ring-primary/50 scale-105 opacity-100 shadow-lg"
                      : "border-white/20 opacity-50 hover:opacity-100 hover:scale-100"
                  }`}
                >
                  {isItemVideo ? (
                    <div className="w-full h-full bg-zinc-900 flex items-center justify-center">
                      <Play className="h-4 w-4 fill-white text-white" />
                      <span className="absolute bottom-1 right-1 bg-black/70 rounded px-1 py-0.5 text-[8px] text-white">
                        <Film className="h-2 w-2" />
                      </span>
                    </div>
                  ) : (
                    <img
                      src={item.url}
                      alt={`Thumbnail ${idx + 1}`}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
