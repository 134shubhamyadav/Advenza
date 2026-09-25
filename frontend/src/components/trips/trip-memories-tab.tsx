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
import { Camera, Plus, MapPin, Image as ImageIcon, Trash2, Sparkles, Film } from "lucide-react";
import { compressImage } from "@/lib/image-utils";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { CollageCreator } from "./collage-creator";
import { ReelStudio } from "@/components/reels/reel-studio";



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
  const [activeMemoryForReel, setActiveMemoryForReel] = useState<MemoryDocument | null>(null);
  const [reelStudioOpen, setReelStudioOpen] = useState(false);


  // Form states
  const [formPlace, setFormPlace] = useState("");
  const [formDate, setFormDate] = useState("");
  const [formHighlight, setFormHighlight] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  useEffect(() => {
    if (!user || !tripId) return;

    const fetchMemories = async () => {
      setLoading(true);
      try {
        const data = await apiFetch(`/api/memories?tripId=${tripId}`);
        const rawList = Array.isArray(data) ? data : data.memories || data.items || [];
        const list = rawList.map((doc: any) => ({
              id: doc._id || doc.id,
              userId: doc.userId,
              tripId: doc.tripId,
              n: doc.n || 1,
              date: doc.date || "",
              place: doc.place || "",
              highlight: doc.highlight || "",
              mediaItems: doc.mediaItems || [
                {
                  id: doc._id || "1",
                  type: doc.mediaType || "photo",
                  storageUrl: doc.thumbnailUrl || doc.mediaUrl,
                  storagePath: doc.storageKey,
                },
              ],
              createdAt: doc.createdAt || new Date().toISOString(),
            }));
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
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setSelectedFiles((prev) => [...prev, ...newFiles]);
    }
  };

  const removeSelectedFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !tripId) return;

    setSubmitting(true);
    setUploadProgress(0);

    try {
      const mediaItems: MediaItem[] = [];
      const totalFiles = selectedFiles.length;

      // Upload each file
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        const compressedBlob = await compressImage(file);

        const fileExtension = file.name.split(".").pop();
        const fileName = `${Date.now()}_${i}.${fileExtension}`;
        const storagePath = `users/${user.uid}/trips/${tripId}/memories/originals/${fileName}`;

        let uploadUrl = "";
        let finalStoragePath = storagePath;

        try {
          const storageRef = ref(storage, storagePath);
          const uploadTask = uploadBytesResumable(storageRef, compressedBlob);

          const taskPromise = new Promise<string>((resolve, reject) => {
            uploadTask.on(
              "state_changed",
              (snapshot) => {
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                setUploadProgress(((i * 100) + progress) / totalFiles);
              },
              (error) => reject(error),
              async () => {
                const url = await getDownloadURL(uploadTask.snapshot.ref);
                resolve(url);
              }
            );
          });

          const timeoutPromise = new Promise<string>((_, reject) =>
            setTimeout(() => reject(new Error("Firebase upload timeout")), 5000)
          );

          uploadUrl = await Promise.race([taskPromise, timeoutPromise]);
        } catch (uploadErr) {
          console.warn("[TripMemoriesTab] Client storage timed out or failed, streaming to backend binary endpoint:", uploadErr);
          try {
            const backendRes: any = await apiFetch("/api/memories/upload-binary", {
              method: "POST",
              headers: {
                "Content-Type": file.type || "image/jpeg",
                "x-file-name": encodeURIComponent(fileName),
                "x-trip-id": tripId,
              },
              body: compressedBlob,
            });
            if (backendRes?.mediaUrl) {
              uploadUrl = backendRes.mediaUrl;
              finalStoragePath = backendRes.storageKey || storagePath;
            }
          } catch (backendErr) {
            console.warn("[TripMemoriesTab] Backend binary stream error:", backendErr);
            uploadUrl = URL.createObjectURL(compressedBlob);
          }
        }

        mediaItems.push({
          id: fileName,
          type: "photo",
          storageUrl: uploadUrl || URL.createObjectURL(compressedBlob),
          storagePath: finalStoragePath,
        });
      }

      // Save to Express Backend / MongoDB
      const primaryMedia = mediaItems[0] || {
        storageUrl: "https://images.unsplash.com/photo-1695956353120-54ce5e91632b?fm=jpg&q=75&w=1400&auto=format&fit=crop",
        storagePath: `users/${user.uid}/trips/${tripId}/memories/default_${Date.now()}`,
      };

      const savedDoc = await apiFetch("/api/memories", {
        method: "POST",
        body: JSON.stringify({
          tripId,
          n: memories.length + 1,
          place: formPlace,
          date: formDate,
          highlight: formHighlight,
          mediaUrl: primaryMedia.storageUrl,
          thumbnailUrl: primaryMedia.storageUrl,
          storageKey: primaryMedia.storagePath,
          mediaType: "image",
        }),
      });

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

      // Reset form
      setFormPlace("");
      setFormDate("");
      setFormHighlight("");
      setSelectedFiles([]);
      setCreateOpen(false);
      toast.success("Memory saved successfully!");
    } catch (err) {
      console.error("Error creating memory:", err);
      toast.error("Failed to save memory.");
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
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setActiveMemoryForReel(memories[0]);
                  setReelStudioOpen(true);
                }}
                className="border-violet-500/20 text-violet-400 hover:bg-violet-500/10"
              >
                <Film className="mr-1.5 h-3.5 w-3.5 text-violet-400" />
                Reel Studio
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
                      onClick={() => {
                        setActiveMemoryForReel(mem);
                        setReelStudioOpen(true);
                      }}
                      className="text-violet-400 border-violet-500/20 hover:bg-violet-500/10"
                    >
                      <Film className="mr-1.5 h-3.5 w-3.5" />
                      Reel
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
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {mem.mediaItems.map((media) => (
                      <div key={media.id} className="relative aspect-square overflow-hidden rounded-xl bg-muted/20">
                        <img 
                          src={media.storageUrl} 
                          alt="Memory" 
                          className="h-full w-full object-cover transition-transform hover:scale-105"
                          loading="lazy"
                        />
                      </div>
                    ))}
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

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-[500px]">
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
              <Input
                id="date"
                type="date"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Photos ({selectedFiles.length} selected)</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {selectedFiles.map((file, i) => (
                  <div key={i} className="relative h-16 w-16 overflow-hidden rounded-md border border-border">
                    <img src={URL.createObjectURL(file)} alt="preview" className="h-full w-full object-cover" />
                    <button 
                      type="button" 
                      onClick={() => removeSelectedFile(i)}
                      className="absolute right-0 top-0 bg-black/50 p-0.5 text-white"
                    >
                      ×
                    </button>
                  </div>
                ))}
                <label className="flex h-16 w-16 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-muted-foreground/40 hover:bg-muted/50">
                  <Plus className="h-6 w-6 text-muted-foreground" />
                  <input type="file" multiple accept="image/*" className="hidden" onChange={handleFileSelect} />
                </label>
              </div>
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
                  <span>Uploading photos...</span>
                  <span>{Math.round(uploadProgress)}%</span>
                </div>
                <Progress value={uploadProgress} className="h-2" />
              </div>
            )}

            <DialogFooter className="pt-4">
              <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)} disabled={submitting}>
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

      <Dialog open={reelStudioOpen} onOpenChange={setReelStudioOpen}>
        <DialogContent className="sm:max-w-[840px] max-h-[94vh] overflow-y-auto">
          <ReelStudio
            tripId={tripId}
            allMemories={memories}
            initialSelectedIds={activeMemoryForReel ? [activeMemoryForReel.id] : []}
            destinationName={activeMemoryForReel?.place || "Trip Memories"}
            onClose={() => setReelStudioOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

