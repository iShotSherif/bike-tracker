<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { BikeComponent } from '@/types'
import { useTracker } from '@/composables/useTracker'
import { formatSince, todayISO } from '@/utils/date'
import { componentStatus, daysUntilAlert, kmSinceStart, progressPct } from '@/utils/status'
import { COMPONENT_PRESETS, findComponentPreset, getComponentLabel } from '@/utils/componentPresets'

const props = defineProps<{ bikeId: string; bikeName: string; totalKm: number }>()

const { t, locale } = useI18n({ useScope: 'global' })
const {
  getComponentsForBike,
  addComponent,
  updateComponent,
  removeComponent,
  kmAtDate,
  getLogForComponent,
  markComponentDone,
} = useTracker()

const showForm = ref(false)
const newName = ref('')
const newPresetName = ref('')
const newMode = ref<'km' | 'days' | 'both'>('km')
const newIntervalKm = ref(1000)
const newIntervalDays = ref(365)
const newDateStarted = ref('')
const newKmAtStart = ref<number | ''>('')

watch(newDateStarted, (date) => {
  if (date) newKmAtStart.value = Math.floor(kmAtDate(props.bikeId, date))
})

function formatNumber(value: number): string {
  return value.toLocaleString(locale.value)
}

function componentLabel(name: string): string {
  return getComponentLabel(name, t)
}

function dayCountLabel(value: number): string {
  return value === 1
    ? t('units.daySingle')
    : t('units.dayMultiple', { count: value })
}

function openForm() {
  newPresetName.value = COMPONENT_PRESETS[0]?.name ?? ''
  applyPresetToNewForm(newPresetName.value)
  newDateStarted.value = todayISO()
  newKmAtStart.value = Math.floor(kmAtDate(props.bikeId, todayISO()))
  showForm.value = true
}

function applyPresetToNewForm(presetName: string) {
  const preset = findComponentPreset(presetName)

  if (!preset) {
    newName.value = ''
    newMode.value = 'km'
    newIntervalKm.value = 1000
    newIntervalDays.value = 365
    return
  }

  newName.value = preset.name
  newIntervalKm.value = preset.intervalKm ?? 1000
  newIntervalDays.value = preset.intervalDays ?? 365
  newMode.value = preset.intervalKm && preset.intervalDays
    ? 'both'
    : preset.intervalDays
      ? 'days'
      : 'km'
}

function saveNew() {
  const name = newName.value.trim()
  const hasKm = newMode.value !== 'days' && newIntervalKm.value > 0
  const hasDays = newMode.value !== 'km' && newIntervalDays.value > 0

  if (!name || (!hasKm && !hasDays) || !newDateStarted.value || newKmAtStart.value === '') return

  addComponent(props.bikeId, {
    name,
    intervalKm: hasKm ? newIntervalKm.value : undefined,
    intervalDays: hasDays ? newIntervalDays.value : undefined,
    dateStarted: newDateStarted.value,
    kmAtStart: Number(newKmAtStart.value),
  })

  showForm.value = false
}

const editingId = ref<string | null>(null)
const editName = ref('')
const editMode = ref<'km' | 'days' | 'both'>('km')
const editIntervalKm = ref(1000)
const editIntervalDays = ref(365)
const editDateStarted = ref('')
const editKmAtStart = ref<number | ''>('')

function openEdit(component: BikeComponent) {
  editingId.value = component.id
  editName.value = component.name
  editMode.value = component.intervalKm && component.intervalDays ? 'both' : component.intervalDays ? 'days' : 'km'
  editIntervalKm.value = component.intervalKm ?? 1000
  editIntervalDays.value = component.intervalDays ?? 365
  editDateStarted.value = component.dateStarted
  editKmAtStart.value = component.kmAtStart
}

function saveEdit(component: BikeComponent) {
  const name = editName.value.trim()
  const hasKm = editMode.value !== 'days' && editIntervalKm.value > 0
  const hasDays = editMode.value !== 'km' && editIntervalDays.value > 0

  if (!name || (!hasKm && !hasDays) || !editDateStarted.value || editKmAtStart.value === '') return

  updateComponent(props.bikeId, component.id, {
    name,
    intervalKm: hasKm ? editIntervalKm.value : undefined,
    intervalDays: hasDays ? editIntervalDays.value : undefined,
    dateStarted: editDateStarted.value,
    kmAtStart: Number(editKmAtStart.value),
  })

  editingId.value = null
}

