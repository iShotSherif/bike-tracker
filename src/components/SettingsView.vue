<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { X } from 'lucide-vue-next'
import NotificationSettingsPanel from '@/components/NotificationSettings.vue'
import { useTracker } from '@/composables/useTracker'

const emit = defineEmits<{
  close: []
}>()

const { t, locale } = useI18n({ useScope: 'global' })
const { serviceLog, bikes } = useTracker()

const recentLog = computed(() => serviceLog.value.slice(0, 10))

function bikeName(bikeId: string): string {
  return bikes.value.find((bike) => bike.id === bikeId)?.name ?? bikeId
}
</script>

<template>
  <div class="settings-view">
    <section class="settings-hero">
      <div>
        <p class="settings-eyebrow">{{ t('settings.eyebrow') }}</p>
        <h2 class="settings-title">{{ t('settings.title') }}</h2>
        <p class="settings-subtitle">{{ t('settings.subtitle') }}</p>
      </div>

      <button type="button" class="close-settings" :aria-label="t('settings.close')" @click="emit('close')">
        <X :size="18" stroke-width="2.2" />
      </button>
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

.settings-hero {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem 1.1rem;
  border: 1.5px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  box-shadow: var(--shadow-sm);
}

.settings-eyebrow {
  margin: 0 0 0.15rem;
  color: var(--accent);
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.settings-title {
  margin: 0;
  font-size: 1.05rem;
  line-height: 1.2;
}

.settings-subtitle {
  margin: 0.25rem 0 0;
  color: var(--muted);
  font-size: 0.86rem;
  max-width: 32rem;
}

.close-settings {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--muted);
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
}

.close-settings:hover {
  border-color: color-mix(in srgb, var(--accent) 45%, var(--border));
  color: var(--accent);
  background: var(--accent-light);
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
  .settings-hero {
    padding: 0.9rem;
  }

  .log-row {
    gap: 0.35rem 0.7rem;
  }
}
</style>
