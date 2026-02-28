import type { IntervalsAthlete, IntervalsActivity, IntervalsBike } from '@/types'

const BASE = 'https://intervals.icu/api/v1'

function authHeader(apiKey: string): string {
  const encoded = btoa(`API_KEY:${apiKey}`)
  return `Basic ${encoded}`
}

export async function fetchAthlete(apiKey: string): Promise<IntervalsAthlete> {
  const res = await fetch(`${BASE}/athlete/0`, {
    headers: { Authorization: authHeader(apiKey) },
  })
  if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`)
  const data = (await res.json()) as Record<string, unknown>
  const bikes = (data.bikes as Array<{ id: string; name: string; distance: number | string; primary?: boolean }>) ?? []
  return {
    id: String(data.id),
    name: String(data.name ?? ''),
    bikes: bikes.map((b) => ({
      id: String(b.id).startsWith('b') ? String(b.id) : `b${b.id}`,
      name: b.name ?? 'Unnamed',
      distance: typeof b.distance === 'number' ? b.distance : parseFloat(String(b.distance).replace(',', '.')) || 0,
      primary: Boolean(b.primary),
    })),
  }
}

/** Fetch activities in date range; distance is in meters in API. */
export async function fetchActivities(
  apiKey: string,
  opts: { oldest: string; newest: string; limit?: number }
): Promise<IntervalsActivity[]> {
  const params = new URLSearchParams({
    oldest: opts.oldest,
    newest: opts.newest,
    ...(opts.limit != null && { limit: String(opts.limit) }),
  })
  const res = await fetch(`${BASE}/athlete/0/activities?${params}`, {
    headers: { Authorization: authHeader(apiKey) },
  })
  if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`)
  const list = (await res.json()) as Array<Record<string, unknown>>
  return list.map((a) => ({
    id: String(a.id),
    start_date_local: String(a.start_date_local ?? ''),
    type: String(a.type ?? ''),
    distance: Number(a.distance ?? 0),
    moving_time: Number(a.moving_time ?? 0),
    gear: a.gear
      ? {
          id: String((a.gear as Record<string, unknown>).id ?? ''),
          name: (a.gear as Record<string, unknown>).name as string | undefined,
          distance: (a.gear as Record<string, unknown>).distance as number | undefined,
          primary: (a.gear as Record<string, unknown>).primary as boolean | undefined,
        }
      : undefined,
  }))
}

/** Sum distance (meters) per gear id from activities. */
export function sumDistanceByGear(activities: IntervalsActivity[]): Record<string, number> {
  const byGear: Record<string, number> = {}
  for (const a of activities) {
    const id = a.gear?.id ?? 'unknown'
    byGear[id] = (byGear[id] ?? 0) + a.distance
  }
  return byGear
}

/** Merge bike totals from athlete (lifetime) with optional activity-based sums. Athlete bike distance is in meters. */
export function bikeDistanceKm(bike: IntervalsBike): number {
  return (bike.distance ?? 0) / 1000
}
/**
 * Calculate cumulative km on a specific bike up to a given date (inclusive).
 * Returns the total km by summing all activities on that bike up to and including that date.
 */
export function kmOnBikeByDate(activities: IntervalsActivity[], bikeId: string, upToDate: string): number {
  const upToMs = new Date(upToDate).getTime()
  let totalMeters = 0
  
  // Normalize bike ID format
  const normalizedBikeId = String(bikeId).startsWith('b') ? String(bikeId) : `b${bikeId}`
  
  for (const a of activities) {
    const activityDate = new Date(a.start_date_local).getTime()
    if (activityDate <= upToMs) {
      // Match activities with this bike's gear
      if (a.gear?.id) {
        const normalizedGearId = String(a.gear.id).startsWith('b') ? String(a.gear.id) : `b${a.gear.id}`
        if (normalizedGearId === normalizedBikeId) {
          totalMeters += a.distance
        }
      }
    }
  }
  return totalMeters / 1000
}