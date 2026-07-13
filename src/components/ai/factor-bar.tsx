import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export function FactorBar({
  label,
  value,
  status = "good",
  detail,
  suggestion,
}: {
  label: string;
  value: number;
  status?: "good" | "warn" | "bad";
  detail?: string;
  suggestion?: string;
}) {
  const tone =
    status === "bad" ? "bg-destructive" : status === "warn" ? "bg-[oklch(0.78_0.16_75)]" : "bg-accent";
  return (
    <div className="rounded-xl px-4 py-3 hover:bg-muted/40">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-sm tabular-nums text-muted-foreground">{value}</span>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted/60">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.8, ease: [0.2, 0.8, 0.2, 1] }}
          className={cn("h-full rounded-full", tone)}
        />
      </div>
      {detail && <p className="mt-2 text-xs text-muted-foreground">{detail}</p>}
      {suggestion && (
        <p className="mt-1.5 text-xs text-primary">
          <span className="font-semibold">Suggestion · </span>
          {suggestion}
        </p>
      )}
    </div>
  );
}
