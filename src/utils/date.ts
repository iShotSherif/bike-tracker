const DATE_ORDER: Record<string, Array<'day' | 'month' | 'year'>> = {
  fr: ['day', 'month', 'year'],
  en: ['month', 'day', 'year'],
  es: ['day', 'month', 'year'],
}

function parseISODate(isoDate: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate)
  if (!match) return new Date(isoDate)

  const [, year, month, day] = match
  return new Date(Number(year), Number(month) - 1, Number(day))
}

export function formatSince(isoDate: string, locale = 'en'): string {
  const date = parseISODate(isoDate)

  if (Number.isNaN(date.getTime())) return isoDate

  const normalizedLocale = locale.toLowerCase().split(/[-_]/)[0]
  const order = DATE_ORDER[normalizedLocale] ?? DATE_ORDER.en
  const parts = {
    day: String(date.getDate()).padStart(2, '0'),
    month: String(date.getMonth() + 1).padStart(2, '0'),
    year: String(date.getFullYear()),
  }

  return order.map((part) => parts[part]).join('-')
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}
