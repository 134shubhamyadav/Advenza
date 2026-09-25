import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "../context/AuthContext";
import { signOut } from "firebase/auth";
import { auth } from "../lib/firebase";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { apiFetch } from "@/lib/api";
import { inr } from "@/lib/utils";
import { Award, Globe, Plane, Camera, Moon, Plus, Calendar, Wallet } from "lucide-react";
import { updateUserProfile, uploadProfilePicture } from "../lib/db";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";

export const Route = createFileRoute("/profile")({ component: Profile });

type Trip = { _id: string; title: string; destination?: string };

const DEFAULT_AVATAR = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%239ca3af'><path d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 4c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm0 14c-2.03 0-4.43-.82-6.14-2.88C7.55 15.8 9.68 15 12 15s4.45.8 6.14 2.12C16.43 19.18 14.03 20 12 20z'/></svg>";

function Profile() {
  const { user, profile, refreshProfile } = useAuth();
  const nav = useNavigate();

  // Modal State
  const [isOpen, setIsOpen] = useState(false);
  const [modalName, setModalName] = useState("");
  const [modalCity, setModalCity] = useState("");
  const [modalCurrency, setModalCurrency] = useState("");
  const [modalPhone, setModalPhone] = useState("");
  const [modalBio, setModalBio] = useState("");
  const [previewUrl, setPreviewUrl] = useState(DEFAULT_AVATAR);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Inline Form State
  const [inlineFirstName, setInlineFirstName] = useState("");
  const [inlineLastName, setInlineLastName] = useState("");
  const [inlineHomeCity, setInlineHomeCity] = useState("");
  const [inlineCurrency, setInlineCurrency] = useState("");
  const [inlinePhone, setInlinePhone] = useState("");
  const [inlineBio, setInlineBio] = useState("");

  const [inlineSaveLoading, setInlineSaveLoading] = useState(false);
  const [modalSaveLoading, setModalSaveLoading] = useState(false);

  const { data: trips = [], isLoading: tripsLoading } = useQuery({
    queryKey: queryKeys.trips(),
    queryFn: async () => {
      const data = await apiFetch("/api/trips");
      return Array.isArray(data) ? data : [];
    },
    enabled: !!user,
  });

  // Sync profile details to inline inputs when loaded
  useEffect(() => {
    if (profile) {
      const parts = (profile.displayName || "").split(" ");
      setInlineFirstName(parts[0] || "");
      setInlineLastName(parts.slice(1).join(" ") || "");
      setInlineHomeCity(profile.homeCity || "");
      setInlineCurrency(profile.currency || "");
      setInlinePhone(profile.phoneNumber || "");
      setInlineBio(profile.bio || "");
    }
  }, [profile]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      nav({ to: "/" });
    } catch (err) {
      console.error("Failed to log out", err);
    }
  };

  const handleSave = async (updatedData: {
    displayName?: string;
    homeCity?: string;
    currency?: string;
    phoneNumber?: string;
    bio?: string;
    photoURL?: string;
  }) => {
    if (!user) return;
    try {
      setModalSaveLoading(true);
      let finalPhotoURL = updatedData.photoURL;

      if (selectedFile) {
        finalPhotoURL = await uploadProfilePicture(user.uid, selectedFile);
      }

      await updateUserProfile(user.uid, {
        displayName: updatedData.displayName,
        homeCity: updatedData.homeCity,
        currency: updatedData.currency,
        phoneNumber: updatedData.phoneNumber,
        bio: updatedData.bio,
        photoURL: finalPhotoURL,
      });

      await refreshProfile();
      setSelectedFile(null);
      toast.success("Profile updated successfully!");
      setIsOpen(false);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to update profile.");
    } finally {
      setModalSaveLoading(false);
    }
  };

  const uniqueDestinations = new Set(
    trips.map((t) => t.destination?.split(",")[0]).filter(Boolean),
  );
  const totalDays = trips.reduce((sum: number, t: any) => sum + (t.days?.length || 0), 0);
  const totalExpenses = trips.reduce(
    (sum: number, t: any) =>
      sum + ((t.expenses || []).reduce((esum: number, e: any) => esum + (Number(e.amount) || 0), 0)),
    0,
  );

  const displayName = profile?.displayName || user?.displayName || user?.email?.split("@")[0] || "Adventurer";
  const photoURL = profile?.photoURL || user?.photoURL;

  return (
    <AppShell>
      <div className="rounded-3xl glass-panel p-8">
        <div className="flex flex-col items-start gap-6 md:flex-row md:items-center">
          <Avatar className="h-24 w-24 shadow-soft">
            {photoURL ? (
              <img
                src={photoURL}
                alt={displayName}
                className="h-full w-full rounded-full object-cover"
                onError={(e) => {
                  e.currentTarget.src = DEFAULT_AVATAR;
                }}
              />
            ) : (
              <img
                src={DEFAULT_AVATAR}
                alt={displayName}
                className="h-full w-full rounded-full object-cover"
              />
            )}
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-muted-foreground">
              {user?.metadata?.creationTime
                ? `Member since ${new Date(user.metadata.creationTime).getFullYear()}`
                : "Advenza member"}
            </p>
            <h1 className="mt-1 font-display text-4xl">
              {displayName}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">{user?.email}</p>
            {profile?.bio && (
              <p className="mt-2 text-sm italic text-muted-foreground max-w-xl">{profile.bio}</p>
            )}
          </div>
          <div className="flex gap-2 mt-4 md:mt-0">
            <Button
              variant="outline"
              onClick={() => {
                setModalName(displayName);
                setModalCity(profile?.homeCity || "");
                setModalCurrency(profile?.currency || "");
                setModalPhone(profile?.phoneNumber || "");
                setModalBio(profile?.bio || "");
                setPreviewUrl(photoURL || DEFAULT_AVATAR);
                setSelectedFile(null);
                setIsOpen(true);
              }}
            >
              Edit profile
            </Button>
            <Button variant="destructive" onClick={handleLogout}>
              Log out
            </Button>
          </div>
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-4">
          {[
            { l: "Trips planned", v: tripsLoading ? "…" : trips.length.toString(), i: Plane },
            {
              l: "Destinations",
              v: tripsLoading ? "…" : uniqueDestinations.size.toString(),
              i: Globe,
            },
            { l: "Days planned", v: tripsLoading ? "…" : totalDays.toString(), i: Calendar },
            {
              l: "Expenses logged",
              v: tripsLoading ? "…" : totalExpenses > 0 ? inr(totalExpenses) : "₹0",
              i: Wallet,
            },
          ].map((s) => (
            <div key={s.l} className="rounded-2xl glass-tile p-4">
              <s.i className="h-4 w-4 text-muted-foreground" />
              <p className="mt-2 font-display text-2xl">{s.v}</p>
              <p className="text-xs text-muted-foreground">{s.l}</p>
            </div>
          ))}
        </div>
      </div>

      <Tabs defaultValue="preferences" className="mt-8">
        <TabsList className="rounded-xl">
          <TabsTrigger value="preferences">Preferences</TabsTrigger>
          <TabsTrigger value="trips">My trips</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="preferences" className="mt-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-2xl glass-panel p-6">
              <h3 className="font-semibold">Personal information</h3>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <Label className="text-xs">First name</Label>
                  <Input
                    className="mt-1.5 animate-fade-in"
                    value={inlineFirstName}
                    onChange={(e) => setInlineFirstName(e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-xs">Last name</Label>
                  <Input
                    className="mt-1.5 animate-fade-in"
                    value={inlineLastName}
                    onChange={(e) => setInlineLastName(e.target.value)}
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-xs">Email</Label>
                  <Input className="mt-1.5" defaultValue={user?.email || ""} readOnly />
                </div>
                <div>
                  <Label className="text-xs">Home city</Label>
                  <Input
                    className="mt-1.5"
                    placeholder="Enter your city"
                    value={inlineHomeCity}
                    onChange={(e) => setInlineHomeCity(e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-xs">Currency</Label>
                  <Input
                    className="mt-1.5"
                    placeholder="Not Set"
                    value={inlineCurrency}
                    onChange={(e) => setInlineCurrency(e.target.value)}
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-xs">Phone number (optional)</Label>
                  <Input
                    className="mt-1.5"
                    placeholder="Enter phone number"
                    value={inlinePhone}
                    onChange={(e) => setInlinePhone(e.target.value)}
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-xs">Bio (optional)</Label>
                  <textarea
                    className="mt-1.5 w-full min-h-[80px] rounded-xl border border-white/60 bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    placeholder="Tell us about yourself..."
                    value={inlineBio}
                    onChange={(e) => setInlineBio(e.target.value)}
                  />
                </div>
              </div>
              <Button
                onClick={async () => {
                  const fullName = `${inlineFirstName} ${inlineLastName}`.trim();
                  if (!fullName) {
                    toast.error("First name and last name cannot be empty");
                    return;
                  }
                  if (!user) {
                    toast.error("Please log in to save preferences");
                    return;
                  }
                  try {
                    setInlineSaveLoading(true);
                    await updateUserProfile(user.uid, {
                      displayName: fullName,
                      homeCity: inlineHomeCity,
                      currency: inlineCurrency,
                      phoneNumber: inlinePhone,
                      bio: inlineBio,
                    });
                    await refreshProfile();
                    toast.success("Preferences updated successfully!");
                  } catch (err: any) {
                    console.error("Save preferences error:", err);
                    toast.error(err.message || "Failed to update preferences.");
                  } finally {
                    setInlineSaveLoading(false);
                  }
                }}
                disabled={inlineSaveLoading}
                className="mt-6 w-full"
              >
                {inlineSaveLoading ? "Saving..." : "Save changes"}
              </Button>
            </div>
            <div className="rounded-2xl glass-panel p-6">
              <h3 className="font-semibold">Travel style</h3>
              <p className="mt-3 text-sm text-muted-foreground">
                Travel style preferences coming soon — Advenza will use these to personalize your
                itineraries and packing lists.
              </p>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="trips" className="mt-6">
          {tripsLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="animate-pulse rounded-2xl glass-panel h-32" />
              ))}
            </div>
          ) : trips.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl glass-panel p-16 text-center">
              <Plane className="h-12 w-12 text-muted-foreground/30" />
              <p className="mt-4 text-lg font-semibold">No trips yet</p>
              <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                Your planned trips will appear here.
              </p>
              <Button className="mt-6" asChild>
                <Link to="/trips/new">
                  <Plus className="mr-1.5 h-4 w-4" />
                  Plan a trip
                </Link>
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {trips.map((t) => (
                <Link
                  key={t._id}
                  to="/trips/$tripId"
                  params={{ tripId: t._id }}
                  className="hover-lift rounded-2xl glass-panel p-5 block"
                >
                  <p className="text-xs text-muted-foreground">{t.destination ?? "Trip"}</p>
                  <p className="mt-1 font-semibold">{t.title}</p>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="settings" className="mt-6">
          <div className="max-w-xl rounded-2xl glass-panel p-6">
            {[
              { l: "Dark mode", d: "Reduce glare after sunset.", icon: Moon },
              { l: "Trip reminders", d: "Get pings before departure and check-ins." },
              { l: "Price alerts", d: "Notify me when flights or stays drop." },
              { l: "Weekly digest", d: "A gentle Sunday roundup of your trips." },
            ].map((s) => (
              <div
                key={s.l}
                className="flex items-center justify-between border-b border-border/60 py-4 last:border-0"
              >
                <div>
                  <p className="font-medium">{s.l}</p>
                  <p className="text-xs text-muted-foreground">{s.d}</p>
                </div>
                <Switch defaultChecked={s.l !== "Dark mode"} />
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Edit Profile Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[480px] rounded-3xl glass-panel border border-white/40 p-6 bg-white/80 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl text-foreground">Edit Profile</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4 animate-fade-in">
            {/* Avatar Section */}
            <div className="flex flex-col items-center gap-4">
              <Avatar className="h-24 w-24 border border-white/60 shadow-soft">
                {previewUrl ? (
                  <img src={previewUrl} alt="Preview" className="h-full w-full rounded-full object-cover" />
                ) : (
                  <img src={DEFAULT_AVATAR} alt="Default" className="h-full w-full rounded-full object-cover" />
                )}
              </Avatar>
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  id="avatar-upload"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setSelectedFile(file);
                      setPreviewUrl(URL.createObjectURL(file));
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => document.getElementById("avatar-upload")?.click()}
                >
                  Change picture
                </Button>
                {previewUrl !== DEFAULT_AVATAR && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:bg-destructive/10 animate-fade-in"
                    onClick={() => {
                      setSelectedFile(null);
                      setPreviewUrl(DEFAULT_AVATAR);
                    }}
                  >
                    Remove
                  </Button>
                )}
              </div>
            </div>

            {/* Form Fields */}
            <div className="grid gap-3">
              <div>
                <Label htmlFor="modal-fullname" className="text-xs">Full Name</Label>
                <Input
                  id="modal-fullname"
                  value={modalName}
                  onChange={(e) => setModalName(e.target.value)}
                  placeholder="Enter full name"
                  className="mt-1"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="modal-city" className="text-xs">Home City</Label>
                  <Input
                    id="modal-city"
                    value={modalCity}
                    onChange={(e) => setModalCity(e.target.value)}
                    placeholder="Enter city"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="modal-currency" className="text-xs">Currency</Label>
                  <Input
                    id="modal-currency"
                    value={modalCurrency}
                    onChange={(e) => setModalCurrency(e.target.value)}
                    placeholder="Not Set"
                    className="mt-1"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="modal-phone" className="text-xs">Phone Number (optional)</Label>
                <Input
                  id="modal-phone"
                  value={modalPhone}
                  onChange={(e) => setModalPhone(e.target.value)}
                  placeholder="Enter phone number"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="modal-bio" className="text-xs">Bio (optional)</Label>
                <textarea
                  id="modal-bio"
                  value={modalBio}
                  onChange={(e) => setModalBio(e.target.value)}
                  placeholder="Tell us about yourself..."
                  className="mt-1 w-full min-h-[80px] rounded-xl border border-white/60 bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsOpen(false)} disabled={modalSaveLoading}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (!modalName.trim()) {
                  toast.error("Full Name cannot be empty");
                  return;
                }
                await handleSave({
                  displayName: modalName,
                  homeCity: modalCity,
                  currency: modalCurrency,
                  phoneNumber: modalPhone,
                  bio: modalBio,
                  photoURL: previewUrl === DEFAULT_AVATAR ? "" : previewUrl,
                });
              }}
              disabled={modalSaveLoading}
            >
              {modalSaveLoading ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
