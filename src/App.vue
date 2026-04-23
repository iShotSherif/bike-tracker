<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import AlertsView from '@/components/AlertsView.vue'
import AuthScreen from '@/components/AuthScreen.vue'
import BikeCard from '@/components/BikeCard.vue'
import HandoffModal from '@/components/HandoffModal.vue'
import LanguageSwitcher from '@/components/LanguageSwitcher.vue'
import { useTracker } from '@/composables/useTracker'

const { t } = useI18n({ useScope: 'global' })

const {
  apiKey,
  setApiKey,
  loading,
  error,
  bikes,
  loadAthlete,
  athlete,
  exportState,
  importState,
  pushProfileToCloud,
  resetAthlete,
  stravaConnected,
  connectStrava,
  loadStravaActivities,
  authToken,
  login,
  logout,
  alertComponents,
} = useTracker()

const keyInput = ref('')
const showKey = ref(false)
const showAuth = ref(false)
const showHandoff = ref(false)
const showHandoffBadge = ref(false)
const currentView = ref<'dashboard' | 'alerts'>('dashboard')
const bikeCountLabel = computed(() =>
  bikes.value.length === 1
    ? t('app.badges.bikeFoundSingle')
    : t('app.badges.bikeFoundMultiple', { count: bikes.value.length }),
)

watch(apiKey, (value) => {
  keyInput.value = value
}, { immediate: true })

onMounted(async () => {
  const params = new URLSearchParams(window.location.search)

  const handoffToken = params.get('handoff')
  if (handoffToken) {
    window.history.replaceState({}, '', window.location.pathname)
    const workerUrl = import.meta.env.VITE_WORKER_URL as string | undefined

    if (workerUrl) {
      try {
        const response = await fetch(`${workerUrl}/handoff/${handoffToken}`)
        if (response.ok) {
          const data = await response.json() as {
            sessionToken?: string
            profileSnapshot?: Record<string, unknown>
          }

          if (data.sessionToken) authToken.value = data.sessionToken
          if (data.profileSnapshot) importState(JSON.stringify(data.profileSnapshot))

          showHandoffBadge.value = true
          window.setTimeout(() => {
            showHandoffBadge.value = false
          }, 4000)
        }
      } catch {
        // best effort
      }
    }

    if (apiKey.value.trim()) await loadAthlete()
    return
  }

  const urlKey = params.get('key')
  if (urlKey) {
    window.history.replaceState({}, '', window.location.pathname)
    setApiKey(urlKey)
    await loadAthlete()
    return
  }

  const urlOtp = params.get('otp')
  const urlEmail = params.get('email')
  if (urlOtp && urlEmail) {
    window.history.replaceState({}, '', window.location.pathname)
    const isLoggedIn = await login(urlEmail, urlOtp)
    if (isLoggedIn && apiKey.value.trim()) await loadAthlete()
    return
  }

  if (params.get('strava') === 'connected') {
    window.history.replaceState({}, '', window.location.pathname)
    await loadStravaActivities()
    return
  }

  if (apiKey.value.trim()) {
    await loadAthlete()
    if (stravaConnected.value) await loadStravaActivities()
  }
})

function onAuthDone() {
  showAuth.value = false
}

function saveKey() {
  setApiKey(keyInput.value.trim())
  void loadAthlete()
}

function skipConnection() {
  athlete.value = { id: 'local', name: 'Local', bikes: [] } as typeof athlete.value
}

