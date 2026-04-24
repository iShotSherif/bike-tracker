<script setup lang="ts">
import { useI18n } from 'vue-i18n'

interface Props {
  authToken: string
  showRefreshIntervals?: boolean
  showRefreshStrava?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  showRefreshIntervals: false,
  showRefreshStrava: false,
})

const emit = defineEmits<{
  downloadExport: []
  logout: []
  openAuth: []
  openHandoff: []
  refreshIntervals: []
  refreshStrava: []
  triggerImport: []
}>()

const { t } = useI18n({ useScope: 'global' })
</script>

<template>
  <div class="footer-actions">
    <button v-if="props.showRefreshIntervals" type="button" class="btn secondary" @click="emit('refreshIntervals')">
      {{ t('app.actions.refreshIntervals') }}
    </button>
    <button v-if="props.showRefreshStrava" type="button" class="btn secondary" @click="emit('refreshStrava')">
      {{ t('app.actions.refreshStrava') }}
    </button>
    <button type="button" class="btn secondary" @click="emit('downloadExport')">{{ t('app.actions.export') }}</button>
    <button type="button" class="btn secondary" @click="emit('triggerImport')">{{ t('app.actions.import') }}</button>
    <button type="button" class="btn secondary" @click="emit('openHandoff')">{{ t('app.actions.openOnPhone') }}</button>
    <button v-if="props.authToken" type="button" class="btn secondary" @click="emit('logout')">{{ t('app.actions.logout') }}</button>
    <button v-else type="button" class="btn secondary" @click="emit('openAuth')">{{ t('app.actions.login') }}</button>
  </div>
</template>

<style scoped>
.footer-actions {
  margin-top: 1.5rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.btn {
  padding: 0.55rem 1rem;
  border-radius: var(--radius-sm);
  border: 1.5px solid var(--border);
  background: var(--surface);
  color: var(--text);
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 500;
  transition: background 0.15s, border-color 0.15s;
}

.btn:hover:not(:disabled) {
  background: var(--bg);
  border-color: var(--muted);
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn.secondary {
  color: var(--muted);
  border-color: transparent;
  background: transparent;
}

.btn.secondary:hover {
  color: var(--accent);
  background: var(--accent-light);
}
</style>
