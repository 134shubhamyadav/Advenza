import { useState, useEffect, useMemo, useRef } from "react";
import { createFileRoute, Link, type ErrorComponentProps } from "@tanstack/react-router";
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
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { InstagramModal } from "@/components/ai/instagram-modal";
import { CollageCreator } from "@/components/trips/collage-creator";
import { MemoryPhotoCollage } from "@/components/memories/memory-photo-collage";
import { MemoryShareDialog } from "@/components/memories/memory-share-dialog";
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

function MemoryErrorFallback({ error, reset }: ErrorComponentProps) {
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
          {(error instanceof Error ? error.message : null) || "There was a problem loading your travel memories. Please refresh or try again."}
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
  validateSearch: (search: Record<string, unknown>) => ({
    id: typeof search.id === "string" ? search.id : undefined,
    tripId: typeof search.tripId === "string" ? search.tripId : undefined,
  }),
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
  weather?: string;
  spend?: number;
  media?: MemoryMediaItem[];
  mediaUrl?: string;
  thumbnailUrl?: string;
  storageKey?: string;
  thumbnailKey?: string;
  mediaType?: "image" | "video";
  highlight?: string;
  moments?: string[];
  caption?: string;
  category?: string;
  tags?: string[];
  aiMetadata?: AIMetadata;
  status?: string;
  isDeleted?: boolean;
  createdAt?: string;
  photo?: string;
}

interface SelectedMediaFile {
  id: string;
  file: File;
  previewUrl: string;
  mediaType: "image" | "video";
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
  const { id: sharedMemoryId, tripId: urlTripId } = Route.useSearch();
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
  const [detailMediaIndex, setDetailMediaIndex] = useState<number>(0);
  const [editItem, setEditItem] = useState<MemoryItem | null>(null);
  const [instagramItem, setInstagramItem] = useState<MemoryItem | null>(null);
  const [shareMemoryItem, setShareMemoryItem] = useState<MemoryItem | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [curateOpen, setCurateOpen] = useState(false);
  const [collageStudioOpen, setCollageStudioOpen] = useState(false);
  const [collageInitialIds, setCollageInitialIds] = useState<string[]>([]);
  const [collageSelectedMemory, setCollageSelectedMemory] = useState<MemoryItem | null>(null);

  // Create Form State
  const [formTripId, setFormTripId] = useState<string>("");
  const [formPlace, setFormPlace] = useState("");
  const [formHighlight, setFormHighlight] = useState("");
  const [formPhotoUrl, setFormPhotoUrl] = useState("");

  // Multiple Media Upload State (up to 10 files)
  const [selectedFiles, setSelectedFiles] = useState<SelectedMediaFile[]>([]);
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

