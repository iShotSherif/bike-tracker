<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Check, MapPin, RotateCcw, Settings } from 'lucide-vue-next'
import type { BikeVisualType, HotspotPosition, IntervalsBike } from '@/types'
import { useTracker } from '@/composables/useTracker'
import { todayISO } from '@/utils/date'
import { getComponentLabel, getComponentTranslationKey } from '@/utils/componentPresets'
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
  getBikeDisplayName,
  setBikeDisplayName,
} = useTracker()

const totalKm = computed(() => bikeTotalKm(props.bike))
const sourceName = computed(() => props.bike.name || t('bike.unnamed'))
const displayName = computed(() => getBikeDisplayName(props.bike.id, sourceName.value))
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
const placementComponentId = ref<string | null>(null)
const settingsOpen = ref(false)
const bikeNameDraft = ref(displayName.value)
const bikeVisualTypes: BikeVisualType[] = ['road', 'gravel', 'mtb']

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

const customComponents = computed(() =>
  components.value.filter((component) => !getComponentTranslationKey(component.name)),
)

const placementComponentName = computed(() => {
  const component = components.value.find((item) => item.id === placementComponentId.value)
  return component ? getComponentLabel(component.name, t) : ''
})

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

function toggleSettings() {
  settingsOpen.value = !settingsOpen.value
  if (settingsOpen.value) {
    bikeNameDraft.value = displayName.value
  }
}

function saveBikeName() {
  setBikeDisplayName(props.bike.id, bikeNameDraft.value)
  bikeNameDraft.value = displayName.value
}

function resetBikeName() {
  bikeNameDraft.value = ''
  setBikeDisplayName(props.bike.id, '')
}

function hasCustomHotspot(componentId: string) {
  return Boolean(hotspotPositions.value[componentId])
}

function handleRequestPlacement(componentId: string) {
  placementComponentId.value = componentId
}

function handleFinishPlacement() {
  placementComponentId.value = null
}
</script>

<template>
  <article class="bike-card">
    <header class="bike-header">
      <div class="bike-title">
        <h2 class="bike-name">{{ displayName }}</h2>
        <p class="bike-km">{{ totalKmLabel }}</p>
      </div>

      <button
        type="button"
        :class="['bike-settings-button', { active: settingsOpen }]"
        :aria-label="t('bike.settings.open')"
        :aria-expanded="settingsOpen"
        @click="toggleSettings"
      >
        <Settings :size="17" stroke-width="2.2" />
      </button>
    </header>

    <section v-if="settingsOpen" class="bike-settings">
      <div class="settings-row settings-row-name">
        <label class="settings-label" :for="`bike-name-${bike.id}`">{{ t('bike.settings.name') }}</label>
        <div class="name-controls">
          <input
            :id="`bike-name-${bike.id}`"
            v-model.trim="bikeNameDraft"
            class="settings-input"
            :placeholder="sourceName"
            @keydown.enter="saveBikeName"
          />
          <button type="button" class="settings-action primary" @click="saveBikeName">
            {{ t('common.save') }}
          </button>
          <button type="button" class="settings-action" @click="resetBikeName">
            {{ t('bike.settings.resetName') }}
          </button>
        </div>
      </div>

      <div class="settings-row">
        <span class="settings-label">{{ t('bikeVisual.visualType') }}</span>
        <div class="visual-tabs">
          <button
            v-for="visual in bikeVisualTypes"
            :key="visual"
            type="button"
            :class="['visual-tab', { active: selectedVisual === visual }]"
            @click="handleBikeVisualChange(visual)"
          >
            {{ t(`bikeVisual.visuals.${visual}`) }}
          </button>
        </div>
      </div>

      <div class="settings-row custom-row">
        <span class="settings-label">{{ t('bike.settings.customComponents') }}</span>
        <div v-if="customComponents.length" class="custom-components">
          <div
            v-for="component in customComponents"
            :key="component.id"
            :class="['custom-component', { active: placementComponentId === component.id }]"
          >
            <div class="custom-meta">
              <span class="custom-name">{{ component.name }}</span>
              <span :class="['custom-status', { placed: hasCustomHotspot(component.id) }]">
                <Check v-if="hasCustomHotspot(component.id)" :size="12" stroke-width="2.6" />
                {{ hasCustomHotspot(component.id) ? t('bike.settings.markerPlaced') : t('bike.settings.markerMissing') }}
              </span>
            </div>
            <div class="custom-actions">
              <button
                type="button"
                :class="['custom-icon-button', 'primary', { active: placementComponentId === component.id }]"
                :title="placementComponentId === component.id ? t('bike.settings.repositioning') : t('bike.settings.placeMarker')"
                :aria-label="placementComponentId === component.id ? t('bike.settings.repositioning') : t('bike.settings.placeMarker')"
                @click="handleRequestPlacement(component.id)"
              >
                <MapPin :size="16" stroke-width="2.25" />
              </button>
              <button
                v-if="hasCustomHotspot(component.id)"
                type="button"
                class="custom-icon-button"
                :title="t('bikeVisual.resetPosition')"
                :aria-label="t('bikeVisual.resetPosition')"
                @click="handleClearHotspot(component.id)"
              >
                <RotateCcw :size="15" stroke-width="2.25" />
              </button>
            </div>
          </div>
        </div>
        <p v-else class="settings-empty">{{ t('bike.settings.noCustomComponents') }}</p>
      </div>

      <div v-if="placementComponentId" class="placement-status">
        {{ t('bike.settings.placementActive', { component: placementComponentName }) }}
      </div>
    </section>

    <BikeVisual
      :zone-status="zoneStatus"
      :zone-alerts="zoneAlerts"
      :hotspot-alerts="hotspotAlerts"
      :components="components"
      :component-hotspots="componentHotspots"
      :bike-visual="selectedVisual"
      :placement-component-id="placementComponentId"
      @place-hotspot="handlePlaceHotspot"
      @clear-hotspot="handleClearHotspot"
      @focus-component="handleFocusComponent"
      @finish-placement="handleFinishPlacement"
    />

    <ComponentTracker
      ref="componentTrackerRef"
      :bike-id="bike.id"
      :bike-name="displayName"
      :total-km="totalKm"
      @request-placement="handleRequestPlacement"
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
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
  padding-bottom: 0.85rem;
  border-bottom: 1.5px solid var(--border-light);
}

