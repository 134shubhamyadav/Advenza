import { useState, useEffect, useMemo, useRef } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { inr } from "@/lib/utils";
import {
  Camera,
  CloudSun,
  MapPin,
  Instagram,
  Plus,
  Trash2,
  Edit3,
  Loader2,
  Sparkles,
  UploadCloud,
  Search,
  Grid,
  List,
  Play,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Wand2,
  Calendar,
  Film,
  Image as ImageIcon,
  X,
  Share2,
  Download,
  Eye,
  Layers,
  Copy,
  Check,
  Tag,
  DollarSign,
  LayoutGrid,
} from "lucide-react";
import { InstagramModal } from "@/components/ai/instagram-modal";
import { CollageCreator } from "@/components/trips/collage-creator";
import { ReelStudio } from "@/components/reels/reel-studio";
import { useAuth } from "../context/AuthContext";

import { storage } from "../lib/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { apiFetch } from "@/lib/api";
import {
  validateMediaFile,
  compressImage,
  generateThumbnail,
  generateVideoThumbnail,
} from "@/lib/image-utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

function MemoryErrorFallback({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <AppShell
      title="Trip Scrapbook & Memories"
      subtitle="AI-curated travel memories with instant timeline organization, categorization, and story generation."
    >
      <div className="flex flex-col items-center justify-center rounded-2xl glass-panel p-12 text-center my-8 max-w-lg mx-auto">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive mb-4">
          <AlertCircle className="h-6 w-6" />
        </div>
        <h2 className="text-xl font-semibold text-foreground">Scrapbook encountered an issue</h2>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
          {error?.message || "There was a problem loading your travel memories. Please refresh or try again."}
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Button onClick={reset} className="bg-primary text-primary-foreground hover:bg-primary/90">
            <RefreshCw className="mr-1.5 h-4 w-4" />
            Try again
          </Button>
          <Button asChild variant="outline">
            <Link to="/dashboard">Back to Dashboard</Link>
          </Button>
        </div>
      </div>
    </AppShell>
  );
}

export const Route = createFileRoute("/memory")({
  component: Memory,
  errorComponent: MemoryErrorFallback,
});

// Controlled Category Options
export const CATEGORY_DEFINITIONS: Record<
  string,
  { label: string; icon: string; badgeClass: string }
