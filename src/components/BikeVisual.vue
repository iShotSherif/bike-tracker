<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { BikeComponent, BikeVisualType, HotspotPosition } from '@/types'
import type { BikeHotspot, BikeZone } from '@/utils/componentZones'
import type { ComponentStatus } from '@/utils/status'
import { getComponentLabel } from '@/utils/componentPresets'

const props = defineProps<{
  zoneStatus: Partial<Record<BikeZone, ComponentStatus>>
  zoneAlerts: Partial<Record<BikeZone, { status: ComponentStatus; label: string }>>
  hotspotAlerts: Partial<Record<BikeHotspot, { status: ComponentStatus; label: string }>>
  components: BikeComponent[]
  bikeVisual: BikeVisualType
  componentHotspots: Array<{
    componentId: string
    label: string
    status: ComponentStatus
    hotspotKey: BikeHotspot
    position?: HotspotPosition
  }>
}>()

const emit = defineEmits<{
  (e: 'place-hotspot', payload: { componentId: string; position: HotspotPosition }): void
  (e: 'clear-hotspot', componentId: string): void
  (e: 'focus-component', componentId: string): void
  (e: 'update:bike-visual', value: BikeVisualType): void
}>()

const { t } = useI18n({ useScope: 'global' })

const defaultHotspotMeta: Record<BikeHotspot, {
  key: BikeHotspot
  label: string
  topPct: number
  leftPct: number
}> = {
  wheels: { key: 'wheels', label: 'Pneu', topPct: 72, leftPct: 12 },
  chain: { key: 'chain', label: 'Chaine', topPct: 85, leftPct: 35 },
  cassette: { key: 'cassette', label: 'Cassette', topPct: 57, leftPct: 21 },
  chainring: { key: 'chainring', label: 'Plateau', topPct: 59, leftPct: 47 },
  brakes: { key: 'brakes', label: 'Freins', topPct: 60, leftPct: 76 },
  cockpit: { key: 'cockpit', label: 'Poste de pilotage', topPct: 18, leftPct: 78 },
  suspension: { key: 'suspension', label: 'Fourche', topPct: 44, leftPct: 71 },
  service: { key: 'service', label: 'Entretien', topPct: 32, leftPct: 52 },
}

const placingMode = ref(false)
const selectedComponentId = ref<string>('')

const selectedComponent = computed(() =>
  props.components.find((component) => component.id === selectedComponentId.value) ?? null,
)

const renderedHotspots = computed(() =>
  props.componentHotspots
    .filter((hotspot) => hotspot.status !== 'ok')
    .map((hotspot) => {
      const fallback = defaultHotspotMeta[hotspot.hotspotKey]
      const position = hotspot.position ?? {
        leftPct: fallback.leftPct,
        topPct: fallback.topPct,
      }

      return {
        ...hotspot,
        label: getComponentLabel(hotspot.label, t),
        position,
      }
    }),
)

function togglePlacingMode() {
  placingMode.value = !placingMode.value
  if (placingMode.value && !selectedComponentId.value && props.components.length) {
    selectedComponentId.value = props.components[0].id
  }
}

function handleStageClick(event: MouseEvent) {
  if (!placingMode.value || !selectedComponent.value) return

  const stage = event.currentTarget as HTMLDivElement | null
  if (!stage) return

  const rect = stage.getBoundingClientRect()
  const leftPct = ((event.clientX - rect.left) / rect.width) * 100
  const topPct = ((event.clientY - rect.top) / rect.height) * 100

  emit('place-hotspot', {
    componentId: selectedComponent.value.id,
    position: {
      leftPct: Math.max(0, Math.min(100, Number(leftPct.toFixed(2)))),
      topPct: Math.max(0, Math.min(100, Number(topPct.toFixed(2)))),
    },
  })
}

function handleHotspotClick(componentId: string) {
  if (placingMode.value) return
  emit('focus-component', componentId)
}

function bikeImageSrc(visual: BikeVisualType): string {
  if (visual === 'gravel') return '/images/bike-gravel.png'
  if (visual === 'mtb') return '/images/bike-mtb.png'
  return '/images/bike-studio.png'
}

function bikeImageAlt(visual: BikeVisualType): string {
  if (visual === 'gravel') return t('bikeVisual.altGravel')
  if (visual === 'mtb') return t('bikeVisual.altMtb')
  return t('bikeVisual.altRoad')
}
</script>

