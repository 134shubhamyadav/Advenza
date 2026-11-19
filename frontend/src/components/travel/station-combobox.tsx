"use client";

import * as React from "react";
import { Train, MapPin, Search, Loader2, X, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/api";

export interface StationOption {
  code: string;
  name: string;
  state?: string;
  zone?: string;
  isMajor?: boolean;
}

interface StationComboboxProps {
  value: string;
  onChange: (value: string, station?: StationOption) => void;
  placeholder?: string;
  className?: string;
  label?: string;
  icon?: "train" | "pin";
  autoFocus?: boolean;
  valueType?: "code" | "name" | "both";
}

/**
 * Advenza Station & Destination Autocomplete Dropdown
 * Connects directly to the 8,990+ Indian Railways station database and destination clusters.
 * Matches Advenza's luxury glassmorphic theme.
 */
export function StationCombobox({
  value,
  onChange,
  placeholder = "Search station or destination...",
  className,
  icon = "pin",
  autoFocus = false,
  valueType = "code",
}: StationComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState(value || "");
  const [loading, setLoading] = React.useState(false);
  const [stations, setStations] = React.useState<StationOption[]>([]);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Sync external value
  React.useEffect(() => {
    setQuery(value || "");
  }, [value]);

  // Click outside listener
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Debounced search query against /api/ai/stations
  React.useEffect(() => {
    if (!open || !query || query.trim().length < 2) {
      setStations([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res: any = await apiFetch(`/api/ai/stations?q=${encodeURIComponent(query.trim())}&limit=8`);
        if (res.results && Array.isArray(res.results)) {
          setStations(res.results);
        }
      } catch (err) {
        console.debug("Station search err:", err);
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query, open]);

  const handleSelect = (stn: StationOption) => {
    const displayVal = stn.name ? `${stn.name} (${stn.code})` : stn.code;
    setQuery(displayVal);
    let chosenVal = stn.code || stn.name;
    if (valueType === "name") {
      chosenVal = stn.name || stn.code;
    } else if (valueType === "both") {
      chosenVal = displayVal;
    }
    onChange(chosenVal, stn);
    setOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    onChange(val);
    if (!open) setOpen(true);
  };

  const handleClear = () => {
    setQuery("");
    onChange("");
    setStations([]);
    inputRef.current?.focus();
  };

  const IconComponent = icon === "train" ? Train : MapPin;

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      <div className="relative flex items-center">
        <IconComponent className="absolute left-2.5 h-3.5 w-3.5 text-primary/70 shrink-0 pointer-events-none" />
        <Input
          ref={inputRef}
          value={query}
          onChange={handleInputChange}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className={cn(
            "h-9 pl-8 pr-8 text-xs font-medium rounded-xl",
            "border-border/70 bg-background/80 hover:bg-muted/20 focus-visible:ring-primary/40",
            "transition-all duration-200 shadow-xs"
          )}
        />
        {loading ? (
          <Loader2 className="absolute right-2.5 h-3.5 w-3.5 text-muted-foreground animate-spin shrink-0 pointer-events-none" />
        ) : query ? (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2.5 p-0.5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-3 w-3" />
          </button>
        ) : (
          <Search className="absolute right-2.5 h-3.5 w-3.5 text-muted-foreground/40 shrink-0 pointer-events-none" />
        )}
      </div>

      {/* Floating Suggestions Dropdown */}
      {open && stations.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 rounded-2xl border border-border/80 bg-card/95 backdrop-blur-xl shadow-lift overflow-hidden max-h-64 overflow-y-auto">
          <div className="px-3 py-1.5 bg-muted/30 border-b border-border/40 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
            <span>Verified Stations & Railheads</span>
            <span>{stations.length} found</span>
          </div>
          <div className="p-1 space-y-0.5">
            {stations.map((s) => {
              const isSelected = value === s.code || value.includes(s.code);
              return (
                <button
                  key={s.code}
                  type="button"
                  onClick={() => handleSelect(s)}
                  className={cn(
                    "w-full text-left px-2.5 py-2 rounded-xl flex items-center justify-between gap-2",
                    "transition-all text-xs cursor-pointer group",
                    isSelected
                      ? "bg-primary/10 text-primary font-semibold"
                      : "hover:bg-muted/50 text-foreground"
                  )}
                >
                  <div className="flex items-center gap-2 truncate">
                    <Train className="h-3.5 w-3.5 text-primary/70 shrink-0 group-hover:scale-110 transition-transform" />
                    <div className="truncate">
                      <div className="font-semibold text-xs truncate flex items-center gap-1.5">
                        <span>{s.name}</span>
                        {s.isMajor && (
                          <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500/10 text-amber-600 border border-amber-500/20 font-medium">
                            Major
                          </span>
                        )}
                      </div>
                      {s.state && (
                        <div className="text-[10px] text-muted-foreground truncate">
                          {s.state} {s.zone ? `· ${s.zone}` : ""}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <Badge variant="outline" className="font-mono text-[10px] px-1.5 py-0 bg-background font-bold text-primary">
                      {s.code}
                    </Badge>
                    {isSelected && <Check className="h-3.5 w-3.5 text-primary" />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
