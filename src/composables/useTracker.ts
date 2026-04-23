import { ref, computed } from 'vue'
import type { IntervalsAthlete, IntervalsBike, BikeComponent, TrackerState, IntervalsActivity, ServiceLogEntry, NotificationSettings, SyncPayload, HotspotPosition, BikeVisualType } from '@/types'
import { fetchAthlete, bikeDistanceKm, fetchActivities, kmOnBikeByDate } from '@/api/intervals'
import { componentStatus, alertDetail } from '@/utils/status'
import { todayISO } from '@/utils/date'

const STORAGE_KEY = 'bike-tracker-state'

function loadState(): Partial<TrackerState> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const state = JSON.parse(raw) as Partial<TrackerState>

    if (state.componentsByBike) {
      const migratedComponents: Record<string, BikeComponent[]> = {}
      for (const [bikeId, components] of Object.entries(state.componentsByBike)) {
        migratedComponents[bikeId] = components.map((c: any) => {
          if ('kmAtStart' in c && 'dateStarted' in c) {
            return { ...c, intervalDays: c.intervalDays ?? undefined } as BikeComponent
          }
          const dateStarted = c.installedAt || c.dateStarted || new Date().toISOString().split('T')[0]
          const kmAtStart = c.lastDoneAtKm ?? c.kmAtStart ?? 0
          return {
            id: c.id,
            name: c.name,
            intervalKm: c.intervalKm,
            intervalDays: c.intervalDays ?? undefined,
            dateStarted,
            kmAtStart,
          } as BikeComponent
        })
      }
      state.componentsByBike = migratedComponents
    }

    if (state.hotspotPositionsByBike) {
      const migratedHotspots: TrackerState['hotspotPositionsByBike'] = {}
      for (const [bikeId, hotspotMap] of Object.entries(state.hotspotPositionsByBike)) {
        const values = Object.values(hotspotMap as Record<string, unknown>)
        const isLegacyFlatMap = values.every((value) =>
          typeof value === 'object' && value !== null && 'leftPct' in (value as object) && 'topPct' in (value as object)
        )

        migratedHotspots[bikeId] = isLegacyFlatMap
          ? { road: hotspotMap as Record<string, HotspotPosition> }
          : hotspotMap as TrackerState['hotspotPositionsByBike'][string]
      }
      state.hotspotPositionsByBike = migratedHotspots
    }

    return state
  } catch {
    return {}
  }
}

function saveState(state: Partial<TrackerState>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch (e) {
    console.error('Failed to save state', e)
  }
}

const apiKey = ref<string>(loadState().apiKey ?? '')
const authToken = ref<string>(loadState().authToken ?? '')
const stravaConnected = ref<boolean>(loadState().stravaConnected ?? false)
const athlete = ref<IntervalsAthlete | null>(null)
const activities = ref<IntervalsActivity[]>([])
const loading = ref(false)
const error = ref<string | null>(null)

const bikes = computed<IntervalsBike[]>(() => athlete.value?.bikes ?? [])

const componentsByBike = ref<Record<string, BikeComponent[]>>(
  loadState().componentsByBike ?? {}
)
const hotspotPositionsByBike = ref<Record<string, Partial<Record<BikeVisualType, Record<string, HotspotPosition>>>>>(
  loadState().hotspotPositionsByBike ?? {}
)
const bikeVisualByBike = ref<Record<string, BikeVisualType>>(
  loadState().bikeVisualByBike ?? {}
)

const serviceLog = ref<ServiceLogEntry[]>(loadState().serviceLog ?? [])
const notificationSettings = ref<NotificationSettings>(loadState().notificationSettings ?? {})

const userId = computed<string>(() =>
  apiKey.value ? btoa(apiKey.value).slice(0, 16) : ''
)

function persist(): void {
  saveState({
    apiKey: apiKey.value,
    authToken: authToken.value || undefined,
    stravaConnected: stravaConnected.value,
    componentsByBike: componentsByBike.value,
    hotspotPositionsByBike: hotspotPositionsByBike.value,
    bikeVisualByBike: bikeVisualByBike.value,
    serviceLog: serviceLog.value,
    notificationSettings: notificationSettings.value,
  })
}

function setNotificationSettings(s: NotificationSettings): void {
  notificationSettings.value = s
  persist()
}

