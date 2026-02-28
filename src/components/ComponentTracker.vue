<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { BikeComponent } from '@/types'
import { useTracker } from '@/composables/useTracker'
import { formatSince, todayISO } from '@/utils/date'

const props = defineProps<{ bikeId: string; bikeName: string; totalKm: number }>()

const { getComponentsForBike, addComponent, updateComponent, removeComponent, kmAtDate } = useTracker()

const showForm = ref(false)
const newName = ref('')
const newIntervalKm = ref(1000)
const newDateStarted = ref<string>('')
const newKmAtStart = ref<number | ''>('')

const STATUS_ORDER: Record<'overdue' | 'soon' | 'ok', number> = { overdue: 0, soon: 1, ok: 2 }

// Current km from activities — same data source as kmAtStart, so the delta is always correct
const currentKmFromActivities = computed(() => kmAtDate(props.bikeId, todayISO()))

// When date changes, automatically calculate km from that date
watch(newDateStarted, (date) => {
  if (date) {
    newKmAtStart.value = Math.floor(kmAtDate(props.bikeId, date))
  }
})

function openForm() {
  newName.value = ''
  newIntervalKm.value = 1000
  newDateStarted.value = todayISO()
  newKmAtStart.value = Math.floor(kmAtDate(props.bikeId, todayISO()))
  showForm.value = true
}

function saveNew() {
  const name = newName.value.trim()
  if (!name || newIntervalKm.value <= 0 || !newDateStarted.value || newKmAtStart.value === '') return
  addComponent(props.bikeId, {
    name,
    intervalKm: newIntervalKm.value,
    dateStarted: newDateStarted.value,
    kmAtStart: Number(newKmAtStart.value),
  })
  newName.value = ''
  showForm.value = false
}

function kmSinceStart(c: BikeComponent): number {
  return Math.max(0, currentKmFromActivities.value - c.kmAtStart)
}

function kmUntilAlert(c: BikeComponent): number {
  const used = kmSinceStart(c)
  return Math.max(0, c.intervalKm - used)
}

function status(c: BikeComponent): 'ok' | 'soon' | 'overdue' {
  const until = kmUntilAlert(c)
  if (until <= 0) return 'overdue'
  if (until <= c.intervalKm * 0.15) return 'soon'
  return 'ok'
}

function markDone(c: BikeComponent) {
  updateComponent(props.bikeId, c.id, {
    dateStarted: todayISO(),
    kmAtStart: currentKmFromActivities.value,
  })
}

function progressPct(c: BikeComponent): number {
  if (c.intervalKm <= 0) return 0
  return Math.min(100, (kmSinceStart(c) / c.intervalKm) * 100)
}

function sinceText(c: BikeComponent): string {
  return formatSince(c.dateStarted)
}

const components = computed(() => {
  const list = getComponentsForBike(props.bikeId)
  return [...list].sort((a, b) => {
    const sa = STATUS_ORDER[status(a)]
    const sb = STATUS_ORDER[status(b)]
    if (sa !== sb) return sa - sb
    return kmUntilAlert(a) - kmUntilAlert(b)
  })
})
</script>

