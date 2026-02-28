/**
 * Format a past ISO date (YYYY-MM-DD) as relative time: "3 months", "45 days", etc.
 */
export function formatSince(isoDate: string): string {
  const then = new Date(isoDate)
  const now = new Date()
  const diffMs = now.getTime() - then.getTime()
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000))

  if (diffDays < 0) return 'future'
  if (diffDays === 0) return 'today'
  if (diffDays === 1) return '1 day'
  if (diffDays < 30) return `${diffDays} days`
  if (diffDays < 60) return '1 month'
  if (diffDays < 365) return `${Math.round(diffDays / 30)} months`
  if (diffDays < 730) return '1 year'
  return `${Math.round(diffDays / 365)} years`
}

/** Return today in YYYY-MM-DD for date inputs. */
export function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}
