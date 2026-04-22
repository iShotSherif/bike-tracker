import type { BikeComponent } from '@/types'
import { todayISO } from './date'

export const TIME_SOON_DAYS = 30

export function kmSinceStart(c: BikeComponent, currentKm: number): number {
  return Math.max(0, currentKm - c.kmAtStart)
}

export function daysUntilAlert(c: BikeComponent): number | null {
  if (!c.intervalDays) return null
  const startMs = new Date(c.dateStarted).getTime()
  const nowMs = new Date(todayISO()).getTime()
  const elapsed = Math.floor((nowMs - startMs) / (24 * 60 * 60 * 1000))
  return c.intervalDays - elapsed
}

export function componentStatus(c: BikeComponent, currentKm: number): 'ok' | 'soon' | 'overdue' {
  let status: 'ok' | 'soon' | 'overdue' = 'ok'

  if (c.intervalKm) {
    const used = kmSinceStart(c, currentKm)
    const until = c.intervalKm - used
    if (until <= 0) return 'overdue'
    if (until <= c.intervalKm * 0.15) status = 'soon'
  }

  if (c.intervalDays) {
    const until = daysUntilAlert(c)!
    if (until <= 0) return 'overdue'
    if (until <= TIME_SOON_DAYS) status = 'soon'
  }

  return status
}

export function alertDetail(c: BikeComponent, currentKm: number): string {
  const parts: string[] = []
  if (c.intervalKm) {
    const used = Math.floor(kmSinceStart(c, currentKm))
    const left = c.intervalKm - used
    if (left <= 0) parts.push(`${Math.abs(left)} km overdue`)
    else parts.push(`${left} km left`)
  }
  if (c.intervalDays) {
    const left = daysUntilAlert(c)!
    if (left <= 0) parts.push(`${Math.abs(left)} days overdue`)
    else parts.push(`${left} days left`)
  }
  return parts.join('  ·  ')
}

export function progressPct(c: BikeComponent, currentKm: number): number {
  let pct = 0

  if (c.intervalKm) {
    const used = kmSinceStart(c, currentKm)
    pct = Math.max(pct, Math.min(100, (used / c.intervalKm) * 100))
  }

  if (c.intervalDays) {
    const until = daysUntilAlert(c)!
    const elapsed = c.intervalDays - until
    pct = Math.max(pct, Math.min(100, (elapsed / c.intervalDays) * 100))
  }

  return pct
}
