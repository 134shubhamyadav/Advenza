import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const inrFmt = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
export function inr(amount: number): string {
  return `₹${inrFmt.format(amount)}`;
}

/**
 * Standardizes any user-input or AI-generated time string into a 24-hour format (HH:mm).
 * Examples:
 *   "2:30 PM" -> "14:30"
 *   "09:15 AM" -> "09:15"
 *   "14:30" -> "14:30"
 *   "12 AM" -> "00:00"
 *   "9" -> "09:00"
 */
export function normalizeTimeTo24h(timeStr: string): string {
  if (!timeStr) return "";
  
  let cleaned = timeStr.trim().toUpperCase();
  
  // 12-hour AM/PM format matching (e.g. "2:30 PM", "2 PM", "02:30PM")
  const ampmRegex = /^(\d{1,2})(?:[:.]?(\d{2}))?\s*(AM|PM)$/;
  const match = cleaned.match(ampmRegex);
  
  if (match) {
    let hours = parseInt(match[1], 10);
    const minutes = match[2] ? parseInt(match[2], 10) : 0;
    const ampm = match[3];
    
    if (ampm === "PM" && hours < 12) {
      hours += 12;
    } else if (ampm === "AM" && hours === 12) {
      hours = 0;
    }
    
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }
  
  // 24-hour format matching (e.g. "14:30", "9:15", "09:15")
  const h24Regex = /^(\d{1,2})[:.](\d{2})$/;
  const match24 = cleaned.match(h24Regex);
  if (match24) {
    const hours = parseInt(match24[1], 10);
    const minutes = parseInt(match24[2], 10);
    if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
      return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
    }
  }
  
  // Pure digit hours (e.g. "9", "14")
  if (/^\d{1,2}$/.test(cleaned)) {
    const hours = parseInt(cleaned, 10);
    if (hours >= 0 && hours <= 23) {
      return `${String(hours).padStart(2, "0")}:00`;
    }
  }

  // 4-digit military format (e.g. "1430")
  if (/^\d{4}$/.test(cleaned)) {
    const hours = parseInt(cleaned.slice(0, 2), 10);
    const minutes = parseInt(cleaned.slice(2), 10);
    if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
      return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
    }
  }

  return timeStr;
}

/**
 * Calculates inclusive calendar days between two ISO date strings (YYYY-MM-DD).
 * Examples:
 *   "2026-10-10" to "2026-10-10" -> 1 day
 *   "2026-10-10" to "2026-10-11" -> 2 days
 *   "2026-10-10" to "2026-10-14" -> 5 days
 */
export function calculateInclusiveDays(startDateStr?: string, endDateStr?: string): number {
  if (!startDateStr || !endDateStr) return 1;
  const [sYear, sMonth, sDay] = startDateStr.split("-").map(Number);
  const [eYear, eMonth, eDay] = endDateStr.split("-").map(Number);
  if (!sYear || !sMonth || !sDay || !eYear || !eMonth || !eDay) return 1;
  const startUtc = Date.UTC(sYear, sMonth - 1, sDay);
  const endUtc = Date.UTC(eYear, eMonth - 1, eDay);
  if (endUtc < startUtc) return 1;
  const msPerDay = 86400000;
  const diffDays = Math.round((endUtc - startUtc) / msPerDay) + 1;
  return Math.max(diffDays, 1);
}

/**
 * Formats duration in minutes to user-friendly "Xh Ym" or "Xh"
 * Examples: 740 -> "12h 20m", 120 -> "2h", 45 -> "45m"
 */
export function formatDurationMinutes(minutes?: number | null): string {
  if (minutes == null || isNaN(minutes) || minutes <= 0) return "";
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/**
 * Returns formatted status badge config for a duration source or status
 */
export function getDurationStatusBadge(status?: string, source?: string, booked?: boolean): { label: string; variant: "confirmed" | "estimated" | "unavailable" } {
  if (booked || status === "CONFIRMED" || source === "USER_SPECIFIED" || source === "SCHEDULED") {
    return { label: "Confirmed", variant: "confirmed" };
  }
  if (status === "ESTIMATED" || source === "CALCULATED_MAPS" || source === "ESTIMATED_HAVERSINE") {
    return { label: "Estimated", variant: "estimated" };
  }
  return { label: "Estimated", variant: "estimated" };
}

/**
 * Checks whether a journey leg has concrete user-specified or confirmed transit details
 * (such as departure/arrival time, transit reference/number, ticket, or confirmed booking)
 */
export function hasConcreteTransitDetails(leg?: any, fallbackTime?: string, fallbackRef?: string): boolean {
  if (!leg && !fallbackTime && !fallbackRef) return false;
  return Boolean(
    leg?.booked ||
    leg?.transitRef ||
    fallbackRef ||
    leg?.departureTime ||
    fallbackTime ||
    leg?.arrivalTime ||
    leg?.ticketRef ||
    leg?.durationSource === "USER_SPECIFIED" ||
    (leg?.status === "CONFIRMED" && leg?.durationMinutes)
  );
}

/**
 * Strips accidental Markdown formatting (bold, italic, backticks, headings, list markers)
 * from user-facing text while preserving legitimate punctuation (e.g. ₹, ≈, –, —, ( ), etc.).
 */
export function stripMarkdownFormatting(text?: string | null): string {
  if (text == null) return "";
  let s = String(text);

  // 1. Remove triple bold+italic: ***text*** or ___text___
  s = s.replace(/\*\*\*(.*?)\*\*\*/g, "$1");
  s = s.replace(/___(.*?)___/g, "$1");

  // 2. Remove double bold: **text** or __text__
  s = s.replace(/\*\*(.*?)\*\*/g, "$1");
  s = s.replace(/__(.*?)__/g, "$1");

  // 3. Remove single italic: *text* (bounded) or _text_
  s = s.replace(/(^|[^\w*])\*([^*\n]+)\*([^\w*]|$)/g, "$1$2$3");
  s = s.replace(/(^|[^\w_])_([^_\n]+)_([^\w_]|$)/g, "$1$2$3");

  // 4. Remove inline code / backticks: `code` or ```code```
  s = s.replace(/```([\s\S]*?)```/g, "$1");
  s = s.replace(/`([^`]+)`/g, "$1");

  // 5. Remove leading Markdown headings (e.g. "### Title" -> "Title")
  s = s.replace(/^#+\s*/gm, "");

  // 6. Remove leading list bullets (e.g. "- Activity" -> "Activity", "* Activity" -> "Activity")
  s = s.replace(/^[-*•]\s+/gm, "");

  // 7. Normalize multiple spaces / tabs within lines
  s = s.replace(/[ \t]+/g, " ");

  return s.trim();
}