<template>
  <div class="component-tracker">
    <div class="component-list">
      <div
        v-for="c in components"
        :key="c.id"
        class="component-row"
        :data-status="status(c)"
      >
        <div class="component-info">
          <span class="component-name">{{ c.name }}</span>
          <span class="component-interval">Alert in {{ c.intervalKm.toLocaleString() }} km</span>
          <span class="component-since">Started {{ sinceText(c) }}</span>
        </div>
        <div class="component-km">
          <div v-if="status(c) === 'overdue'" class="status-overdue">
            {{ kmSinceStart(c).toFixed(0) }} km done — Service now!
          </div>
          <div v-else-if="status(c) === 'soon'" class="status-soon">
            {{ kmUntilAlert(c).toFixed(0) }} km left ({{ kmSinceStart(c).toFixed(0) }}/{{ c.intervalKm }} km used)
          </div>
          <div v-else class="status-ok">
            {{ kmUntilAlert(c).toFixed(0) }} km left ({{ kmSinceStart(c).toFixed(0) }}/{{ c.intervalKm }} km used)
          </div>
        </div>
        <div class="component-actions">
          <button type="button" class="btn-mark" @click="markDone(c)" title="Mark as done and reset">
            Done
          </button>
          <button type="button" class="btn-remove" @click="removeComponent(props.bikeId, c.id)" title="Remove">
            ×
          </button>
        </div>
        <div class="component-progress">
          <div class="progress-fill" :data-status="status(c)" :style="{ width: progressPct(c) + '%' }"></div>
        </div>
      </div>
    </div>

    <div v-if="showForm" class="add-form">
      <input v-model.trim="newName" placeholder="Component name (e.g. Chain wax)" class="input" />
      <input v-model.number="newIntervalKm" type="number" min="1" placeholder="Km until alert" class="input input-narrow" />
      <input v-model="newDateStarted" type="date" class="input input-date" title="Start date (Auto-calculates km)" />
      <input :value="newKmAtStart" type="number" disabled placeholder="Km at start" class="input input-narrow input-disabled" title="Auto-calculated from activity history" />
      <button type="button" class="btn btn-primary" @click="saveNew">Add</button>
      <button type="button" class="btn" @click="showForm = false">Cancel</button>
    </div>
    <button v-else type="button" class="btn btn-add" @click="openForm">+ Add component</button>
  </div>
</template>

<style scoped>
.component-tracker {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.component-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.component-row {
  display: grid;
  grid-template-columns: 1fr auto auto;
  grid-template-rows: auto auto;
  align-items: center;
  gap: 0.75rem 0.75rem;
  padding: 0.5rem 0.75rem 0.6rem;
  background: var(--surface);
  border-radius: 8px;
  border-left: 3px solid var(--border);
}
.component-row[data-status="soon"] { border-left-color: var(--warning); }
.component-row[data-status="overdue"] { border-left-color: var(--danger); }
.component-info { display: flex; flex-direction: column; gap: 0.2rem; }
.component-name { font-weight: 600; font-size: 0.95rem; }
.component-interval { font-size: 0.8rem; color: var(--muted); }
.component-since { font-size: 0.75rem; color: var(--muted); }
.component-km { display: flex; flex-direction: column; align-items: flex-end; gap: 0.25rem; font-family: var(--font-mono); font-size: 0.9rem; }
.status-ok { color: var(--muted); font-weight: 500; }
.status-soon { color: var(--warning); font-weight: 600; }
.status-overdue { color: var(--danger); font-weight: 600; }
.component-actions { display: flex; gap: 0.35rem; }
.btn-mark { padding: 0.25rem 0.5rem; font-size: 0.8rem; font-family: inherit; border-radius: 4px; border: 1px solid var(--border); background: var(--bg); color: var(--text); cursor: pointer; }
.btn-mark:hover { background: var(--surface); }
.btn-remove { padding: 0.25rem 0.5rem; font-size: 1rem; line-height: 1; border: none; background: transparent; color: var(--muted); cursor: pointer; border-radius: 4px; }
.btn-remove:hover { color: var(--danger); background: var(--surface); }
.add-form { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; }
.input { padding: 0.4rem 0.6rem; border: 1px solid var(--border); border-radius: 6px; background: var(--bg); color: var(--text); }
.input-narrow { width: 5rem; }
.input-date { width: 8rem; }
.input-disabled { opacity: 0.6; cursor: not-allowed; background: var(--surface); }
.btn { padding: 0.4rem 0.75rem; border-radius: 6px; border: 1px solid var(--border); background: var(--bg); color: var(--text); cursor: pointer; font-size: 0.9rem; }
.btn:hover { background: var(--surface); }
.btn-primary { background: var(--accent); border-color: var(--accent); color: var(--bg); }
.btn-primary:hover { filter: brightness(1.1); }
.btn-add { border-style: dashed; color: var(--muted); }
.btn-add:hover { color: var(--accent); border-color: var(--accent); }
.component-progress { grid-column: 1 / -1; height: 3px; background: var(--border); border-radius: 2px; overflow: hidden; }
.progress-fill { height: 100%; border-radius: 2px; background: var(--accent); transition: width 0.4s ease; }
.progress-fill[data-status="soon"] { background: var(--warning); }
.progress-fill[data-status="overdue"] { background: var(--danger); }
</style>
