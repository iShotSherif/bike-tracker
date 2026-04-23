<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import NotificationSettingsPanel from '@/components/NotificationSettings.vue'
import { useTracker } from '@/composables/useTracker'
import { todayISO } from '@/utils/date'
import { getComponentLabel } from '@/utils/componentPresets'
import type { ComponentStatus } from '@/utils/status'

const { t } = useI18n({ useScope: 'global' })
const { alertComponents, kmAtDate, markComponentDone, serviceLog, bikes } = useTracker()

const doneIds = ref<Set<string>>(new Set())
const collapsingIds = ref<Set<string>>(new Set())
const recentLog = computed(() => serviceLog.value.slice(0, 10))

function alertDetail(
  bikeId: string,
  component: {
    intervalKm?: number
    intervalDays?: number
    dateStarted: string
  },
): string {
  const parts: string[] = []
  const currentKm = kmAtDate(bikeId, todayISO())
  const startKm = kmAtDate(bikeId, component.dateStarted)

  if (component.intervalKm) {
    const used = Math.floor(Math.max(0, currentKm - startKm))
    const left = component.intervalKm - used
    parts.push(left <= 0
      ? t('alerts.detail.kmOverdue', { count: Math.abs(left) })
      : t('alerts.detail.kmRemaining', { count: left }))
  }

  if (component.intervalDays) {
    const startMs = new Date(component.dateStarted).getTime()
    const nowMs = new Date(todayISO()).getTime()
    const elapsed = Math.floor((nowMs - startMs) / (24 * 60 * 60 * 1000))
    const left = component.intervalDays - elapsed
    parts.push(left <= 0
      ? Math.abs(left) === 1
        ? t('alerts.detail.daysOverdueSingle')
        : t('alerts.detail.daysOverdueMultiple', { count: Math.abs(left) })
      : left === 1
        ? t('alerts.detail.daysRemainingSingle')
        : t('alerts.detail.daysRemainingMultiple', { count: left }))
  }

  return parts.join(' - ')
}

function markDone(bikeId: string, componentId: string, bikeCurrentKm: number) {
  doneIds.value = new Set([...doneIds.value, componentId])
  markComponentDone(bikeId, componentId, bikeCurrentKm)

  window.setTimeout(() => {
    collapsingIds.value = new Set([...collapsingIds.value, componentId])
  }, 1400)
}

function bikeName(bikeId: string): string {
  return bikes.value.find((bike) => bike.id === bikeId)?.name ?? bikeId
}

function statusLabel(status: ComponentStatus): string {
  return t(`alerts.status.${status}`)
}

function statusClass(status: ComponentStatus): string {
  if (status === 'watch') return 'badge-watch'
  if (status === 'soon') return 'badge-soon'
  if (status === 'overdue') return 'badge-overdue'
  return ''
}
</script>

<template>
  <div class="alerts-view">
    <section class="section">
      <h2 class="section-title">{{ t('alerts.title') }}</h2>

      <div v-if="alertComponents.length === 0" class="empty-ok">
        <span class="ok-dot"></span>
        {{ t('alerts.emptyOk') }}
      </div>

      <div v-else class="alert-list">
        <transition-group name="row">
          <div
            v-for="item in alertComponents"
            v-show="!collapsingIds.has(item.component.id)"
            :key="item.component.id"
            :class="['alert-row', `row-${item.status}`, { 'row-done': doneIds.has(item.component.id) }]"
          >
            <div class="alert-row-left">
              <span class="row-name">{{ getComponentLabel(item.component.name, t) }}</span>
              <span class="row-bike">{{ item.bikeName }}</span>
            </div>

            <div class="alert-row-right">
              <span :class="['status-badge', statusClass(item.status as ComponentStatus)]">
                {{ statusLabel(item.status as ComponentStatus) }}
              </span>

              <span class="row-detail">{{ alertDetail(item.bikeId, item.component) }}</span>

              <button
                v-if="!doneIds.has(item.component.id)"
                class="btn-done"
                @click="markDone(item.bikeId, item.component.id, kmAtDate(item.bikeId, todayISO()))"
              >
                {{ t('alerts.markDoneToday') }}
              </button>

              <span v-else class="done-confirm">✓ {{ t('alerts.resetDone') }}</span>
            </div>
          </div>
        </transition-group>
      </div>
    </section>

    <section class="section">
      <h2 class="section-title">{{ t('alerts.settingsTitle') }}</h2>
      <NotificationSettingsPanel :inline="true" />
    </section>

    <section class="section">
      <h2 class="section-title">{{ t('alerts.historyTitle') }}</h2>

      <div v-if="recentLog.length === 0" class="empty-log">{{ t('alerts.emptyHistory') }}</div>

      <div v-else class="log-list">
        <div v-for="entry in recentLog" :key="entry.id" class="log-row">
          <span class="log-date">{{ entry.date }}</span>
          <span class="log-bike">{{ bikeName(entry.bikeId) }}</span>
          <span class="log-component">{{ entry.notes ?? t('alerts.defaultServiceNote') }}</span>
          <span class="log-km">{{ entry.kmAtService.toFixed(0) }} km</span>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.alerts-view {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.section {
  background: var(--surface);
  border: 1.5px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
}

.section-title {
  font-size: 0.82rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--muted);
  margin: 0;
  padding: 0.85rem 1.25rem;
  border-bottom: 1.5px solid var(--border);
}