const pendingDoneId = ref<string | null>(null)
const pendingNotes = ref('')
const currentKmFromActivities = computed(() => kmAtDate(props.bikeId, todayISO()))
const openHistoryId = ref<string | null>(null)

function confirmDone(component: BikeComponent) {
  markComponentDone(props.bikeId, component.id, currentKmFromActivities.value, pendingNotes.value.trim() || undefined)
  pendingDoneId.value = null
  pendingNotes.value = ''
}

function toggleHistory(id: string) {
  openHistoryId.value = openHistoryId.value === id ? null : id
}

function kmStartFor(component: BikeComponent): number {
  return kmAtDate(props.bikeId, component.dateStarted)
}

function status(component: BikeComponent) {
  return componentStatus(component, currentKmFromActivities.value, kmStartFor(component))
}

function kmLeft(component: BikeComponent): number {
  if (!component.intervalKm) return 0
  return Math.max(0, component.intervalKm - kmSinceStart(component, currentKmFromActivities.value, kmStartFor(component)))
}

function daysLeft(component: BikeComponent): number | null {
  return daysUntilAlert(component)
}

function intervalLabel(component: BikeComponent): string {
  const parts: string[] = []
  if (component.intervalKm) parts.push(`${formatNumber(component.intervalKm)} km`)
  if (component.intervalDays) parts.push(dayCountLabel(component.intervalDays))
  return t('tracker.intervalLabel', { parts: parts.join(' / ') })
}

function statusText(component: BikeComponent): string {
  const componentStatus = status(component)
  const parts: string[] = []

  if (component.intervalKm) {
    const used = Math.floor(kmSinceStart(component, currentKmFromActivities.value, kmStartFor(component)))
    const left = Math.floor(kmLeft(component))

    if (componentStatus === 'overdue' && used >= component.intervalKm) {
      parts.push(t('tracker.serviceNow', { used: formatNumber(used) }))
    } else {
      parts.push(t('tracker.kmRemaining', {
        left: formatNumber(left),
        used: formatNumber(used),
        interval: formatNumber(component.intervalKm),
      }))
    }
  }

  if (component.intervalDays) {
    const left = daysLeft(component) ?? 0

    if (left <= 0) {
      const overdue = Math.abs(left)
      parts.push(overdue === 1
        ? t('tracker.daysOverdueSingle')
        : t('tracker.daysOverdueMultiple', { count: overdue }))
    } else {
      parts.push(left === 1
        ? t('tracker.daysRemainingSingle')
        : t('tracker.daysRemainingMultiple', { count: left }))
    }
  }

  return parts.join(' - ')
}

function pct(component: BikeComponent): number {
  return progressPct(component, currentKmFromActivities.value, kmStartFor(component))
}

function sinceText(component: BikeComponent): string {
  return formatSince(component.dateStarted, locale.value)
}

const STATUS_ORDER: Record<'overdue' | 'soon' | 'watch' | 'ok', number> = { overdue: 0, soon: 1, watch: 2, ok: 3 }

const components = computed(() => {
  const list = getComponentsForBike(props.bikeId)

  return [...list].sort((left, right) => {
    const leftStatus = STATUS_ORDER[status(left)]
    const rightStatus = STATUS_ORDER[status(right)]
    if (leftStatus !== rightStatus) return leftStatus - rightStatus
    return (kmLeft(left) || 0) - (kmLeft(right) || 0)
  })
})

watch(newPresetName, (presetName) => {
  if (presetName) applyPresetToNewForm(presetName)
})

function focusComponent(componentId: string) {
  const row = document.getElementById(`component-${componentId}`)
  if (!row) return

  row.scrollIntoView({ behavior: 'smooth', block: 'center' })
  row.classList.remove('component-row-focus')

  window.requestAnimationFrame(() => {
    row.classList.add('component-row-focus')
    window.setTimeout(() => row.classList.remove('component-row-focus'), 1800)
  })
}

defineExpose({
  focusComponent,
})
</script>

