<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { BikeComponent } from '@/types'
import { useTracker } from '@/composables/useTracker'
import { formatSince, todayISO } from '@/utils/date'
import { kmSinceStart, daysUntilAlert, componentStatus, progressPct } from '@/utils/status'

const props = defineProps<{ bikeId: string; bikeName: string; totalKm: number }>()

const { getComponentsForBike, addComponent, updateComponent, removeComponent, kmAtDate, getLogForComponent, markComponentDone } = useTracker()

// ── add form ──────────────────────────────────────────────────────────────────
const showForm = ref(false)
const newName = ref('')
const newMode = ref<'km' | 'days' | 'both'>('km')
const newIntervalKm = ref(1000)
const newIntervalDays = ref(365)
const newDateStarted = ref('')
const newKmAtStart = ref<number | ''>('')

watch(newDateStarted, (date) => {
  if (date) newKmAtStart.value = Math.floor(kmAtDate(props.bikeId, date))
})

function openForm() {
  newName.value = ''
  newMode.value = 'km'
  newIntervalKm.value = 1000
  newIntervalDays.value = 365
  newDateStarted.value = todayISO()
  newKmAtStart.value = Math.floor(kmAtDate(props.bikeId, todayISO()))
  showForm.value = true
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

// ── edit form ─────────────────────────────────────────────────────────────────
const editingId = ref<string | null>(null)
const editName = ref('')
const editMode = ref<'km' | 'days' | 'both'>('km')
const editIntervalKm = ref(1000)
const editIntervalDays = ref(365)
const editDateStarted = ref('')
const editKmAtStart = ref<number | ''>('')

function openEdit(c: BikeComponent) {
  editingId.value = c.id
  editName.value = c.name
  editMode.value = c.intervalKm && c.intervalDays ? 'both' : c.intervalDays ? 'days' : 'km'
  editIntervalKm.value = c.intervalKm ?? 1000
  editIntervalDays.value = c.intervalDays ?? 365
  editDateStarted.value = c.dateStarted
  editKmAtStart.value = c.kmAtStart
}

function saveEdit(c: BikeComponent) {
  const name = editName.value.trim()
  const hasKm = editMode.value !== 'days' && editIntervalKm.value > 0
  const hasDays = editMode.value !== 'km' && editIntervalDays.value > 0
  if (!name || (!hasKm && !hasDays) || !editDateStarted.value || editKmAtStart.value === '') return
  updateComponent(props.bikeId, c.id, {
    name,
    intervalKm: hasKm ? editIntervalKm.value : undefined,
    intervalDays: hasDays ? editIntervalDays.value : undefined,
    dateStarted: editDateStarted.value,
    kmAtStart: Number(editKmAtStart.value),
  })
  editingId.value = null
}

// ── done flow ─────────────────────────────────────────────────────────────────
const pendingDoneId = ref<string | null>(null)
const pendingNotes = ref('')

const currentKmFromActivities = computed(() => kmAtDate(props.bikeId, todayISO()))

function confirmDone(c: BikeComponent) {
  markComponentDone(props.bikeId, c.id, currentKmFromActivities.value, pendingNotes.value.trim() || undefined)
  pendingDoneId.value = null
  pendingNotes.value = ''
}

// ── history ───────────────────────────────────────────────────────────────────
const openHistoryId = ref<string | null>(null)

function toggleHistory(id: string) {
  openHistoryId.value = openHistoryId.value === id ? null : id
}

// ── status helpers ────────────────────────────────────────────────────────────
function status(c: BikeComponent) {
  return componentStatus(c, currentKmFromActivities.value)
}

function kmLeft(c: BikeComponent): number {
  if (!c.intervalKm) return 0
  return Math.max(0, c.intervalKm - kmSinceStart(c, currentKmFromActivities.value))
}

function daysLeft(c: BikeComponent): number | null {
  return daysUntilAlert(c)
}

function intervalLabel(c: BikeComponent): string {
  const parts: string[] = []
  if (c.intervalKm) parts.push(`${c.intervalKm.toLocaleString()} km`)
  if (c.intervalDays) parts.push(`${c.intervalDays} days`)
  return `Alert at ${parts.join(' / ')}`
}

function statusText(c: BikeComponent): string {
  const s = status(c)
  const lines: string[] = []
  if (c.intervalKm) {
    const used = Math.floor(kmSinceStart(c, currentKmFromActivities.value))
    const left = Math.floor(kmLeft(c))
    if (s === 'overdue' && used >= c.intervalKm) lines.push(`${used} km — Service now!`)
    else lines.push(`${left} km left (${used}/${c.intervalKm})`)
  }
  if (c.intervalDays) {
    const left = daysLeft(c)!
    if (left <= 0) lines.push(`${Math.abs(left)} days overdue`)
    else lines.push(`${left} days left`)
  }
  return lines.join('  ·  ')
}

function pct(c: BikeComponent): number {
  return progressPct(c, currentKmFromActivities.value)
}

function sinceText(c: BikeComponent): string {
  return formatSince(c.dateStarted)
}

const STATUS_ORDER: Record<'overdue' | 'soon' | 'ok', number> = { overdue: 0, soon: 1, ok: 2 }

const components = computed(() => {
  const list = getComponentsForBike(props.bikeId)
  return [...list].sort((a, b) => {
    const sa = STATUS_ORDER[status(a)]
    const sb = STATUS_ORDER[status(b)]
    if (sa !== sb) return sa - sb
    return (kmLeft(a) || 0) - (kmLeft(b) || 0)
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
        :style="{ '--pct': pct(c) }"
      >
        <!-- edit mode -->
        <template v-if="editingId === c.id">
          <div class="inline-form">
            <input v-model.trim="editName" placeholder="Component name" class="input" />
            <div class="mode-toggle">
              <button :class="['btn-mode', { active: editMode === 'km' }]" @click="editMode = 'km'">km</button>
              <button :class="['btn-mode', { active: editMode === 'days' }]" @click="editMode = 'days'">Time</button>
              <button :class="['btn-mode', { active: editMode === 'both' }]" @click="editMode = 'both'">Both</button>
            </div>
            <input v-if="editMode !== 'days'" v-model.number="editIntervalKm" type="number" min="1" placeholder="km interval" class="input input-narrow" />
            <input v-if="editMode !== 'km'" v-model.number="editIntervalDays" type="number" min="1" placeholder="days" class="input input-narrow" title="e.g. 365 = 1 yr, 730 = 2 yrs" />
            <input v-model="editDateStarted" type="date" class="input input-date" />
            <input v-model.number="editKmAtStart" type="number" min="0" placeholder="km at start" class="input input-narrow" />
            <button type="button" class="btn btn-primary" @click="saveEdit(c)">Save</button>
            <button type="button" class="btn" @click="editingId = null">Cancel</button>
          </div>
        </template>

        <!-- normal view -->
        <template v-else>
          <div class="component-info">
            <span class="component-name">{{ c.name }}</span>
            <span class="component-interval">{{ intervalLabel(c) }}</span>
            <span class="component-since">Started {{ sinceText(c) }}</span>
          </div>

          <div class="component-km">
            <span :class="`status-${status(c)}`">{{ statusText(c) }}</span>
          </div>

          <div class="component-actions">
            <button type="button" class="btn-mark" @click="pendingDoneId = c.id; pendingNotes = ''" title="Mark as done">Done</button>
            <button type="button" class="btn-edit" @click="openEdit(c)" title="Edit settings">✎</button>
            <button type="button" class="btn-remove" @click="removeComponent(props.bikeId, c.id)" title="Remove">×</button>
          </div>

          <div class="component-progress">
            <div class="progress-fill" :data-status="status(c)" :style="{ width: pct(c) + '%' }"></div>
          </div>

          <!-- done notes bar -->
          <div v-if="pendingDoneId === c.id" class="done-bar">
            <input v-model="pendingNotes" class="input done-notes" placeholder="Notes (optional)" @keydown.enter="confirmDone(c)" @keydown.escape="pendingDoneId = null" autofocus />
            <button type="button" class="btn btn-primary" @click="confirmDone(c)">Confirm</button>
            <button type="button" class="btn" @click="pendingDoneId = null">Cancel</button>
          </div>

          <!-- history panel -->
          <div class="component-history">
            <button type="button" class="btn-history" @click="toggleHistory(c.id)">
              History ({{ getLogForComponent(c.id).length }}) {{ openHistoryId === c.id ? '▴' : '▾' }}
            </button>
            <div v-if="openHistoryId === c.id" class="history-list">
              <p v-if="!getLogForComponent(c.id).length" class="history-empty">No service history yet.</p>
              <div v-for="entry in getLogForComponent(c.id).slice(0, 10)" :key="entry.id" class="history-entry">
                <span class="history-date">{{ entry.date }}</span>
                <span class="history-km">{{ entry.kmAtService.toLocaleString() }} km</span>
                <span v-if="entry.notes" class="history-notes">{{ entry.notes }}</span>
              </div>
            </div>
          </div>
        </template>
      </div>
    </div>

    <!-- add form -->
    <div v-if="showForm" class="inline-form">
      <input v-model.trim="newName" placeholder="Component name (e.g. Chain wax)" class="input" />
      <div class="mode-toggle">
        <button :class="['btn-mode', { active: newMode === 'km' }]" @click="newMode = 'km'">km</button>
        <button :class="['btn-mode', { active: newMode === 'days' }]" @click="newMode = 'days'">Time</button>
        <button :class="['btn-mode', { active: newMode === 'both' }]" @click="newMode = 'both'">Both</button>
      </div>
      <input v-if="newMode !== 'days'" v-model.number="newIntervalKm" type="number" min="1" placeholder="km interval" class="input input-narrow" />
      <input v-if="newMode !== 'km'" v-model.number="newIntervalDays" type="number" min="1" placeholder="days" class="input input-narrow" title="e.g. 365 = 1 yr, 730 = 2 yrs" />
      <input v-model="newDateStarted" type="date" class="input input-date" />
      <input :value="newKmAtStart" type="number" disabled placeholder="km at start" class="input input-narrow input-disabled" title="Auto-calculated from activity history" />
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
  /* background tint: transparent at 0%, warm amber wash at 75%, red wash at 100% */
  background:
    linear-gradient(
      to right,
      color-mix(in srgb, #f97316 calc(var(--pct, 0) * 0.12%), transparent),
      transparent 60%
    ),
    var(--surface);
}
.component-row[data-status="soon"] {
  border-left-color: var(--warning);
  background:
    linear-gradient(
      to right,
      color-mix(in srgb, #d97706 calc(var(--pct, 0) * 0.14%), transparent),
      transparent 60%
    ),
    #fffcf5;
}
.component-row[data-status="overdue"] {
  border-left-color: var(--danger);
  background:
    linear-gradient(
      to right,
      color-mix(in srgb, #dc2626 calc(var(--pct, 0) * 0.13%), transparent),
      transparent 60%
    ),
    #fff8f8;
}

.component-info { display: flex; flex-direction: column; gap: 0.15rem; }
.component-name { font-weight: 600; font-size: 0.93rem; }
.component-interval { font-size: 0.76rem; color: var(--muted); }
.component-since { font-size: 0.72rem; color: var(--muted); }

.component-km { display: flex; align-items: center; font-family: var(--font-mono); font-size: 0.82rem; }
.status-ok { color: var(--muted); }
.status-soon { color: var(--warning); font-weight: 600; }
.status-overdue { color: var(--danger); font-weight: 600; }

.component-actions { display: flex; gap: 0.3rem; }
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
.btn-mark:hover { background: var(--accent); color: #fff; }
.btn-edit { padding: 0.2rem 0.45rem; font-size: 0.85rem; border: none; background: transparent; color: var(--muted); cursor: pointer; border-radius: 4px; transition: color 0.12s; }
.btn-edit:hover { color: var(--accent); background: var(--accent-light); }
.btn-remove { padding: 0.2rem 0.45rem; font-size: 1rem; line-height: 1; border: none; background: transparent; color: var(--muted); cursor: pointer; border-radius: 4px; }
.btn-remove:hover { color: var(--danger); background: var(--danger-light); }

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
  /* gradient spans full bar width so the visible color shifts as the fill grows */
  background: linear-gradient(
    to right,
    #22c55e 0%,      /* green  — fresh */
    #84cc16 30%,     /* lime   */
    #eab308 58%,     /* amber  — getting worn */
    #f97316 78%,     /* orange — due soon */
    #ef4444 92%,     /* red    — overdue */
    #b91c1c 100%
  );
  background-size: calc(100% / (var(--pct, 1) / 100)) 100%;
  transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
}
/* no color overrides needed — the gradient carries all states */

/* done notes bar */
.done-bar { grid-column: 1 / -1; display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; padding-top: 0.2rem; }
.done-notes { flex: 1; min-width: 8rem; }

/* history */
.component-history { grid-column: 1 / -1; }
.btn-history { background: none; border: none; color: var(--muted); font-size: 0.75rem; cursor: pointer; padding: 0; transition: color 0.12s; }
.btn-history:hover { color: var(--accent); }
.history-list { margin-top: 0.4rem; display: flex; flex-direction: column; gap: 0.25rem; }
.history-entry { display: flex; flex-wrap: wrap; gap: 0.5rem; font-size: 0.78rem; color: var(--muted); font-family: var(--font-mono); padding: 0.2rem 0; border-bottom: 1px solid var(--border-light); }
.history-entry:last-child { border-bottom: none; }
.history-date { color: var(--text); font-weight: 500; }
.history-notes { font-family: inherit; font-style: italic; color: var(--muted); }
.history-empty { font-size: 0.78rem; color: var(--muted); margin: 0.25rem 0 0; }

/* forms */
.inline-form { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; padding: 0.5rem 0; }
.mode-toggle { display: flex; gap: 0.2rem; }
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
.btn-mode.active { background: var(--accent); border-color: var(--accent); color: #fff; }
.input {
  padding: 0.4rem 0.65rem;
  border: 1.5px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface);
  color: var(--text);
  font-size: 0.88rem;
  transition: border-color 0.15s;
}
.input:focus { outline: none; border-color: var(--accent); }
.input-narrow { width: 5.5rem; }
.input-date { width: 8rem; }
.input-disabled { opacity: 0.5; cursor: not-allowed; background: var(--bg); }
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
.btn:hover { background: var(--bg); border-color: var(--muted); }
.btn-primary { background: var(--accent); border-color: var(--accent); color: #fff; font-weight: 600; }
.btn-primary:hover { background: var(--accent-hover); border-color: var(--accent-hover); }
.btn-add {
  border-style: dashed;
  color: var(--muted);
  background: transparent;
  width: 100%;
  text-align: center;
  padding: 0.5rem;
  margin-top: 0.1rem;
}
.btn-add:hover { color: var(--accent); border-color: var(--accent); background: var(--accent-light); }
</style>
