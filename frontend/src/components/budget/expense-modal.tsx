import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { apiFetch } from "@/lib/api";
import { storage } from "@/lib/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useAuth } from "@/context/AuthContext";
import { compressImage } from "@/lib/image-utils";
import {
  Plane,
  Building2,
  Utensils,
  Ticket,
  Car,
  Bus,
  ShoppingBag,
  MoreHorizontal,
  Upload,
  Sparkles,
  Loader2,
  Receipt,
  Check,
  CreditCard,
  Banknote,
  Smartphone,
  Globe,
} from "lucide-react";
import { toast } from "sonner";

export const CATEGORIES = [
  { id: "flights", label: "Flights", icon: Plane, color: "text-sky-500" },
  { id: "hotels", label: "Stays & Hotels", icon: Building2, color: "text-amber-500" },
  { id: "food", label: "Dining & Food", icon: Utensils, color: "text-orange-500" },
  { id: "activities", label: "Activities & Tours", icon: Ticket, color: "text-emerald-500" },
  { id: "transport", label: "Intercity Transport", icon: Car, color: "text-indigo-500" },
  { id: "localTransport", label: "Local Cabs & Metro", icon: Bus, color: "text-purple-500" },
  { id: "shopping", label: "Shopping", icon: ShoppingBag, color: "text-pink-500" },
  { id: "miscellaneous", label: "Miscellaneous", icon: MoreHorizontal, color: "text-zinc-500" },
];

export const CURRENCIES = [
  { code: "INR", symbol: "₹" },
  { code: "USD", symbol: "$" },
  { code: "EUR", symbol: "€" },
  { code: "GBP", symbol: "£" },
  { code: "AED", symbol: "د.إ" },
  { code: "JPY", symbol: "¥" },
  { code: "THB", symbol: "฿" },
  { code: "SGD", symbol: "S$" },
];

interface ExpenseModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  tripId: string;
  tripCurrency?: string;
  tripMembers?: Array<{ userId?: string; name: string; email?: string }>;
  expenseToEdit?: any;
  onSuccess: () => void;
}

