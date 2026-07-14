import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { AppShell } from "@/components/app-shell";
import { AiBadge } from "@/components/ai/ai-badge";
import { packing as fallbackPacking } from "@/lib/ai-engine";
import { Check, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/packing")({ component: Packing });

const BACKEND = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

type PackItem = { name: string; why: string };
type PackData = Record<string, PackItem[]>;

function Packing() {
  const [packingData, setPackingData] = useState<PackData>(fallbackPacking as PackData);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  const fetchPacking = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND}/api/ai/packing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destination: "Udaipur, Rajasthan",
          startDate: "2026-06-12",
          endDate: "2026-06-18",
          style: "Balanced",
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (Object.keys(data).length > 0) {
          setPackingData(data);
        }
      }
    } catch (err) {
      console.error("Packing fetch error:", err);
      // Use fallback data
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPacking();
  }, []);

  const groups = Object.keys(packingData);
  const total = groups.reduce((n, g) => n + packingData[g].length, 0);
  const done = Object.values(checked).filter(Boolean).length;

  return (
    <AppShell
      title="Smart Packing"
      subtitle={loading ? "AI is generating your packing list..." : `${done} of ${total} packed · tailored by AI for Udaipur, monsoon fringe, 6 days`}
      actions={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchPacking} disabled={loading}>
            <RefreshCw className={cn("mr-1.5 h-3.5 w-3.5", loading && "animate-spin")} />
            Regenerate
          </Button>
          <AiBadge>GPT-4o Generated</AiBadge>
        </div>
      }
    >
      {loading ? (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-2xl glass-panel p-5 h-48" />
          ))}
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {groups.map((g) => (
            <section key={g} className="rounded-2xl glass-panel p-5">
              <div className="mb-3 flex items-baseline justify-between">
                <h3 className="font-semibold">{g}</h3>
                <span className="text-xs text-muted-foreground">
                  {packingData[g].filter((_, i) => checked[`${g}:${i}`]).length}/{packingData[g].length}
                </span>
              </div>
              <ul className="space-y-2">
                {packingData[g].map((item, i) => {
                  const key = `${g}:${i}`;
                  const on = !!checked[key];
                  return (
                    <li key={key}>
                      <button
                        onClick={() => setChecked((c) => ({ ...c, [key]: !c[key] }))}
                        className={cn(
                          "flex w-full gap-3 rounded-xl border p-3 text-left transition",
                          on ? "border-accent/50 bg-accent/6" : "border-border/60 bg-background/50 hover:border-primary/30",
                        )}
                      >
                        <span className={cn("mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border",
                          on ? "border-accent bg-accent text-accent-foreground" : "border-border")}>
                          {on && <Check className="h-3 w-3" />}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className={cn("text-sm font-medium", on && "line-through opacity-60")}>{item.name}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">{item.why}</p>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </AppShell>
  );
}
