<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { BikeVisualType, HotspotPosition, IntervalsBike } from '@/types'
import { useTracker } from '@/composables/useTracker'
import { todayISO } from '@/utils/date'
import { componentStatus, type ComponentStatus } from '@/utils/status'
import {
  getPresetHotspotPosition,
  inferHotspotsForComponent,
  inferZonesForComponent,
  mergeZoneStatus,
  type BikeHotspot,
  type BikeZone,
} from '@/utils/componentZones'
import BikeVisual from './BikeVisual.vue'
import ComponentTracker from './ComponentTracker.vue'

const props = defineProps<{ bike: IntervalsBike }>()

const { t, locale } = useI18n({ useScope: 'global' })
const {
  bikeTotalKm,
  getComponentsForBike,
  kmAtDate,
  getHotspotPositionsForBike,
  setHotspotPosition,
  clearHotspotPosition,
  getBikeVisual,
  setBikeVisual,
} = useTracker()

const totalKm = computed(() => bikeTotalKm(props.bike))
const displayName = computed(() => props.bike.name || t('bike.unnamed'))
const totalKmLabel = computed(() =>
  t('bike.totalKm', {
    count: totalKm.value.toLocaleString(locale.value, { maximumFractionDigits: 0 }),
  }),
)
const currentKm = computed(() => kmAtDate(props.bike.id, todayISO()))
const components = computed(() => getComponentsForBike(props.bike.id))
const STATUS_RANK: Record<ComponentStatus, number> = { ok: 0, watch: 1, soon: 2, overdue: 3 }
const selectedVisual = computed({
  get: () => getBikeVisual(props.bike.id),
  set: (value: BikeVisualType) => setBikeVisual(props.bike.id, value),
})
const hotspotPositions = computed(() => getHotspotPositionsForBike(props.bike.id, selectedVisual.value))
const componentTrackerRef = ref<InstanceType<typeof ComponentTracker> | null>(null)

const zoneStatus = computed<Partial<Record<BikeZone, ComponentStatus>>>(() => {
  const merged: Partial<Record<BikeZone, ComponentStatus>> = {}

  for (const component of components.value) {
    const kmStart = kmAtDate(props.bike.id, component.dateStarted)
    const status = componentStatus(component, currentKm.value, kmStart)

    for (const zone of inferZonesForComponent(component.name)) {
      merged[zone] = mergeZoneStatus(merged[zone], status)
    }
  }

  return merged
})

const zoneAlerts = computed<Partial<Record<BikeZone, { status: ComponentStatus; label: string }>>>(() => {
  const merged: Partial<Record<BikeZone, { status: ComponentStatus; label: string }>> = {}

  for (const component of components.value) {
    const kmStart = kmAtDate(props.bike.id, component.dateStarted)
    const status = componentStatus(component, currentKm.value, kmStart)

    for (const zone of inferZonesForComponent(component.name)) {
      const current = merged[zone]
      if (!current || STATUS_RANK[status] > STATUS_RANK[current.status]) {
        merged[zone] = { status, label: component.name }
      }
    }
  }

  return merged
})

const hotspotAlerts = computed<Partial<Record<BikeHotspot, { status: ComponentStatus; label: string }>>>(() => {
  const merged: Partial<Record<BikeHotspot, { status: ComponentStatus; label: string }>> = {}

  for (const component of components.value) {
    const kmStart = kmAtDate(props.bike.id, component.dateStarted)
    const status = componentStatus(component, currentKm.value, kmStart)

    for (const hotspot of inferHotspotsForComponent(component.name)) {
      const current = merged[hotspot]
      if (!current || STATUS_RANK[status] > STATUS_RANK[current.status]) {
        merged[hotspot] = { status, label: component.name }
      }
    }
  }

  return merged
})

const componentHotspots = computed(() =>
  components.value.map((component) => {
    const kmStart = kmAtDate(props.bike.id, component.dateStarted)
    const status = componentStatus(component, currentKm.value, kmStart)
    const hotspotKey = inferHotspotsForComponent(component.name)[0]

    return {
      componentId: component.id,
      label: component.name,
      status,
      hotspotKey,
      position: (hotspotPositions.value[component.id] as HotspotPosition | undefined)
        ?? getPresetHotspotPosition(selectedVisual.value, component.name),
    }
  }),
)

function handlePlaceHotspot(payload: { componentId: string; position: HotspotPosition }) {
  setHotspotPosition(props.bike.id, selectedVisual.value, payload.componentId, payload.position)
}

function handleClearHotspot(componentId: string) {
  clearHotspotPosition(props.bike.id, selectedVisual.value, componentId)
}

function handleFocusComponent(componentId: string) {
  componentTrackerRef.value?.focusComponent(componentId)
}

function handleBikeVisualChange(value: BikeVisualType) {
  selectedVisual.value = value
}
</script>

<template>
  <article class="bike-card">
    <header class="bike-header">
      <h2 class="bike-name">{{ displayName }}</h2>
      <p class="bike-km">{{ totalKmLabel }}</p>
    </header>

    <BikeVisual
      :zone-status="zoneStatus"
      :zone-alerts="zoneAlerts"
      :hotspot-alerts="hotspotAlerts"
      :components="components"
      :component-hotspots="componentHotspots"
      :bike-visual="selectedVisual"
      @place-hotspot="handlePlaceHotspot"
      @clear-hotspot="handleClearHotspot"
      @focus-component="handleFocusComponent"
      @update:bike-visual="handleBikeVisualChange"
    />

    <ComponentTracker
      ref="componentTrackerRef"
      :bike-id="bike.id"
      :bike-name="displayName"
      :total-km="totalKm"
    />
  </article>
</template>

<style scoped>
.bike-card {
  background: var(--card);
  border-radius: var(--radius);
  padding: 1.25rem 1.5rem 1.5rem;
  border: 1.5px solid var(--border);
  box-shadow: var(--shadow-sm);
  transition: box-shadow 0.2s;
}

.bike-card:hover {
  box-shadow: var(--shadow);
}

.bike-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
  padding-bottom: 0.85rem;
  border-bottom: 1.5px solid var(--border-light);
}

.bike-name {
  font-size: 1.15rem;
  font-weight: 700;
  margin: 0;
  letter-spacing: -0.01em;
}

.bike-km {
  font-family: var(--font-mono);
  font-size: 0.85rem;
  color: var(--muted);
  margin: 0;
  white-space: nowrap;
  background: var(--bg);
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  border: 1px solid var(--border);
}

@keyframes highlight-flash {
  0% {
    box-shadow: 0 0 0 3px var(--warning);
  }

  100% {
    box-shadow: var(--shadow-sm);
  }
}

.bike-card.highlight {
  animation: highlight-flash 1.8s ease-out forwards;
}
</style>