<template>
  <div class="component-tracker">
    <div class="component-list">
      <div
        v-for="component in components"
        :id="`component-${component.id}`"
        :key="component.id"
        class="component-row"
        :data-status="status(component)"
        :style="{ '--pct': pct(component) }"
      >
        <template v-if="editingId === component.id">
          <div class="inline-form">
            <input v-model.trim="editName" :placeholder="t('tracker.componentNamePlaceholder')" class="input" />

            <div class="mode-toggle">
              <button :class="['btn-mode', { active: editMode === 'km' }]" @click="editMode = 'km'">{{ t('tracker.mode.km') }}</button>
              <button :class="['btn-mode', { active: editMode === 'days' }]" @click="editMode = 'days'">{{ t('tracker.mode.days') }}</button>
              <button :class="['btn-mode', { active: editMode === 'both' }]" @click="editMode = 'both'">{{ t('tracker.mode.both') }}</button>
            </div>

            <input
              v-if="editMode !== 'days'"
              v-model.number="editIntervalKm"
              type="number"
              min="1"
              :placeholder="t('tracker.placeholders.kmInterval')"
              class="input input-narrow"
            />

            <input
              v-if="editMode !== 'km'"
              v-model.number="editIntervalDays"
              type="number"
              min="1"
              :placeholder="t('tracker.placeholders.daysInterval')"
              class="input input-narrow"
              :title="t('tracker.titles.daysHelp')"
            />

            <input v-model="editDateStarted" type="date" class="input input-date" />

            <input
              v-model.number="editKmAtStart"
              type="number"
              min="0"
              :placeholder="t('tracker.placeholders.startKm')"
              class="input input-narrow"
            />

            <button type="button" class="btn btn-primary" @click="saveEdit(component)">{{ t('common.save') }}</button>
            <button type="button" class="btn" @click="editingId = null">{{ t('common.cancel') }}</button>
          </div>
        </template>

        <template v-else>
          <div class="component-info">
            <span class="component-name">{{ componentLabel(component.name) }}</span>
            <span class="component-interval">{{ intervalLabel(component) }}</span>
            <span class="component-since">{{ t('tracker.started', { time: sinceText(component) }) }}</span>
          </div>

          <div class="component-km">
            <span :class="`status-${status(component)}`">{{ statusText(component) }}</span>
          </div>

          <div class="component-actions">
            <button
              type="button"
              class="btn-mark"
              :title="t('tracker.titles.markDone')"
              @click="pendingDoneId = component.id; pendingNotes = ''"
            >
              {{ t('alerts.markDoneToday') }}
            </button>

            <button type="button" class="btn-edit" :title="t('tracker.titles.edit')" @click="openEdit(component)">✎</button>
            <button type="button" class="btn-remove" :title="t('tracker.titles.remove')" @click="removeComponent(props.bikeId, component.id)">×</button>
          </div>

          <div class="component-progress">
            <div class="progress-fill" :data-status="status(component)" :style="{ width: `${pct(component)}%` }"></div>
          </div>

          <div v-if="pendingDoneId === component.id" class="done-bar">
            <input
              v-model="pendingNotes"
              class="input done-notes"
              :placeholder="t('tracker.placeholders.notes')"
              autofocus
              @keydown.enter="confirmDone(component)"
              @keydown.escape="pendingDoneId = null"
            />
            <button type="button" class="btn btn-primary" @click="confirmDone(component)">{{ t('common.confirm') }}</button>
            <button type="button" class="btn" @click="pendingDoneId = null">{{ t('common.cancel') }}</button>
          </div>

          <div class="component-history">
            <button type="button" class="btn-history" @click="toggleHistory(component.id)">
              {{ t('tracker.actions.history') }} ({{ getLogForComponent(component.id).length }})
              {{ openHistoryId === component.id ? '▴' : '▾' }}
            </button>

            <div v-if="openHistoryId === component.id" class="history-list">
              <p v-if="!getLogForComponent(component.id).length" class="history-empty">{{ t('tracker.historyEmpty') }}</p>

              <div
                v-for="entry in getLogForComponent(component.id).slice(0, 10)"
                :key="entry.id"
                class="history-entry"
              >
                <span class="history-date">{{ entry.date }}</span>
                <span class="history-km">{{ entry.kmAtService.toLocaleString(locale) }} km</span>
                <span v-if="entry.notes" class="history-notes">{{ entry.notes }}</span>
              </div>
            </div>
          </div>
        </template>
      </div>
    </div>

    <div v-if="showForm" class="inline-form">
      <select v-model="newPresetName" class="input preset-select">
        <option v-for="preset in COMPONENT_PRESETS" :key="preset.name" :value="preset.name">
          {{ componentLabel(preset.name) }}
        </option>
      </select>

      <input :value="componentLabel(newName)" readonly class="input input-disabled" />

      <div class="mode-toggle">
        <button :class="['btn-mode', { active: newMode === 'km' }]" @click="newMode = 'km'">{{ t('tracker.mode.km') }}</button>
        <button :class="['btn-mode', { active: newMode === 'days' }]" @click="newMode = 'days'">{{ t('tracker.mode.days') }}</button>
        <button :class="['btn-mode', { active: newMode === 'both' }]" @click="newMode = 'both'">{{ t('tracker.mode.both') }}</button>
      </div>

      <input
        v-if="newMode !== 'days'"
        v-model.number="newIntervalKm"
        type="number"
        min="1"
        :placeholder="t('tracker.placeholders.kmInterval')"
        class="input input-narrow"
      />

      <input
        v-if="newMode !== 'km'"
        v-model.number="newIntervalDays"
        type="number"
        min="1"
        :placeholder="t('tracker.placeholders.daysInterval')"
        class="input input-narrow"
        :title="t('tracker.titles.daysHelp')"
      />

      <input v-model="newDateStarted" type="date" class="input input-date" />

      <input
        :value="newKmAtStart"
        type="number"
        disabled
        :placeholder="t('tracker.placeholders.startKm')"
        class="input input-narrow input-disabled"
        :title="t('tracker.titles.startKmHelp')"
      />

      <button type="button" class="btn btn-primary" @click="saveNew">{{ t('tracker.actions.add') }}</button>
      <button type="button" class="btn" @click="showForm = false">{{ t('common.cancel') }}</button>
    </div>

    <button v-else type="button" class="btn btn-add" @click="openForm">{{ t('tracker.actions.addComponent') }}</button>
  </div>
