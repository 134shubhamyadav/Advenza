import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { storage } from "@/lib/firebase";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Camera, Plus, MapPin, Image as ImageIcon, Trash2, Sparkles, Share2 } from "lucide-react";
import { compressImage } from "@/lib/image-utils";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { DatePicker } from "@/components/ui/date-picker";
import { CollageCreator } from "./collage-creator";
import { MemoryPhotoCollage } from "@/components/memories/memory-photo-collage";
import { MemoryShareDialog } from "@/components/memories/memory-share-dialog";



interface SelectedMediaItem {
  id: string;
  file: File;
  previewUrl: string;
  type: "photo" | "video";
}

export interface MediaItem {
  id: string;
  type: "photo" | "video";
  storageUrl: string;
  storagePath: string;
}

export interface MemoryDocument {
  id: string;
  userId: string;
  tripId: string;
  n: number;
  date: string;
  place: string;
  highlight: string;
  mediaItems: MediaItem[];
  createdAt: string;
}

interface TripMemoriesTabProps {
  tripId: string;
}

export function TripMemoriesTab({ tripId }: TripMemoriesTabProps) {
  const { user } = useAuth();
  const [memories, setMemories] = useState<MemoryDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [activeMemoryForContent, setActiveMemoryForContent] = useState<MemoryDocument | null>(null);
  const [shareMemoryItem, setShareMemoryItem] = useState<MemoryDocument | null>(null);

  // Form states
  const [formPlace, setFormPlace] = useState("");
  const [formDate, setFormDate] = useState("");
  const [formHighlight, setFormHighlight] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<SelectedMediaItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  useEffect(() => {
    if (!user || !tripId) return;

    const fetchMemories = async () => {
      setLoading(true);
      try {
        const data = await apiFetch(`/api/memories?tripId=${tripId}`);
        const rawList = Array.isArray(data) ? data : data.memories || data.items || [];
        const list = rawList.map((doc: any) => {
          const mediaItems: MediaItem[] = Array.isArray(doc.media) && doc.media.length > 0
            ? doc.media.map((m: any, idx: number) => ({
                id: m._id || m.publicId || String(idx),
                type: (m.resourceType === "video" || m.mediaType === "video") ? "video" : "photo",
                storageUrl: m.url || m.storageUrl || "",
                storagePath: m.publicId || m.storagePath || "",
              }))
            : doc.mediaItems || [
                {
                  id: doc._id || "1",
                  type: doc.mediaType || "photo",
                  storageUrl: doc.thumbnailUrl || doc.mediaUrl || "",
                  storagePath: doc.storageKey || "",
                },
              ];

          return {
            id: doc._id || doc.id,
            userId: doc.userId,
            tripId: doc.tripId,
            n: doc.n || 1,
            date: doc.date || "",
            place: doc.place || "",
            highlight: doc.highlight || "",
            mediaItems,
            createdAt: doc.createdAt || new Date().toISOString(),
          };
        });
        list.sort((a: any, b: any) => a.n - b.n);
        setMemories(list);
      } catch (err) {
        console.error("Error fetching memories:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchMemories();
  }, [user, tripId]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const incomingFiles = Array.from(e.target.files);
      setSelectedFiles((prev) => {
        const availableSlots = 10 - prev.length;
        if (availableSlots <= 0) {
          toast.error("Maximum 10 media files are allowed per Memory.");
          return prev;
        }

        const newItems: SelectedMediaItem[] = [];
        for (const file of incomingFiles) {
          if (prev.length + newItems.length >= 10) {
            toast.error("Maximum 10 media files reached. Extra files were not added.");
            break;
          }

          // Safe duplicate check against existing and new items
          const isDuplicate = prev.some(
            (s) => s.file.name === file.name && s.file.size === file.size && s.file.lastModified === file.lastModified
          ) || newItems.some(
            (s) => s.file.name === file.name && s.file.size === file.size && s.file.lastModified === file.lastModified
          );
          if (isDuplicate) continue;

          const isVideo = file.type.startsWith("video/");
          const maxSize = isVideo ? 100 * 1024 * 1024 : 20 * 1024 * 1024;
          if (file.size > maxSize) {
            toast.error(`File "${file.name}" exceeds ${isVideo ? "100MB" : "20MB"} limit.`);
            continue;
          }

          newItems.push({
            id: `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
            file,
            previewUrl: URL.createObjectURL(file),
            type: isVideo ? "video" : "photo",
          });
        }

        return [...prev, ...newItems];
      });

      // Clear the input value so subsequent selections of the same file trigger onChange properly
      e.target.value = "";
    }
  };

  const removeSelectedFile = (id: string) => {
    setSelectedFiles((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target && target.previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((item) => item.id !== id);
    });
  };

  const clearSelectedFiles = () => {
    selectedFiles.forEach((item) => {
      if (item.previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(item.previewUrl);
      }
    });
    setSelectedFiles([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !tripId) return;
    if (selectedFiles.length === 0) {
      toast.error("Please select at least one photo or video.");
      return;
    }

    setSubmitting(true);
    setUploadProgress(0);

    const uploadedAssets: Array<{
      url: string;
      publicId: string;
      resourceType: string;
      format?: string;
      width?: number;
      height?: number;
      duration?: number;
      originalName?: string;
    }> = [];

    try {
      const totalFiles = selectedFiles.length;

      // Upload each file via direct Cloudinary binary streaming backend endpoint
      for (let i = 0; i < selectedFiles.length; i++) {
        const item = selectedFiles[i];
        let uploadBlob: Blob = item.file;

        if (item.type === "photo") {
          try {
            uploadBlob = await compressImage(item.file, 1920, 0.85);
          } catch {
            uploadBlob = item.file;
          }
        }

        setUploadProgress(Math.round(((i) / totalFiles) * 80));

        const backendRes: any = await apiFetch("/api/memories/upload-binary", {
          method: "POST",
          headers: {
            "Content-Type": item.file.type || (item.type === "video" ? "video/mp4" : "image/jpeg"),
            "x-file-name": encodeURIComponent(item.file.name),
            "x-trip-id": tripId,
          },
          body: uploadBlob,
        });

        if (!backendRes?.mediaUrl) {
          throw new Error(`Failed to upload ${item.file.name} to Cloudinary.`);
        }

        uploadedAssets.push({
          url: backendRes.mediaUrl,
          publicId: backendRes.storageKey || "",
          resourceType: backendRes.resourceType || (item.type === "video" ? "video" : "image"),
          format: backendRes.format || "",
          width: backendRes.width || 0,
          height: backendRes.height || 0,
          duration: backendRes.duration || 0,
          originalName: item.file.name,
        });

        setUploadProgress(Math.round(((i + 1) / totalFiles) * 85));
      }

      const primaryMedia = uploadedAssets[0];

      // Save memory document in MongoDB with full media array
      const savedDoc = await apiFetch("/api/memories", {
        method: "POST",
        body: JSON.stringify({
          tripId,
          n: memories.length + 1,
          place: formPlace,
          date: formDate,
          highlight: formHighlight,
          media: uploadedAssets,
          mediaUrl: primaryMedia.url,
          thumbnailUrl: primaryMedia.url,
          storageKey: primaryMedia.publicId,
          mediaType: primaryMedia.resourceType,
        }),
      });

      const mediaItems: MediaItem[] = uploadedAssets.map((asset, idx) => ({
        id: asset.publicId || String(idx),
        type: asset.resourceType === "video" ? "video" : "photo",
        storageUrl: asset.url,
        storagePath: asset.publicId,
      }));

      const newMemory: MemoryDocument = {
        id: savedDoc._id || savedDoc.id,
        userId: user.uid,
        tripId,
        n: memories.length + 1,
        place: formPlace,
        date: formDate,
        highlight: formHighlight,
        mediaItems,
        createdAt: savedDoc.createdAt || new Date().toISOString(),
      };

      setMemories((prev) => [...prev, newMemory]);

      // Cleanup and reset form
      clearSelectedFiles();
      setFormPlace("");
      setFormDate("");
      setFormHighlight("");
      setCreateOpen(false);
      toast.success("Memory saved successfully with all photos!");
    } catch (err: any) {
      console.error("Error creating memory:", err);
      toast.error(err.message || "Failed to save memory.");

      // Rollback uploaded Cloudinary assets to prevent orphans
      if (uploadedAssets.length > 0) {
        try {
          await apiFetch("/api/memories/cleanup-assets", {
            method: "POST",
            body: JSON.stringify({
              items: uploadedAssets.map((a) => ({ publicId: a.publicId, resourceType: a.resourceType })),
            }),
          });
        } catch (cleanupErr) {
          console.warn("Failed to cleanup orphaned Cloudinary assets:", cleanupErr);
        }
      }
    } finally {
      setSubmitting(false);
      setUploadProgress(0);
    }
  };

  const handleDelete = async (memory: MemoryDocument) => {
    try {
      await apiFetch(`/api/memories/${memory.id}`, { method: "DELETE" });
      setMemories((prev) => prev.filter((m) => m.id !== memory.id));
      toast.success("Memory deleted.");
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete memory.");
    }
  };

  if (loading) {
    return <div className="py-8 text-center text-muted-foreground">Loading memories...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Trip Memories</h2>
          <p className="text-sm text-muted-foreground">Photos and highlights from this trip.</p>
        </div>
        <div className="flex items-center gap-2">
          {memories.length > 0 && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setActiveMemoryForContent(memories[0])}
                className="border-primary/20 text-primary hover:bg-primary/10"
              >
                <Sparkles className="mr-1.5 h-3.5 w-3.5 text-primary" />
                Collage
              </Button>
            </>
          )}
          <Button onClick={() => setCreateOpen(true)} className="bg-gradient-to-r from-primary to-accent">
            <Plus className="mr-2 h-4 w-4" />
            Add Memory
          </Button>
        </div>
      </div>

      {memories.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed p-12 text-center">
          <Camera className="mb-4 h-12 w-12 text-muted-foreground/30" />
          <p className="text-lg font-medium">No memories yet</p>
          <p className="mb-6 text-sm text-muted-foreground">Start adding photos to build your trip scrapbook.</p>
          <Button onClick={() => setCreateOpen(true)} variant="secondary">Add your first memory</Button>
        </div>
      ) : (
        <div className="grid gap-6">
          {memories.map((mem) => (
            <div key={mem.id} className="overflow-hidden rounded-2xl glass-panel">
              <div className="p-5">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-semibold text-lg flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-primary" />
                      {mem.place || "Unknown location"}
                    </h3>
                    <p className="text-sm text-muted-foreground">{mem.date}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setActiveMemoryForContent(mem)}
                      className="text-primary border-primary/20 hover:bg-primary/10"
                    >
                      <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                      Collage
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShareMemoryItem(mem)}
                      className="text-primary/70 border-primary/20 hover:bg-primary/10"
                    >
                      <Share2 className="mr-1.5 h-3.5 w-3.5" />
                      Share
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(mem)} className="text-muted-foreground hover:text-red-500 hover:bg-red-500/10">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                </div>
                
                {mem.highlight && (
                  <p className="mb-4 text-sm leading-relaxed">{mem.highlight}</p>
                )}

                {mem.mediaItems && mem.mediaItems.length > 0 && (
                  <div
                    className="relative rounded-xl overflow-hidden my-3"
                    style={{
                      minHeight:
                        mem.mediaItems.length === 1
                          ? 240
                          : mem.mediaItems.length === 2
                          ? 260
                          : mem.mediaItems.length === 3
                          ? 280
                          : 320,
                    }}
                  >
                    <MemoryPhotoCollage
                      media={mem.mediaItems.map((m) => ({
                        url: m.storageUrl,
                        resourceType: m.type === "video" ? "video" : "image",
                      }))}
                      place={mem.place}
                      date={mem.date}
                      onShare={() => setShareMemoryItem(mem)}
                      className="h-full"
                    />
                  </div>
                )}
              </div>
              
              {/* Show collages if any */}
              {(mem as any).collageOutputs?.length > 0 && (
                <div className="p-5 border-t border-border/40 bg-muted/10">
                  <h4 className="text-sm font-medium mb-3 flex items-center gap-1.5 text-muted-foreground">
                    <ImageIcon className="h-4 w-4" /> Generated Collages
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {(mem as any).collageOutputs.map((collage: any) => (
                      <div key={collage.id} className="relative aspect-auto rounded-lg overflow-hidden border border-border shadow-sm">
                        <img 
                          src={collage.storageUrl} 
                          alt="Generated Collage" 
                          className="w-full h-auto"
                          loading="lazy"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={(open) => {
        if (!open) clearSelectedFiles();
        setCreateOpen(open);
      }}>
        <DialogContent className="sm:max-w-[540px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Trip Memory</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="place">Place / Location</Label>
              <Input
                id="place"
                placeholder="e.g. City Palace, Udaipur"
                value={formPlace}
                onChange={(e) => setFormPlace(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <DatePicker
                value={formDate}
                onChange={setFormDate}
                placeholder="Pick memory date"
                className="h-10 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Photos & Videos</Label>
                <span className={`text-xs font-medium ${selectedFiles.length >= 10 ? "text-amber-500 font-semibold" : "text-muted-foreground"}`}>
                  {selectedFiles.length} / 10 selected
                </span>
              </div>
              
              <div className="mt-2 flex flex-wrap gap-2.5 p-2 rounded-xl border border-border/70 bg-background/50 min-h-[76px] items-center">
                {selectedFiles.map((item) => (
                  <div key={item.id} className="relative h-20 w-20 overflow-hidden rounded-lg border border-border/80 bg-black/40 group shadow-sm">
                    {item.type === "video" ? (
                      <video src={item.previewUrl} className="h-full w-full object-cover" />
                    ) : (
                      <img src={item.previewUrl} alt="preview" className="h-full w-full object-cover" />
                    )}
                    <button 
                      type="button" 
                      onClick={() => removeSelectedFile(item.id)}
                      className="absolute right-1 top-1 bg-black/70 hover:bg-destructive text-white rounded-full p-1 shadow transition-all duration-200"
                      title="Remove file"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                    <span className="absolute bottom-1 left-1 bg-black/70 text-[9px] px-1 py-0.5 rounded text-white font-medium">
                      {item.type === "video" ? "Video" : "Photo"}
                    </span>
                  </div>
                ))}

                {selectedFiles.length < 10 && (
                  <label className="flex h-20 w-20 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border/80 hover:border-primary/60 hover:bg-primary/5 transition-all text-muted-foreground hover:text-primary gap-1">
                    <Plus className="h-5 w-5" />
                    <span className="text-[10px] font-medium">Add more</span>
                    <input
                      type="file"
                      multiple
                      accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime"
                      className="hidden"
                      onChange={handleFileSelect}
                    />
                  </label>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">Photos ≤ 20MB · Videos ≤ 100MB · Max 10 items</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="highlight">Highlight (Story)</Label>
              <Textarea
                id="highlight"
                placeholder="What made this memorable?"
                value={formHighlight}
                onChange={(e) => setFormHighlight(e.target.value)}
                rows={3}
              />
            </div>

            {submitting && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span>Uploading media to Cloudinary...</span>
                  <span>{Math.round(uploadProgress)}%</span>
                </div>
                <Progress value={uploadProgress} className="h-2" />
              </div>
            )}

            <DialogFooter className="pt-4">
              <Button type="button" variant="ghost" onClick={() => {
                clearSelectedFiles();
                setCreateOpen(false);
              }} disabled={submitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting || selectedFiles.length === 0}>
                {submitting ? "Saving..." : "Save Memory"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Sheet open={!!activeMemoryForContent} onOpenChange={(open) => !open && setActiveMemoryForContent(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md md:max-w-lg lg:max-w-xl overflow-y-auto">
          <SheetHeader className="mb-6">
            <SheetTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Create Content
            </SheetTitle>
            <SheetDescription>
              Turn your memory photos into a beautiful collage to share.
            </SheetDescription>
          </SheetHeader>
          
          {activeMemoryForContent && (
            <CollageCreator
              tripId={tripId}
              memory={activeMemoryForContent}
              allMemories={memories}
              onClose={() => setActiveMemoryForContent(null)}
            />
          )}
        </SheetContent>
      </Sheet>

      {/* UNIFIED SHARE DIALOG */}
      <MemoryShareDialog
        isOpen={!!shareMemoryItem}
        onOpenChange={(open) => !open && setShareMemoryItem(null)}
        memory={shareMemoryItem ? {
          _id: shareMemoryItem.id,
          place: shareMemoryItem.place,
          date: shareMemoryItem.date,
          highlight: shareMemoryItem.highlight,
          media: shareMemoryItem.mediaItems?.map((m) => ({
            url: m.storageUrl,
            resourceType: m.type === "video" ? "video" as const : "image" as const,
          })),
        } : null}
      />
    </div>
  );
}

