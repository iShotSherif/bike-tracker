<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import NotificationSettingsPanel from '@/components/NotificationSettings.vue'
import { useTracker } from '@/composables/useTracker'

const { t, locale } = useI18n({ useScope: 'global' })
const { serviceLog, bikes } = useTracker()

const recentLog = computed(() => serviceLog.value.slice(0, 10))

function bikeName(bikeId: string): string {
  return bikes.value.find((bike) => bike.id === bikeId)?.name ?? bikeId
}
</script>

<template>
  <div class="settings-view">
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
          <span class="log-km">{{ entry.kmAtService.toLocaleString(locale) }} km</span>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.settings-view {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.section {
  background: var(--surface);
  border: 1.5px solid var(--border);
  border-radius: 8px;
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
  align-items: center;
  gap: 1rem;
  padding: 0.6rem 1.25rem;
  border-bottom: 1px solid var(--border);
  color: var(--muted);
  font-size: 0.85rem;
  flex-wrap: wrap;
}

.log-row:last-child {
  border-bottom: none;
}

.log-date {
  min-width: 6rem;
  font-variant-numeric: tabular-nums;
  font-size: 0.8rem;
}

.log-bike {
  font-size: 0.8rem;
}

.log-component {
  flex: 1;
  color: var(--text);
  font-weight: 500;
}

.log-km {
  margin-left: auto;
  font-size: 0.8rem;
}

@media (max-width: 640px) {
  .log-row {
    gap: 0.35rem 0.7rem;
  }
}
</style>