function getComponentsForBike(bikeId: string): BikeComponent[] {
  return componentsByBike.value[bikeId] ?? []
}

function setComponentsForBike(bikeId: string, components: BikeComponent[]): void {
  componentsByBike.value = { ...componentsByBike.value, [bikeId]: components }
  persist()
}

function addComponent(bikeId: string, component: Omit<BikeComponent, 'id'>): void {
  const list = getComponentsForBike(bikeId)
  const newOne: BikeComponent = {
    ...component,
    id: `c-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
  }
  setComponentsForBike(bikeId, [...list, newOne])
}

function getHotspotPositionsForBike(bikeId: string, visual: BikeVisualType): Record<string, HotspotPosition> {
  return hotspotPositionsByBike.value[bikeId]?.[visual] ?? {}
}

function getBikeVisual(bikeId: string): BikeVisualType {
  return bikeVisualByBike.value[bikeId] ?? 'road'
}

function setBikeVisual(bikeId: string, visual: BikeVisualType): void {
  bikeVisualByBike.value = {
    ...bikeVisualByBike.value,
    [bikeId]: visual,
  }
  persist()
}

function setHotspotPosition(bikeId: string, visual: BikeVisualType, componentId: string, position: HotspotPosition): void {
  hotspotPositionsByBike.value = {
    ...hotspotPositionsByBike.value,
    [bikeId]: {
      ...hotspotPositionsByBike.value[bikeId],
      [visual]: {
        ...getHotspotPositionsForBike(bikeId, visual),
        [componentId]: position,
      },
    },
  }
  persist()
}

function clearHotspotPosition(bikeId: string, visual: BikeVisualType, componentId: string): void {
  const visualPositions = { ...getHotspotPositionsForBike(bikeId, visual) }
  delete visualPositions[componentId]
  hotspotPositionsByBike.value = {
    ...hotspotPositionsByBike.value,
    [bikeId]: {
      ...hotspotPositionsByBike.value[bikeId],
      [visual]: visualPositions,
    },
  }
  persist()
}

function updateComponent(bikeId: string, id: string, patch: Partial<BikeComponent>): void {
  const list = getComponentsForBike(bikeId).map((c) =>
    c.id === id ? { ...c, ...patch } : c
  )
  setComponentsForBike(bikeId, list)
}

function removeComponent(bikeId: string, id: string): void {
  for (const visual of ['road', 'gravel', 'mtb'] as BikeVisualType[]) {
    clearHotspotPosition(bikeId, visual, id)
  }
  setComponentsForBike(
    bikeId,
    getComponentsForBike(bikeId).filter((c) => c.id !== id)
  )
}

function addServiceEntry(entry: Omit<ServiceLogEntry, 'id'>): void {
  const newEntry: ServiceLogEntry = {
    ...entry,
    id: `sl-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
  }
  serviceLog.value = [newEntry, ...serviceLog.value]
  persist()
}

function getLogForComponent(componentId: string): ServiceLogEntry[] {
  return serviceLog.value.filter((e) => e.componentId === componentId)
}

function markComponentDone(bikeId: string, componentId: string, currentKm: number, notes?: string): void {
  addServiceEntry({ componentId, bikeId, date: todayISO(), kmAtService: currentKm, notes })
  updateComponent(bikeId, componentId, { dateStarted: todayISO(), kmAtStart: currentKm })
}

