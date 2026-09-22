/**
 * TimePicker — inline, single-row 24-hour time input
 *
 * Renders:  [ HH ] : [ MM ]
 *
 * value / onChange use HH:MM 24-hour strings — same as <input type="time">.
 */
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

interface TimePickerProps {
  value: string;               // "14:30" (24-h) or "" (unset)
  onChange: (v: string) => void;
  className?: string;
  disabled?: boolean;
}

function parse(value: string): { h24: number; min: number } | null {
  if (!value) return null;
  const [h, m] = value.split(":").map(Number);
  if (isNaN(h) || isNaN(m)) return null;
  return { h24: h, min: m };
}

function fmt24(h24: number, min: number): string {
  return `${String(h24).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

export function TimePicker({ value, onChange, className, disabled }: TimePickerProps) {
  const parsed = parse(value);

  const [h24, setH24] = useState<string>(parsed ? String(parsed.h24).padStart(2, "0") : "");
  const [min, setMin] = useState<string>(parsed ? String(parsed.min).padStart(2, "0") : "");

  // Sync from external value resets
  useEffect(() => {
    const p = parse(value);
    if (p) {
      setH24(String(p.h24).padStart(2, "0"));
      setMin(String(p.min).padStart(2, "0"));
    } else {
      setH24("");
      setMin("");
    }
  }, [value]);

  const emit = (newH: string, newM: string) => {
    const h = parseInt(newH);
    const m = parseInt(newM);
    if (isNaN(h) || isNaN(m) || !newH || !newM) return;
    onChange(fmt24(h, m));
  };

  const handleHourBlur = (raw: string) => {
    let h = parseInt(raw);
    if (isNaN(h) || h < 0) h = 0;
    if (h > 23) h = 23;
    const s = String(h).padStart(2, "0");
    setH24(s);
    emit(s, min);
  };

  const handleMinBlur = (raw: string) => {
    let m = parseInt(raw);
    if (isNaN(m) || m < 0) m = 0;
    if (m > 59) m = 59;
    const s = String(m).padStart(2, "0");
    setMin(s);
    emit(h24, s);
  };

  const inputCls =
    "w-12 h-10 rounded-lg border border-input bg-background text-center text-sm font-medium " +
    "focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition leading-none " +
    "disabled:opacity-50";

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5",
        disabled && "opacity-50 pointer-events-none",
        className
      )}
    >
      {/* Hours */}
      <input
        type="text"
        inputMode="numeric"
        maxLength={2}
        placeholder="HH"
        disabled={disabled}
        value={h24}
        onChange={(e) => setH24(e.target.value.replace(/\D/g, ""))}
        onFocus={(e) => e.target.select()}
        onBlur={(e) => handleHourBlur(e.target.value)}
        className={inputCls}
        aria-label="Hour (24h)"
      />

      <span className="text-sm font-bold text-muted-foreground select-none">:</span>

      {/* Minutes */}
      <input
        type="text"
        inputMode="numeric"
        maxLength={2}
        placeholder="MM"
        disabled={disabled}
        value={min}
        onChange={(e) => setMin(e.target.value.replace(/\D/g, ""))}
        onFocus={(e) => e.target.select()}
        onBlur={(e) => handleMinBlur(e.target.value)}
        className={inputCls}
        aria-label="Minute"
      />
    </div>
  );
}

