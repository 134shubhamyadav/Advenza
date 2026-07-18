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
