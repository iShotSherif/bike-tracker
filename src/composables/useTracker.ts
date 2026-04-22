import { ref, computed } from 'vue'
import type { IntervalsAthlete, IntervalsBike, BikeComponent, TrackerState, IntervalsActivity, ServiceLogEntry, NotificationSettings, SyncPayload } from '@/types'
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
const athlete = ref<IntervalsAthlete | null>(null)
const activities = ref<IntervalsActivity[]>([])
const loading = ref(false)
const error = ref<string | null>(null)

const bikes = computed<IntervalsBike[]>(() => athlete.value?.bikes ?? [])

const componentsByBike = ref<Record<string, BikeComponent[]>>(
  loadState().componentsByBike ?? {}
)

const serviceLog = ref<ServiceLogEntry[]>(loadState().serviceLog ?? [])
const notificationSettings = ref<NotificationSettings>(loadState().notificationSettings ?? {})

const userId = computed<string>(() =>
  apiKey.value ? btoa(apiKey.value).slice(0, 16) : ''
)

function persist(): void {
  saveState({
    apiKey: apiKey.value,
    componentsByBike: componentsByBike.value,
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

function updateComponent(bikeId: string, id: string, patch: Partial<BikeComponent>): void {
  const list = getComponentsForBike(bikeId).map((c) =>
    c.id === id ? { ...c, ...patch } : c
  )
  setComponentsForBike(bikeId, list)
}

function removeComponent(bikeId: string, id: string): void {
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
      detail: alertDetail(item.component, kmAtDate(item.bikeId, todayISO())),
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

function setApiKey(key: string): void {
  apiKey.value = key
  persist()
}

async function loadAthlete(): Promise<void> {
  if (!apiKey.value.trim()) {
    error.value = 'Enter your intervals.icu API key'
    return
  }
  loading.value = true
  error.value = null
  try {
    athlete.value = await fetchAthlete(apiKey.value)
    const newest = new Date().toISOString().split('T')[0]
    const oldest = new Date(Date.now() - 730 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    activities.value = await fetchActivities(apiKey.value, { oldest, newest, limit: 1000 })
    await syncToWorker()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load data'
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
    return getComponentsForBike(bike.id).map((c) => ({
      component: c,
      bikeId: bike.id,
      bikeName: bike.name,
      status: componentStatus(c, km),
    }))
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
    serviceLog,
    alertComponents,
    getComponentsForBike,
    setComponentsForBike,
    addComponent,
    updateComponent,
    removeComponent,
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
  }
}
