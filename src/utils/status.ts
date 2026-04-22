import type { BikeComponent } from '@/types'
import { todayISO } from './date'

export const TIME_SOON_DAYS = 30

export function kmSinceStart(c: BikeComponent, currentKm: number, kmAtStart?: number): number {
  const base = kmAtStart ?? c.kmAtStart
  return Math.max(0, currentKm - base)
}

export function daysUntilAlert(c: BikeComponent): number | null {
  if (!c.intervalDays) return null
  const startMs = new Date(c.dateStarted).getTime()
  const nowMs = new Date(todayISO()).getTime()
  const elapsed = Math.floor((nowMs - startMs) / (24 * 60 * 60 * 1000))
  return c.intervalDays - elapsed
}

export type ComponentStatus = 'ok' | 'watch' | 'soon' | 'overdue'

export function componentStatus(c: BikeComponent, currentKm: number, kmAtStart?: number): ComponentStatus {
  let status: ComponentStatus = 'ok'

  if (c.intervalKm) {
    const used = kmSinceStart(c, currentKm, kmAtStart)
    const pct = used / c.intervalKm
    const until = c.intervalKm - used
    if (until <= 0) return 'overdue'
    if (pct >= 0.90) status = 'soon'
    else if (pct >= 0.80 && status === 'ok') status = 'watch'
  }

  if (c.intervalDays) {
    const until = daysUntilAlert(c)!
    const elapsed = c.intervalDays - until
    const pct = elapsed / c.intervalDays
    if (until <= 0) return 'overdue'
    if (pct >= 0.90) status = 'soon'
    else if (pct >= 0.80 && status === 'ok') status = 'watch'
  }

  return status
}

export function alertDetail(c: BikeComponent, currentKm: number, kmAtStart?: number): string {
  const parts: string[] = []
  if (c.intervalKm) {
    const used = Math.floor(kmSinceStart(c, currentKm, kmAtStart))
    const left = c.intervalKm - used
    if (left <= 0) parts.push(`${Math.abs(left)} km de retard`)
    else parts.push(`${left} km restants`)
  }
  if (c.intervalDays) {
    const left = daysUntilAlert(c)!
    if (left <= 0) parts.push(`${Math.abs(left)} jours de retard`)
    else parts.push(`${left} jours restants`)
  }
  return parts.join('  ·  ')
}

export function progressPct(c: BikeComponent, currentKm: number, kmAtStart?: number): number {
  let pct = 0

  if (c.intervalKm) {
    const used = kmSinceStart(c, currentKm, kmAtStart)
    pct = Math.max(pct, Math.min(100, (used / c.intervalKm) * 100))
  }

  if (c.intervalDays) {
    const until = daysUntilAlert(c)!
    const elapsed = c.intervalDays - until
    pct = Math.max(pct, Math.min(100, (elapsed / c.intervalDays) * 100))
  }

  return pct
}
