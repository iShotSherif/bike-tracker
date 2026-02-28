import { ref, computed } from 'vue'
import type { IntervalsAthlete, IntervalsBike, BikeComponent, TrackerState, IntervalsActivity } from '@/types'
import { fetchAthlete, bikeDistanceKm, fetchActivities, kmOnBikeByDate } from '@/api/intervals'

const STORAGE_KEY = 'bike-tracker-state'

function loadState(): Partial<TrackerState> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const state = JSON.parse(raw) as Partial<TrackerState>
    
    // Migrate old component format to new format
    if (state.componentsByBike) {
      const migratedComponents: Record<string, BikeComponent[]> = {}
      for (const [bikeId, components] of Object.entries(state.componentsByBike)) {
        migratedComponents[bikeId] = components.map((c: any) => {
          // If already migrated (has kmAtStart), keep as is
          if ('kmAtStart' in c && 'dateStarted' in c) {
            return c as BikeComponent
          }
          // Migrate old format to new format
          const dateStarted = c.installedAt || c.dateStarted || new Date().toISOString().split('T')[0]
          const kmAtStart = c.lastDoneAtKm ?? c.kmAtStart ?? 0
          return {
            id: c.id,
            name: c.name,
            intervalKm: c.intervalKm,
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

function getComponentsForBike(bikeId: string): BikeComponent[] {
  const list = componentsByBike.value[bikeId] ?? []
  return list as BikeComponent[]
}

function setComponentsForBike(bikeId: string, components: BikeComponent[]): void {
  componentsByBike.value = { ...componentsByBike.value, [bikeId]: components }
  saveState({ apiKey: apiKey.value, componentsByBike: componentsByBike.value })
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

function setApiKey(key: string): void {
  apiKey.value = key
  saveState({ apiKey: key, componentsByBike: componentsByBike.value })
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

export function useTracker() {
  return {
    apiKey,
    athlete,
    loading,
    error,
    bikes,
    componentsByBike,
    getComponentsForBike,
    setComponentsForBike,
    addComponent,
    updateComponent,
    removeComponent,
    setApiKey,
    loadAthlete,
    bikeTotalKm,
    kmAtDate,
  }
}
