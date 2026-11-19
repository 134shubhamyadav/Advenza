"use client";

import * as React from "react";
import { format, parseISO, isValid } from "date-fns";
import { Calendar as CalendarIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export interface DatePickerProps {
  value?: string | Date | null;
  onChange?: (dateString: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  minDate?: Date;
  maxDate?: Date;
  align?: "start" | "center" | "end";
}

/**
 * Advenza Luxury Themed Date Picker
 * Combines Advenza glassmorphic theme styling with accessible Popover & DayPicker Calendar.
 * Automatically synchronizes with canonical 'YYYY-MM-DD' format.
 */
export function DatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
  className,
  disabled = false,
  minDate,
  maxDate,
  align = "start",
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);

  // Parse string date (YYYY-MM-DD or ISO) into Date object
  const selectedDate = React.useMemo(() => {
    if (!value) return undefined;
    if (value instanceof Date) return isValid(value) ? value : undefined;
    if (typeof value === "string") {
      // Handle YYYY-MM-DD or DD-MM-YYYY
      if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        const parsed = parseISO(value);
        return isValid(parsed) ? parsed : undefined;
      }
      const dmy = value.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
      if (dmy) {
        const [, d, m, y] = dmy;
        const parsed = new Date(Number(y), Number(m) - 1, Number(d));
        return isValid(parsed) ? parsed : undefined;
      }
      const parsed = new Date(value);
      return isValid(parsed) ? parsed : undefined;
    }
    return undefined;
  }, [value]);

  const handleSelect = (date: Date | undefined) => {
    if (!date) {
      onChange?.("");
      setOpen(false);
      return;
    }
    const formatted = format(date, "yyyy-MM-dd");
    onChange?.(formatted);
    setOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange?.("");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full h-9 justify-start text-left font-normal text-xs rounded-xl",
            "border-border/70 bg-background/80 hover:bg-muted/30 hover:border-primary/40",
            "transition-all duration-200 shadow-xs focus-visible:ring-1 focus-visible:ring-primary/40",
            !selectedDate && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-3.5 w-3.5 text-primary shrink-0 opacity-80" />
          <span className="flex-1 truncate font-medium">
            {selectedDate ? format(selectedDate, "dd MMM yyyy") : placeholder}
          </span>
          {selectedDate && !disabled && (
            <span
              onClick={handleClear}
              className="ml-1 p-0.5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              title="Clear date"
            >
              <X className="h-3 w-3" />
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align={align}
        className="w-auto p-0 z-50 rounded-2xl border border-border/80 bg-card/95 backdrop-blur-xl shadow-lift overflow-hidden"
      >
        <div className="p-3 border-b border-border/40 bg-muted/20 flex items-center justify-between text-xs font-semibold text-muted-foreground">
          <span className="flex items-center gap-1.5 text-foreground font-semibold">
            <CalendarIcon className="h-3.5 w-3.5 text-primary" />
            Select Date
          </span>
          {selectedDate && (
            <span className="text-primary font-bold">
              {format(selectedDate, "EEE, dd MMM yyyy")}
            </span>
          )}
        </div>
        <div className="p-2">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={handleSelect}
            initialFocus
            disabled={(d) => {
              if (minDate && d < minDate) return true;
              if (maxDate && d > maxDate) return true;
              return false;
            }}
            className="rounded-xl"
          />
        </div>
        <div className="p-2.5 border-t border-border/40 bg-muted/10 flex items-center justify-between gap-1 text-[11px]">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => handleSelect(new Date())}
            className="h-6 text-[11px] px-2 text-primary font-medium hover:bg-primary/10 rounded-lg"
          >
            Today
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              const tmr = new Date();
              tmr.setDate(tmr.getDate() + 1);
              handleSelect(tmr);
            }}
            className="h-6 text-[11px] px-2 text-primary font-medium hover:bg-primary/10 rounded-lg"
          >
            Tomorrow
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              const nextWeek = new Date();
              nextWeek.setDate(nextWeek.getDate() + 7);
              handleSelect(nextWeek);
            }}
            className="h-6 text-[11px] px-2 text-primary font-medium hover:bg-primary/10 rounded-lg"
          >
            In 1 Week
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
