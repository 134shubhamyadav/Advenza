import { useState, useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { AiBadge } from "@/components/ai/ai-badge";
import { inr } from "@/lib/utils";
import { Camera, CloudSun, MapPin, Instagram, Plus, Trash2, Loader2, Sparkles } from "lucide-react";
import { InstagramModal } from "@/components/ai/instagram-modal";
import { useAuth } from "../context/AuthContext";
import { db } from "../lib/firebase";
import { collection, query, where, getDocs, addDoc, deleteDoc, doc } from "firebase/firestore";
import { Button } from "@/components/ui/button";
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

export const Route = createFileRoute("/memory")({ component: Memory });

interface MemoryItem {
  id: string;
  n: number;
  place: string;
  date: string;
  weather: string;
  spend: number;
  photo: string;
  highlight: string;
  moments: string[];
}

function Memory() {
  const { user } = useAuth();
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<MemoryItem | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  // Form states
  const [createOpen, setCreateOpen] = useState(false);
  const [formN, setFormN] = useState<number>(1);
  const [formPlace, setFormPlace] = useState("");
  const [formDate, setFormDate] = useState("");
  const [formWeather, setFormWeather] = useState("");
  const [formSpend, setFormSpend] = useState("");
  const [formHighlight, setFormHighlight] = useState("");
  const [formMoments, setFormMoments] = useState("");
  const [formPhotoUrl, setFormPhotoUrl] = useState("");
  const [formPhotoBase64, setFormPhotoBase64] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const q = query(collection(db, "memories"), where("userId", "==", user.uid));
    getDocs(q)
      .then((snapshot) => {
        const list: MemoryItem[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...docSnap.data() } as MemoryItem);
        });
        // Sort in memory by day number `n`
        list.sort((a, b) => a.n - b.n);
        setMemories(list);
        setFormN(list.length + 1);
      })
      .catch((err) => {
        console.error("Error fetching memories:", err);
      })
      .finally(() => setLoading(false));
  }, [user]);

  const openShareModal = (day: MemoryItem) => {
    setSelectedDay(day);
    setModalOpen(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormPhotoBase64(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);
    try {
      const momentsList = formMoments
        .split(",")
        .map((m) => m.trim())
        .filter(Boolean);

      const newMemory = {
        n: Number(formN) || 1,
        place: formPlace,
        date: formDate,
        weather: formWeather,
        spend: Number(formSpend) || 0,
        photo: formPhotoBase64 || formPhotoUrl || "https://images.unsplash.com/photo-1695956353120-54ce5e91632b?fm=jpg&q=75&w=1400&auto=format&fit=crop",
        highlight: formHighlight,
        moments: momentsList,
        userId: user.uid,
        createdAt: new Date().toISOString(),
      };

      const docRef = await addDoc(collection(db, "memories"), newMemory);
      
      const addedItem: MemoryItem = { id: docRef.id, ...newMemory };
      setMemories((prev) => [...prev, addedItem].sort((a, b) => a.n - b.n));

      // Reset form
      setFormN((prev) => prev + 1); // Suggest next day number
      setFormPlace("");
      setFormDate("");
      setFormWeather("");
      setFormSpend("");
      setFormHighlight("");
      setFormMoments("");
      setFormPhotoUrl("");
      setFormPhotoBase64("");
      setCreateOpen(false);
    } catch (err) {
      console.error("Error creating memory:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this memory?")) return;
    try {
      await deleteDoc(doc(db, "memories", id));
      setMemories((prev) => prev.filter((m) => m.id !== id));
    } catch (err) {
      console.error("Error deleting memory:", err);
    }
  };

  // Compute dynamic stats
  const totalDays = memories.length;
  const photoCount = memories.filter((m) => m.photo).length;
  const uniquePlaces = new Set(
    memories.map((m) => m.place.split(",")[0].trim()).filter(Boolean)
  ).size;
  const totalSpend = memories.reduce((sum, m) => sum + (Number(m.spend) || 0), 0);

  return (
    <AppShell
      title="Memory Timeline"
      subtitle="An interactive scrapbook Aventra writes as your trip happens."
      actions={
        user && (
          <Button onClick={() => setCreateOpen(true)} className="bg-gradient-to-r from-primary to-accent shadow-lg">
            <Plus className="mr-1.5 h-4 w-4" />
            Add memory
          </Button>
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
          <p className="mt-4 text-sm text-muted-foreground">Loading your scrapbook…</p>
        </div>
      ) : (
        <>
          {memories.length > 0 && (
            <div className="mb-6 grid gap-4 grid-cols-2 sm:grid-cols-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
              {[
                ["Days", totalDays.toString()],
                ["Photos", photoCount.toString()],
                ["Places visited", uniquePlaces.toString()],
                ["Total spend", inr(totalSpend)],
              ].map(([k, v]) => (
                <div key={k} className="rounded-2xl glass-panel p-5">
                  <p className="text-xs text-muted-foreground">{k}</p>
                  <p className="mt-1 font-display text-2xl sm:text-3xl text-foreground font-bold">{v}</p>
                </div>
              ))}
            </div>
          )}

          {memories.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl glass-panel p-16 text-center animate-in fade-in duration-500">
              <Camera className="h-12 w-12 text-muted-foreground/30" />
              <p className="mt-4 text-lg font-semibold">No memories yet</p>
              <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                Capture your journey! Add photos, notes, weather, and spending from your trips to build your scrapbook.
              </p>
              <Button onClick={() => setCreateOpen(true)} className="mt-6">
                <Plus className="mr-1.5 h-4 w-4" />
                Add your first memory
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              {memories.map((d, index) => (
                <article
                  key={d.id}
                  onClick={() => openShareModal(d)}
                  className="grid gap-0 overflow-hidden rounded-2xl glass-panel md:grid-cols-[280px_1fr] cursor-pointer hover:ring-2 hover:ring-pink-500/50 transition-all hover:-translate-y-1 group animate-in fade-in slide-in-from-bottom-3 duration-500"
                  style={{ animationDelay: `${index * 0.05}s` }}
                >
                  <div className="relative h-56 md:h-full min-h-[220px]">
                    <img
                      src={d.photo}
                      alt={d.place}
                      className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                    <span className="absolute left-3 top-3 rounded-full bg-background/90 px-2.5 py-1 text-[11px] font-semibold text-foreground shadow-sm">
                      Day {d.n} · {d.date}
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
                              <CloudSun className="h-3.5 w-3.5" strokeWidth={2} />
                              {d.weather}
                            </span>
                          )}
                          <span className="inline-flex items-center gap-1">
                            <Camera className="h-3.5 w-3.5" strokeWidth={2} />
                            {d.photo ? 1 : 0} photo
                          </span>
                          <span>Spend {inr(d.spend)}</span>
                        </div>
                      </div>
                      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{d.highlight}</p>
                    </div>

                    <div className="mt-6 pt-4 border-t border-border/30 flex flex-wrap items-center justify-between gap-4">
                      <ul className="flex flex-wrap gap-2 text-xs">
                        {d.moments.map((m) => (
                          <li
                            key={m}
                            className="rounded-full border border-border/60 bg-background/50 px-2.5 py-1 text-muted-foreground"
                          >
                            {m}
                          </li>
                        ))}
                      </ul>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => handleDelete(d.id, e)}
                          className="flex items-center gap-2 text-xs font-semibold text-destructive hover:text-destructive-foreground hover:bg-destructive bg-destructive/10 px-3 py-1.5 rounded-full transition-all"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openShareModal(d);
                          }}
                          className="flex items-center gap-2 text-xs font-semibold text-pink-500 hover:text-white hover:bg-pink-500 bg-pink-500/10 px-3 py-1.5 rounded-full transition-all"
                        >
                          <Instagram className="h-3.5 w-3.5" />
                          Create Reel/Post
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      )}

      {/* Create Memory Modal */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary animate-pulse" />
              Capture a New Memory
            </DialogTitle>
            <DialogDescription>
              Record the sights, moments, and expenses from your trip.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="formN" className="text-xs font-semibold">Day Number</Label>
                <Input
                  id="formN"
                  type="number"
                  required
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
                  placeholder="e.g. Jun 12"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="formPlace" className="text-xs font-semibold">Place / Highlight</Label>
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
                  placeholder="e.g. 32°C, clear"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="formSpend" className="text-xs font-semibold">Spend (INR)</Label>
              <Input
                id="formSpend"
                type="number"
                value={formSpend}
                onChange={(e) => setFormSpend(e.target.value)}
                placeholder="e.g. 4500"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="formHighlight" className="text-xs font-semibold">Highlight Story</Label>
              <Textarea
                id="formHighlight"
                required
                value={formHighlight}
                onChange={(e) => setFormHighlight(e.target.value)}
                placeholder="What made this day unforgettable?"
                rows={3}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="formMoments" className="text-xs font-semibold">Moments (comma-separated)</Label>
              <Input
                id="formMoments"
                value={formMoments}
                onChange={(e) => setFormMoments(e.target.value)}
                placeholder="e.g. Boat tour, Spicy Thali dinner, Sunset view"
              />
            </div>

            <div className="space-y-2 border-t border-border/40 pt-3">
              <Label className="text-xs font-semibold">Memory Photo</Label>
              <div className="grid gap-3">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] text-muted-foreground">Upload from your device:</span>
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="cursor-pointer file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 text-xs"
                  />
                </div>
                {formPhotoBase64 && (
                  <div className="relative aspect-video rounded-lg overflow-hidden border border-border">
                    <img src={formPhotoBase64} alt="Preview" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setFormPhotoBase64("")}
                      className="absolute right-2 top-2 bg-black/60 text-white rounded-full p-1 text-xs hover:bg-black"
                    >
                      Remove
                    </button>
                  </div>
                )}
                {!formPhotoBase64 && (
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-muted-foreground">Or paste an Unsplash image URL:</span>
                    <Input
                      value={formPhotoUrl}
                      onChange={(e) => setFormPhotoUrl(e.target.value)}
                      placeholder="https://images.unsplash.com/..."
                    />
                  </div>
                )}
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateOpen(false)}
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

      {selectedDay && (
        <InstagramModal isOpen={modalOpen} onOpenChange={setModalOpen} dayData={selectedDay} />
      )}
    </AppShell>
  );
}