async function syncToWorker(): Promise<void> {
  const workerUrl = import.meta.env.VITE_WORKER_URL as string | undefined
  if (!workerUrl) return
  const { email, pushSubscription } = notificationSettings.value
  if (!email && !pushSubscription) return
  if (!userId.value) return

  const payload: SyncPayload = {
    userId: userId.value,
    notificationSettings: notificationSettings.value,
    alertComponents: alertComponents.value.map((item) => ({
      componentName: item.component.name,
      bikeName: item.bikeName,
      status: item.status as 'overdue' | 'soon',
      detail: alertDetail(item.component, kmAtDate(item.bikeId, todayISO()), kmAtDate(item.bikeId, item.component.dateStarted)),
    })),
  }
  try {
    await fetch(`${workerUrl}/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch { /* non-fatal */ }
}

const DEFAULT_COMPONENTS: Omit<BikeComponent, 'id'>[] = [
  { name: 'Chaîne', intervalKm: 3000, dateStarted: todayISO(), kmAtStart: 0 },
  { name: 'Cassette', intervalKm: 9000, dateStarted: todayISO(), kmAtStart: 0 },
  { name: 'Plaquettes de frein', intervalKm: 1500, dateStarted: todayISO(), kmAtStart: 0 },
  { name: 'Pneus', intervalKm: 5000, dateStarted: todayISO(), kmAtStart: 0 },
  { name: 'Câbles de frein', intervalDays: 365, dateStarted: todayISO(), kmAtStart: 0 },
  { name: 'Révision générale', intervalDays: 180, dateStarted: todayISO(), kmAtStart: 0 },
]

function initDefaultComponents(bikeId: string): void {
  if (!componentsByBike.value[bikeId]?.length) {
    DEFAULT_COMPONENTS.forEach((c) => addComponent(bikeId, c))
  }
}

function exportState(): string {
  return JSON.stringify({
    apiKey: apiKey.value,
    componentsByBike: componentsByBike.value,
    hotspotPositionsByBike: hotspotPositionsByBike.value,
    bikeVisualByBike: bikeVisualByBike.value,
    serviceLog: serviceLog.value,
    notificationSettings: notificationSettings.value,
  }, null, 2)
}

function importState(json: string): void {
  try {
    const parsed = JSON.parse(json)
    if (parsed.apiKey) apiKey.value = parsed.apiKey
    if (parsed.componentsByBike) componentsByBike.value = parsed.componentsByBike
    if (parsed.hotspotPositionsByBike) hotspotPositionsByBike.value = parsed.hotspotPositionsByBike
    if (parsed.bikeVisualByBike) bikeVisualByBike.value = parsed.bikeVisualByBike
    if (parsed.serviceLog) serviceLog.value = parsed.serviceLog
    if (parsed.notificationSettings) notificationSettings.value = parsed.notificationSettings
    persist()
  } catch {
    error.value = 'Fichier invalide.'
  }
}

function authHeaders(): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' }
  if (authToken.value) h.Authorization = `Bearer ${authToken.value}`
  return h
}

async function pushProfileToCloud(): Promise<void> {
  const workerUrl = import.meta.env.VITE_WORKER_URL as string | undefined
  if (!workerUrl || !userId.value) return
  try {
    await fetch(`${workerUrl}/profile`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        userId: userId.value,
        componentsByBike: componentsByBike.value,
        hotspotPositionsByBike: hotspotPositionsByBike.value,
        bikeVisualByBike: bikeVisualByBike.value,
        serviceLog: serviceLog.value,
        notificationSettings: notificationSettings.value,
      }),
    })
  } catch { /* non-fatal */ }
}

async function pullProfileFromCloud(): Promise<boolean> {
  const workerUrl = import.meta.env.VITE_WORKER_URL as string | undefined
  if (!workerUrl || !userId.value) return false
  try {
    const res = await fetch(`${workerUrl}/profile/${userId.value}`, { headers: authHeaders() })
    if (!res.ok) return false
    const data = await res.json() as Partial<TrackerState>
    if (data.componentsByBike) componentsByBike.value = data.componentsByBike
    if (data.hotspotPositionsByBike) hotspotPositionsByBike.value = data.hotspotPositionsByBike
    if (data.bikeVisualByBike) bikeVisualByBike.value = data.bikeVisualByBike
    if (data.serviceLog) serviceLog.value = data.serviceLog
    if (data.notificationSettings) notificationSettings.value = data.notificationSettings
    persist()
    return true
  } catch {
    return false
  }
}

async function login(email: string, otp: string): Promise<boolean> {
  const workerUrl = import.meta.env.VITE_WORKER_URL as string | undefined
  if (!workerUrl) return false
  try {
    const res = await fetch(`${workerUrl}/auth/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, otp }),
    })
    if (!res.ok) return false
    const data = await res.json() as { token: string; userId: string }
    authToken.value = data.token
    persist()
    await pullProfileFromCloud()
    return true
  } catch {
    return false
  }
}

function logout(): void {
  authToken.value = ''
  persist()
}

function connectStrava(): void {
  const workerUrl = import.meta.env.VITE_WORKER_URL as string | undefined
  if (!workerUrl || !userId.value) return
  window.location.href = `${workerUrl}/strava/auth?userId=${encodeURIComponent(userId.value)}`
}

