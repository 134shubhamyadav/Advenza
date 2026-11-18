/**
 * Advenza — Unified Date Arithmetic Service
 *
 * Built on date-fns for timezone-safe, pure mathematical date calculations.
 * Standardizes outbound/return journey day math, multi-day transit offsets,
 * and itinerary scheduling across Advenza without mutating Date instances.
 */

import {
  addDays,
  subDays,
  differenceInDays,
  differenceInHours,
  differenceInMinutes,
  format,
  parseISO,
  isValid,
  isAfter,
  isBefore,
  isSameDay,
  startOfDay,
  endOfDay,
} from "date-fns";

export class DateFnsService {
  /**
   * Safely parses any date string (YYYY-MM-DD or ISO 8601) into a valid Date object.
   */
  parseDate(dateStr) {
    if (!dateStr) return null;
    if (dateStr instanceof Date) return isValid(dateStr) ? dateStr : null;

    const parsed = parseISO(String(dateStr));
    if (isValid(parsed)) return parsed;

    // Fallback for non-ISO formats
    const d = new Date(dateStr);
    return isValid(d) ? d : null;
  }

  /**
   * Formats a date into YYYY-MM-DD format.
   */
  formatDateStr(date) {
    const d = this.parseDate(date);
    if (!d) return "";
    return format(d, "yyyy-MM-dd");
  }

  /**
   * Adds specified number of whole days to a date string or Date object.
   */
  addDaysToDate(date, amount) {
    const d = this.parseDate(date);
    if (!d) return "";
    const res = addDays(d, Number(amount) || 0);
    return format(res, "yyyy-MM-dd");
  }

  /**
   * Subtracts specified number of whole days from a date.
   */
  subDaysFromDate(date, amount) {
    const d = this.parseDate(date);
    if (!d) return "";
    const res = subDays(d, Number(amount) || 0);
    return format(res, "yyyy-MM-dd");
  }

  /**
   * Calculates difference in calendar days between two dates (dateRight - dateLeft).
   */
  diffInDays(dateLeft, dateRight) {
    const d1 = this.parseDate(dateLeft);
    const d2 = this.parseDate(dateRight);
    if (!d1 || !d2) return 0;
    return differenceInDays(d1, d2);
  }

  /**
   * Calculates difference in whole minutes between two timestamps.
   */
  diffInMinutes(dateLeft, dateRight) {
    const d1 = this.parseDate(dateLeft);
    const d2 = this.parseDate(dateRight);
    if (!d1 || !d2) return 0;
    return differenceInMinutes(d1, d2);
  }

  /**
   * Calculates destination arrival date given departure date and journey duration in minutes.
   */
  calculateArrivalDate(departureDateStr, departureTimeStr, durationMins) {
    const dateStr = String(departureDateStr || "").trim();
    const timeStr = String(departureTimeStr || "10:00").trim();
    const mins = Math.max(0, Number(durationMins) || 0);

    const [hh, mm] = timeStr.split(":").map(Number);
    const depDateTime = new Date(`${dateStr}T${String(hh || 0).padStart(2, "0")}:${String(mm || 0).padStart(2, "0")}:00`);

    if (!isValid(depDateTime)) {
      const daysOffset = Math.floor(mins / (24 * 60));
      return this.addDaysToDate(dateStr, daysOffset);
    }

    const arrDateTime = new Date(depDateTime.getTime() + mins * 60 * 1000);
    return format(arrDateTime, "yyyy-MM-dd");
  }

  /**
   * Returns an array of formatted date strings for all days in a trip.
   */
  generateDateRange(startDateStr, endDateStr) {
    const start = this.parseDate(startDateStr);
    const end = this.parseDate(endDateStr);
    if (!start || !end) return [];

    const dates = [];
    let curr = start;
    while (!isAfter(curr, end)) {
      dates.push(format(curr, "yyyy-MM-dd"));
      curr = addDays(curr, 1);
    }
    return dates;
  }
}

export const dateFnsService = new DateFnsService();
export default dateFnsService;