<template>
  <figure class="bike-visual">
    <div class="hero">
      <div class="hero-copy">
        <p class="eyebrow">{{ t('bikeVisual.eyebrow') }}</p>
        <h3 class="headline">{{ t('bikeVisual.headline') }}</h3>
        <p class="caption">{{ t('bikeVisual.caption') }}</p>
      </div>

      <div class="placement-bar">
        <select
          :value="props.bikeVisual"
          class="placement-select visual-select"
          @change="emit('update:bike-visual', ($event.target as HTMLSelectElement).value as BikeVisualType)"
        >
          <option value="road">{{ t('bikeVisual.visuals.road') }}</option>
          <option value="gravel">{{ t('bikeVisual.visuals.gravel') }}</option>
          <option value="mtb">{{ t('bikeVisual.visuals.mtb') }}</option>
        </select>

        <button type="button" class="placement-toggle" :class="{ active: placingMode }" @click="togglePlacingMode">
          {{ placingMode ? t('bikeVisual.finishPlacement') : t('bikeVisual.togglePlacement') }}
        </button>

        <select v-model="selectedComponentId" class="placement-select">
          <option disabled value="">{{ t('components.selectPlaceholder') }}</option>
          <option v-for="component in props.components" :key="component.id" :value="component.id">
            {{ getComponentLabel(component.name, t) }}
          </option>
        </select>

        <button
          type="button"
          class="placement-reset"
          :disabled="!selectedComponentId"
          @click="selectedComponentId && emit('clear-hotspot', selectedComponentId)"
        >
          {{ t('bikeVisual.resetPosition') }}
        </button>
      </div>

      <div class="image-stage" :class="{ placing: placingMode }" @click="handleStageClick">
        <img
          class="bike-image"
          :src="bikeImageSrc(props.bikeVisual)"
          :alt="bikeImageAlt(props.bikeVisual)"
        />

        <div v-if="placingMode" class="placement-hint">
          {{ t('bikeVisual.placementHint', { component: selectedComponent ? getComponentLabel(selectedComponent.name, t) : t('components.selectedPlaceholder') }) }}
        </div>

        <div
          v-for="hotspot in renderedHotspots"
          :key="hotspot.componentId"
          class="hotspot"
          :data-status="hotspot.status"
          :style="{ top: `${hotspot.position.topPct}%`, left: `${hotspot.position.leftPct}%` }"
          @click.stop="handleHotspotClick(hotspot.componentId)"
        >
          <span class="pulse"></span>
          <span class="label">{{ hotspot.label }}</span>
        </div>
      </div>
    </div>

    <figcaption class="legend">
      <span class="chip watch">{{ t('bikeVisual.legend.watch') }}</span>
      <span class="chip soon">{{ t('bikeVisual.legend.soon') }}</span>
      <span class="chip overdue">{{ t('bikeVisual.legend.overdue') }}</span>
    </figcaption>
  </figure>
</template>

<style scoped>
.bike-visual {
  margin: 0 0 1rem;
  padding: 1.1rem 1rem 0.8rem;
  border-radius: 18px;
  border: 1px solid color-mix(in srgb, var(--border) 70%, white);
  background:
    radial-gradient(circle at top left, rgba(255, 255, 255, 0.98), rgba(247, 245, 242, 0.82) 55%, rgba(253, 240, 235, 0.8)),
    linear-gradient(180deg, rgba(255, 255, 255, 0.7), rgba(255, 255, 255, 0.94));
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.8),
    0 18px 45px rgba(28, 25, 23, 0.06);
}

.hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0.9rem;
}

.hero-copy {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.eyebrow {
  margin: 0;
  font-size: 0.72rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--accent);
  font-weight: 700;
}

.headline {
  margin: 0;
  max-width: 28rem;
  font-size: 1rem;
  line-height: 1.2;
  letter-spacing: -0.02em;
}

.caption {
  margin: 0;
  color: var(--muted);
  font-size: 0.82rem;
  max-width: 34rem;
}

.placement-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem;
  align-items: center;
}

.placement-toggle,
.placement-reset,
.placement-select {
  border-radius: 999px;
  border: 1px solid var(--border);
  background: rgba(255, 255, 255, 0.82);
  color: var(--text);
  font: inherit;
}

.placement-toggle,
.placement-reset {
  padding: 0.42rem 0.8rem;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}

