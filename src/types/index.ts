/** Bike from intervals.icu athlete profile (bikes array). */
export interface IntervalsBike {
  id: string
  name: string
  distance: number
  primary?: boolean
}

/** Activity from intervals.icu (minimal fields we use). */
export interface IntervalsActivity {
  id: string
  start_date_local: string
  type: string
  distance: number
  moving_time: number
  gear?: { id: string; name?: string; distance?: number; primary?: boolean }
}

/** Athlete profile from intervals.icu (minimal). */
export interface IntervalsAthlete {
  id: string
  name: string
  bikes: IntervalsBike[]
}

/** User-defined maintenance component for a bike. */
export interface BikeComponent {
  id: string
  name: string
  /** Interval in km between services. */
  intervalKm: number
  /** Date when component was started/installed or last serviced (ISO YYYY-MM-DD). */
  dateStarted: string
  /** Odometer km reading when component was started/last serviced. */
  kmAtStart: number
}

/** Persisted state (localStorage). */
export interface TrackerState {
  apiKey: string
  /** Component definitions per bike id. */
  componentsByBike: Record<string, BikeComponent[]>
}
