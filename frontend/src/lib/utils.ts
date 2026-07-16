import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number | null | undefined): string {
  if (value == null) return "—"
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

export function formatPct(value: number | null | undefined): string {
  if (value == null) return "—"
  const sign = value >= 0 ? "+" : ""
  return `${sign}${value.toFixed(2)}%`
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr || "—"
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

export function formatNumber(value: number | null | undefined): string {
  if (value == null) return "—"
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

export function filterAndSortByTicker<T extends { ticker: string }>(
  items: T[],
  query: string,
): T[] {
  if (!query) return items
  const q = query.toUpperCase().trim()
  if (!q) return items
  return items
    .filter((item) => item.ticker.toUpperCase().includes(q))
    .sort((a, b) => {
      const aUpper = a.ticker.toUpperCase()
      const bUpper = b.ticker.toUpperCase()
      const aStarts = aUpper.startsWith(q)
      const bStarts = bUpper.startsWith(q)
      if (aStarts !== bStarts) return aStarts ? -1 : 1
      return aUpper.indexOf(q) - bUpper.indexOf(q)
    })
}
