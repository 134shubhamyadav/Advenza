import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export function AiBadge({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/8 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary",
        className,
      )}
    >
      <Sparkles className="h-3 w-3" />
      {children ?? "AI"}
    </span>
  );
}
