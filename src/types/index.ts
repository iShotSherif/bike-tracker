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
  /** Interval in km between services. At least one of intervalKm / intervalDays must be set. */
  intervalKm?: number
  /** Interval in days between services. At least one of intervalKm / intervalDays must be set. */
  intervalDays?: number
  /** Date when component was started/installed or last serviced (ISO YYYY-MM-DD). */
  dateStarted: string
  /** Odometer km reading when component was started/last serviced. */
  kmAtStart: number
}

/** A recorded maintenance event for a component. */
export interface ServiceLogEntry {
  id: string
  componentId: string
  bikeId: string
  date: string
  kmAtService: number
  notes?: string
}

export interface NotificationSettings {
  email?: string
  pushSubscription?: PushSubscriptionJSON
  alertLevel?: 'overdue-only' | 'soon-and-overdue'
}

export interface AlertComponentPayload {
  componentName: string
  bikeName: string
  status: 'overdue' | 'soon'
  detail: string
}

export interface SyncPayload {
  userId: string
  notificationSettings: NotificationSettings
  alertComponents: AlertComponentPayload[]
}

/** Persisted state (localStorage). */
export interface TrackerState {
  apiKey: string
  authToken?: string
  stravaConnected?: boolean
  componentsByBike: Record<string, BikeComponent[]>
  serviceLog: ServiceLogEntry[]
  notificationSettings?: NotificationSettings
}