.empty-ok {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 1rem 1.25rem;
  font-size: 0.88rem;
  color: var(--ok);
  font-weight: 600;
}

.ok-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--ok);
  flex-shrink: 0;
}

.alert-list {
  display: flex;
  flex-direction: column;
}

.alert-row {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem 1.25rem;
  border-bottom: 1px solid var(--border);
  flex-wrap: wrap;
  transition: background 0.2s, opacity 0.4s, max-height 0.4s;
}

.alert-row:last-child {
  border-bottom: none;
}

.row-overdue {
  border-left: 3px solid var(--danger);
  background: var(--danger-light);
}

.row-soon {
  border-left: 3px solid var(--warning);
  background: var(--warning-light);
}

.row-watch {
  border-left: 3px solid #eab308;
  background: #fefce8;
}

.row-done {
  background: var(--ok-light, #f0fdf4) !important;
  border-left-color: var(--ok) !important;
}

.alert-row-left {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  min-width: 9rem;
}

.row-name {
  font-weight: 600;
  font-size: 0.9rem;
  color: var(--text);
}

.row-bike {
  font-size: 0.78rem;
  color: var(--muted);
}

.alert-row-right {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
  margin-left: auto;
}

.status-badge {
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 0.15rem 0.5rem;
  border-radius: 4px;
  white-space: nowrap;
}

.badge-overdue {
  background: var(--danger);
  color: #fff;
}

.badge-soon {
  background: var(--warning);
  color: #fff;
}

.badge-watch {
  background: #eab308;
  color: #fff;
}

.row-detail {
  font-size: 0.78rem;
  color: var(--muted);
  font-family: var(--font-mono, monospace);
}

.btn-done {
  padding: 0.3rem 0.75rem;
  border-radius: var(--radius-sm);
  border: 1.5px solid var(--accent);
  background: var(--accent-light, #fff5f0);
  color: var(--accent);
  cursor: pointer;
  font-size: 0.82rem;
  font-weight: 600;
  font-family: inherit;
  white-space: nowrap;
  transition: background 0.15s, color 0.15s;
}

.btn-done:hover {
  background: var(--accent);
  color: #fff;
}

.done-confirm {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--ok);
  animation: popIn 0.3s ease;
}

@keyframes popIn {
  from {
    opacity: 0;
    transform: scale(0.85);
  }

  to {
    opacity: 1;
    transform: scale(1);
  }
}

.row-leave-active {
  transition: max-height 0.4s ease, opacity 0.3s ease, padding 0.4s ease;
  overflow: hidden;
  max-height: 100px;
}

.row-leave-to {
  max-height: 0;
  opacity: 0;
  padding-top: 0;
  padding-bottom: 0;
}

.empty-log {
  padding: 1rem 1.25rem;
  font-size: 0.85rem;
  color: var(--muted);
}

.log-list {
  display: flex;
  flex-direction: column;
}

.log-row {
  display: flex;
  gap: 1rem;
  padding: 0.6rem 1.25rem;
  font-size: 0.85rem;
  border-bottom: 1px solid var(--border);
  flex-wrap: wrap;
  align-items: center;
}

.log-row:last-child {
  border-bottom: none;
}

.log-date {
  color: var(--muted);
  font-variant-numeric: tabular-nums;
  font-size: 0.8rem;
  min-width: 6rem;
}

.log-bike {
  color: var(--muted);
  font-size: 0.8rem;
}

.log-component {
  font-weight: 500;
  flex: 1;
}

.log-km {
  color: var(--muted);
  font-size: 0.8rem;
  margin-left: auto;
}
</style>