function downloadExport() {
  const blob = new Blob([exportState()], { type: 'application/json' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = 'ride-maintain-backup.json'
  link.click()
  URL.revokeObjectURL(link.href)
}

function triggerImport() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.json,application/json'
  input.onchange = async (event) => {
    const file = (event.target as HTMLInputElement).files?.[0]
    if (!file) return

    const text = await file.text()
    importState(text)

    if (!error.value) {
      await pushProfileToCloud()
    }
  }

  input.click()
}
</script>

<template>
  <div class="app">
    <header class="header">
      <div class="header-main">
        <div class="header-icon">🚴</div>
        <div class="header-text">
          <h1 class="title">{{ t('app.title') }}</h1>
          <p class="subtitle">{{ t('app.subtitle') }}</p>
        </div>
      </div>

      <div class="header-actions">
        <LanguageSwitcher />
      </div>
    </header>

    <HandoffModal v-if="showHandoff" @close="showHandoff = false" />
    <AuthScreen v-if="showAuth" @done="onAuthDone" />

    <section v-else-if="!athlete && !loading" class="setup">
      <div class="source-options">
        <div class="key-section">
          <label for="api-key">{{ t('app.setup.intervals.label') }}</label>

          <div class="key-row">
            <input
              id="api-key"
              v-model="keyInput"
              :type="showKey ? 'text' : 'password'"
              :placeholder="t('app.setup.intervals.placeholder')"
              class="input key-input"
              @keydown.enter="saveKey"
            />

            <button
              type="button"
              class="btn icon"
              :title="showKey ? t('app.setup.intervals.togglePassword.hide') : t('app.setup.intervals.togglePassword.show')"
              :aria-label="showKey ? t('app.setup.intervals.togglePassword.hide') : t('app.setup.intervals.togglePassword.show')"
              @click="showKey = !showKey"
            >
              {{ showKey ? '🙈' : '👁' }}
            </button>

            <button type="button" class="btn btn-primary" :disabled="loading" @click="saveKey">
              {{ loading ? t('app.setup.intervals.connecting') : t('app.setup.intervals.connect') }}
            </button>
          </div>

          <p class="hint">
            {{ t('app.setup.intervals.hint') }}
            <a href="https://app.intervals.icu/settings#developer" target="_blank" class="hint-link">
              {{ t('app.setup.intervals.findKey') }}
            </a>
          </p>
        </div>

        <div class="source-divider"><span>{{ t('app.setup.or') }}</span></div>

        <div class="strava-section">
          <label>{{ t('app.setup.strava.label') }}</label>
          <button type="button" class="btn btn-strava" :disabled="loading" @click="connectStrava">
            <svg class="strava-logo" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" /></svg>
            {{ t('app.setup.strava.connect') }}
          </button>
          <p class="hint">{{ t('app.setup.strava.hint') }}</p>
        </div>
      </div>

      <div class="auth-row">
        <span v-if="authToken" class="auth-badge">✓ {{ t('app.setup.auth.connected') }}</span>
        <button v-else type="button" class="btn btn-link" @click="showAuth = true">
          {{ t('app.setup.auth.syncLogin') }}
        </button>
      </div>

      <button type="button" class="btn btn-link" @click="skipConnection">
        {{ t('app.setup.auth.continueWithoutConnection') }}
      </button>

      <p v-if="error" class="error">{{ error }}</p>
    </section>

    <section v-else class="main">
      <div v-if="error" class="error">{{ error }}</div>
      <div v-if="loading" class="loading">{{ t('common.loading') }}</div>

      <template v-else>
        <div v-if="showHandoffBadge" class="handoff-badge">✓ {{ t('app.badges.handoffLoaded') }}</div>

        <div v-if="bikes.length" class="connection-badges">
          <span v-if="apiKey" class="connection-badge">✓ {{ t('app.badges.intervals') }}</span>
          <span v-if="stravaConnected" class="connection-badge strava-badge">✓ {{ t('app.badges.strava') }}</span>
          <span class="badge-detail">- {{ bikeCountLabel }}</span>
        </div>

        <nav class="tabs">
          <button :class="['tab', { active: currentView === 'dashboard' }]" @click="currentView = 'dashboard'">
            {{ t('app.tabs.bikes') }}
          </button>

          <button :class="['tab', { active: currentView === 'alerts' }]" @click="currentView = 'alerts'">
            {{ t('app.tabs.alerts') }}
            <span v-if="alertComponents.length" class="tab-badge">{{ alertComponents.length }}</span>
          </button>
        </nav>

        <template v-if="currentView === 'dashboard'">
          <div class="bike-grid">
            <BikeCard v-for="bike in bikes" :key="bike.id" :bike="bike" :id="`bike-${bike.id}`" />

            <div v-if="!bikes.length" class="empty-state">
              <p>
                {{ t('app.empty.noBikes') }}
                <button type="button" class="btn btn-link" @click="resetAthlete">
                  {{ t('app.empty.connectIntervals') }}
                </button>
              </p>
            </div>
          </div>
        </template>

        <AlertsView v-else-if="currentView === 'alerts'" />
      </template>

      <div class="footer-actions">
        <button v-if="apiKey" type="button" class="btn secondary" @click="loadAthlete">
          {{ t('app.actions.refreshIntervals') }}
        </button>
        <button v-if="stravaConnected" type="button" class="btn secondary" @click="loadStravaActivities">
          {{ t('app.actions.refreshStrava') }}
        </button>
        <button type="button" class="btn secondary" @click="downloadExport">{{ t('app.actions.export') }}</button>
        <button type="button" class="btn secondary" @click="triggerImport">{{ t('app.actions.import') }}</button>
        <button type="button" class="btn secondary" @click="showHandoff = true">{{ t('app.actions.openOnPhone') }}</button>
        <button v-if="authToken" type="button" class="btn secondary" @click="logout">{{ t('app.actions.logout') }}</button>
        <button v-else type="button" class="btn secondary" @click="showAuth = true">{{ t('app.actions.login') }}</button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.app {
  min-height: 100vh;
  padding: 1.5rem 1.25rem 3rem;
  max-width: 860px;
  margin: 0 auto;
}

.header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 2rem;
  padding-bottom: 1.25rem;
  border-bottom: 2px solid var(--border);
}

