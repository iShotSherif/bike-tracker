<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useTracker } from '@/composables/useTracker'
import { alertDetail as _alertDetail } from '@/utils/status'
import { todayISO } from '@/utils/date'
import { getComponentLabel } from '@/utils/componentPresets'

const { t } = useI18n({ useScope: 'global' })
const { alertComponents, kmAtDate } = useTracker()

const overdueItems = computed(() => alertComponents.value.filter((item) => item.status === 'overdue'))
const soonItems = computed(() => alertComponents.value.filter((item) => item.status === 'soon'))
const watchItems = computed(() => alertComponents.value.filter((item) => item.status === 'watch'))

function alertDetail(bikeId: string, component: Parameters<typeof _alertDetail>[0]): string {
  return _alertDetail(component, kmAtDate(bikeId, todayISO()), kmAtDate(bikeId, component.dateStarted))
}

function scrollToBike(bikeId: string) {
  const element = document.getElementById(`bike-${bikeId}`)
  if (!element) return
  element.scrollIntoView({ behavior: 'smooth', block: 'start' })
  element.classList.add('highlight')
  window.setTimeout(() => element.classList.remove('highlight'), 1800)
}
</script>

<template>
  <section v-if="alertComponents.length" class="dashboard">
    <h2 class="dashboard-title">{{ t('dashboard.title') }}</h2>

    <div v-if="overdueItems.length" class="dashboard-group">
      <h3 class="group-label overdue-label">{{ t('dashboard.overdue') }}</h3>
      <div
        v-for="item in overdueItems"
        :key="item.component.id"
        class="alert-item overdue-item"
        @click="scrollToBike(item.bikeId)"
      >
        <span class="alert-name">{{ getComponentLabel(item.component.name, t) }}</span>
        <span class="alert-bike">{{ item.bikeName }}</span>
        <span class="alert-detail">{{ alertDetail(item.bikeId, item.component) }}</span>
      </div>
    </div>

    <div v-if="soonItems.length" class="dashboard-group">
      <h3 class="group-label soon-label">{{ t('dashboard.soon') }}</h3>
      <div
        v-for="item in soonItems"
        :key="item.component.id"
        class="alert-item soon-item"
        @click="scrollToBike(item.bikeId)"
      >
        <span class="alert-name">{{ getComponentLabel(item.component.name, t) }}</span>
        <span class="alert-bike">{{ item.bikeName }}</span>
        <span class="alert-detail">{{ alertDetail(item.bikeId, item.component) }}</span>
      </div>
    </div>

    <div v-if="watchItems.length" class="dashboard-group">
      <h3 class="group-label watch-label">{{ t('dashboard.watch') }}</h3>
      <div
        v-for="item in watchItems"
        :key="item.component.id"
        class="alert-item watch-item"
        @click="scrollToBike(item.bikeId)"
      >
        <span class="alert-name">{{ getComponentLabel(item.component.name, t) }}</span>
        <span class="alert-bike">{{ item.bikeName }}</span>
        <span class="alert-detail">{{ alertDetail(item.bikeId, item.component) }}</span>
      </div>
    </div>
  </section>

  <section v-else class="dashboard dashboard-ok">
    <span class="ok-dot"></span>
    <span class="ok-badge">{{ t('dashboard.emptyOk') }}</span>
  </section>
</template>

<style scoped>
.dashboard {
  background: var(--surface);
  border-radius: var(--radius);
  padding: 1rem 1.25rem;
  margin-bottom: 1.5rem;
  border: 1.5px solid var(--border);
  box-shadow: var(--shadow-sm);
}

.dashboard-title {
  font-size: 0.82rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--muted);
  margin: 0 0 0.75rem 0;
}

.dashboard-group {
  margin-bottom: 0.6rem;
}

.dashboard-group:last-child {
  margin-bottom: 0;
}

.group-label {
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  margin: 0 0 0.3rem 0;
}

.overdue-label {
  color: var(--danger);
}

.soon-label {
  color: var(--warning);
}

.watch-label {
  color: #ca8a04;
}

.alert-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.4rem 0.6rem;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 0.88rem;
  flex-wrap: wrap;
  transition: background 0.12s;
}

.overdue-item {
  background: var(--danger-light);
  border-left: 3px solid var(--danger);
}

.overdue-item:hover {
  filter: brightness(0.97);
}

.soon-item {
  background: var(--warning-light);
  border-left: 3px solid var(--warning);
}

.soon-item:hover {
  filter: brightness(0.97);
}

.watch-item {
  background: #fefce8;
  border-left: 3px solid #eab308;
}

.watch-item:hover {
  filter: brightness(0.97);
}

.alert-name {
  font-weight: 600;
  min-width: 8rem;
}

.alert-bike {
  color: var(--muted);
  font-size: 0.83rem;
  min-width: 6rem;
}

.alert-detail {
  font-family: var(--font-mono);
  font-size: 0.8rem;
  color: var(--muted);
  margin-left: auto;
}

.dashboard-ok {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.25rem;
}

.ok-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--ok);
  flex-shrink: 0;
}

.ok-badge {
  font-size: 0.85rem;
  color: var(--ok);
  font-weight: 600;
}
</style>
