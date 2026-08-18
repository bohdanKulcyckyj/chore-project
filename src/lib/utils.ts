import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** date-fns patterns used app-wide: 24h time, e.g. "Aug 17, 2026 20:01" */
export const TIME_FMT = 'HH:mm'
export const DATE_FMT = 'MMM dd, yyyy'
export const DATE_TIME_FMT = `${DATE_FMT} ${TIME_FMT}`
