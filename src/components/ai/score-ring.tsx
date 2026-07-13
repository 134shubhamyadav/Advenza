import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export function ScoreRing({
  value,
  size = 176,
  stroke = 12,
  label,
  suffix = "/ 100",
}: {
  value: number;
  size?: number;
  stroke?: number;
  label?: string;
  suffix?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  const dash = (pct / 100) * c;
  const tone = pct >= 85 ? "text-accent" : pct >= 65 ? "text-primary" : "text-destructive";
  return (
    <div className="relative inline-flex flex-col items-center">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} className="fill-none stroke-muted/60" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          strokeLinecap="round"
          className={cn("fill-none", tone)}
          stroke="currentColor"
          initial={{ strokeDasharray: `0 ${c}` }}
          animate={{ strokeDasharray: `${dash} ${c}` }}
          transition={{ duration: 1.1, ease: [0.2, 0.8, 0.2, 1] }}
        />
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn("font-display text-4xl", tone)}>{Math.round(pct)}</span>
        <span className="text-[11px] text-muted-foreground">{suffix}</span>
        {label && <span className="mt-1 text-xs font-medium text-foreground">{label}</span>}
      </div>
    </div>
  );
}
