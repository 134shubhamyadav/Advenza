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
import { apiFetch } from "@/lib/api";
import { Settings, Check, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { CATEGORIES } from "./expense-modal";

interface BudgetSettingsModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  tripId: string;
  tripCurrency?: string;
  currentBudgetSummary?: any;
  onSuccess: () => void;
}

export function BudgetSettingsModal({
  isOpen,
  onOpenChange,
  tripId,
  tripCurrency = "INR",
  currentBudgetSummary,
  onSuccess,
}: BudgetSettingsModalProps) {
  const [totalBudget, setTotalBudget] = useState("50000");
  const [allocations, setAllocations] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (currentBudgetSummary) {
      setTotalBudget(String(currentBudgetSummary.totalBudget || 50000));
      const allocMap: Record<string, string> = {};
      for (const cat of currentBudgetSummary.categories || []) {
        allocMap[cat.category] = String(cat.allocated || 0);
      }
      setAllocations(allocMap);
    }
  }, [currentBudgetSummary, isOpen]);

  const handleAutoDistribute = () => {
    const total = parseFloat(totalBudget) || 50000;
    const presets: Record<string, number> = {
      flights: 0.25,
      hotels: 0.3,
      food: 0.2,
      activities: 0.1,
      transport: 0.05,
      localTransport: 0.05,
      shopping: 0.03,
      miscellaneous: 0.02,
    };

    const newAllocs: Record<string, string> = {};
    for (const [cat, ratio] of Object.entries(presets)) {
      newAllocs[cat] = String(Math.round(total * ratio));
    }
    setAllocations(newAllocs);
    toast.info("Auto-distributed category budget targets.");
  };

  const handleSave = async () => {
    const totalNum = parseFloat(totalBudget);
    if (isNaN(totalNum) || totalNum < 0) {
      toast.error("Please enter a valid positive total budget");
      return;
    }

    setSaving(true);
    try {
      const allocatedCategories: Record<string, number> = {};
      for (const [k, v] of Object.entries(allocations)) {
        allocatedCategories[k] = Math.max(0, parseFloat(v) || 0);
      }

      await apiFetch(`/api/trips/${tripId}/budget`, {
        method: "PATCH",
        body: JSON.stringify({
          totalBudget: totalNum,
          allocatedCategories,
        }),
      });

      toast.success("Budget settings and allocations updated");
      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(`Failed to update budget: ${err.message}`);
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
              <Settings className="h-5 w-5 text-primary" />
              Budget & Category Allocations
            </DialogTitle>
          </div>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Total Budget Target */}
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-xs font-semibold text-primary">Total Target Budget ({tripCurrency})</Label>
                <p className="text-[11px] text-muted-foreground">The overall financial ceiling for this trip</p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAutoDistribute}
                className="h-8 gap-1 text-xs border-primary/30 text-primary hover:bg-primary/10"
              >
                <Sparkles className="h-3.5 w-3.5" /> Auto Distribute
              </Button>
            </div>
            <Input
              type="number"
              className="mt-2.5 h-11 rounded-xl font-display text-xl bg-background"
              value={totalBudget}
              onChange={(e) => setTotalBudget(e.target.value)}
            />
          </div>

          {/* Category Target Allocations */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Category Allocation Caps
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {CATEGORIES.map((c) => (
                <div key={c.id} className="rounded-xl border border-border p-3 bg-card/60">
                  <div className="flex items-center gap-2 mb-1.5">
                    <c.icon className={`h-4 w-4 ${c.color}`} />
                    <Label className="text-xs font-medium">{c.label}</Label>
                  </div>
                  <Input
                    type="number"
                    className="h-9 rounded-lg text-sm"
                    placeholder="0"
                    value={allocations[c.id] || ""}
                    onChange={(e) =>
                      setAllocations((prev) => ({
                        ...prev,
                        [c.id]: e.target.value,
                      }))
                    }
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="mt-4 gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving} className="gap-1.5">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {saving ? "Saving..." : "Save Allocations"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
