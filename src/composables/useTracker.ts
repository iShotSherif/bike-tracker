import { ref, computed } from 'vue'
import type { IntervalsAthlete, IntervalsBike, BikeComponent, TrackerState, IntervalsActivity, ServiceLogEntry, NotificationSettings, SyncPayload, HotspotPosition, BikeVisualType } from '@/types'
import { bikeDistanceKm, kmOnBikeByDate } from '@/api/km'
import { i18n } from '@/i18n'
import { componentStatus, alertDetail } from '@/utils/status'
import { todayISO } from '@/utils/date'

const STORAGE_KEY = 'bike-tracker-state'

// LEGACY MIGRATION — à supprimer quand les anciens exports apiKey
// ne sont plus en circulation. Utilisé uniquement dans loadState()
// et importState() pour la rétrocompatibilité.
function legacyUserIdFromApiKey(apiKey?: string): string | null {
  const normalized = apiKey?.trim()
  return normalized ? btoa(normalized).slice(0, 16) : null
}

function createUserId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }

  return `u-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

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

const initialState = loadState()

const userId = ref<string>(
  initialState.userId
    ?? legacyUserIdFromApiKey(initialState.apiKey)
    ?? createUserId(),
)
const authToken = ref<string>(initialState.authToken ?? '')
const stravaConnected = ref<boolean>(initialState.stravaConnected ?? false)
const athlete = ref<IntervalsAthlete | null>(null)
const activities = ref<IntervalsActivity[]>([])
const loading = ref(false)
const error = ref<string | null>(null)

const bikes = computed<IntervalsBike[]>(() => athlete.value?.bikes ?? [])

const bikeNameByBike = ref<Record<string, string>>(
  initialState.bikeNameByBike ?? {}
)
const componentsByBike = ref<Record<string, BikeComponent[]>>(
  initialState.componentsByBike ?? {}
)
const hotspotPositionsByBike = ref<Record<string, Partial<Record<BikeVisualType, Record<string, HotspotPosition>>>>>(
  initialState.hotspotPositionsByBike ?? {}
)
const bikeVisualByBike = ref<Record<string, BikeVisualType>>(
  initialState.bikeVisualByBike ?? {}
)

const serviceLog = ref<ServiceLogEntry[]>(initialState.serviceLog ?? [])
const notificationSettings = ref<NotificationSettings>(initialState.notificationSettings ?? {})

function persist(): void {
  saveState({
    userId: userId.value,
    authToken: authToken.value || undefined,
    stravaConnected: stravaConnected.value,
    bikeNameByBike: bikeNameByBike.value,
    componentsByBike: componentsByBike.value,
    hotspotPositionsByBike: hotspotPositionsByBike.value,
    bikeVisualByBike: bikeVisualByBike.value,
    serviceLog: serviceLog.value,
    notificationSettings: notificationSettings.value,
  })
}

if (!initialState.userId) {
  persist()
}

function setNotificationSettings(s: NotificationSettings): void {
  notificationSettings.value = s
  persist()
}

function getBikeDisplayName(bikeId: string, fallbackName: string): string {
  return bikeNameByBike.value[bikeId]?.trim() || fallbackName
}

function setBikeDisplayName(bikeId: string, name: string): void {
  const cleanName = name.trim()
  if (!cleanName) {
    const next = { ...bikeNameByBike.value }
    delete next[bikeId]
    bikeNameByBike.value = next
  } else {
    bikeNameByBike.value = { ...bikeNameByBike.value, [bikeId]: cleanName }
  }
  persist()
}

function getComponentsForBike(bikeId: string): BikeComponent[] {
  return componentsByBike.value[bikeId] ?? []
}

function setComponentsForBike(bikeId: string, components: BikeComponent[]): void {
  componentsByBike.value = { ...componentsByBike.value, [bikeId]: components }
  persist()
}

function addComponent(bikeId: string, component: Omit<BikeComponent, 'id'>): BikeComponent {
  const list = getComponentsForBike(bikeId)
  const newOne: BikeComponent = {
    ...component,
    id: `c-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
  }
  setComponentsForBike(bikeId, [...list, newOne])
  return newOne
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
      headers: { 'Content-Type': 'application/json', ...(authToken.value ? { 'Authorization': `Bearer ${authToken.value}` } : {}) },
      body: JSON.stringify(payload),
    })
  } catch { /* non-fatal */ }
}

type DefaultComponentKey = 'chain' | 'cassette' | 'brakePads' | 'tires' | 'brakeCables' | 'fullService'

