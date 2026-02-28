<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useTracker } from '@/composables/useTracker'
import BikeCard from '@/components/BikeCard.vue'

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
      <h1 class="title">Bike component tracker</h1>
      <p class="subtitle">Cumulative km from Intervals.icu — chain wax, brakes, and more</p>
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
      <div v-else class="bike-grid">
        <BikeCard v-for="bike in bikes" :key="bike.id" :bike="bike" />
      </div>
      <div class="footer-actions">
        <button type="button" class="btn secondary" @click="loadAthlete">Refresh from Intervals.icu</button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.app {
  min-height: 100vh;
  padding: 1.5rem;
  max-width: 900px;
  margin: 0 auto;
}
.header {
  margin-bottom: 2rem;
}
.title {
  font-size: 1.75rem;
  font-weight: 700;
  margin: 0 0 0.25rem 0;
}
.subtitle {
  color: var(--muted);
  font-size: 0.95rem;
  margin: 0;
}
.setup {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.key-section label {
  display: block;
  font-size: 0.85rem;
  font-weight: 500;
  margin-bottom: 0.35rem;
  color: var(--muted);
}
.key-row {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}
.key-input { flex: 1; min-width: 0; }
.input {
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg);
  color: var(--text);
  font-size: 0.95rem;
}
.btn {
  padding: 0.5rem 1rem;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--text);
  cursor: pointer;
  font-size: 0.9rem;
}
.btn:hover:not(:disabled) { background: var(--surface); }
.btn:disabled { opacity: 0.6; cursor: not-allowed; }
.btn.icon { padding: 0.5rem 0.65rem; }
.btn-primary {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--bg);
}
.btn-primary:hover:not(:disabled) { filter: brightness(1.1); }
.btn.secondary { color: var(--muted); }
.btn.secondary:hover { color: var(--text); }
.hint { font-size: 0.8rem; color: var(--muted); margin: 0.35rem 0 0 0; }
.error { color: var(--danger); font-size: 0.9rem; margin: 0; }
.loading { color: var(--muted); }
.bike-grid {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}
.footer-actions { margin-top: 1.5rem; }
</style>
