export function formatSince(isoDate: string, locale = 'en'): string {
  const then = new Date(isoDate)
  const now = new Date()
  const diffDays = Math.floor((then.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })

  if (Math.abs(diffDays) < 30) return formatter.format(diffDays, 'day')

  const diffMonths = Math.round(diffDays / 30)
  if (Math.abs(diffMonths) < 12) return formatter.format(diffMonths, 'month')

  const diffYears = Math.round(diffDays / 365)
  return formatter.format(diffYears, 'year')
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}
