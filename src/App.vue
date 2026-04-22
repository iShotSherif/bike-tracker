<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useTracker } from '@/composables/useTracker'
import BikeCard from '@/components/BikeCard.vue'
import DashboardOverview from '@/components/DashboardOverview.vue'
import NotificationSettings from '@/components/NotificationSettings.vue'

const { apiKey, setApiKey, loading, error, bikes, loadAthlete } = useTracker()

const keyInput = ref('')
const showKey = ref(false)

watch(apiKey, (v) => { keyInput.value = v }, { immediate: true })

onMounted(() => { if (apiKey.value.trim()) loadAthlete() })

function saveKey() {
  setApiKey(keyInput.value.trim())
  loadAthlete()
}
</script>

<template>
  <div class="app">
    <header class="header">
      <div class="header-icon">🚴</div>
      <div class="header-text">
        <h1 class="title">Ride & Maintain</h1>
        <p class="subtitle">Keep your bikes in shape — track components, log services, stay rolling.</p>
      </div>
    </header>

    <section v-if="!bikes.length && !loading" class="setup">
      <div class="key-section">
        <label for="api-key">Intervals.icu API key</label>
        <div class="key-row">
          <input
            id="api-key"
            v-model="keyInput"
            :type="showKey ? 'text' : 'password'"
            placeholder="API_KEY:your_key or paste key only"
            class="input key-input"
            @keydown.enter="saveKey"
          />
          <button type="button" class="btn icon" @click="showKey = !showKey" :title="showKey ? 'Hide' : 'Show'">
            {{ showKey ? '🙈' : '👁' }}
          </button>
          <button type="button" class="btn btn-primary" :disabled="loading" @click="saveKey">
            {{ loading ? 'Loading…' : 'Load bikes' }}
          </button>
        </div>
        <p class="hint">Get your key in Intervals.icu → Settings → Developer settings. Stored only in this browser.</p>
      </div>
      <p v-if="error" class="error">{{ error }}</p>
    </section>

    <section v-else class="main">
      <div v-if="error" class="error">{{ error }}</div>
      <div v-if="loading" class="loading">Loading…</div>
      <template v-else>
        <DashboardOverview />
        <div class="bike-grid">
          <BikeCard v-for="bike in bikes" :key="bike.id" :bike="bike" :id="`bike-${bike.id}`" />
        </div>
      </template>
      <div class="footer-actions">
        <button type="button" class="btn secondary" @click="loadAthlete">Refresh from Intervals.icu</button>
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
.hint { font-size: 0.78rem; color: var(--muted); margin: 0.4rem 0 0 0; }
.error { color: var(--danger); font-size: 0.88rem; margin: 0; background: var(--danger-light); padding: 0.5rem 0.75rem; border-radius: var(--radius-sm); }
.loading { color: var(--muted); font-size: 0.9rem; }
.bike-grid {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}
.footer-actions { margin-top: 1.5rem; }
</style>
