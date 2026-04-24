<script setup lang="ts">
import { useI18n } from 'vue-i18n'

interface Props {
  authToken: string
  error: string | null
  intervalsValue?: string
  loading: boolean
  showIntervals?: boolean
  showKey?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  intervalsValue: '',
  showIntervals: false,
  showKey: false,
})

const emit = defineEmits<{
  connectStrava: []
  openAuth: []
  saveIntervals: []
  skipConnection: []
  toggleShowKey: []
  'update:intervalsValue': [value: string]
}>()

const { t } = useI18n({ useScope: 'global' })

function onIntervalsInput(event: Event): void {
  emit('update:intervalsValue', (event.target as HTMLInputElement).value)
}
</script>

<template>
  <section class="setup">
    <div class="source-options">
      <div v-if="props.showIntervals" class="key-section">
        <label for="api-key">{{ t('app.setup.intervals.label') }}</label>

        <div class="key-row">
          <input
            id="api-key"
            :value="props.intervalsValue"
            :type="props.showKey ? 'text' : 'password'"
            :placeholder="t('app.setup.intervals.placeholder')"
            class="input key-input"
            @input="onIntervalsInput"
            @keydown.enter="emit('saveIntervals')"
          />

          <button
            type="button"
            class="btn icon"
            :title="props.showKey ? t('app.setup.intervals.togglePassword.hide') : t('app.setup.intervals.togglePassword.show')"
            :aria-label="props.showKey ? t('app.setup.intervals.togglePassword.hide') : t('app.setup.intervals.togglePassword.show')"
            @click="emit('toggleShowKey')"
          >
            {{ props.showKey ? '🙈' : '👁' }}
          </button>

          <button type="button" class="btn btn-primary" :disabled="props.loading" @click="emit('saveIntervals')">
            {{ props.loading ? t('app.setup.intervals.connecting') : t('app.setup.intervals.connect') }}
          </button>
        </div>

        <p class="hint">
          {{ t('app.setup.intervals.hint') }}
          <a href="https://app.intervals.icu/settings#developer" target="_blank" class="hint-link">
            {{ t('app.setup.intervals.findKey') }}
          </a>
        </p>
      </div>

      <div v-if="props.showIntervals" class="source-divider"><span>{{ t('app.setup.or') }}</span></div>

      <div class="strava-section">
        <label>{{ t('app.setup.strava.label') }}</label>
        <button type="button" class="btn btn-strava" :disabled="props.loading" @click="emit('connectStrava')">
          <svg class="strava-logo" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" /></svg>
          {{ t('app.setup.strava.connect') }}
        </button>
        <p class="hint">{{ t('app.setup.strava.hint') }}</p>
      </div>
    </div>

    <div class="auth-row">
      <span v-if="props.authToken" class="auth-badge">✓ {{ t('app.setup.auth.connected') }}</span>
      <button v-else type="button" class="btn btn-link" @click="emit('openAuth')">
        {{ t('app.setup.auth.syncLogin') }}
      </button>
    </div>

    <button type="button" class="btn btn-link" @click="emit('skipConnection')">
      {{ t('app.setup.auth.continueWithoutConnection') }}
    </button>

    <p v-if="props.error" class="error">{{ props.error }}</p>
  </section>
</template>

<style scoped>
.setup {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  max-width: 480px;
}

.source-options {
  display: flex;
  flex-direction: column;
  gap: 0;
  border: 1.5px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
  background: var(--surface);
}

.key-section,
.strava-section {
  padding: 1rem 1.25rem;
}

.key-section label,
.strava-section label {
  display: block;
  font-size: 0.78rem;
  font-weight: 700;
  margin-bottom: 0.6rem;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.source-divider {
  display: flex;
  align-items: center;
  padding: 0 1.25rem;
  gap: 0.75rem;
  color: var(--muted);
  font-size: 0.75rem;
  font-weight: 600;
}

.source-divider::before,
.source-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--border);
}

.key-row {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.key-input {
  flex: 1;
  min-width: 0;
}

.input {
  padding: 0.55rem 0.85rem;
  border: 1.5px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface);
  color: var(--text);
  font-size: 0.95rem;
  transition: border-color 0.15s;
}

.input:focus {
  outline: none;
  border-color: var(--accent);
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

.btn.icon {
  padding: 0.55rem 0.7rem;
}

.btn-primary {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
  font-weight: 600;
}

.btn-primary:hover:not(:disabled) {
  background: var(--accent-hover);
  border-color: var(--accent-hover);
}

.btn-strava {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.55rem 1rem;
  border-radius: var(--radius-sm);
  border: 1.5px solid #fc4c02;
  background: #fc4c02;
  color: #fff;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 600;
  font-family: inherit;
  transition: background 0.15s, border-color 0.15s;
}

.btn-strava:hover:not(:disabled) {
  background: #e04300;
  border-color: #e04300;
}

.btn-strava:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.strava-logo {
  width: 1rem;
  height: 1rem;
  flex-shrink: 0;
}

.btn-link {
  background: none;
  border: none;
  color: var(--accent);
  font-size: 0.85rem;
  cursor: pointer;
  padding: 0.3rem 0;
  font-family: inherit;
  font-weight: 500;
  display: inline-block;
  margin-top: 0.5rem;
}

.btn-link:hover {
  text-decoration: underline;
}

.hint {
  font-size: 0.78rem;
  color: var(--muted);
  margin: 0.4rem 0 0 0;
  line-height: 1.6;
}

.hint-link {
  color: var(--accent);
  text-decoration: none;
}

.hint-link:hover {
  text-decoration: underline;
}

.auth-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.25rem;
}

.auth-badge {
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--ok, #16a34a);
  background: var(--ok-light, #f0fdf4);
  border: 1.5px solid var(--ok, #16a34a);
  border-radius: 5px;
  padding: 0.15rem 0.5rem;
}

.error {
  color: var(--danger);
  font-size: 0.88rem;
  margin: 0;
  background: var(--danger-light);
  padding: 0.5rem 0.75rem;
  border-radius: var(--radius-sm);
}
</style>