async function loadStravaActivities(): Promise<void> {
  const workerUrl = import.meta.env.VITE_WORKER_URL as string | undefined
  if (!workerUrl || !userId.value) return
  loading.value = true
  error.value = null
  try {
    const res = await fetch(`${workerUrl}/strava/activities?userId=${encodeURIComponent(userId.value)}`)
    if (!res.ok) {
      if (res.status === 401) {
        stravaConnected.value = false
        persist()
        error.value = 'Session Strava expirée. Reconnecte ton compte.'
        return
      }
      throw new Error(`Strava error: ${res.status}`)
    }
    const data = await res.json() as { bikes: IntervalsBike[]; activities: IntervalsActivity[] }

    if (!athlete.value) {
      athlete.value = { id: 'strava', name: 'Strava', bikes: data.bikes }
    } else {
      const existingIds = new Set(athlete.value.bikes.map((b) => b.id))
      const newBikes = data.bikes.filter((b) => !existingIds.has(b.id))
      athlete.value = { ...athlete.value, bikes: [...athlete.value.bikes, ...newBikes] }
    }

    const existingActivityIds = new Set(activities.value.map((a) => a.id))
    const newActivities = data.activities.filter((a) => !existingActivityIds.has(a.id))
    activities.value = [...activities.value, ...newActivities]

    stravaConnected.value = true
    persist()

    const restored = await pullProfileFromCloud()
    if (!restored) {
      data.bikes.forEach((bike) => initDefaultComponents(bike.id))
    }
    await syncToWorker()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Impossible de charger les activités Strava'
  } finally {
    loading.value = false
  }
}

function resetAthlete(): void {
  athlete.value = null
  activities.value = []
}

function setApiKey(key: string): void {
  apiKey.value = key
  persist()
}

async function loadAthlete(): Promise<void> {
  if (!apiKey.value.trim()) {
    error.value = 'Entre ta clé API Intervals.icu'
    return
  }
  loading.value = true
  error.value = null
  try {
    athlete.value = await fetchAthlete(apiKey.value)
    const newest = new Date().toISOString().split('T')[0]
    const oldest = new Date(Date.now() - 730 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    activities.value = await fetchActivities(apiKey.value, { oldest, newest, limit: 1000 })
    const restored = await pullProfileFromCloud()
    if (!restored) {
      bikes.value.forEach((bike) => initDefaultComponents(bike.id))
    }
    await syncToWorker()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Impossible de charger les données'
    athlete.value = null
  } finally {
    loading.value = false
  }
}

function bikeTotalKm(bike: IntervalsBike): number {
  return bikeDistanceKm(bike)
}

function kmAtDate(bikeId: string, date: string): number {
  return kmOnBikeByDate(activities.value, bikeId, date)
}

const alertComponents = computed(() =>
  bikes.value.flatMap((bike) => {
    const km = kmAtDate(bike.id, todayISO())
    return getComponentsForBike(bike.id).map((c) => {
      const kmStart = kmAtDate(bike.id, c.dateStarted)
      return {
        component: c,
        bikeId: bike.id,
        bikeName: bike.name,
        status: componentStatus(c, km, kmStart),
      }
    })
  })
  .filter((i) => i.status !== 'ok')
  .sort((a, b) => {
    const order: Record<string, number> = { overdue: 0, soon: 1 }
    return order[a.status] - order[b.status]
  })
)

export function useTracker() {
  return {
    apiKey,
    athlete,
    loading,
    error,
    bikes,
    componentsByBike,
    hotspotPositionsByBike,
    bikeVisualByBike,
    serviceLog,
    alertComponents,
    getComponentsForBike,
    getHotspotPositionsForBike,
    getBikeVisual,
    setComponentsForBike,
    addComponent,
    updateComponent,
    removeComponent,
    setHotspotPosition,
    clearHotspotPosition,
    setBikeVisual,
    addServiceEntry,
    getLogForComponent,
    markComponentDone,
    setApiKey,
    loadAthlete,
    bikeTotalKm,
    kmAtDate,
    notificationSettings,
    setNotificationSettings,
    userId,
    exportState,
    importState,
    pushProfileToCloud,
    pullProfileFromCloud,
    resetAthlete,
    stravaConnected,
    connectStrava,
    loadStravaActivities,
    authToken,
    login,
    logout,
  }
}