> = {
  ALL: { label: "All Categories", icon: "✨", badgeClass: "bg-muted text-muted-foreground" },
  LANDMARK: { label: "Landmark", icon: "🏛️", badgeClass: "bg-amber-500/15 text-amber-500 border-amber-500/30" },
  FOOD: { label: "Food & Drink", icon: "🍕", badgeClass: "bg-orange-500/15 text-orange-500 border-orange-500/30" },
  PEOPLE: { label: "People & Portraits", icon: "👥", badgeClass: "bg-blue-500/15 text-blue-500 border-blue-500/30" },
  NATURE: { label: "Nature & Wildlife", icon: "🌿", badgeClass: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30" },
  TRANSPORT: { label: "Transit & Travel", icon: "✈️", badgeClass: "bg-sky-500/15 text-sky-500 border-sky-500/30" },
  HOTEL: { label: "Stay & Hotels", icon: "🏨", badgeClass: "bg-purple-500/15 text-purple-500 border-purple-500/30" },
  EVENT: { label: "Event & Festivals", icon: "🎪", badgeClass: "bg-rose-500/15 text-rose-500 border-rose-500/30" },
  CITY: { label: "City & Streets", icon: "🏙️", badgeClass: "bg-indigo-500/15 text-indigo-500 border-indigo-500/30" },
  NIGHTLIFE: { label: "Nightlife & Vibes", icon: "🍸", badgeClass: "bg-pink-500/15 text-pink-500 border-pink-500/30" },
  ADVENTURE: { label: "Adventure & Sports", icon: "🧗", badgeClass: "bg-teal-500/15 text-teal-500 border-teal-500/30" },
  CULTURE: { label: "Culture & Art", icon: "🎭", badgeClass: "bg-violet-500/15 text-violet-500 border-violet-500/30" },
  OTHER: { label: "Other", icon: "📌", badgeClass: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30" },
};

interface AIMetadata {
  caption?: string;
  description?: string;
  tags?: string[];
  category?: string;
  confidence?: number;
  status: "PENDING" | "PROCESSING" | "READY" | "FAILED";
  lastProcessedAt?: string;
  error?: string;
}

interface MemoryItem {
  _id?: string;
  id?: string;
  tripId?: string;
  n: number;
  place: string;
  date: string;
  weather: string;
  spend: number;
  mediaUrl: string;
  thumbnailUrl?: string;
  storageKey: string;
  thumbnailKey?: string;
  mediaType?: "image" | "video";
  highlight: string;
  moments: string[];
  caption?: string;
  category?: string;
  tags?: string[];
  aiMetadata?: AIMetadata;
  status?: string;
  isDeleted?: boolean;
  createdAt?: string;
  photo?: string;
}

interface CuratedCollageResponse {
  title: string;
  narrative: string;
  selectedMemories: Array<{
    memoryId: string;
    reason: string;
    sequenceOrder: number;
  }>;
  count: number;
}

function Memory() {
  const { user } = useAuth();
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [trips, setTrips] = useState<Array<{ _id: string; title?: string; destination?: string }>>([]);
  const [loading, setLoading] = useState(true);

  // Filters & View State
  const [selectedTripId, setSelectedTripId] = useState<string>("ALL");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"cards" | "timeline">("cards");

  // Selected trip object based on active filter
  const selectedTrip = useMemo(() => {
    if (selectedTripId === "ALL") return null;
    return trips.find((t) => t._id === selectedTripId) || null;
  }, [trips, selectedTripId]);

  // Modals & Active Items
  const [detailItem, setDetailItem] = useState<MemoryItem | null>(null);
  const [editItem, setEditItem] = useState<MemoryItem | null>(null);
  const [instagramItem, setInstagramItem] = useState<MemoryItem | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [curateOpen, setCurateOpen] = useState(false);
  const [collageStudioOpen, setCollageStudioOpen] = useState(false);
  const [collageInitialIds, setCollageInitialIds] = useState<string[]>([]);
  const [reelStudioOpen, setReelStudioOpen] = useState(false);
  const [reelInitialIds, setReelInitialIds] = useState<string[]>([]);


  // Create Form State
  const [formTripId, setFormTripId] = useState<string>("");
  const [formN, setFormN] = useState<number>(1);
  const [formPlace, setFormPlace] = useState("");
  const [formDate, setFormDate] = useState("");
  const [formWeather, setFormWeather] = useState("");
  const [formSpend, setFormSpend] = useState("");
  const [formHighlight, setFormHighlight] = useState("");
  const [formMoments, setFormMoments] = useState("");
  const [formCategory, setFormCategory] = useState<string>("LANDMARK");
  const [formTags, setFormTags] = useState("");
  const [formPhotoUrl, setFormPhotoUrl] = useState("");

  // Media Upload State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [detectedMediaType, setDetectedMediaType] = useState<"image" | "video">("image");
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [progressStage, setProgressStage] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // AI Collage Curator State
  const [curateTripId, setCurateTripId] = useState<string>("");
  const [curateStyle, setCurateStyle] = useState<string>("HIGHLIGHTS");
  const [curateCount, setCurateCount] = useState<number>(6);
  const [curating, setCurating] = useState(false);
  const [curateResult, setCurateResult] = useState<CuratedCollageResponse | null>(null);
  const [curateError, setCurateError] = useState<string>("");
  const [copiedNarrative, setCopiedNarrative] = useState(false);

  // Reprocess AI State
  const [reprocessingId, setReprocessingId] = useState<string | null>(null);

  // Fetch initial memories and trips
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);

    Promise.allSettled([
      apiFetch("/api/memories"),
      apiFetch("/api/trips"),
    ])
      .then(([memoriesResult, tripsResult]) => {
        if (memoriesResult.status === "fulfilled") {
          const data = memoriesResult.value;
          const rawList = Array.isArray(data) ? data : data.memories || data.items || [];
          const list = rawList.map((item: any) => ({
            ...item,
            id: item._id || item.id,
            photo: item.mediaUrl || item.photo,
            mediaType: item.mediaType || "image",
          }));
          list.sort((a: any, b: any) => (a.n || 0) - (b.n || 0));
          setMemories(list);
          setFormN(list.length + 1);
        }

        if (tripsResult.status === "fulfilled") {
          const tripsData = tripsResult.value;
          const tripList = Array.isArray(tripsData)
            ? tripsData
            : tripsData.trips || tripsData.items || [];
          setTrips(tripList);
          if (tripList.length > 0 && !formTripId) {
            setFormTripId(tripList[0]._id);
            setCurateTripId(tripList[0]._id);
          }
        }
      })
      .catch((err) => {
        console.error("Error loading memories and trips:", err);
      })
      .finally(() => setLoading(false));
  }, [user]);

  // Handle Drag & Drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processSelectedFile(file);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processSelectedFile(file);
    }
  };

  const processSelectedFile = (file: File) => {
    setUploadError("");
    const validation = validateMediaFile(file, 20, 100);
    if (!validation.valid) {
      setUploadError(validation.error || "Invalid file format or size.");
      return;
    }

    if (previewUrl && previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(previewUrl);
    }

    setSelectedFile(file);
    setDetectedMediaType(validation.mediaType);
    const localUrl = URL.createObjectURL(file);
    setPreviewUrl(localUrl);
  };

  const clearSelectedFile = () => {
    if (previewUrl && previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl("");
    setUploadError("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Submit New Memory
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setSubmitting(true);
    setUploadError("");
    setUploadProgress(10);
    setProgressStage("1/5: Preparing media & validating…");

    try {
      let finalMediaUrl = formPhotoUrl.trim();
      let finalThumbUrl = "";
      const timestamp = Date.now();
      let finalStorageKey = `users/${user.uid}/memories/external_${timestamp}`;
      let finalThumbStorageKey = "";

      if (selectedFile) {
        setUploadProgress(30);
        setProgressStage("2/5: Optimizing media & generating high-res thumbnail…");

        let mediaUploadBlob: Blob = selectedFile;
        let thumbBlob: Blob;

        if (detectedMediaType === "image") {
          mediaUploadBlob = await compressImage(selectedFile, 1920, 0.85);
          thumbBlob = await generateThumbnail(selectedFile, 360, 0.75);
        } else {
          // Video: upload original file and generate first-frame poster
          mediaUploadBlob = selectedFile;
          try {
            thumbBlob = await generateVideoThumbnail(selectedFile, 1.0);
          } catch (err) {
            console.warn("Video thumbnail generator error, using default frame", err);
            thumbBlob = new Blob([], { type: "image/jpeg" });
          }
        }

        const safeName = selectedFile.name.replace(/[^a-zA-Z0-9.-]/g, "_");
        finalStorageKey = `users/${user.uid}/memories/${timestamp}_${safeName}`;
        finalThumbStorageKey = `users/${user.uid}/memories/thumb_${timestamp}_${safeName}.jpg`;

        setUploadProgress(60);
        setProgressStage("3/5: Uploading media to secure storage…");

        let uploadSucceeded = false;

        // 1. Primary path: Direct Firebase Client SDK upload with a strict 4-second timeout
        if (storage && (storage as any)?.type !== "mock-storage") {
          try {
            const fileRef = ref(storage, finalStorageKey);
            const uploadPromise = uploadBytes(fileRef, mediaUploadBlob, {
              contentType: selectedFile.type || "application/octet-stream",
            });
            const timeoutPromise = new Promise((_, reject) =>
              setTimeout(() => reject(new Error("Firebase Storage timeout")), 4000)
            );
            await Promise.race([uploadPromise, timeoutPromise]);
            finalMediaUrl = await getDownloadURL(fileRef);

            if (thumbBlob && thumbBlob.size > 0) {
              const thumbRef = ref(storage, finalThumbStorageKey);
              await uploadBytes(thumbRef, thumbBlob, { contentType: "image/jpeg" });
              finalThumbUrl = await getDownloadURL(thumbRef);
            } else {
              finalThumbUrl = finalMediaUrl;
            }
            uploadSucceeded = true;
          } catch (storageErr) {
            console.warn("[Memory] Client storage timed out or failed, falling back to backend binary stream:", storageErr);
          }
        }

        // 2. Fallback path: Stream binary directly to backend storage endpoint
        if (!uploadSucceeded) {
          try {
            const backendRes: any = await apiFetch("/api/memories/upload-binary", {
              method: "POST",
              headers: {
                "Content-Type": selectedFile.type || "image/jpeg",
                "x-file-name": encodeURIComponent(selectedFile.name),
                ...(formTripId ? { "x-trip-id": formTripId } : {}),
              },
              body: mediaUploadBlob,
            });

            if (backendRes?.mediaUrl) {
              finalMediaUrl = backendRes.mediaUrl;
              finalThumbUrl = backendRes.thumbnailUrl || backendRes.mediaUrl;
              finalStorageKey = backendRes.storageKey || finalStorageKey;
              finalThumbStorageKey = backendRes.thumbnailKey || finalThumbStorageKey;
              uploadSucceeded = true;
              console.log("[Memory] Successfully uploaded media via backend binary stream:", finalMediaUrl);
            }
          } catch (backendErr) {
            console.warn("[Memory] Backend binary upload error, using local fallback preview:", backendErr);
          }
        }

        // 3. Fallback: if both failed, use local blob URL to preserve user's real uploaded media
        if (!uploadSucceeded && !finalMediaUrl) {
          finalMediaUrl = URL.createObjectURL(mediaUploadBlob);
          finalThumbUrl = thumbBlob && thumbBlob.size > 0 ? URL.createObjectURL(thumbBlob) : finalMediaUrl;
        }
      }

      if (!finalMediaUrl) {
        finalMediaUrl =
          "https://images.unsplash.com/photo-1695956353120-54ce5e91632b?fm=jpg&q=75&w=1400&auto=format&fit=crop";
      }

      setUploadProgress(85);
      setProgressStage("4/5: Saving memory metadata & triggering AI enrichment…");

      const momentsList = formMoments
        .split(",")
        .map((m) => m.trim())
        .filter(Boolean);

      const tagsList = formTags
        .split(",")
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);

      const memoryPayload = {
        tripId: formTripId && formTripId !== "NONE" ? formTripId : undefined,
        n: Number(formN) || 1,
        place: formPlace.trim(),
        date: formDate.trim() || new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        weather: formWeather.trim(),
        spend: Number(formSpend) || 0,
        mediaUrl: finalMediaUrl,
        thumbnailUrl: finalThumbUrl || finalMediaUrl,
        storageKey: finalStorageKey,
        thumbnailKey: finalThumbStorageKey || undefined,
        mediaType: detectedMediaType,
        highlight: formHighlight.trim(),
        moments: momentsList,
        category: formCategory || "OTHER",
        tags: tagsList,
        caption: formHighlight.trim(),
      };

      const savedMemory = await apiFetch("/api/memories", {
        method: "POST",
        body: JSON.stringify(memoryPayload),
      });

      setUploadProgress(100);
      setProgressStage("5/5: Memory saved successfully!");

      const addedItem: MemoryItem = {
        ...savedMemory,
        id: savedMemory._id || savedMemory.id,
        photo: savedMemory.mediaUrl,
        mediaType: savedMemory.mediaType || detectedMediaType,
        aiMetadata: savedMemory.aiMetadata || { status: "PENDING" },
      };

      setMemories((prev) => [addedItem, ...prev.filter((m) => (m._id || m.id) !== addedItem.id)]);

      // Reset form
      setFormN((prev) => prev + 1);
      setFormPlace("");
      setFormDate("");
      setFormWeather("");
      setFormSpend("");
      setFormHighlight("");
      setFormMoments("");
      setFormTags("");
      setFormPhotoUrl("");
      clearSelectedFile();
      setCreateOpen(false);
    } catch (err: any) {
      console.error("Error creating memory:", err);
      setUploadError(err.message || "Failed to save memory.");
    } finally {
      setSubmitting(false);
      setUploadProgress(0);
      setProgressStage("");
    }
  };

  // Handle Edit Memory Save
  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editItem) return;

    try {
      const editId = editItem._id || editItem.id;
      const updated = await apiFetch(`/api/memories/${editId}`, {
        method: "PATCH",
        body: JSON.stringify({
          place: editItem.place,
          date: editItem.date,
          weather: editItem.weather,
          spend: editItem.spend,
          highlight: editItem.highlight,
          moments: editItem.moments,
          category: editItem.category,
          tags: editItem.tags,
          caption: editItem.caption || editItem.highlight,
        }),
      });

      setMemories((prev) =>
        prev.map((m) =>
          (m._id || m.id) === editId
            ? { ...m, ...updated, id: editId, photo: updated.mediaUrl || m.mediaUrl }
            : m
        )
      );
      if (detailItem && (detailItem._id || detailItem.id) === editId) {
        setDetailItem((prev) => (prev ? { ...prev, ...updated } : null));
      }
      setEditItem(null);
    } catch (err: any) {
      console.error("Error updating memory:", err);
    }
  };

  // Reprocess with AI
  const handleReprocessAI = async (id: string) => {
    setReprocessingId(id);
    try {
      const result = await apiFetch(`/api/memories/${id}/reprocess`, { method: "POST" });
      if (result.memory) {
        setMemories((prev) =>
          prev.map((m) =>
            (m._id || m.id) === id
              ? { ...m, ...result.memory, id: id, photo: result.memory.mediaUrl || m.mediaUrl }
              : m
          )
        );
        if (detailItem && (detailItem._id || detailItem.id) === id) {
          setDetailItem((prev) => (prev ? { ...prev, ...result.memory } : null));
        }
      }
    } catch (err) {
      console.error("Error reprocessing memory with AI:", err);
    } finally {
      setReprocessingId(null);
    }
  };

  // Confirm Delete
  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      await apiFetch(`/api/memories/${deleteId}`, { method: "DELETE" });
      setMemories((prev) => prev.filter((m) => (m._id || m.id) !== deleteId));
      if (detailItem && (detailItem._id || detailItem.id) === deleteId) {
        setDetailItem(null);
      }
    } catch (err) {
      console.error("Error deleting memory:", err);
    } finally {
      setDeleteId(null);
    }
  };

  // AI Collage Curation
  const handleCurateCollage = async () => {
    setCurating(true);
    setCurateError("");
    setCurateResult(null);

    try {
      const payload: any = {
        style: curateStyle,
        targetCount: Number(curateCount) || 6,
      };
      if (curateTripId && curateTripId !== "ALL") {
        payload.tripId = curateTripId;
      }

      const res = await apiFetch("/api/memories/curate", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setCurateResult(res);
    } catch (err: any) {
      console.error("Collage curation failed:", err);
      setCurateError(err.message || "Failed to generate curated collage.");
    } finally {
      setCurating(false);
    }
  };

  // Filter & Search Logic
  const filteredMemories = useMemo(() => {
    return memories.filter((item) => {
      // Trip filter
      if (selectedTripId !== "ALL" && item.tripId !== selectedTripId) {
        return false;
      }

      // Category filter
      if (selectedCategory !== "ALL") {
        const itemCat = (item.category || item.aiMetadata?.category || "OTHER").toUpperCase();
        if (itemCat !== selectedCategory) {
          return false;
        }
      }

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchPlace = item.place?.toLowerCase().includes(q);
        const matchHighlight = item.highlight?.toLowerCase().includes(q);
        const matchCaption = item.caption?.toLowerCase().includes(q);
        const matchAiDesc = item.aiMetadata?.description?.toLowerCase().includes(q);
        const matchMoments = item.moments?.some((m) => m.toLowerCase().includes(q));
        const matchTags = item.tags?.some((t) => t.toLowerCase().includes(q));
        const matchAiTags = item.aiMetadata?.tags?.some((t) => t.toLowerCase().includes(q));

        if (
          !matchPlace &&
          !matchHighlight &&
          !matchCaption &&
          !matchAiDesc &&
          !matchMoments &&
          !matchTags &&
          !matchAiTags
        ) {
          return false;
        }
      }

      return true;
    });
  }, [memories, selectedTripId, selectedCategory, searchQuery]);

  // Dynamic Statistics
  const stats = useMemo(() => {
    const totalCount = memories.length;
    const photoCount = memories.filter((m) => m.mediaType !== "video").length;
    const videoCount = memories.filter((m) => m.mediaType === "video").length;
    const uniquePlaces = new Set(
      memories
        .map((m) => (m.place ? m.place.split(",")[0]?.trim() : ""))
        .filter(Boolean)
    ).size;
    const totalSpend = memories.reduce((sum, m) => sum + (Number(m.spend) || 0), 0);
    const enrichedCount = memories.filter(
      (m) => m.aiMetadata?.status === "READY"
    ).length;

    return { totalCount, photoCount, videoCount, uniquePlaces, totalSpend, enrichedCount };
  }, [memories]);

  return (
    <AppShell
      title="Trip Scrapbook & Memories"
      subtitle="AI-curated travel memories with instant timeline organization, categorization, and story generation."
      actions={
        user && (
          <div className="flex items-center gap-2">
            <Button
              onClick={() => {
                setCollageInitialIds(
                  memories
                    .slice(0, 6)
                    .map((m) => m._id || m.id)
                    .filter((id): id is string => Boolean(id))
                );
                setCollageStudioOpen(true);
              }}
              variant="outline"
              className="border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 shadow-sm transition-all"
            >
              <LayoutGrid className="mr-1.5 h-4 w-4 text-primary" />
              Collage Studio
            </Button>
            <Button
              onClick={() => {
                setReelInitialIds(
                  memories
                    .slice(0, 6)
                    .map((m) => m._id || m.id)
                    .filter((id): id is string => Boolean(id))
                );
                setReelStudioOpen(true);
              }}
              variant="outline"
              className="border-violet-500/40 bg-violet-500/10 text-violet-400 hover:bg-violet-500/20 shadow-sm transition-all"
            >
              <Film className="mr-1.5 h-4 w-4 text-violet-400" />
              Reels Studio
            </Button>

            <Button
              onClick={() => setCurateOpen(true)}
              variant="outline"
              className="border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 shadow-sm transition-all"
            >
              <Wand2 className="mr-1.5 h-4 w-4 text-primary animate-pulse" />
              Curate with AI
            </Button>
            <Button
              onClick={() => setCreateOpen(true)}
              className="bg-gradient-to-r from-primary to-accent text-white shadow-lg shadow-primary/20"
            >
              <Plus className="mr-1.5 h-4 w-4" />
              Add Memory
            </Button>
          </div>
        )
      }
    >
      {!user ? (
        <div className="flex flex-col items-center justify-center rounded-2xl glass-panel p-16 text-center">
          <Camera className="h-12 w-12 text-muted-foreground/30" />
          <p className="mt-4 text-lg font-semibold">Login required</p>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            Please log in or sign up to record, store, and view your travel memories.
          </p>
          <Button className="mt-6" asChild>
            <Link to="/login">Log in</Link>
          </Button>
        </div>
      ) : loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="mt-4 text-sm text-muted-foreground">Opening your scrapbook…</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Stats Bar */}
          {memories.length > 0 && (
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-5 animate-in fade-in slide-in-from-bottom-2 duration-500">
              <div className="rounded-2xl glass-panel p-4 flex flex-col justify-between">
                <span className="text-xs text-muted-foreground">Memories</span>
                <p className="mt-1 font-display text-2xl sm:text-3xl font-bold text-foreground">
                  {stats.totalCount}
                </p>
                <span className="text-[11px] text-muted-foreground">
                  {stats.photoCount} photos · {stats.videoCount} videos
                </span>
              </div>
              <div className="rounded-2xl glass-panel p-4 flex flex-col justify-between">
                <span className="text-xs text-muted-foreground">Destinations</span>
                <p className="mt-1 font-display text-2xl sm:text-3xl font-bold text-foreground">
                  {stats.uniquePlaces}
                </p>
                <span className="text-[11px] text-muted-foreground">unique cities / spots</span>
              </div>
              <div className="rounded-2xl glass-panel p-4 flex flex-col justify-between">
                <span className="text-xs text-muted-foreground">Total Travel Spend</span>
                <p className="mt-1 font-display text-2xl sm:text-3xl font-bold text-foreground">
                  {inr(stats.totalSpend)}
                </p>
                <span className="text-[11px] text-muted-foreground">logged expenses</span>
              </div>
              <div className="rounded-2xl glass-panel p-4 flex flex-col justify-between">
                <span className="text-xs text-muted-foreground">AI Enriched</span>
                <p className="mt-1 font-display text-2xl sm:text-3xl font-bold text-primary flex items-center gap-1.5">
                  <Sparkles className="h-5 w-5" />
                  {stats.enrichedCount}
                </p>
                <span className="text-[11px] text-muted-foreground">auto-tagged & categorized</span>
              </div>
              <div className="rounded-2xl glass-panel p-4 flex flex-col justify-between col-span-2 sm:col-span-1">
                <span className="text-xs text-muted-foreground">Quick Action</span>
                <Button
                  onClick={() => setCurateOpen(true)}
                  size="sm"
                  className="mt-2 w-full bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30"
                >
                  <Wand2 className="mr-1 h-3.5 w-3.5" />
                  Make Collage
                </Button>
              </div>
            </div>
          )}

          {/* Search, Trip Filter & Category Pills Toolbar */}
          <div className="space-y-3 rounded-2xl glass-panel p-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              {/* Search Bar */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search memories by place, tags, stories, or caption…"
                  className="pl-9 bg-background/50 text-sm"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs"
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* Trip Selector */}
              {trips.length > 0 && (
                <div className="w-full sm:w-56">
                  <Select value={selectedTripId} onValueChange={setSelectedTripId}>
                    <SelectTrigger className="bg-background/50 text-xs">
                      <SelectValue placeholder="All Trips" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Trips</SelectItem>
                      {trips.map((t) => (
                        <SelectItem key={t._id} value={t._id}>
                          {t.destination || t.title || "Trip"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* View Toggle */}
              <div className="flex items-center gap-1 rounded-lg border border-border/50 bg-background/50 p-1 self-end sm:self-auto">
                <button
                  onClick={() => setViewMode("cards")}
                  className={`p-1.5 rounded-md text-xs transition-colors ${
                    viewMode === "cards"
                      ? "bg-primary text-white shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  title="Grid view"
                >
                  <Grid className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setViewMode("timeline")}
                  className={`p-1.5 rounded-md text-xs transition-colors ${
                    viewMode === "timeline"
                      ? "bg-primary text-white shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  title="Timeline view"
                >
                  <List className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Category Pills Slider */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-1 no-scrollbar text-xs">
              {Object.entries(CATEGORY_DEFINITIONS).map(([key, def]) => {
                const isActive = selectedCategory === key;
                return (
                  <button
                    key={key}
                    onClick={() => setSelectedCategory(key)}
                    className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 font-medium transition-all ${
                      isActive
                        ? "bg-primary text-white shadow-sm scale-105"
                        : "bg-background/60 text-muted-foreground hover:bg-background/90 hover:text-foreground border border-border/40"
                    }`}
                  >
                    <span>{def.icon}</span>
                    <span>{def.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Content Feed */}
          {filteredMemories.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl glass-panel p-16 text-center animate-in fade-in duration-500">
              <Camera className="h-12 w-12 text-muted-foreground/30" />
              <p className="mt-4 text-lg font-semibold">
                {memories.length === 0 ? "No memories recorded yet" : "No memories found"}
              </p>
              <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                {memories.length === 0
                  ? "Start building your journey! Upload photos, videos, day highlights, and weather notes."
                  : "No memories match your active search and filter criteria. Try clearing filters."}
              </p>
              {memories.length === 0 ? (
                <Button onClick={() => setCreateOpen(true)} className="mt-6">
                  <Plus className="mr-1.5 h-4 w-4" />
                  Add your first memory
                </Button>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedCategory("ALL");
                    setSelectedTripId("ALL");
                    setSearchQuery("");
                  }}
                  className="mt-6 text-xs"
                >
                  Reset all filters
                </Button>
              )}
            </div>
          ) : viewMode === "cards" ? (
            /* Cards Grid View */
            <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {filteredMemories.map((item, index) => {
                const itemId = item._id || item.id || `mem_${index}`;
                const displayPhoto = item.thumbnailUrl || item.mediaUrl || item.photo;
                const isVideo = item.mediaType === "video";
                const catDef =
                  CATEGORY_DEFINITIONS[(item.category || item.aiMetadata?.category || "OTHER").toUpperCase()] ||
                  CATEGORY_DEFINITIONS.OTHER;
                const isAiPending = item.aiMetadata?.status === "PENDING";
                const isAiReady = item.aiMetadata?.status === "READY";

                return (
                  <article
                    key={itemId}
                    onClick={() => setDetailItem(item)}
                    className="group relative flex flex-col justify-between overflow-hidden rounded-2xl glass-panel cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:ring-2 hover:ring-primary/40 animate-in fade-in slide-in-from-bottom-3"
                    style={{ animationDelay: `${index * 0.04}s` }}
                  >
                    {/* Media Thumbnail Container */}
                    <div className="relative aspect-[16/10] w-full overflow-hidden bg-muted">
                      <img
                        src={displayPhoto}
                        alt={item.place}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                      />

                      {/* Video Indicator */}
                      {isVideo && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/25">
                          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-md transition-transform group-hover:scale-110">
                            <Play className="h-5 w-5 fill-white ml-0.5" />
                          </div>
                        </div>
                      )}

                      {/* Day and Date Badge */}
                      <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-background/85 backdrop-blur-md px-2.5 py-1 text-[11px] font-semibold text-foreground shadow-sm">
                        <Calendar className="h-3 w-3 text-primary" />
                        Day {item.n} · {item.date}
                      </span>

                      {/* AI Status Badge */}
                      {isAiPending && (
                        <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-primary/90 backdrop-blur-md px-2.5 py-1 text-[10px] font-semibold text-white shadow-sm animate-pulse">
                          <Sparkles className="h-3 w-3 animate-spin" />
                          AI Enriching…
                        </span>
                      )}
                      {isAiReady && (
                        <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-background/85 backdrop-blur-md px-2 py-0.5 text-[10px] font-semibold text-primary shadow-sm border border-primary/30">
                          <Sparkles className="h-3 w-3" />
                          AI Ready
                        </span>
                      )}

                      {/* Category Chip */}
                      <span
                        className={`absolute left-3 bottom-3 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold backdrop-blur-md shadow-sm border ${catDef.badgeClass}`}
                      >
                        <span>{catDef.icon}</span>
                        <span>{catDef.label}</span>
                      </span>
                    </div>

                    {/* Card Body */}
                    <div className="flex flex-1 flex-col justify-between p-5">
                      <div>
                        {/* Title and Weather */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <MapPin className="h-4 w-4 text-primary shrink-0" />
                            <h3 className="font-semibold text-base line-clamp-1 text-foreground">
                              {item.place}
                            </h3>
                          </div>
                          {item.weather && (
                            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap">
                              <CloudSun className="h-3.5 w-3.5 text-amber-500" />
                              {item.weather}
                            </span>
                          )}
                        </div>

                        {/* Story Highlight */}
                        <p className="mt-2 text-xs leading-relaxed text-muted-foreground line-clamp-2">
                          {item.highlight || item.caption || item.aiMetadata?.caption || "No highlight story provided."}
                        </p>

                        {/* Moments / AI Tags */}
                        {((item.moments && item.moments.length > 0) ||
                          (item.tags && item.tags.length > 0)) && (
                          <div className="mt-3 flex flex-wrap gap-1">
                            {item.moments?.slice(0, 3).map((m) => (
                              <span
                                key={m}
                                className="rounded-md border border-border/50 bg-background/50 px-2 py-0.5 text-[10px] text-muted-foreground"
                              >
                                {m}
                              </span>
                            ))}
                            {item.tags?.slice(0, 2).map((t) => (
                              <span
                                key={t}
                                className="rounded-md bg-primary/10 text-primary px-2 py-0.5 text-[10px] font-medium"
                              >
                                #{t}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Card Footer */}
                      <div className="mt-4 pt-3 border-t border-border/30 flex items-center justify-between text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">
                          {item.spend > 0 ? inr(item.spend) : "Free"}
                        </span>

                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => {
                              setReelInitialIds([itemId]);
                              setReelStudioOpen(true);
                            }}
                            title="Generate AI Travel Reel"
                            className="p-1.5 rounded-full hover:bg-violet-500/10 text-violet-400 hover:text-violet-500 transition-colors"
                          >
                            <Film className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => setInstagramItem(item)}
                            title="Generate Instagram Reel/Post"
                            className="p-1.5 rounded-full hover:bg-pink-500/10 text-pink-500 hover:text-pink-600 transition-colors"
                          >
                            <Instagram className="h-3.5 w-3.5" />
                          </button>

                          <button
                            onClick={() => setEditItem(item)}
                            title="Edit memory"
                            className="p-1.5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteId(itemId)}
                            title="Delete memory"
                            className="p-1.5 rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            /* Timeline List View */
            <div className="space-y-6">
              {filteredMemories.map((d, index) => {
                const displayPhoto = d.thumbnailUrl || d.mediaUrl || d.photo;
                const itemId = d._id || d.id || `mem_${index}`;
                const isVideo = d.mediaType === "video";
                const catDef =
                  CATEGORY_DEFINITIONS[(d.category || d.aiMetadata?.category || "OTHER").toUpperCase()] ||
                  CATEGORY_DEFINITIONS.OTHER;

                return (
                  <article
                    key={itemId}
                    onClick={() => setDetailItem(d)}
                    className="grid gap-0 overflow-hidden rounded-2xl glass-panel md:grid-cols-[280px_1fr] cursor-pointer hover:ring-2 hover:ring-primary/40 transition-all hover:-translate-y-1 group animate-in fade-in slide-in-from-bottom-3"
                    style={{ animationDelay: `${index * 0.03}s` }}
                  >
                    <div className="relative h-56 md:h-full min-h-[220px] bg-muted">
                      <img
                        src={displayPhoto}
                        alt={d.place}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                      />
                      {isVideo && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/25">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-md">
                            <Play className="h-4 w-4 fill-white ml-0.5" />
                          </div>
                        </div>
                      )}
                      <span className="absolute left-3 top-3 rounded-full bg-background/90 backdrop-blur-md px-2.5 py-1 text-[11px] font-semibold text-foreground shadow-sm">
                        Day {d.n} · {d.date}
                      </span>
                      <span
                        className={`absolute left-3 bottom-3 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold backdrop-blur-md shadow-sm border ${catDef.badgeClass}`}
                      >
                        <span>{catDef.icon}</span>
                        <span>{catDef.label}</span>
                      </span>
                    </div>

                    <div className="p-6 flex flex-col justify-between min-h-[220px]">
                      <div>
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-primary" />
                            <h3 className="font-semibold text-lg">{d.place}</h3>
                          </div>
                          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                            {d.weather && (
                              <span className="inline-flex items-center gap-1">
                                <CloudSun className="h-3.5 w-3.5" />
                                {d.weather}
                              </span>
                            )}
                            <span>Spend {inr(d.spend)}</span>
                          </div>
                        </div>
                        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                          {d.highlight || d.caption}
                        </p>
                        {d.aiMetadata?.description && (
                          <div className="mt-3 rounded-xl bg-primary/5 border border-primary/15 p-2.5 text-xs text-muted-foreground flex items-start gap-2">
                            <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                            <p className="line-clamp-2">{d.aiMetadata.description}</p>
                          </div>
                        )}
                      </div>

                      <div className="mt-6 pt-4 border-t border-border/30 flex flex-wrap items-center justify-between gap-4">
                        <ul className="flex flex-wrap gap-1.5 text-xs">
                          {d.moments?.map((m) => (
                            <li
                              key={m}
                              className="rounded-full border border-border/60 bg-background/50 px-2.5 py-0.5 text-muted-foreground"
                            >
                              {m}
                            </li>
                          ))}
                          {d.tags?.map((t) => (
                            <li
                              key={t}
                              className="rounded-full bg-primary/10 text-primary px-2.5 py-0.5 text-xs font-medium"
                            >
                              #{t}
                            </li>
                          ))}
                        </ul>

                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => setEditItem(d)}
                            className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted bg-background/50 px-3 py-1.5 rounded-full transition-all border border-border/40"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                            Edit
                          </button>
                          <button
                            onClick={() => {
                              setReelInitialIds([itemId]);
                              setReelStudioOpen(true);
                            }}
                            className="flex items-center gap-1.5 text-xs font-semibold text-violet-400 hover:text-white hover:bg-violet-500 bg-violet-500/10 px-3 py-1.5 rounded-full transition-all"
                          >
                            <Film className="h-3.5 w-3.5" />
                            AI Reel
                          </button>
                          <button
                            onClick={() => setInstagramItem(d)}
                            className="flex items-center gap-1.5 text-xs font-semibold text-pink-500 hover:text-white hover:bg-pink-500 bg-pink-500/10 px-3 py-1.5 rounded-full transition-all"
                          >
                            <Instagram className="h-3.5 w-3.5" />
                            Social Post
                          </button>

                          <button
                            onClick={() => setDeleteId(itemId)}
                            className="flex items-center gap-1.5 text-xs font-semibold text-destructive hover:text-destructive-foreground hover:bg-destructive bg-destructive/10 px-3 py-1.5 rounded-full transition-all"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* DETAIL MODAL WITH HIGH-RES MEDIA & AI INSIGHTS */}
      {detailItem && (
        <Dialog open={!!detailItem} onOpenChange={(open) => !open && setDetailItem(null)}>
          <DialogContent className="sm:max-w-[720px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center justify-between gap-2 pr-6">
                <DialogTitle className="flex items-center gap-2 text-xl font-bold">
                  <MapPin className="h-5 w-5 text-primary" />
                  {detailItem.place}
                </DialogTitle>
                <span className="rounded-full bg-primary/10 text-primary px-3 py-1 text-xs font-semibold">
                  Day {detailItem.n} · {detailItem.date}
                </span>
              </div>
              <DialogDescription className="flex items-center gap-3 text-xs text-muted-foreground pt-1">
                {detailItem.weather && <span>Weather: {detailItem.weather}</span>}
                <span>Spend: {inr(detailItem.spend)}</span>
                {detailItem.category && (
                  <span className="font-medium text-foreground">
                    Category: {CATEGORY_DEFINITIONS[detailItem.category.toUpperCase()]?.label || detailItem.category}
                  </span>
                )}
              </DialogDescription>
            </DialogHeader>

            {/* Media Presentation */}
            <div className="relative rounded-xl overflow-hidden bg-black/90 aspect-video flex items-center justify-center">
              {detailItem.mediaType === "video" ? (
                <video
                  controls
                  src={detailItem.mediaUrl}
                  poster={detailItem.thumbnailUrl}
                  className="w-full h-full max-h-[50vh] object-contain"
                />
              ) : (
                <img
                  src={detailItem.mediaUrl}
                  alt={detailItem.place}
                  className="w-full h-full max-h-[50vh] object-contain"
                />
              )}
            </div>

            {/* Content & Story */}
            <div className="space-y-4 pt-2">
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Highlight Story
                </h4>
                <p className="mt-1 text-sm leading-relaxed text-foreground">
                  {detailItem.highlight}
                </p>
              </div>

              {detailItem.moments && detailItem.moments.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Moments
                  </h4>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {detailItem.moments.map((m) => (
                      <span
                        key={m}
                        className="rounded-full border border-border/60 bg-muted/50 px-2.5 py-1 text-xs text-foreground"
                      >
                        {m}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* AI Photo Insights Section */}
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-semibold text-sm text-primary">
                    <Sparkles className="h-4 w-4" />
                    <span>AI Vision & Scene Insights</span>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleReprocessAI(detailItem._id || detailItem.id || "")}
                    disabled={reprocessingId === (detailItem._id || detailItem.id)}
                    className="h-7 text-xs text-primary hover:bg-primary/10"
                  >
                    <RefreshCw
                      className={`mr-1 h-3 w-3 ${
                        reprocessingId === (detailItem._id || detailItem.id) ? "animate-spin" : ""
                      }`}
                    />
                    Reprocess AI
                  </Button>
                </div>

                {detailItem.aiMetadata?.status === "PENDING" ? (
                  <p className="text-xs text-muted-foreground italic flex items-center gap-1.5">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                    AI is currently analyzing scene elements, mood, and auto-tagging…
                  </p>
                ) : detailItem.aiMetadata?.description ? (
                  <>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      {detailItem.aiMetadata.description}
                    </p>
                    {detailItem.aiMetadata.tags && detailItem.aiMetadata.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {detailItem.aiMetadata.tags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-md bg-primary/15 text-primary px-2 py-0.5 text-[11px] font-medium"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Click "Reprocess AI" to generate scene analysis, auto-tags, and category classifications.
                  </p>
                )}
              </div>
            </div>

            <DialogFooter className="flex flex-wrap items-center justify-between gap-2 pt-4 border-t border-border/40">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                >
                  <a href={detailItem.mediaUrl} target="_blank" rel="noopener noreferrer" download>
                    <Download className="mr-1.5 h-3.5 w-3.5" />
                    Original Media
                  </a>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const item = detailItem;
                    setDetailItem(null);
                    setInstagramItem(item);
                  }}
                  className="text-pink-500 border-pink-500/30 hover:bg-pink-500/10"
                >
                  <Instagram className="mr-1.5 h-3.5 w-3.5" />
                  Instagram Post
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const item = detailItem;
                    setDetailItem(null);
                    setEditItem(item);
                  }}
                >
                  <Edit3 className="mr-1.5 h-3.5 w-3.5" />
                  Edit
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    const id = detailItem._id || detailItem.id;
                    if (id) setDeleteId(id);
                  }}
                >
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                  Delete
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* CREATE MEMORY MODAL WITH DRAG & DROP AND MULTI-STAGE PROGRESS */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-[540px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Sparkles className="h-5 w-5 text-primary" />
              Capture a Travel Memory
            </DialogTitle>
            <DialogDescription>
              Upload photos or videos. Advenza AI will automatically optimize, categorize, and tag your memory.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Trip Selector */}
            {trips.length > 0 && (
              <div className="space-y-1.5">
                <Label htmlFor="formTripId" className="text-xs font-semibold">Associated Trip</Label>
                <Select value={formTripId} onValueChange={setFormTripId}>
                  <SelectTrigger id="formTripId" className="text-xs">
                    <SelectValue placeholder="Select Trip (Optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">Standalone Memory (No specific trip)</SelectItem>
                    {trips.map((t) => (
                      <SelectItem key={t._id} value={t._id}>
                        {t.destination || t.title || "Trip"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Day and Date */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="formN" className="text-xs font-semibold">Day Number</Label>
                <Input
                  id="formN"
                  type="number"
                  required
                  min={1}
                  value={formN}
                  onChange={(e) => setFormN(Number(e.target.value))}
                  placeholder="e.g. 1"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="formDate" className="text-xs font-semibold">Date</Label>
                <Input
                  id="formDate"
                  required
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  placeholder="e.g. Jun 14"
                />
              </div>
            </div>

            {/* Place and Weather */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="formPlace" className="text-xs font-semibold">Place / Destination</Label>
                <Input
                  id="formPlace"
                  required
                  value={formPlace}
                  onChange={(e) => setFormPlace(e.target.value)}
                  placeholder="e.g. Udaipur, City Palace"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="formWeather" className="text-xs font-semibold">Weather</Label>
                <Input
                  id="formWeather"
                  value={formWeather}
                  onChange={(e) => setFormWeather(e.target.value)}
                  placeholder="e.g. 32°C, Golden hour"
                />
              </div>
            </div>

            {/* Category and Spend */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="formCategory" className="text-xs font-semibold">Category</Label>
                <Select value={formCategory} onValueChange={setFormCategory}>
                  <SelectTrigger id="formCategory" className="text-xs">
                    <SelectValue placeholder="Select Category" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CATEGORY_DEFINITIONS)
                      .filter(([key]) => key !== "ALL")
                      .map(([key, def]) => (
                        <SelectItem key={key} value={key}>
                          <span className="mr-1.5">{def.icon}</span>
                          {def.label}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="formSpend" className="text-xs font-semibold">Spend (INR)</Label>
                <Input
                  id="formSpend"
                  type="number"
                  min={0}
                  value={formSpend}
                  onChange={(e) => setFormSpend(e.target.value)}
                  placeholder="e.g. 3500"
                />
              </div>
            </div>

            {/* Story Highlight */}
            <div className="space-y-1.5">
              <Label htmlFor="formHighlight" className="text-xs font-semibold">Highlight Story</Label>
              <Textarea
                id="formHighlight"
                required
                value={formHighlight}
                onChange={(e) => setFormHighlight(e.target.value)}
                placeholder="What made this moment or spot unforgettable?"
                rows={3}
              />
            </div>

            {/* Moments and Tags */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="formMoments" className="text-xs font-semibold">Moments (comma separated)</Label>
                <Input
                  id="formMoments"
                  value={formMoments}
                  onChange={(e) => setFormMoments(e.target.value)}
                  placeholder="Boat tour, Spicy Thali, Sunset"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="formTags" className="text-xs font-semibold">Tags (comma separated)</Label>
                <Input
                  id="formTags"
                  value={formTags}
                  onChange={(e) => setFormTags(e.target.value)}
                  placeholder="palace, lake, photography"
                />
              </div>
            </div>

            {/* Media Upload Area (Drag & Drop) */}
            <div className="space-y-2 border-t border-border/40 pt-3">
              <Label className="text-xs font-semibold">Media File (Photo or Video)</Label>

              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center cursor-pointer transition-all ${
                  isDragging
                    ? "border-primary bg-primary/10"
                    : "border-border/70 hover:border-primary/50 bg-background/50"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/heic,image/heif,video/mp4,video/webm,video/quicktime"
                  onChange={handleFileInputChange}
                  className="hidden"
                />

                {previewUrl ? (
                  <div className="relative w-full aspect-video rounded-lg overflow-hidden border border-border">
                    {detectedMediaType === "video" ? (
                      <video src={previewUrl} className="w-full h-full object-cover" controls />
                    ) : (
                      <img src={previewUrl} alt="Upload preview" className="w-full h-full object-cover" />
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        clearSelectedFile();
                      }}
                      className="absolute right-2 top-2 bg-black/70 text-white rounded-full p-1 text-xs hover:bg-black transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                    <span className="absolute left-2 bottom-2 bg-black/70 text-white text-[10px] px-2 py-0.5 rounded-md backdrop-blur-sm">
                      {detectedMediaType === "video" ? "Video preview" : "Image preview"}
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-1.5 py-2">
                    <UploadCloud className="h-9 w-9 text-muted-foreground/60" />
                    <p className="text-sm font-medium text-foreground">
                      Click to browse or drag & drop media here
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Photos: JPEG, PNG, WebP (up to 20MB) · Videos: MP4, WebM, MOV (up to 100MB)
                    </p>
                  </div>
                )}
              </div>

              {uploadError && (
                <p className="text-xs text-destructive font-medium flex items-center gap-1">
                  <AlertCircle className="h-3.5 w-3.5" />
                  {uploadError}
                </p>
              )}

              {!previewUrl && (
                <div className="flex flex-col gap-1 pt-1">
                  <span className="text-[11px] text-muted-foreground">Or provide a direct web image/video URL:</span>
                  <Input
                    value={formPhotoUrl}
                    onChange={(e) => setFormPhotoUrl(e.target.value)}
                    placeholder="https://images.unsplash.com/..."
                    className="text-xs"
                  />
                </div>
              )}
            </div>

            {/* Upload Progress Bar */}
            {submitting && (
              <div className="space-y-1.5 rounded-xl bg-primary/5 border border-primary/20 p-3">
                <div className="flex items-center justify-between text-xs font-semibold text-primary">
                  <span className="flex items-center gap-1.5">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    {progressStage}
                  </span>
                  <span>{uploadProgress}%</span>
                </div>
                <Progress value={uploadProgress} className="h-2" />
              </div>
            )}

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  clearSelectedFile();
                  setCreateOpen(false);
                }}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="bg-gradient-to-r from-primary to-accent text-white"
              >
                {submitting ? "Saving…" : "Save Memory"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* EDIT MEMORY MODAL */}
      {editItem && (
        <Dialog open={!!editItem} onOpenChange={(open) => !open && setEditItem(null)}>
          <DialogContent className="sm:max-w-[480px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Edit3 className="h-5 w-5 text-primary" />
                Edit Memory Details
              </DialogTitle>
              <DialogDescription>
                Update notes, place, category, tags, or spending details.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleEditSave} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Place / Spot</Label>
                  <Input
                    value={editItem.place}
                    onChange={(e) => setEditItem({ ...editItem, place: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Date</Label>
                  <Input
                    value={editItem.date}
                    onChange={(e) => setEditItem({ ...editItem, date: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Category</Label>
                  <Select
                    value={editItem.category || "OTHER"}
                    onValueChange={(val) => setEditItem({ ...editItem, category: val })}
                  >
                    <SelectTrigger className="text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(CATEGORY_DEFINITIONS)
                        .filter(([k]) => k !== "ALL")
                        .map(([k, def]) => (
                          <SelectItem key={k} value={k}>
                            <span className="mr-1.5">{def.icon}</span>
                            {def.label}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Spend (INR)</Label>
                  <Input
                    type="number"
                    value={editItem.spend}
                    onChange={(e) => setEditItem({ ...editItem, spend: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Weather</Label>
                <Input
                  value={editItem.weather || ""}
                  onChange={(e) => setEditItem({ ...editItem, weather: e.target.value })}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Highlight Story</Label>
                <Textarea
                  value={editItem.highlight}
                  onChange={(e) => setEditItem({ ...editItem, highlight: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Moments (comma separated)</Label>
                <Input
                  value={editItem.moments?.join(", ") || ""}
                  onChange={(e) =>
                    setEditItem({
                      ...editItem,
                      moments: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                    })
                  }
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Tags (comma separated)</Label>
                <Input
                  value={editItem.tags?.join(", ") || ""}
                  onChange={(e) =>
                    setEditItem({
                      ...editItem,
                      tags: e.target.value.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean),
                    })
                  }
                />
              </div>

              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" onClick={() => setEditItem(null)}>
                  Cancel
                </Button>
                <Button type="submit">Save Changes</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* AI COLLAGE CURATOR MODAL */}
      <Dialog open={curateOpen} onOpenChange={setCurateOpen}>
        <DialogContent className="sm:max-w-[680px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              <Wand2 className="h-5 w-5 text-primary" />
              AI Collage & Story Curator
            </DialogTitle>
            <DialogDescription>
              Let Advenza's neural curator craft a cohesive photo story from your travel archive.
            </DialogDescription>
          </DialogHeader>

          {!curateResult ? (
            <div className="space-y-4 pt-2">
              {/* Trip Selection */}
              {trips.length > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Select Trip Archive</Label>
                  <Select value={curateTripId} onValueChange={setCurateTripId}>
                    <SelectTrigger className="text-xs">
                      <SelectValue placeholder="All Trips" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Trips Across Archive</SelectItem>
                      {trips.map((t) => (
                        <SelectItem key={t._id} value={t._id}>
                          {t.destination || t.title || "Trip"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Style Selection Cards */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Curation Narrative Style</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {[
                    {
                      id: "HIGHLIGHTS",
                      label: "🌟 Signature Highlights",
                      desc: "Iconic sights, peak experiences, and memorable milestones.",
                    },
                    {
                      id: "CHRONOLOGICAL",
                      label: "⏱️ Story Arc (Start to Finish)",
                      desc: "The complete journey organized as day-by-day evolution.",
                    },
                    {
                      id: "FOODIE",
                      label: "🍕 Culinary Adventures",
                      desc: "Local gastronomy, dining, street bites, and cafe culture.",
                    },
                    {
                      id: "SCENIC",
                      label: "🌄 Nature & Landscapes",
                      desc: "Vistas, sunsets, architecture, and tranquil natural views.",
                    },
                    {
                      id: "SOCIAL",
                      label: "👥 Social & Nightlife",
                      desc: "Group portraits, joyful candid moments, and evening atmosphere.",
                    },
                  ].map((style) => (
                    <button
                      key={style.id}
                      type="button"
                      onClick={() => setCurateStyle(style.id)}
                      className={`rounded-xl border p-3 text-left transition-all ${
                        curateStyle === style.id
                          ? "border-primary bg-primary/10 shadow-sm"
                          : "border-border/60 bg-background/50 hover:bg-background/80"
                      }`}
                    >
                      <p className="text-xs font-semibold text-foreground">{style.label}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{style.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Target Count */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Target Memory Count</Label>
                <div className="flex gap-2">
                  {[4, 6, 9].map((count) => (
                    <Button
                      key={count}
                      type="button"
                      size="sm"
                      variant={curateCount === count ? "default" : "outline"}
                      onClick={() => setCurateCount(count)}
                      className="flex-1"
                    >
                      {count} Photos
                    </Button>
                  ))}
                </div>
              </div>

              {curateError && (
                <p className="text-xs text-destructive font-medium flex items-center gap-1.5">
                  <AlertCircle className="h-4 w-4" />
                  {curateError}
                </p>
              )}

              <DialogFooter className="pt-2">
                <Button variant="outline" onClick={() => setCurateOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleCurateCollage}
                  disabled={curating}
                  className="bg-gradient-to-r from-primary to-accent text-white"
                >
                  {curating ? (
                    <>
                      <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                      Curating Story…
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-1.5 h-4 w-4" />
                      Curate My Collage
                    </>
                  )}
                </Button>
              </DialogFooter>
            </div>
          ) : (
            /* Curated Result View */
            <div className="space-y-4 pt-2">
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-2">
                <h3 className="font-display text-lg font-bold text-foreground">
                  {curateResult.title}
                </h3>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {curateResult.narrative}
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs h-7"
                    onClick={() => {
                      navigator.clipboard.writeText(
                        `${curateResult.title}\n\n${curateResult.narrative}`
                      );
                      setCopiedNarrative(true);
                      setTimeout(() => setCopiedNarrative(false), 2000);
                    }}
                  >
                    {copiedNarrative ? (
                      <>
                        <Check className="mr-1 h-3 w-3 text-emerald-500" />
                        Copied Narrative
                      </>
                    ) : (
                      <>
                        <Copy className="mr-1 h-3 w-3" />
                        Copy Narrative
                      </>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    className="text-xs h-7 bg-gradient-to-r from-primary to-accent text-white shadow-sm"
                    onClick={() => {
                      const ids = curateResult.selectedMemories.map((m) => m.memoryId);
                      setCurateOpen(false);
                      setCollageInitialIds(ids);
                      setCollageStudioOpen(true);
                    }}
                  >
                    <Wand2 className="mr-1 h-3 w-3" />
                    Render in Collage Studio
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-xs h-7"
                    onClick={() => setCurateResult(null)}
                  >
                    Try Another Style
                  </Button>
                </div>
              </div>

              {/* Curated Grid Display */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {curateResult.selectedMemories.map((sel, idx) => {
                  const item = memories.find((m) => (m._id || m.id) === sel.memoryId);
                  const displayImg = item?.thumbnailUrl || item?.mediaUrl || item?.photo;
                  return (
                    <div
                      key={sel.memoryId || idx}
                      className="group relative flex flex-col rounded-xl overflow-hidden border border-border/60 bg-muted/30"
                    >
                      <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
                        {displayImg ? (
                          <img
                            src={displayImg}
                            alt={item?.place || "Curated memory"}
                            className="w-full h-full object-cover transition-transform group-hover:scale-105"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                            <ImageIcon className="h-6 w-6" />
                          </div>
                        )}
                        <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-semibold text-white">
                          #{sel.sequenceOrder || idx + 1}
                        </span>
                      </div>
                      <div className="p-2.5 space-y-1">
                        <p className="text-xs font-semibold text-foreground line-clamp-1">
                          {item?.place || "Memory"}
                        </p>
                        <p className="text-[11px] leading-tight text-muted-foreground italic line-clamp-2">
                          "{sel.reason}"
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <DialogFooter className="pt-2">
                <Button variant="outline" onClick={() => setCurateOpen(false)}>
                  Done
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* INSTAGRAM SHARE MODAL */}
      {instagramItem && (
        <InstagramModal
          isOpen={!!instagramItem}
          onOpenChange={(open) => !open && setInstagramItem(null)}
          dayData={{
            place: instagramItem.place,
            weather: instagramItem.weather || "Sunny",
            photo: instagramItem.mediaUrl || instagramItem.photo || "",
            date: instagramItem.date,
          }}
        />
      )}

      {/* CONFIRM DELETE DIALOG */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this memory?</AlertDialogTitle>
            <AlertDialogDescription>
              This memory will be removed from your trip scrapbook. You can add new memories at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Memory
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* REAL SERVER COLLAGE STUDIO DIALOG */}
      <Dialog open={collageStudioOpen} onOpenChange={setCollageStudioOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[92vh] overflow-y-auto">
          <CollageCreator
            tripId={selectedTripId !== "ALL" ? selectedTripId : undefined}
            allMemories={memories}
            initialSelectedIds={collageInitialIds}
            onClose={() => setCollageStudioOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* REAL AI TRAVEL REELS STUDIO DIALOG */}
      <Dialog open={reelStudioOpen} onOpenChange={setReelStudioOpen}>
        <DialogContent className="sm:max-w-[840px] max-h-[94vh] overflow-y-auto">
          <ReelStudio
            tripId={selectedTripId !== "ALL" ? selectedTripId : undefined}
            allMemories={memories}
            initialSelectedIds={reelInitialIds}
            destinationName={selectedTrip?.destination || "Travel Memories"}
            onClose={() => setReelStudioOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </AppShell>

  );
}