.bike-title {
  min-width: 0;
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

.bike-settings-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.15rem;
  height: 2.15rem;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--muted);
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}

.bike-settings-button:hover,
.bike-settings-button.active {
  border-color: color-mix(in srgb, var(--accent) 45%, var(--border));
  color: var(--accent);
  background: var(--accent-light);
}

.bike-settings {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin: -0.15rem 0 1rem;
  padding: 0.85rem;
  border-radius: 8px;
  border: 1px solid var(--border-light);
  background: color-mix(in srgb, var(--bg) 64%, white);
}

.settings-row {
  display: grid;
  grid-template-columns: 7.5rem minmax(0, 1fr);
  gap: 0.75rem;
  align-items: center;
}

.settings-row-name {
  align-items: start;
}

.settings-label {
  color: var(--muted);
  font-size: 0.78rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.name-controls,
.custom-components {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  min-width: 0;
}

.settings-input {
  flex: 1 1 12rem;
  min-width: 0;
  height: 2.15rem;
  padding: 0.35rem 0.6rem;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  font: inherit;
  font-size: 0.86rem;
}

.settings-input:focus {
  outline: none;
  border-color: var(--accent);
}

.settings-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.3rem;
  min-height: 2.15rem;
  padding: 0.35rem 0.65rem;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  font: inherit;
  font-size: 0.8rem;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}

.settings-action:hover,
.settings-action.primary {
  border-color: color-mix(in srgb, var(--accent) 45%, var(--border));
  color: var(--accent);
  background: var(--accent-light);
}

.visual-tabs {
  display: inline-grid;
  grid-template-columns: repeat(3, minmax(4rem, 1fr));
  width: min(100%, 17rem);
  padding: 0.18rem;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--surface);
}

.visual-tab {
  min-height: 2rem;
  padding: 0.3rem 0.55rem;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--muted);
  font: inherit;
  font-size: 0.78rem;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}

.visual-tab.active {
  background: var(--accent);
  color: #fff;
}

.custom-row {
  align-items: start;
}

.custom-components {
  flex-direction: column;
  gap: 0.35rem;
}

.custom-component {
  display: flex;
  gap: 0.65rem;
  align-items: center;
  justify-content: space-between;
  min-width: 0;
  padding: 0.42rem 0.5rem 0.42rem 0.65rem;
  border-radius: 8px;
  border: 1px solid transparent;
  background: color-mix(in srgb, var(--surface) 82%, var(--bg));
  transition: background 0.15s ease, border-color 0.15s ease;
}

.custom-component.active {
  border-color: color-mix(in srgb, var(--accent) 32%, var(--border));
  background: var(--accent-light);
}

.custom-meta {
  display: grid;
  gap: 0.12rem;
  min-width: 0;
}

.custom-name {
  overflow: hidden;
  min-width: 0;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.86rem;
  font-weight: 700;
}

.custom-status {
  display: inline-flex;
  align-items: center;
  gap: 0.18rem;
  color: var(--muted);
  font-size: 0.72rem;
  font-weight: 700;
}

.custom-status.placed {
  color: var(--ok, #16a34a);
}

.custom-actions {
  display: flex;
  align-items: center;
  gap: 0.28rem;
  flex-shrink: 0;
}

.custom-icon-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--muted);
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}

.custom-icon-button:hover,
.custom-icon-button.active {
  border-color: color-mix(in srgb, var(--accent) 45%, var(--border));
  color: var(--accent);
  background: var(--surface);
}

.custom-icon-button.primary {
  color: var(--accent);
}

.settings-empty {
  margin: 0;
  color: var(--muted);
  font-size: 0.84rem;
}

.placement-status {
  padding: 0.45rem 0.6rem;
  border-radius: 8px;
  background: var(--accent-light);
  color: var(--accent);
  font-size: 0.8rem;
  font-weight: 700;
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

@media (max-width: 640px) {
  .settings-row {
    grid-template-columns: 1fr;
    gap: 0.35rem;
  }

  .visual-tabs,
  .settings-action {
    width: 100%;
  }

  .custom-component {
    padding: 0.5rem;
  }
}
</style>
