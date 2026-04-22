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
  border-radius: var(--radius);
  padding: 1.25rem 1.5rem 1.5rem;
  border: 1.5px solid var(--border);
  box-shadow: var(--shadow-sm);
  transition: box-shadow 0.2s;
}
.bike-card:hover {
  box-shadow: var(--shadow);
}
.bike-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
  padding-bottom: 0.85rem;
  border-bottom: 1.5px solid var(--border-light);
}
.bike-name {
  font-size: 1.15rem;
  font-weight: 700;
  margin: 0;
  letter-spacing: -0.01em;
}
.bike-km {
  font-family: var(--font-mono);
  font-size: 0.85rem;
  color: var(--muted);
  margin: 0;
  white-space: nowrap;
  background: var(--bg);
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  border: 1px solid var(--border);
}
@keyframes highlight-flash {
  0%   { box-shadow: 0 0 0 3px var(--warning); }
  100% { box-shadow: var(--shadow-sm); }
}
.bike-card.highlight { animation: highlight-flash 1.8s ease-out forwards; }
</style>
