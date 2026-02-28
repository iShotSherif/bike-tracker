<script setup lang="ts">
import { computed } from 'vue'
import type { IntervalsBike } from '@/types'
import { useTracker } from '@/composables/useTracker'
import ComponentTracker from './ComponentTracker.vue'

const props = defineProps<{ bike: IntervalsBike }>()

const { bikeTotalKm } = useTracker()

const totalKm = computed(() => bikeTotalKm(props.bike))
const displayName = computed(() => props.bike.name || 'Unnamed bike')
</script>

<template>
  <article class="bike-card">
    <header class="bike-header">
      <h2 class="bike-name">{{ displayName }}</h2>
      <p class="bike-km">{{ totalKm.toLocaleString(undefined, { maximumFractionDigits: 0 }) }} km total</p>
    </header>
    <ComponentTracker
      :bike-id="bike.id"
      :bike-name="displayName"
      :total-km="totalKm"
    />
  </article>
</template>

<style scoped>
.bike-card {
  background: var(--card);
  border-radius: 12px;
  padding: 1.25rem;
  border: 1px solid var(--border);
}
.bike-header {
  margin-bottom: 1rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--border);
}
.bike-name {
  font-size: 1.25rem;
  font-weight: 700;
  margin: 0 0 0.25rem 0;
}
.bike-km {
  font-family: var(--font-mono);
  font-size: 1rem;
  color: var(--muted);
  margin: 0;
}
</style>
