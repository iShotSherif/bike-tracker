<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useTracker } from '@/composables/useTracker'
import BikeCard from '@/components/BikeCard.vue'
import DashboardOverview from '@/components/DashboardOverview.vue'
import NotificationSettings from '@/components/NotificationSettings.vue'

const { apiKey, setApiKey, loading, error, bikes, loadAthlete, athlete, exportState, importState, pushProfileToCloud, resetAthlete } = useTracker()

const keyInput = ref('')
const showKey = ref(false)
const importError = ref('')

watch(apiKey, (v) => { keyInput.value = v }, { immediate: true })

onMounted(() => { if (apiKey.value.trim()) loadAthlete() })

function saveKey() {
  setApiKey(keyInput.value.trim())
  loadAthlete()
}

function skipConnection() {
  athlete.value = { id: 'local', name: 'Local', bikes: [] } as any
}

function downloadExport() {
  const blob = new Blob([exportState()], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'ride-maintain-backup.json'
  a.click()
  URL.revokeObjectURL(a.href)
}

function triggerImport() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.json,application/json'
  input.onchange = async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file) return
    const text = await file.text()
    importError.value = ''
    importState(text)
    if (!error.value) await pushProfileToCloud()
  }
  input.click()
}
</script>

<template>
  <div class="app">
    <header class="header">
      <div class="header-icon">🚴</div>
      <div class="header-text">
        <h1 class="title">Ride & Maintain</h1>
        <p class="subtitle">Suis tes composants, note tes entretiens, roule sans surprise.</p>
      </div>
    </header>

    <section v-if="!athlete && !loading" class="setup">
      <div class="key-section">
        <label for="api-key">Clé API Intervals.icu</label>
        <div class="key-row">
          <input
            id="api-key"
            v-model="keyInput"
            :type="showKey ? 'text' : 'password'"
            placeholder="Colle ta clé ici"
            class="input key-input"
            @keydown.enter="saveKey"
          />
          <button type="button" class="btn icon" @click="showKey = !showKey" :title="showKey ? 'Masquer' : 'Afficher'">
            {{ showKey ? '🙈' : '👁' }}
          </button>
          <button type="button" class="btn btn-primary" :disabled="loading" @click="saveKey">
            {{ loading ? 'Connexion à Intervals.icu…' : 'Connecter Intervals.icu' }}
          </button>
        </div>
        <p class="hint">
          Accès en lecture seule. Tes données servent uniquement au calcul des rappels.
          <a href="https://app.intervals.icu/settings#developer" target="_blank" class="hint-link">Où trouver ma clé ?</a>
        </p>
        <button type="button" class="btn btn-link" @click="skipConnection">
          Continuer sans connexion →
        </button>
      </div>
      <p v-if="error" class="error">{{ error }}</p>
    </section>

    <section v-else class="main">
      <div v-if="error" class="error">{{ error }}</div>
      <div v-if="loading" class="loading">Chargement…</div>
      <template v-else>
        <div v-if="bikes.length" class="connection-badge">
          ✓ Intervals.icu connecté — {{ bikes.length }} vélo{{ bikes.length > 1 ? 's' : '' }} trouvé{{ bikes.length > 1 ? 's' : '' }}
        </div>
        <DashboardOverview />
        <div class="bike-grid">
          <BikeCard v-for="bike in bikes" :key="bike.id" :bike="bike" :id="`bike-${bike.id}`" />
          <div v-if="!bikes.length" class="empty-state">
            <p>Aucun vélo connecté. <button type="button" class="btn btn-link" @click="resetAthlete">Connecter Intervals.icu</button></p>
          </div>
        </div>
      </template>
      <div class="footer-actions">
        <button type="button" class="btn secondary" @click="loadAthlete">Actualiser depuis Intervals.icu</button>
        <button type="button" class="btn secondary" @click="downloadExport">Exporter mes données</button>
        <button type="button" class="btn secondary" @click="triggerImport">Importer</button>
      </div>
      <NotificationSettings />
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
  gap: 1rem;
  margin-bottom: 2rem;
  padding-bottom: 1.25rem;
  border-bottom: 2px solid var(--border);
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
.key-section label {
  display: block;
  font-size: 0.82rem;
  font-weight: 600;
  margin-bottom: 0.4rem;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.key-row {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}
.key-input { flex: 1; min-width: 0; }
.input {
  padding: 0.55rem 0.85rem;
  border: 1.5px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface);
  color: var(--text);
  font-size: 0.95rem;
  transition: border-color 0.15s;
}
.input:focus { outline: none; border-color: var(--accent); }
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
.btn:hover:not(:disabled) { background: var(--bg); border-color: var(--muted); }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.btn.icon { padding: 0.55rem 0.7rem; }
.btn-primary {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
  font-weight: 600;
}
.btn-primary:hover:not(:disabled) { background: var(--accent-hover); border-color: var(--accent-hover); }
.btn.secondary { color: var(--muted); border-color: transparent; background: transparent; }
.btn.secondary:hover { color: var(--accent); background: var(--accent-light); }
.hint { font-size: 0.78rem; color: var(--muted); margin: 0.4rem 0 0 0; line-height: 1.6; }
.hint-link { color: var(--accent); text-decoration: none; }
.hint-link:hover { text-decoration: underline; }
.error { color: var(--danger); font-size: 0.88rem; margin: 0; background: var(--danger-light); padding: 0.5rem 0.75rem; border-radius: var(--radius-sm); }
.loading { color: var(--muted); font-size: 0.9rem; }
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
.btn-link:hover { text-decoration: underline; }
.connection-badge {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--ok, #16a34a);
  margin-bottom: 1rem;
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
</style>
