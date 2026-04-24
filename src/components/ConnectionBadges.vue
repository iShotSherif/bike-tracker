<script setup lang="ts">
import { useI18n } from 'vue-i18n'

interface Props {
  bikeCountLabel: string
  showIntervals?: boolean
  showStrava?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  showIntervals: false,
  showStrava: false,
})

const { t } = useI18n({ useScope: 'global' })
</script>

<template>
  <div class="connection-badges">
    <span v-if="props.showIntervals" class="connection-badge">✓ {{ t('app.badges.intervals') }}</span>
    <span v-if="props.showStrava" class="connection-badge strava-badge">✓ {{ t('app.badges.strava') }}</span>
    <span class="badge-detail">- {{ props.bikeCountLabel }}</span>
  </div>
</template>

<style scoped>
.connection-badges {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-bottom: 1rem;
}

.connection-badge {
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--ok, #16a34a);
  background: var(--ok-light, #f0fdf4);
  border: 1.5px solid var(--ok, #16a34a);
  border-radius: 5px;
  padding: 0.15rem 0.5rem;
}

.strava-badge {
  color: #fc4c02;
  background: #fff5f0;
  border-color: #fc4c02;
}

.badge-detail {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--muted);
}
</style>