.placement-toggle.active {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}

.placement-reset:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.placement-select {
  min-width: 12rem;
  padding: 0.42rem 0.8rem;
}

.image-stage {
  position: relative;
  min-height: 16rem;
  border-radius: 16px;
  overflow: hidden;
  background: #f7f4ef;
  cursor: default;
}

.image-stage.placing {
  cursor: crosshair;
}

.bike-image {
  position: relative;
  z-index: 1;
  width: 100%;
  display: block;
  object-fit: contain;
  padding: 0;
  filter: drop-shadow(0 18px 22px rgba(40, 28, 20, 0.14));
}

.placement-hint {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  z-index: 3;
  padding: 0.45rem 0.7rem;
  border-radius: 12px;
  background: rgba(28, 25, 23, 0.76);
  color: #fff;
  font-size: 0.74rem;
  max-width: 14rem;
  line-height: 1.35;
  box-shadow: 0 12px 24px rgba(28, 25, 23, 0.16);
}

.hotspot {
  position: absolute;
  z-index: 2;
  transform: translate(-50%, -50%);
  pointer-events: auto;
  cursor: pointer;
}

.pulse {
  display: block;
  width: 22px;
  height: 22px;
  border-radius: 999px;
  border: 2px solid rgba(255, 255, 255, 0.9);
  background: rgba(255, 255, 255, 0.18);
  box-shadow: 0 0 0 0 rgba(255, 255, 255, 0.25);
  backdrop-filter: blur(4px);
}

.label {
  position: absolute;
  top: calc(100% + 0.35rem);
  left: 50%;
  transform: translateX(-50%);
  white-space: nowrap;
  padding: 0.2rem 0.45rem;
  border-radius: 999px;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: #fff;
  background: rgba(28, 25, 23, 0.76);
  box-shadow: 0 10px 18px rgba(28, 25, 23, 0.18);
}

.hotspot[data-status='ok'] {
  opacity: 0;
}

.hotspot[data-status='watch'] .pulse {
  background: color-mix(in srgb, var(--warning-light) 70%, white);
  box-shadow:
    0 0 0 10px color-mix(in srgb, var(--warning) 12%, transparent),
    0 0 34px color-mix(in srgb, var(--warning) 38%, transparent);
}

.hotspot[data-status='soon'] .pulse {
  background: var(--warning-light);
  box-shadow:
    0 0 0 12px color-mix(in srgb, var(--warning) 18%, transparent),
    0 0 40px color-mix(in srgb, var(--warning) 42%, transparent);
  animation: hotspot-pulse 2s ease-in-out infinite;
}

.hotspot[data-status='overdue'] .pulse {
  background: var(--danger-light);
  box-shadow:
    0 0 0 14px color-mix(in srgb, var(--danger) 18%, transparent),
    0 0 48px color-mix(in srgb, var(--danger) 42%, transparent);
  animation: hotspot-pulse 1.4s ease-in-out infinite;
}

.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-top: 0.4rem;
}

.chip {
  padding: 0.1rem 0.42rem;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--muted);
  font-size: 0.68rem;
  font-weight: 600;
}

.chip.watch {
  border-color: color-mix(in srgb, var(--warning) 60%, white);
  background: color-mix(in srgb, var(--warning-light) 70%, white);
  color: color-mix(in srgb, var(--warning) 85%, black);
}

.chip.soon {
  border-color: var(--warning);
  background: var(--warning-light);
  color: var(--warning);
}

.chip.overdue {
  border-color: var(--danger);
  background: var(--danger-light);
  color: var(--danger);
}

@keyframes zone-pulse {
  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: 0.72;
  }
}

@keyframes hotspot-pulse {
  0%,
  100% {
    transform: scale(1);
  }

  50% {
    transform: scale(1.08);
  }
}

@media (max-width: 640px) {
  .bike-visual {
    padding: 0.9rem 0.8rem 0.7rem;
  }

  .image-stage {
    min-height: 11.5rem;
  }

  .headline {
    font-size: 0.92rem;
  }

  .caption {
    font-size: 0.78rem;
  }

  .placement-bar {
    align-items: stretch;
  }

  .placement-toggle,
  .placement-reset,
  .placement-select {
    width: 100%;
  }

  .pulse {
    width: 18px;
    height: 18px;
  }
}
</style>