const DEFAULT_COMPONENTS: Array<Omit<BikeComponent, 'id' | 'name'> & { nameKey: DefaultComponentKey }> = [
  { nameKey: 'chain', intervalKm: 3000, dateStarted: todayISO(), kmAtStart: 0 },
  { nameKey: 'cassette', intervalKm: 9000, dateStarted: todayISO(), kmAtStart: 0 },
  { nameKey: 'brakePads', intervalKm: 1500, dateStarted: todayISO(), kmAtStart: 0 },
  { nameKey: 'tires', intervalKm: 5000, dateStarted: todayISO(), kmAtStart: 0 },
  { nameKey: 'brakeCables', intervalDays: 365, dateStarted: todayISO(), kmAtStart: 0 },
  { nameKey: 'fullService', intervalDays: 180, dateStarted: todayISO(), kmAtStart: 0 },
]

function initDefaultComponents(bikeId: string): void {
  // Intentionally idempotent: Strava refresh can call this repeatedly for the same bike.
  if (!componentsByBike.value[bikeId]?.length) {
    DEFAULT_COMPONENTS.forEach(({ nameKey, ...component }) => {
      addComponent(bikeId, {
        ...component,
        name: i18n.global.t(`components.names.${nameKey}`),
      })
    })
  }
}

function exportState(): string {
  return JSON.stringify({
    userId: userId.value,
    stravaConnected: stravaConnected.value,
    bikeNameByBike: bikeNameByBike.value,
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
    if (typeof parsed.userId === 'string' && parsed.userId.trim()) {
      userId.value = parsed.userId
    } else if (typeof parsed.apiKey === 'string') {
      userId.value = legacyUserIdFromApiKey(parsed.apiKey) ?? userId.value
    }
    if (typeof parsed.stravaConnected === 'boolean') stravaConnected.value = parsed.stravaConnected
    if (parsed.bikeNameByBike) bikeNameByBike.value = parsed.bikeNameByBike
    if (parsed.componentsByBike) componentsByBike.value = parsed.componentsByBike
    if (parsed.hotspotPositionsByBike) hotspotPositionsByBike.value = parsed.hotspotPositionsByBike
    if (parsed.bikeVisualByBike) bikeVisualByBike.value = parsed.bikeVisualByBike
    if (parsed.serviceLog) serviceLog.value = parsed.serviceLog
    if (parsed.notificationSettings) notificationSettings.value = parsed.notificationSettings
    error.value = null
    persist()
  } catch {
    error.value = 'Fichier invalide.'
  }
}

async function pushProfileToCloud(): Promise<void> {
  const workerUrl = import.meta.env.VITE_WORKER_URL as string | undefined
  if (!workerUrl || !userId.value) return
  try {
    await fetch(`${workerUrl}/profile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(authToken.value ? { 'Authorization': `Bearer ${authToken.value}` } : {}) },
      body: JSON.stringify({
        userId: userId.value,
        stravaConnected: stravaConnected.value,
        bikeNameByBike: bikeNameByBike.value,
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
  if (!workerUrl || !userId.value || !authToken.value) return false
  try {
    const res = await fetch(`${workerUrl}/profile/${userId.value}`, { headers: { 'Content-Type': 'application/json', ...(authToken.value ? { 'Authorization': `Bearer ${authToken.value}` } : {}) } })
    if (!res.ok) return false
    const data = await res.json() as Partial<TrackerState>
    if (typeof data.userId === 'string' && data.userId.trim()) userId.value = data.userId
    if (typeof data.stravaConnected === 'boolean') stravaConnected.value = data.stravaConnected
    if (data.bikeNameByBike) bikeNameByBike.value = data.bikeNameByBike
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
    userId.value = data.userId
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
  if (!workerUrl) {
    error.value = 'Configuration Strava manquante. Définis VITE_WORKER_URL pour activer la connexion.'
    return
  }
  if (!userId.value) {
    error.value = 'Impossible de préparer la connexion Strava. Recharge la page puis réessaie.'
    return
  }
  window.location.href = `${workerUrl}/strava/auth?userId=${encodeURIComponent(userId.value)}`
}

async function loadStravaActivities(): Promise<void> {
  const workerUrl = import.meta.env.VITE_WORKER_URL as string | undefined
  if (!workerUrl || !userId.value) return
  loading.value = true
  error.value = null
  try {
    const res = await fetch(`${workerUrl}/strava/activities?userId=${encodeURIComponent(userId.value)}`, { headers: { ...(authToken.value ? { 'Authorization': `Bearer ${authToken.value}` } : {}) } })
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
        bikeName: getBikeDisplayName(bike.id, bike.name),
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
    athlete,
    loading,
    error,
    bikes,
    bikeNameByBike,
    componentsByBike,
    hotspotPositionsByBike,
    bikeVisualByBike,
    serviceLog,
    alertComponents,
    getComponentsForBike,
    getBikeDisplayName,
    setBikeDisplayName,
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