  // Reset detail media index when opening new detail item
  useEffect(() => {
    setDetailMediaIndex(0);
  }, [detailItem]);

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
            photo: item.media?.[0]?.url || item.mediaUrl || item.photo,
            mediaType: item.media?.[0]?.resourceType || item.mediaType || "image",
          }));
          list.sort((a: any, b: any) => (a.n || 0) - (b.n || 0));
          setMemories(list);
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

  // Auto-open shared memory when ?id= is present in URL
  useEffect(() => {
    if (!sharedMemoryId) return;
    // First try to find in already-loaded memories
    const found = memories.find((m) => (m._id || m.id) === sharedMemoryId);
    if (found) {
      setDetailItem(found);
      return;
    }
    // Fall back to public share endpoint (no auth required)
    fetch(`/api/memories/share/${sharedMemoryId}`)
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (data) {
          const item: MemoryItem = {
            ...data,
            id: data._id || sharedMemoryId,
            photo: data.media?.[0]?.url || data.mediaUrl || "",
            mediaType: data.media?.[0]?.resourceType || "image",
          };
          setDetailItem(item);
        }
      })
      .catch(() => {/* silent — user may need to log in */});
  }, [sharedMemoryId, memories]);

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
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processSelectedFiles(e.dataTransfer.files);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processSelectedFiles(e.target.files);
    }
  };

  const processSelectedFiles = (files: FileList | File[]) => {
    setUploadError("");
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    setSelectedFiles((prev) => {
      const availableSlots = 10 - prev.length;
      if (availableSlots <= 0) {
        setUploadError("Maximum 10 media files are allowed per Memory.");
        return prev;
      }

      const newItems: SelectedMediaFile[] = [];
      let hadOversizeOrInvalid = false;

      for (const file of fileArray) {
        if (prev.length + newItems.length >= 10) {
          setUploadError("Maximum 10 media files reached. Extra files were not added.");
          break;
        }

        // Safe duplicate check against existing items AND currently processing batch
        const isDuplicate = prev.some(
          (s) => s.file.name === file.name && s.file.size === file.size && s.file.lastModified === file.lastModified
        ) || newItems.some(
          (s) => s.file.name === file.name && s.file.size === file.size && s.file.lastModified === file.lastModified
        );
        if (isDuplicate) continue;

        const validation = validateMediaFile(file, 20, 100);
        if (!validation.valid) {
          setUploadError(validation.error || `File ${file.name} is invalid or exceeds file size limit.`);
          hadOversizeOrInvalid = true;
          continue;
        }

        const localUrl = URL.createObjectURL(file);
        newItems.push({
          id: `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          file,
          previewUrl: localUrl,
          mediaType: validation.mediaType,
        });
      }

      if (newItems.length > 0 && !hadOversizeOrInvalid) {
        setUploadError("");
      }

      return [...prev, ...newItems];
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeSelectedFile = (id: string) => {
    setSelectedFiles((prev) => {
      const target = prev.find((f) => f.id === id);
      if (target && target.previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((f) => f.id !== id);
    });
  };

  const clearSelectedFiles = () => {
    selectedFiles.forEach((f) => {
      if (f.previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(f.previewUrl);
      }
    });
    setSelectedFiles([]);
    setUploadError("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Submit New Memory (Uploads to Cloudinary & saves references in MongoDB)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (selectedFiles.length === 0 && !formPhotoUrl.trim()) {
      setUploadError("Please select at least one photo or video, or provide a media URL.");
      return;
    }

    if (selectedFiles.length > 10) {
      setUploadError("Maximum 10 media files are allowed per Memory.");
      return;
    }

    setSubmitting(true);
    setUploadError("");
    setUploadProgress(5);
    setProgressStage(`1/3: Preparing ${selectedFiles.length || 1} media file(s)…`);

    const uploadedAssets: MemoryMediaItem[] = [];

    try {
      if (selectedFiles.length > 0) {
        const total = selectedFiles.length;
        for (let i = 0; i < total; i++) {
          const item = selectedFiles[i];
          const progressStep = Math.round(10 + ((i / total) * 70));
          setUploadProgress(progressStep);
          setProgressStage(`2/3: Uploading media ${i + 1} of ${total} to Cloudinary…`);

          let uploadBlob: Blob = item.file;
          if (item.mediaType === "image") {
            try {
              uploadBlob = await compressImage(item.file, 1920, 0.85);
            } catch {
              uploadBlob = item.file;
            }
          }

          const backendRes: any = await apiFetch("/api/memories/upload-binary", {
            method: "POST",
            headers: {
              "Content-Type": item.file.type || (item.mediaType === "video" ? "video/mp4" : "image/jpeg"),
              "x-file-name": encodeURIComponent(item.file.name),
              ...(formTripId && formTripId !== "NONE" ? { "x-trip-id": formTripId } : {}),
            },
            body: uploadBlob,
          });

          if (!backendRes?.mediaUrl) {
            throw new Error(`Failed to upload ${item.file.name} to Cloudinary.`);
          }

          uploadedAssets.push({
            url: backendRes.mediaUrl,
            publicId: backendRes.publicId || backendRes.storageKey || "",
            resourceType: backendRes.resourceType || item.mediaType,
            format: backendRes.format || "",
            width: backendRes.width || 0,
            height: backendRes.height || 0,
            duration: backendRes.duration || 0,
            originalName: item.file.name,
          });
        }
      } else if (formPhotoUrl.trim()) {
        uploadedAssets.push({
          url: formPhotoUrl.trim(),
          publicId: `external_${Date.now()}`,
          resourceType: "image",
          format: "jpg",
          width: 0,
          height: 0,
          duration: 0,
          originalName: "external_image",
        });
      }

      setUploadProgress(85);
      setProgressStage("3/3: Saving memory metadata & triggering AI enrichment…");

      const primary = uploadedAssets[0];
      const memoryPayload = {
        tripId: formTripId && formTripId !== "NONE" ? formTripId : undefined,
        place: formPlace.trim(),
        date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        media: uploadedAssets,
        mediaUrl: primary?.url || "",
        thumbnailUrl: primary?.url || "",
        storageKey: primary?.publicId || `users/${user.uid}/memories/${Date.now()}`,
        mediaType: primary?.resourceType || "image",
        highlight: formHighlight.trim(),
        caption: formHighlight.trim(),
      };

      const savedMemory = await apiFetch("/api/memories", {
        method: "POST",
        body: JSON.stringify(memoryPayload),
      });

      setUploadProgress(100);
      setProgressStage("Memory saved successfully!");

      const addedItem: MemoryItem = {
        ...savedMemory,
        id: savedMemory._id || savedMemory.id,
        photo: savedMemory.media?.[0]?.url || savedMemory.mediaUrl,
        mediaType: savedMemory.media?.[0]?.resourceType || savedMemory.mediaType || "image",
        aiMetadata: savedMemory.aiMetadata || { status: "PENDING" },
      };

      setMemories((prev) => [addedItem, ...prev.filter((m) => (m._id || m.id) !== addedItem.id)]);

      // Reset form
      setFormPlace("");
      setFormHighlight("");
      setFormPhotoUrl("");
      clearSelectedFiles();
      setCreateOpen(false);
    } catch (err: any) {
      console.error("Error creating memory:", err);
      setUploadError(err.message || "Failed to save memory.");

      // Rollback uploaded Cloudinary assets to prevent orphaned files
      if (uploadedAssets.length > 0) {
        apiFetch("/api/memories/cleanup-assets", {
          method: "POST",
          body: JSON.stringify({
            items: uploadedAssets.map((a) => ({ publicId: a.publicId, resourceType: a.resourceType })),
          }),
        }).catch(() => {});
      }
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
                const mediaList: MemoryMediaItem[] = (Array.isArray(item.media) && item.media.length > 0)
                  ? item.media
                  : (Array.isArray((item as any).mediaItems) && (item as any).mediaItems.length > 0)
                    ? (item as any).mediaItems.map((m: any) => ({
                        url: m.storageUrl || m.url,
                        resourceType: m.type === "video" || m.resourceType === "video" ? "video" : "image",
                        originalName: m.originalName || "",
                      }))
                    : [{ url: item.thumbnailUrl || item.mediaUrl || item.photo || "", resourceType: item.mediaType || "image" }];
                const mediaCount = mediaList.length;
                const catDef =
                  CATEGORY_DEFINITIONS[(item.category || item.aiMetadata?.category || "OTHER").toUpperCase()] ||
                  CATEGORY_DEFINITIONS.OTHER;
                const isAiPending = item.aiMetadata?.status === "PENDING";
                const isAiReady = item.aiMetadata?.status === "READY";
                const associatedTrip = trips.find(
                  (t) => t._id === (typeof item.tripId === "object" ? (item.tripId as any)?._id : item.tripId)
                );

                // Responsive scrapbook collage aspect ratio based on count
                const collageHeightClass =
                  mediaCount === 1
                    ? "aspect-[16/10] min-h-[220px]"
                    : mediaCount === 2
                    ? "aspect-[16/11] min-h-[240px]"
                    : mediaCount === 3
                    ? "aspect-[16/12] min-h-[260px]"
                    : "aspect-[4/3] min-h-[280px]";

                return (
                  <article
                    key={itemId}
                    onClick={() => setDetailItem(item)}
                    className="group relative flex flex-col justify-between overflow-hidden rounded-2xl glass-panel cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:ring-2 hover:ring-primary/40 animate-in fade-in slide-in-from-bottom-3"
                    style={{ animationDelay: `${index * 0.04}s` }}
                  >
                    {/* Media Thumbnail Container — Photo Collage */}
                    <div className={`relative ${collageHeightClass} w-full overflow-hidden bg-muted`}>
                      <MemoryPhotoCollage
                        media={mediaList}
                        place={item.place}
                        date={item.date}
                        onShare={() => {
                          setShareMemoryItem(item);
                        }}
                        className="h-full"
                      />

                      {/* Day and Date Badge */}
                      <span className="pointer-events-none absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-background/85 backdrop-blur-md px-2.5 py-1 text-[11px] font-semibold text-foreground shadow-sm z-10">
                        <Calendar className="h-3 w-3 text-primary" />
                        Day {item.n} · {item.date}
                      </span>

                      {/* AI Status Badge */}
                      {isAiPending && (
                        <span className="pointer-events-none absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-primary/90 backdrop-blur-md px-2.5 py-1 text-[10px] font-semibold text-white shadow-sm animate-pulse z-10">
                          <Sparkles className="h-3 w-3 animate-spin" />
                          AI Enriching…
                        </span>
                      )}
                      {!isAiPending && isAiReady && (
                        <span className="pointer-events-none absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-background/85 backdrop-blur-md px-2 py-0.5 text-[10px] font-semibold text-primary shadow-sm border border-primary/30 z-10">
                          <Sparkles className="h-3 w-3" />
                          AI Ready
                        </span>
                      )}

                      {/* Category Chip */}
                      <span
                        className={`pointer-events-none absolute left-3 bottom-3 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold backdrop-blur-md shadow-sm border z-10 ${catDef.badgeClass}`}
                      >
                        <span>{catDef.icon}</span>
                        <span>{catDef.label}</span>
                      </span>
                    </div>

                    {/* Card Body */}
                    <div className="flex flex-1 flex-col justify-between p-5">
                      <div>
                        {/* Title, Associated Trip, and Weather */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <MapPin className="h-4 w-4 text-primary shrink-0" />
                              <h3 className="font-semibold text-base line-clamp-1 text-foreground">
                                {item.place}
                              </h3>
                              {associatedTrip?.title && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 border border-primary/20 px-2 py-0.5 text-[10px] font-medium text-primary">
                                  ✈️ {associatedTrip.title}
                                </span>
                              )}
                            </div>
                          </div>
                          {item.weather && (
                            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap shrink-0">
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
                          {item.spend && item.spend > 0 ? inr(item.spend) : "Free"}
                        </span>

                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => {
                              setCollageSelectedMemory(item);
                              setCollageStudioOpen(true);
                            }}
                            title="Open in Collage Studio"
                            className="p-1.5 rounded-full hover:bg-primary/10 text-primary/70 hover:text-primary transition-colors"
                          >
                            <LayoutGrid className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => setShareMemoryItem(item)}
                            title="Share memory"
                            className="p-1.5 rounded-full hover:bg-primary/10 text-primary/70 hover:text-primary transition-colors"
                          >
                            <Share2 className="h-3.5 w-3.5" />
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
                const mediaList: MemoryMediaItem[] = (Array.isArray(d.media) && d.media.length > 0)
                  ? d.media
                  : (Array.isArray((d as any).mediaItems) && (d as any).mediaItems.length > 0)
                    ? (d as any).mediaItems.map((m: any) => ({
                        url: m.storageUrl || m.url,
                        resourceType: m.type === "video" || m.resourceType === "video" ? "video" : "image",
                        originalName: m.originalName || "",
                      }))
                    : [{ url: d.thumbnailUrl || d.mediaUrl || d.photo || "", resourceType: d.mediaType || "image" }];
                const primaryMedia = mediaList[0];
                const displayPhoto = primaryMedia?.url || d.thumbnailUrl || d.mediaUrl || d.photo;
                const itemId = d._id || d.id || `mem_${index}`;
                const isVideo = primaryMedia?.resourceType === "video" || d.mediaType === "video";
                const mediaCount = mediaList.length;
                const catDef =
                  CATEGORY_DEFINITIONS[(d.category || d.aiMetadata?.category || "OTHER").toUpperCase()] ||
                  CATEGORY_DEFINITIONS.OTHER;
                const associatedTrip = trips.find(
                  (t) => t._id === (typeof d.tripId === "object" ? (d.tripId as any)?._id : d.tripId)
                );

                return (
                  <article
                    key={itemId}
                    onClick={() => setDetailItem(d)}
                    className="grid gap-0 overflow-hidden rounded-2xl glass-panel md:grid-cols-[340px_1fr] cursor-pointer hover:ring-2 hover:ring-primary/40 transition-all hover:-translate-y-1 group animate-in fade-in slide-in-from-bottom-3"
                    style={{ animationDelay: `${index * 0.03}s` }}
                  >
                    <div className="relative h-64 md:h-full min-h-[240px] md:min-h-[280px] bg-muted overflow-hidden">
                      <MemoryPhotoCollage
                        media={mediaList}
                        place={d.place}
                        date={d.date}
                        onShare={() => setShareMemoryItem(d)}
                        className="h-full"
                      />
                      <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-background/90 backdrop-blur-md px-2.5 py-1 text-[11px] font-semibold text-foreground shadow-sm z-10">
                        Day {d.n} · {d.date}
                      </span>
                      <span
                        className={`pointer-events-none absolute left-3 bottom-3 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold backdrop-blur-md shadow-sm border z-10 ${catDef.badgeClass}`}
                      >
                        <span>{catDef.icon}</span>
                        <span>{catDef.label}</span>
                      </span>
                    </div>

                    <div className="p-6 flex flex-col justify-between min-h-[220px]">
                      <div>
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <MapPin className="h-4 w-4 text-primary shrink-0" />
                            <h3 className="font-semibold text-lg">{d.place}</h3>
                            {associatedTrip?.title && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 border border-primary/20 px-2 py-0.5 text-xs font-medium text-primary">
                                ✈️ {associatedTrip.title}
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                            {d.weather && (
                              <span className="inline-flex items-center gap-1">
                                <CloudSun className="h-3.5 w-3.5" />
                                {d.weather}
                              </span>
                            )}
                            <span>Spend {d.spend ? inr(d.spend) : "Free"}</span>
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
                              setCollageSelectedMemory(d);
                              setCollageStudioOpen(true);
                            }}
                            className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary-foreground hover:bg-primary bg-primary/10 px-3 py-1.5 rounded-full transition-all"
                          >
                            <LayoutGrid className="h-3.5 w-3.5" />
                            Collage
                          </button>
                          <button
                            onClick={() => setShareMemoryItem(d)}
                            className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary-foreground hover:bg-primary bg-primary/10 px-3 py-1.5 rounded-full transition-all"
                          >
                            <Share2 className="h-3.5 w-3.5" />
                            Share
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

      {/* DETAIL MODAL WITH MULTI-MEDIA GALLERY & AI INSIGHTS */}
      {detailItem && (() => {
        const detailMediaList: MemoryMediaItem[] = (Array.isArray(detailItem.media) && detailItem.media.length > 0)
          ? detailItem.media
          : [{
              url: detailItem.mediaUrl || detailItem.photo || "",
              resourceType: detailItem.mediaType || "image",
              publicId: detailItem.storageKey || "",
            }];
        const currentMedia = detailMediaList[detailMediaIndex] || detailMediaList[0];
        const isCurrentVideo = currentMedia?.resourceType === "video" || (!currentMedia?.resourceType && detailItem.mediaType === "video");

        return (
          <Dialog open={!!detailItem} onOpenChange={(open) => !open && setDetailItem(null)}>
            <DialogContent className="sm:max-w-[760px] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <div className="flex items-center justify-between gap-2 pr-6">
                  <DialogTitle className="flex items-center gap-2 text-xl font-bold">
                    <MapPin className="h-5 w-5 text-primary" />
                    {detailItem.place || "Travel Memory"}
                  </DialogTitle>
                  <span className="rounded-full bg-primary/10 text-primary px-3 py-1 text-xs font-semibold">
                    Day {detailItem.n} · {detailItem.date}
                  </span>
                </div>
                <DialogDescription className="flex items-center gap-3 text-xs text-muted-foreground pt-1">
                  {detailItem.weather && <span>Weather: {detailItem.weather}</span>}
                  {detailItem.spend !== undefined && detailItem.spend > 0 && <span>Spend: {inr(detailItem.spend)}</span>}
                  {detailItem.category && (
                    <span className="font-medium text-foreground">
                      Category: {CATEGORY_DEFINITIONS[detailItem.category.toUpperCase()]?.label || detailItem.category}
                    </span>
                  )}
                </DialogDescription>
              </DialogHeader>

              {/* Media Gallery / Presentation */}
              <div className="space-y-3">
                <div className="relative rounded-xl overflow-hidden bg-black/95 aspect-video flex items-center justify-center group shadow-inner">
                  {isCurrentVideo ? (
                    <video
                      key={currentMedia.url}
                      controls
                      src={currentMedia.url}
                      poster={currentMedia.url}
                      className="w-full h-full max-h-[50vh] object-contain"
                      autoPlay={false}
                    />
                  ) : (
                    <img
                      key={currentMedia.url}
                      src={currentMedia.url}
                      alt={detailItem.place || "Memory media"}
                      className="w-full h-full max-h-[50vh] object-contain"
                    />
                  )}

                  {/* Navigation Arrows for Multiple Media */}
                  {detailMediaList.length > 1 && (
                    <>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDetailMediaIndex((prev) => (prev > 0 ? prev - 1 : detailMediaList.length - 1));
                        }}
                        className="absolute left-3 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 hover:bg-black/90 text-white backdrop-blur-sm transition-all shadow-md"
                        title="Previous media"
                      >
                        <ChevronLeft className="h-5 w-5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDetailMediaIndex((prev) => (prev < detailMediaList.length - 1 ? prev + 1 : 0));
                        }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 hover:bg-black/90 text-white backdrop-blur-sm transition-all shadow-md"
                        title="Next media"
                      >
                        <ChevronRight className="h-5 w-5" />
                      </button>
                      <span className="absolute top-3 right-3 rounded-full bg-black/75 backdrop-blur-md px-2.5 py-1 text-[11px] font-semibold text-white shadow">
                        {detailMediaIndex + 1} / {detailMediaList.length}
                      </span>
                    </>
                  )}
                </div>

                {/* Multiple Media Thumbnails Strip */}
                {detailMediaList.length > 1 && (
                  <div className="flex items-center gap-2 overflow-x-auto py-1 px-1 no-scrollbar">
                    {detailMediaList.map((m, idx) => {
                      const isSelected = idx === detailMediaIndex;
                      const isItemVideo = m.resourceType === "video";
                      return (
                        <button
                          key={m.url || idx}
                          type="button"
                          onClick={() => setDetailMediaIndex(idx)}
                          className={`relative flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                            isSelected
                              ? "border-primary ring-2 ring-primary/40 scale-105 shadow-md"
                              : "border-border/60 opacity-60 hover:opacity-100"
                          }`}
                        >
                          {isItemVideo ? (
                            <div className="w-full h-full bg-zinc-900 flex items-center justify-center">
                              <Play className="h-5 w-5 fill-white text-white" />
                            </div>
                          ) : (
                            <img src={m.url} alt="" className="w-full h-full object-cover" />
                          )}
                          {isItemVideo && (
                            <span className="absolute bottom-1 right-1 bg-black/80 rounded px-1 py-0.2 text-[8px] text-white">
                              <Film className="h-2.5 w-2.5" />
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Content & Story */}
              <div className="space-y-4 pt-2">
                {detailItem.highlight && (
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Highlight Story
                    </h4>
                    <p className="mt-1 text-sm leading-relaxed text-foreground">
                      {detailItem.highlight}
                    </p>
                  </div>
                )}

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
                    <a href={currentMedia.url} target="_blank" rel="noopener noreferrer" download>
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
                      setShareMemoryItem(item);
                    }}
                    className="text-primary border-primary/30 hover:bg-primary/10"
                  >
                    <Share2 className="mr-1.5 h-3.5 w-3.5" />
                    Share Memory
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const item = detailItem;
                      setDetailItem(null);
                      setCollageSelectedMemory(item);
                      setCollageStudioOpen(true);
                    }}
                    className="text-primary border-primary/30 hover:bg-primary/10"
                  >
                    <LayoutGrid className="mr-1.5 h-3.5 w-3.5" />
                    Collage Studio
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
        );
      })()}

      {/* CREATE MEMORY MODAL WITH MULTI-FILE PREVIEWS & PROGRESS */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Sparkles className="h-5 w-5 text-primary" />
              Capture a Travel Memory
            </DialogTitle>
            <DialogDescription>
              Upload up to 10 photos or videos per memory. Advenza AI will automatically optimize, categorize, and tag your memories.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">

            {/* ── MULTI-MEDIA UPLOAD (primary action — top of form) ── */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">Photos & Videos</Label>
                <span className={`text-[11px] font-medium ${selectedFiles.length >= 10 ? "text-amber-500 font-semibold" : "text-muted-foreground"}`}>
                  {selectedFiles.length} / 10 selected
                </span>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime"
                onChange={handleFileInputChange}
                className="hidden"
              />

              {selectedFiles.length > 0 ? (
                <div className="space-y-2">
                  {/* Thumbnail Previews Grid */}
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 p-2.5 rounded-xl border border-border/70 bg-background/50 max-h-60 overflow-y-auto">
                    {selectedFiles.map((item) => {
                      const isVideo = item.mediaType === "video";
                      return (
                        <div
                          key={item.id}
                          className="group relative aspect-square rounded-lg overflow-hidden border border-border/80 bg-black/40 shadow-sm"
                        >
                          {isVideo ? (
                            <div className="relative w-full h-full flex items-center justify-center bg-zinc-900">
                              <video src={item.previewUrl} className="w-full h-full object-cover" />
                              <div className="absolute inset-0 flex items-center justify-center bg-black/30 pointer-events-none">
                                <Play className="h-5 w-5 fill-white text-white" />
                              </div>
                            </div>
                          ) : (
                            <img
                              src={item.previewUrl}
                              alt={item.file.name}
                              className="w-full h-full object-cover"
                            />
                          )}

                          {/* Remove Button on each individual media item */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeSelectedFile(item.id);
                            }}
                            className="absolute top-1 right-1 bg-black/70 hover:bg-destructive text-white rounded-full p-1 shadow transition-all duration-200"
                            title="Remove file"
                          >
                            <X className="h-3 w-3" />
                          </button>

                          {/* Media Type Badge */}
                          <span className="absolute bottom-1 left-1 bg-black/70 backdrop-blur-sm text-white text-[9px] px-1.5 py-0.5 rounded font-medium">
                            {isVideo ? "Video" : "Photo"}
                          </span>
                        </div>
                      );
                    })}

                    {/* Add more button if less than 10 */}
                    {selectedFiles.length < 10 && (
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="flex flex-col items-center justify-center aspect-square rounded-lg border-2 border-dashed border-border/80 hover:border-primary/60 hover:bg-primary/5 transition-all text-muted-foreground hover:text-primary gap-1"
                      >
                        <Plus className="h-5 w-5" />
                        <span className="text-[10px] font-medium">Add more</span>
                      </button>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-muted-foreground px-1">
                    <span>Photos ≤20MB · Videos ≤100MB</span>
                    <button
                      type="button"
                      onClick={clearSelectedFiles}
                      className="text-xs text-destructive hover:underline"
                    >
                      Clear all
                    </button>
                  </div>
                </div>
              ) : (
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
                  <div className="flex flex-col items-center justify-center gap-1.5 py-2">
                    <UploadCloud className="h-9 w-9 text-muted-foreground/60" />
                    <p className="text-sm font-medium text-foreground">
                      Click to browse or drag & drop (select up to 10 files)
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Photos: JPEG, PNG, WebP (≤20MB) · Videos: MP4, WebM, MOV (≤100MB)
                    </p>
                  </div>
                </div>
              )}

              {uploadError && (
                <p className="text-xs text-destructive font-medium flex items-center gap-1">
                  <AlertCircle className="h-3.5 w-3.5" />
                  {uploadError}
                </p>
              )}

              {selectedFiles.length === 0 && (
                <div className="flex flex-col gap-1 pt-1">
                  <span className="text-[11px] text-muted-foreground">Or paste a direct image / video URL:</span>
                  <Input
                    value={formPhotoUrl}
                    onChange={(e) => setFormPhotoUrl(e.target.value)}
                    placeholder="https://images.unsplash.com/..."
                    className="text-xs"
                  />
                </div>
              )}
            </div>

            {/* ── ASSOCIATED TRIP ── */}
            {trips.length > 0 && (
              <div className="space-y-1.5">
                <Label htmlFor="formTripId" className="text-xs font-semibold">Associated Trip</Label>
                <Select value={formTripId} onValueChange={setFormTripId}>
                  <SelectTrigger id="formTripId" className="text-xs">
                    <SelectValue placeholder="Select trip (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">Standalone Memory (no specific trip)</SelectItem>
                    {trips.map((t) => (
                      <SelectItem key={t._id} value={t._id}>
                        {t.destination || t.title || "Trip"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* ── PLACE (optional) ── */}
            <div className="space-y-1.5">
              <Label htmlFor="formPlace" className="text-xs font-semibold">
                Place <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Input
                id="formPlace"
                value={formPlace}
                onChange={(e) => setFormPlace(e.target.value)}
                placeholder="e.g. Udaipur, City Palace"
              />
            </div>

            {/* ── STORY (optional) ── */}
            <div className="space-y-1.5">
              <Label htmlFor="formHighlight" className="text-xs font-semibold">
                Story <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Textarea
                id="formHighlight"
                value={formHighlight}
                onChange={(e) => setFormHighlight(e.target.value)}
                placeholder="What happened here? What made it special?"
                rows={3}
              />
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
                  clearSelectedFiles();
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
              <div className="space-y-1">
                <Label className="text-xs">Place / Spot</Label>
                <Input
                  value={editItem.place}
                  onChange={(e) => setEditItem({ ...editItem, place: e.target.value })}
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

      {/* UNIFIED SHARE DIALOG — WhatsApp, Instagram, Facebook, X, Telegram, Copy Link, Native */}
      <MemoryShareDialog
        isOpen={!!shareMemoryItem}
        onOpenChange={(open) => !open && setShareMemoryItem(null)}
        memory={shareMemoryItem}
      />

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
      <Dialog
        open={collageStudioOpen}
        onOpenChange={(open) => {
          setCollageStudioOpen(open);
          if (!open) setCollageSelectedMemory(null);
        }}
      >
        <DialogContent className="sm:max-w-[700px] max-h-[92vh] overflow-y-auto">
          <CollageCreator
            tripId={selectedTripId !== "ALL" ? selectedTripId : undefined}
            memory={collageSelectedMemory}
            allMemories={memories}
            initialSelectedIds={collageInitialIds}
            onClose={() => {
              setCollageStudioOpen(false);
              setCollageSelectedMemory(null);
            }}
          />
        </DialogContent>
      </Dialog>
    </AppShell>

  );
}