</template>

<style scoped>
.component-tracker {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.component-list {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.component-row {
  display: grid;
  grid-template-columns: 1fr auto auto;
  grid-template-rows: auto auto auto auto;
  align-items: center;
  gap: 0.45rem 0.75rem;
  padding: 0.65rem 0.85rem 0.55rem;
  border-radius: var(--radius-sm);
  border: 1.5px solid var(--border-light);
  border-left: 3px solid var(--border);
  transition: border-color 0.4s ease, background 0.4s ease;
  background:
    linear-gradient(
      to right,
      color-mix(in srgb, #f97316 calc(var(--pct, 0) * 0.12%), transparent),
      transparent 60%
    ),
    var(--surface);
}

.component-row[data-status='soon'] {
  border-left-color: var(--warning);
  background:
    linear-gradient(
      to right,
      color-mix(in srgb, #d97706 calc(var(--pct, 0) * 0.14%), transparent),
      transparent 60%
    ),
    #fffcf5;
}

.component-row[data-status='overdue'] {
  border-left-color: var(--danger);
  background:
    linear-gradient(
      to right,
      color-mix(in srgb, #dc2626 calc(var(--pct, 0) * 0.13%), transparent),
      transparent 60%
    ),
    #fff8f8;
}

.component-row-focus {
  animation: component-row-flash 1.8s ease-out;
}

.component-info {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.component-name {
  font-weight: 600;
  font-size: 0.93rem;
}

.component-interval {
  font-size: 0.76rem;
  color: var(--muted);
}

.component-since {
  font-size: 0.72rem;
  color: var(--muted);
}

.component-km {
  display: flex;
  align-items: center;
  font-family: var(--font-mono);
  font-size: 0.82rem;
}

.status-ok {
  color: var(--muted);
}

.status-soon {
  color: var(--warning);
  font-weight: 600;
}

.status-overdue {
  color: var(--danger);
  font-weight: 600;
}

.component-actions {
  display: flex;
  gap: 0.3rem;
}

.btn-mark {
  padding: 0.2rem 0.55rem;
  font-size: 0.78rem;
  font-family: inherit;
  font-weight: 600;
  border-radius: 5px;
  border: 1.5px solid var(--accent);
  background: var(--accent-light);
  color: var(--accent);
  cursor: pointer;
  transition: background 0.12s;
}

.btn-mark:hover {
  background: var(--accent);
  color: #fff;
}

.btn-edit {
  padding: 0.2rem 0.45rem;
  font-size: 0.85rem;
  border: none;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  border-radius: 4px;
  transition: color 0.12s;
}

.btn-edit:hover {
  color: var(--accent);
  background: var(--accent-light);
}

.btn-remove {
  padding: 0.2rem 0.45rem;
  font-size: 1rem;
  line-height: 1;
  border: none;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  border-radius: 4px;
}

.btn-remove:hover {
  color: var(--danger);
  background: var(--danger-light);
}

.component-progress {
  grid-column: 1 / -1;
  height: 5px;
  background: var(--border);
  border-radius: 99px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  border-radius: 99px;
  background: linear-gradient(
    to right,
    #22c55e 0%,
    #84cc16 30%,
    #eab308 58%,
    #f97316 78%,
    #ef4444 92%,
    #b91c1c 100%
  );
  background-size: calc(100% / (var(--pct, 1) / 100)) 100%;
  transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
}

.done-bar {
  grid-column: 1 / -1;
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
  padding-top: 0.2rem;
}

.done-notes {
  flex: 1;
  min-width: 8rem;
}

.component-history {
  grid-column: 1 / -1;
}

.btn-history {
  background: none;
  border: none;
  color: var(--muted);
  font-size: 0.75rem;
  cursor: pointer;
  padding: 0;
  transition: color 0.12s;
}

.btn-history:hover {
  color: var(--accent);
}

.history-list {
  margin-top: 0.4rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.history-entry {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  font-size: 0.78rem;
  color: var(--muted);
  font-family: var(--font-mono);
  padding: 0.2rem 0;
  border-bottom: 1px solid var(--border-light);
}

.history-entry:last-child {
  border-bottom: none;
}

.history-date {
  color: var(--text);
  font-weight: 500;
}

.history-notes {
  font-family: inherit;
  font-style: italic;
  color: var(--muted);
}

.history-empty {
  font-size: 0.78rem;
  color: var(--muted);
  margin: 0.25rem 0 0;
}

.inline-form {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0;
}

.mode-toggle {
  display: flex;
  gap: 0.2rem;
}

.btn-mode {
  padding: 0.25rem 0.55rem;
  font-size: 0.78rem;
  font-weight: 600;
  border-radius: 5px;
  border: 1.5px solid var(--border);
  background: var(--surface);
  color: var(--muted);
  cursor: pointer;
  font-family: inherit;
  transition: all 0.12s;
}

.btn-mode.active {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}

.input {
  padding: 0.4rem 0.65rem;
  border: 1.5px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface);
  color: var(--text);
  font-size: 0.88rem;
  transition: border-color 0.15s;
}

.input:focus {
  outline: none;
  border-color: var(--accent);
}

.input-narrow {
  width: 5.5rem;
}

.input-date {
  width: 8rem;
}

.input-disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background: var(--bg);
}

.btn {
  padding: 0.38rem 0.8rem;
  border-radius: var(--radius-sm);
  border: 1.5px solid var(--border);
  background: var(--surface);
  color: var(--text);
  cursor: pointer;
  font-size: 0.88rem;
  font-weight: 500;
  font-family: inherit;
  transition: background 0.12s;
}

.btn:hover {
  background: var(--bg);
  border-color: var(--muted);
}

.btn-primary {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
  font-weight: 600;
}

.btn-primary:hover {
  background: var(--accent-hover);
  border-color: var(--accent-hover);
}

.btn-add {
  border-style: dashed;
  color: var(--muted);
  background: transparent;
  width: 100%;
  text-align: center;
  padding: 0.5rem;
  margin-top: 0.1rem;
}

.btn-add:hover {
  color: var(--accent);
  border-color: var(--accent);
  background: var(--accent-light);
}

@keyframes component-row-flash {
  0% {
    box-shadow: 0 0 0 0 color-mix(in srgb, var(--accent) 26%, transparent);
    transform: translateY(0);
  }

  20% {
    box-shadow: 0 0 0 5px color-mix(in srgb, var(--accent) 22%, transparent);
    transform: translateY(-1px);
  }

  100% {
    box-shadow: 0 0 0 0 transparent;
    transform: translateY(0);
  }
}
</style>