.header-main {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.header-actions {
  display: flex;
  justify-content: flex-end;
}

.header-icon {
  font-size: 2.25rem;
  line-height: 1;
  flex-shrink: 0;
}

.title {
  font-size: 1.6rem;
  font-weight: 700;
  margin: 0 0 0.15rem 0;
  letter-spacing: -0.02em;
  color: var(--text);
}

.subtitle {
  color: var(--muted);
  font-size: 0.88rem;
  margin: 0;
}

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

.btn.secondary {
  color: var(--muted);
  border-color: transparent;
  background: transparent;
}

.btn.secondary:hover {
  color: var(--accent);
  background: var(--accent-light);
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

.error {
  color: var(--danger);
  font-size: 0.88rem;
  margin: 0;
  background: var(--danger-light);
  padding: 0.5rem 0.75rem;
  border-radius: var(--radius-sm);
}

.loading {
  color: var(--muted);
  font-size: 0.9rem;
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

.bike-grid {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.empty-state {
  color: var(--muted);
  font-size: 0.9rem;
  padding: 1.5rem 0;
}

.footer-actions {
  margin-top: 1.5rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.tabs {
  display: flex;
  gap: 0.25rem;
  margin-bottom: 1.25rem;
  border-bottom: 2px solid var(--border);
  padding-bottom: 0;
}

.tab {
  padding: 0.5rem 1rem;
  border: none;
  background: none;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 500;
  font-family: inherit;
  color: var(--muted);
  border-bottom: 2px solid transparent;
  margin-bottom: -2px;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  transition: color 0.12s;
}

.tab:hover {
  color: var(--text);
}

.tab.active {
  color: var(--accent);
  border-bottom-color: var(--accent);
  font-weight: 600;
}

.tab-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.1rem;
  height: 1.1rem;
  padding: 0 0.25rem;
  border-radius: 999px;
  background: var(--danger);
  color: #fff;
  font-size: 0.68rem;
  font-weight: 700;
}

.handoff-badge {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--ok, #16a34a);
  margin-bottom: 0.75rem;
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }

  to {
    opacity: 1;
    transform: none;
  }
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

@media (max-width: 640px) {
  .header {
    flex-direction: column;
  }

  .header-main {
    width: 100%;
  }
}
</style>
