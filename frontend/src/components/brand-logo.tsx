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
    <Link to="/" className={cn("group inline-flex items-center gap-2.5", className)}>
      <span className="relative grid h-8 w-8 place-items-center rounded-full bg-[#004678] text-white shadow-sm ring-1 ring-[#004678]/20 shrink-0">
        <svg
          viewBox="0 0 64 64"
          className="h-5 w-5"
          fill="none"
        >
          <path d="M32 15 L40 25.5 L32 33 L24 25.5 Z M32 21 L35.5 25.5 L32 29 L28.5 25.5 Z" fill="#FFFFFF" fillRule="evenodd" />
          <path d="M21 41.5 C24.5 38.5 28 38.5 32 41.5 C36 44.5 39.5 44.5 43 41.5" stroke="#FFFFFF" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>
      </span>
      {showWord && (
        <span className="font-display text-2xl leading-none tracking-tight text-foreground">Advenza</span>
      )}
    </Link>
  );
}