export function ExpenseModal({
  isOpen,
  onOpenChange,
  tripId,
  tripCurrency = "INR",
  tripMembers = [],
  expenseToEdit,
  onSuccess,
}: ExpenseModalProps) {
  const isEditing = Boolean(expenseToEdit?._id);

  const [form, setForm] = useState({
    name: "",
    description: "",
    amount: "",
    originalCurrency: tripCurrency,
    category: "food",
    type: "ACTUAL",
    paymentMethod: "card",
    date: new Date().toISOString().slice(0, 10),
    paidByName: "You",
    paidById: "",
    splitType: "equal",
    receiptUrl: "",
    receiptStorageKey: "",
  });

  const [saving, setSaving] = useState(false);
  const [scanningOcr, setScanningOcr] = useState(false);
  const [ocrBadge, setOcrBadge] = useState<string | null>(null);

  useEffect(() => {
    if (expenseToEdit) {
      setForm({
        name: expenseToEdit.name || "",
        description: expenseToEdit.description || "",
        amount: String(expenseToEdit.originalAmount ?? expenseToEdit.amount ?? ""),
        originalCurrency: expenseToEdit.originalCurrency || expenseToEdit.currency || tripCurrency,
        category: expenseToEdit.category || "food",
        type: expenseToEdit.type || "ACTUAL",
        paymentMethod: expenseToEdit.paymentMethod || "card",
        date: expenseToEdit.date || new Date().toISOString().slice(0, 10),
        paidByName: expenseToEdit.paidBy?.name || "You",
        paidById: expenseToEdit.paidBy?.userId || "",
        splitType: expenseToEdit.splitType || "equal",
        receiptUrl: expenseToEdit.receiptUrl || "",
        receiptStorageKey: expenseToEdit.receiptStorageKey || "",
      });
      setOcrBadge(null);
    } else {
      setForm({
        name: "",
        description: "",
        amount: "",
        originalCurrency: tripCurrency,
        category: "food",
        type: "ACTUAL",
        paymentMethod: "card",
        date: new Date().toISOString().slice(0, 10),
        paidByName: tripMembers[0]?.name || "You",
        paidById: tripMembers[0]?.userId || "",
        splitType: "equal",
        receiptUrl: "",
        receiptStorageKey: "",
      });
      setOcrBadge(null);
    }
  }, [expenseToEdit, isOpen, tripCurrency, tripMembers]);

  const { user } = useAuth();

  // Handle Receipt Upload (Cloud Storage Direct Upload + Binary Fallback)
  const handleReceiptFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validMimes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    if (!validMimes.includes(file.type)) {
      toast.error("Please upload a valid receipt image (JPEG, PNG, WebP) or PDF");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error("Receipt file size must be less than 10MB");
      return;
    }

    try {
      setSaving(true);
      let receiptBlob: Blob = file;

      if (file.type.startsWith("image/")) {
        try {
          receiptBlob = await compressImage(file, 1600, 0.85);
        } catch (compressErr) {
          console.warn("Client receipt compression skipped:", compressErr);
        }
      }

      let finalUrl = "";
      let finalKey = "";

      // 1. Primary path: Direct Firebase Storage upload if configured
      const isCloudStorageAvailable = storage && (storage as any).type !== "mock-storage" && user?.uid;
      if (isCloudStorageAvailable) {
        try {
          const timestamp = Date.now();
          const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
          finalKey = `users/${user.uid}/trips/${tripId}/receipts/${timestamp}_${cleanName}`;
          const fileRef = ref(storage, finalKey);
          await uploadBytes(fileRef, receiptBlob, { contentType: file.type });
          finalUrl = await getDownloadURL(fileRef);

          // Register verified metadata in backend
          await apiFetch(`/api/trips/${tripId}/expenses/receipt-register`, {
            method: "POST",
            body: JSON.stringify({
              receiptUrl: finalUrl,
              receiptStorageKey: finalKey,
              fileName: file.name,
              mimeType: file.type,
              fileSizeBytes: receiptBlob.size,
            }),
          });
        } catch (storageErr) {
          console.warn("Direct cloud storage upload failed, falling back to binary stream:", storageErr);
          finalUrl = "";
        }
      }

      // 2. Fallback path: Binary stream upload directly to backend
      if (!finalUrl) {
        const token = user ? await user.getIdToken() : "";
        const response = await fetch(`/api/trips/${tripId}/expenses/receipt-upload-binary`, {
          method: "POST",
          headers: {
            "Content-Type": file.type || "application/octet-stream",
            "x-file-name": encodeURIComponent(file.name),
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: receiptBlob,
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || `Upload failed with status ${response.status}`);
        }

        const resData = await response.json();
        finalUrl = resData.receiptUrl;
        finalKey = resData.receiptStorageKey;
      }

      setForm((prev) => ({
        ...prev,
        receiptUrl: finalUrl,
        receiptStorageKey: finalKey,
      }));
      toast.success("Receipt uploaded and verified successfully");
    } catch (err: any) {
      toast.error(`Receipt upload failed: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Handle Receipt OCR Auto-Fill
  const handleScanReceipt = async () => {
    if (!form.receiptUrl && !form.name) {
      toast.info("Upload a receipt image first or enter description to scan");
      return;
    }

    try {
      setScanningOcr(true);
      const res: any = await apiFetch(`/api/trips/${tripId}/expenses/ocr`, {
        method: "POST",
        body: JSON.stringify({
          textContent: `${form.name} ${form.description}`.trim(),
          receiptUrl: form.receiptUrl || undefined,
        }),
      });

      if (res && res.status === "OCR_RESULT") {
        if (res.merchant && res.merchant !== "Receipt") {
          setForm((prev) => ({ ...prev, name: res.merchant }));
        }
        if (res.amount > 0) {
          setForm((prev) => ({ ...prev, amount: String(res.amount) }));
        }
        if (res.category) {
          setForm((prev) => ({ ...prev, category: res.category }));
        }
        setOcrBadge("OCR_RESULT (Verified)");
        toast.success("Receipt fields autofilled. Please verify and confirm.");
      }
    } catch (err: any) {
      toast.error(`OCR scan notice: ${err.message}`);
    } finally {
      setScanningOcr(false);
    }
  };

  const handleSubmit = async () => {
    const amt = parseFloat(form.amount);
    if (!form.name.trim()) {
      toast.error("Please enter an expense title");
      return;
    }
    if (isNaN(amt) || amt <= 0) {
      toast.error("Please enter a valid positive amount");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        amount: amt,
        originalAmount: amt,
        originalCurrency: form.originalCurrency,
        currency: tripCurrency,
        category: form.category,
        type: form.type,
        paymentMethod: form.paymentMethod,
        date: form.date,
        paidBy: {
          name: form.paidByName,
          userId: form.paidById || null,
        },
        splitType: form.splitType,
        receiptUrl: form.receiptUrl || null,
        receiptStorageKey: form.receiptStorageKey || null,
      };

      if (isEditing) {
        await apiFetch(`/api/trips/${tripId}/expenses/${expenseToEdit._id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        toast.success("Expense updated successfully");
      } else {
        await apiFetch(`/api/trips/${tripId}/expenses`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
        toast.success("Expense recorded successfully");
      }

      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(`Failed to save expense: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl glass-panel p-6 shadow-2xl">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Receipt className="h-5 w-5 text-primary" />
              {isEditing ? "Edit Expense" : "Record New Expense"}
            </DialogTitle>
            {ocrBadge && (
              <span className="rounded-full bg-accent/15 px-2.5 py-0.5 text-xs font-semibold text-accent">
                {ocrBadge}
              </span>
            )}
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Title & Category */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold">Title / Description</Label>
              <Input
                className="mt-1.5 h-10 rounded-xl"
                placeholder="e.g. Seafood Dinner at Brittos"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-xs font-semibold">Category</Label>
              <Select
                value={form.category}
                onValueChange={(val) => setForm((p) => ({ ...p, category: val }))}
              >
                <SelectTrigger className="mt-1.5 h-10 rounded-xl">
                  <SelectValue placeholder="Select Category" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      <span className="flex items-center gap-2">
                        <c.icon className={`h-4 w-4 ${c.color}`} />
                        {c.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Amount & Currency */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <Label className="text-xs font-semibold">Amount</Label>
              <Input
                type="number"
                step="any"
                className="mt-1.5 h-10 rounded-xl font-display text-lg"
                placeholder="0.00"
                value={form.amount}
                onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-xs font-semibold">Currency</Label>
              <Select
                value={form.originalCurrency}
                onValueChange={(val) => setForm((p) => ({ ...p, originalCurrency: val }))}
              >
                <SelectTrigger className="mt-1.5 h-10 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.code} ({c.symbol})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Cost Type & Payment Method */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold">Cost Classification</Label>
              <div className="mt-1.5 grid grid-cols-3 gap-1 rounded-xl border border-border p-1 bg-background/50 text-xs">
                {(["ACTUAL", "ESTIMATED", "LIVE_PRICE"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setForm((p) => ({ ...p, type: t }))}
                    className={`rounded-lg py-1.5 font-medium transition ${
                      form.type === t
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {t === "ACTUAL" ? "Actual" : t === "ESTIMATED" ? "Estimated" : "Live Price"}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-xs font-semibold">Payment Method</Label>
              <Select
                value={form.paymentMethod}
                onValueChange={(val) => setForm((p) => ({ ...p, paymentMethod: val }))}
              >
                <SelectTrigger className="mt-1.5 h-10 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="card">
                    <span className="flex items-center gap-1.5">
                      <CreditCard className="h-3.5 w-3.5 text-sky-500" /> Credit / Debit Card
                    </span>
                  </SelectItem>
                  <SelectItem value="upi">
                    <span className="flex items-center gap-1.5">
                      <Smartphone className="h-3.5 w-3.5 text-emerald-500" /> UPI / QR
                    </span>
                  </SelectItem>
                  <SelectItem value="cash">
                    <span className="flex items-center gap-1.5">
                      <Banknote className="h-3.5 w-3.5 text-amber-500" /> Cash
                    </span>
                  </SelectItem>
                  <SelectItem value="netbanking">Net Banking</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Date & Paid By */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold">Date</Label>
              <DatePicker
                value={form.date}
                onChange={(d) => setForm((p) => ({ ...p, date: d }))}
                placeholder="Select expense date"
                className="mt-1.5 h-10 rounded-xl"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold">Paid By</Label>
              <Select
                value={form.paidByName}
                onValueChange={(val) => {
                  const matched = tripMembers.find((m) => m.name === val);
                  setForm((p) => ({
                    ...p,
                    paidByName: val,
                    paidById: matched?.userId || "",
                  }));
                }}
              >
                <SelectTrigger className="mt-1.5 h-10 rounded-xl">
                  <SelectValue placeholder="Paid By" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="You">You</SelectItem>
                  {tripMembers.map((m, idx) => (
                    <SelectItem key={idx} value={m.name || `Member ${idx + 1}`}>
                      {m.name || `Member ${idx + 1}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Split Type Selector */}
          <div>
            <Label className="text-xs font-semibold">Group Split</Label>
            <div className="mt-1.5 flex gap-2">
              <button
                type="button"
                onClick={() => setForm((p) => ({ ...p, splitType: "equal" }))}
                className={`rounded-xl border px-3 py-1.5 text-xs font-medium transition ${
                  form.splitType === "equal"
                    ? "border-primary bg-primary/10 text-primary font-semibold"
                    : "border-border text-muted-foreground hover:border-primary/40"
                }`}
              >
                Equally Split Among All Members
              </button>
              <button
                type="button"
                onClick={() => setForm((p) => ({ ...p, splitType: "custom" }))}
                className={`rounded-xl border px-3 py-1.5 text-xs font-medium transition ${
                  form.splitType === "custom"
                    ? "border-primary bg-primary/10 text-primary font-semibold"
                    : "border-border text-muted-foreground hover:border-primary/40"
                }`}
              >
                Custom Split
              </button>
            </div>
          </div>

          {/* Receipt Attachment & OCR Scanner */}
          <div className="rounded-xl border border-dashed border-border p-3.5 bg-muted/20">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <Label className="text-xs font-semibold flex items-center gap-1.5">
                  <Receipt className="h-4 w-4 text-primary" /> Receipt Attachment
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  {form.receiptUrl ? "Receipt attached" : "Upload photo or PDF receipt"}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <label className="cursor-pointer">
                  <span className="inline-flex items-center gap-1 text-xs border border-border rounded-lg px-2.5 py-1.5 hover:bg-muted/40 transition">
                    <Upload className="h-3.5 w-3.5" /> Upload File
                  </span>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    className="hidden"
                    onChange={handleReceiptFile}
                  />
                </label>

                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleScanReceipt}
                  disabled={scanningOcr}
                  className="h-8 gap-1 text-xs border-primary/30 text-primary hover:bg-primary/10"
                >
                  {scanningOcr ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                  )}
                  {scanningOcr ? "Scanning..." : "Scan Receipt (OCR)"}
                </Button>
              </div>
            </div>

            {form.receiptUrl && (
              <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                <a
                  href={form.receiptUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary underline flex items-center gap-1"
                >
                  View attached receipt ↗
                </a>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="mt-4 gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving} className="gap-1.5">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {saving ? "Saving..." : isEditing ? "Save Changes" : "Record Expense"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
