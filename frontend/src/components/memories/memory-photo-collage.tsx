import { useState } from "react";
import { Play, Film } from "lucide-react";
import { MemoryLightbox, type MemoryMediaItem } from "./memory-lightbox";

interface MemoryPhotoCollageProps {
  media: MemoryMediaItem[];
  className?: string;
  place?: string;
  date?: string;
  onShare?: () => void;
  showLightbox?: boolean;
  onPhotoClick?: (index: number) => void;
}

export function MemoryPhotoCollage({
  media = [],
  className = "",
  place = "Travel Memory",
  date = "",
  onShare,
  showLightbox = true,
  onPhotoClick,
}: MemoryPhotoCollageProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Normalize media items list - clean invalid / empty items
  const validMedia = Array.isArray(media)
    ? media.filter((m) => m && typeof m.url === "string" && m.url.trim().length > 0)
    : [];

  if (validMedia.length === 0) {
    return (
      <div className={`relative w-full h-full min-h-[200px] flex items-center justify-center bg-muted/40 text-muted-foreground ${className}`}>
        <span className="text-xs">No media available</span>
      </div>
    );
  }

  const handleTileClick = (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    if (onPhotoClick) {
      onPhotoClick(index);
    }
    if (showLightbox) {
      setSelectedIndex(index);
      setLightboxOpen(true);
    }
  };

  const handleCollageClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (showLightbox) {
      setSelectedIndex(0);
      setLightboxOpen(true);
    }
  };

  const count = validMedia.length;

  const renderTile = (
    item: MemoryMediaItem,
    index: number,
    tileClass = "",
    overlayContent?: React.ReactNode
  ) => {
    const isVideo = item.resourceType === "video";
    return (
      <div
        key={item.url ? `${item.url}_${index}` : index}
        onClick={(e) => handleTileClick(e, index)}
        className={`relative overflow-hidden cursor-pointer group/tile bg-zinc-950/80 transition-all ${tileClass}`}
      >
        {isVideo ? (
          <div className="relative w-full h-full bg-zinc-900 flex items-center justify-center">
            <video
              src={item.url}
              className="w-full h-full object-cover transition-transform duration-500 group-hover/tile:scale-105"
              preload="metadata"
              muted
              playsInline
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/30 pointer-events-none group-hover/tile:bg-black/15 transition-all">
              <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-md transition-transform group-hover/tile:scale-110 shadow-lg border border-white/20">
                <Play className="h-4 w-4 sm:h-5 sm:w-5 fill-white text-white ml-0.5" />
              </div>
            </div>
            <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded bg-black/80 backdrop-blur-md px-1.5 py-0.5 text-[9px] font-semibold text-white pointer-events-none border border-white/10 shadow-sm">
              <Film className="h-2.5 w-2.5 text-primary" />
              Video
            </span>
          </div>
        ) : (
          <img
            src={item.url}
            alt={item.originalName || `${place} photo ${index + 1}`}
            loading="lazy"
            className="w-full h-full object-cover transition-transform duration-500 group-hover/tile:scale-105"
          />
        )}

        {/* Subtle shine on hover */}
        <div className="absolute inset-0 bg-white/0 group-hover/tile:bg-white/5 pointer-events-none transition-colors" />

        {/* Optional overlay (e.g. +N badge on 5+ count) */}
        {overlayContent && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/65 backdrop-blur-[2px] text-white hover:bg-black/75 transition-all">
            {overlayContent}
          </div>
        )}
      </div>
    );
  };

  // ── Render layouts based on media count ───────────────────────────────────────
  const renderCollage = () => {
    // 1 ITEM: Single large prominent image
    if (count === 1) {
      return (
        <div className="w-full h-full">
          {renderTile(validMedia[0], 0, "w-full h-full")}
        </div>
      );
    }

    // 2 ITEMS: Balanced two-column split layout
    if (count === 2) {
      return (
        <div className="grid grid-cols-2 gap-1 w-full h-full">
          {renderTile(validMedia[0], 0, "w-full h-full")}
          {renderTile(validMedia[1], 1, "w-full h-full")}
        </div>
      );
    }

    // 3 ITEMS: One large featured image (left) + two smaller previews (right)
    if (count === 3) {
      return (
        <div className="grid grid-cols-12 gap-1 w-full h-full">
          {/* Prominent main photo on left (7 cols) */}
          <div className="col-span-7 h-full">
            {renderTile(validMedia[0], 0, "w-full h-full")}
          </div>
          {/* Two stacked photos on right (5 cols) */}
          <div className="col-span-5 grid grid-rows-2 gap-1 h-full">
            <div className="w-full h-full min-h-0">
              {renderTile(validMedia[1], 1, "w-full h-full")}
            </div>
            <div className="w-full h-full min-h-0">
              {renderTile(validMedia[2], 2, "w-full h-full")}
            </div>
          </div>
        </div>
      );
    }

    // 4 ITEMS: Beautiful 2×2 grid
    if (count === 4) {
      return (
        <div className="grid grid-cols-2 grid-rows-2 gap-1 w-full h-full">
          <div className="w-full h-full min-h-0">
            {renderTile(validMedia[0], 0, "w-full h-full")}
          </div>
          <div className="w-full h-full min-h-0">
            {renderTile(validMedia[1], 1, "w-full h-full")}
          </div>
          <div className="w-full h-full min-h-0">
            {renderTile(validMedia[2], 2, "w-full h-full")}
          </div>
          <div className="w-full h-full min-h-0">
            {renderTile(validMedia[3], 3, "w-full h-full")}
          </div>
        </div>
      );
    }

    // 5 OR MORE ITEMS: Editorial-style collage with "+N" overlay on remaining photos
    const remainingCount = count - 4;
    return (
      <div className="grid grid-cols-12 gap-1 w-full h-full">
        {/* Prominent main photo on left (takes 7 cols) */}
        <div className="col-span-7 h-full">
          {renderTile(validMedia[0], 0, "w-full h-full")}
        </div>
        {/* Right column: 3 photos (takes 5 cols) */}
        <div className="col-span-5 grid grid-rows-3 gap-1 h-full">
          <div className="w-full h-full min-h-0">
            {renderTile(validMedia[1], 1, "w-full h-full")}
          </div>
          <div className="w-full h-full min-h-0">
            {renderTile(validMedia[2], 2, "w-full h-full")}
          </div>
          <div className="w-full h-full min-h-0">
            {renderTile(
              validMedia[3],
              3,
              "w-full h-full",
              <div className="flex flex-col items-center justify-center gap-0.5 select-none">
                <span className="text-base sm:text-xl font-bold tracking-tight text-white drop-shadow">
                  +{remainingCount + 1}
                </span>
                <span className="text-[9px] sm:text-[10px] uppercase font-semibold tracking-wider text-white/90 drop-shadow">
                  Photos
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <div
        onClick={handleCollageClick}
        className={`relative w-full h-full select-none cursor-pointer overflow-hidden ${className}`}
        title="Click to view full photo gallery"
      >
        {renderCollage()}
      </div>

      {showLightbox && (
        <MemoryLightbox
          isOpen={lightboxOpen}
          onClose={() => setLightboxOpen(false)}
          media={validMedia}
          initialIndex={selectedIndex}
          place={place}
          date={date}
          onShare={onShare}
        />
      )}
    </>
  );
}
