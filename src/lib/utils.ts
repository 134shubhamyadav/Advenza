import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const inrFmt = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
export function inr(amount: number): string {
  return `₹${inrFmt.format(amount)}`;
}
