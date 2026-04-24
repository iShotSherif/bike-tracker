<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Settings } from 'lucide-vue-next'
import AuthScreen from '@/components/AuthScreen.vue'
import BikeCard from '@/components/BikeCard.vue'
import ConnectionBadges from '@/components/ConnectionBadges.vue'
import FooterActions from '@/components/FooterActions.vue'
import HandoffModal from '@/components/HandoffModal.vue'
import LanguageSwitcher from '@/components/LanguageSwitcher.vue'
import SettingsView from '@/components/SettingsView.vue'
import SetupView from '@/components/SetupView.vue'
import { useBackup } from '@/composables/useBackup'
import { useHandoff } from '@/composables/useHandoff'
import { useTracker } from '@/composables/useTracker'

const { t } = useI18n({ useScope: 'global' })

const {
  loading,
  error,
  bikes,
  athlete,
  exportState,
  importState,
  pushProfileToCloud,
  stravaConnected,
  connectStrava,
  loadStravaActivities,
  authToken,
  login,
  logout,
} = useTracker()

const { downloadExport, triggerImport } = useBackup({
  error,
  exportState,
  importState,
  pushProfileToCloud,
})

const { showHandoffBadge, handleHandoffFromUrl } = useHandoff({
  authToken,
  importState,
  loadStravaActivities,
  stravaConnected,
})

const showAuth = ref(false)
const showHandoff = ref(false)
const currentView = ref<'dashboard' | 'settings'>('dashboard')
const bikeCountLabel = computed(() =>
  bikes.value.length === 1
    ? t('app.badges.bikeFoundSingle')
    : t('app.badges.bikeFoundMultiple', { count: bikes.value.length }),
)

function decodeTransferState(value: string): string {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padding = '='.repeat((4 - normalized.length % 4) % 4)
  const binary = atob(normalized + padding)
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

onMounted(async () => {
  if (await handleHandoffFromUrl()) return

  const params = new URLSearchParams(window.location.search)
  const importedState = params.get('import')

  if (importedState) {
    window.history.replaceState({}, '', window.location.pathname)
    try {
      importState(decodeTransferState(importedState))
    } catch {
      error.value = 'Fichier invalide.'
    }
    if (stravaConnected.value) await loadStravaActivities()
    return
  }

  const urlOtp = params.get('otp')
  const urlEmail = params.get('email')
  if (urlOtp && urlEmail) {
    window.history.replaceState({}, '', window.location.pathname)
    const isLoggedIn = await login(urlEmail, urlOtp)
    if (isLoggedIn && stravaConnected.value) await loadStravaActivities()
    return
  }

  if (params.get('strava') === 'connected') {
    window.history.replaceState({}, '', window.location.pathname)
    await loadStravaActivities()
    return
  }

  if (stravaConnected.value) await loadStravaActivities()
})

function skipConnection() {
  athlete.value = { id: 'local', name: 'Local', bikes: [] } as typeof athlete.value
}

function toggleSettings() {
  currentView.value = currentView.value === 'settings' ? 'dashboard' : 'settings'
}
</script>

<template>
  <div class="app">
    <header class="header">
      <div class="header-main">
        <div class="header-mark">RM</div>
        <div class="header-text">
          <h1 class="title">{{ t('app.title') }}</h1>
          <p class="subtitle">{{ t('app.subtitle') }}</p>
        </div>
      </div>

      <div class="header-actions">
        <LanguageSwitcher />
        <button
          type="button"
          :class="['header-icon-button', { active: currentView === 'settings' }]"
          :aria-label="t('settings.open')"
          :aria-pressed="currentView === 'settings'"
          @click="toggleSettings"
        >
          <Settings :size="18" stroke-width="2.2" />
        </button>
      </div>
    </header>

    <HandoffModal v-if="showHandoff" @close="showHandoff = false" />
    <AuthScreen v-if="showAuth" @done="showAuth = false" />

    <SetupView
      v-else-if="!athlete && !loading"
      :auth-token="authToken"
      :error="error"
      :loading="loading"
      @connect-strava="connectStrava"
      @open-auth="showAuth = true"
      @skip-connection="skipConnection"
    />

    <section v-else class="main">
      <div v-if="error" class="error">{{ error }}</div>
      <div v-if="loading" class="loading">{{ t('common.loading') }}</div>

      <template v-else>
        <div v-if="showHandoffBadge" class="handoff-badge">✓ {{ t('app.badges.handoffLoaded') }}</div>

        <ConnectionBadges
          v-if="bikes.length"
          :bike-count-label="bikeCountLabel"
          :show-strava="stravaConnected"
        />

        <div v-if="currentView === 'dashboard'" class="bike-grid">
          <BikeCard v-for="bike in bikes" :key="bike.id" :bike="bike" :id="`bike-${bike.id}`" />

          <div v-if="!bikes.length" class="empty-state">
            <p>
              {{ t('app.empty.noBikes') }}
              <button type="button" class="btn-link" @click="stravaConnected ? loadStravaActivities() : connectStrava()">
                {{ stravaConnected ? t('app.actions.refreshStrava') : t('app.setup.strava.connect') }}
              </button>
            </p>
          </div>
        </div>

        <SettingsView v-else />
      </template>

      <FooterActions
        :auth-token="authToken"
        :show-refresh-strava="stravaConnected"
        @download-export="downloadExport"
        @logout="logout"
        @open-auth="showAuth = true"
        @open-handoff="showHandoff = true"
        @refresh-strava="loadStravaActivities"
        @trigger-import="triggerImport"
      />
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
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.4rem;
  padding-bottom: 1rem;
  border-bottom: 1.5px solid var(--border);
}

.header-main {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.header-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.45rem;
}

.header-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.45rem;
  height: 2.45rem;
  border-radius: 8px;
  background: var(--accent);
  color: #fff;
  font-size: 0.82rem;
  font-weight: 900;
  letter-spacing: 0.03em;
  flex-shrink: 0;
  box-shadow: 0 10px 22px color-mix(in srgb, var(--accent) 22%, transparent);
}

.header-icon-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}

.header-icon-button:hover,
.header-icon-button.active {
  border-color: color-mix(in srgb, var(--accent) 45%, var(--border));
  color: var(--accent);
  background: var(--accent-light);
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

.main {
  min-width: 0;
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

.handoff-badge {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--ok, #16a34a);
  margin-bottom: 0.75rem;
  animation: fadeIn 0.3s ease;
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

@media (max-width: 640px) {
  .header {
    align-items: flex-start;
  }

  .header-main {
    min-width: 0;
  }

  .header-actions {
    margin-left: auto;
  }
}
</style>
