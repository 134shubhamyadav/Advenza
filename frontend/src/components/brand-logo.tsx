import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export function BrandLogo({
  className,
  showWord = true,
}: {
  className?: string;
  showWord?: boolean;
}) {
  return (
    <Link to="/" className={cn("group inline-flex items-center gap-2", className)}>
      <span className="relative grid h-8 w-8 place-items-center rounded-xl bg-primary text-primary-foreground shadow-soft">
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 18c3-2 6-2 9 0s6 2 9 0" />
          <path d="M12 3l3 6-3 3-3-3 3-6z" />
        </svg>
      </span>
      {showWord && (
        <span className="font-display text-2xl leading-none tracking-tight">Advenza</span>
      )}
    </Link>
  );
}
