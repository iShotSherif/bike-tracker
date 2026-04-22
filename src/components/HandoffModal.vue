<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import QRCode from 'qrcode'
import { useTracker } from '@/composables/useTracker'

const emit = defineEmits<{ close: [] }>()

const { authToken, userId, importState, pushProfileToCloud } = useTracker()

const WORKER_URL = import.meta.env.VITE_WORKER_URL as string | undefined

const qrDataUrl = ref('')
const handoffUrl = ref('')
const secondsLeft = ref(300)
const error = ref('')
let timer: ReturnType<typeof setInterval> | null = null

const minutesDisplay = computed(() => {
  const m = Math.floor(secondsLeft.value / 60)
  const s = secondsLeft.value % 60
  return `${m}:${s.toString().padStart(2, '0')}`
})

const expired = computed(() => secondsLeft.value <= 0)

onMounted(async () => {
  if (!WORKER_URL) {
    // Fallback: encode API key in URL
    const params = new URLSearchParams(window.location.search)
    const key = (useTracker()).apiKey.value
    if (key) {
      const fallbackUrl = `${window.location.origin}${window.location.pathname}?key=${encodeURIComponent(key)}`
      handoffUrl.value = fallbackUrl
      await renderQr(fallbackUrl)
    }
    return
  }

  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (authToken.value) headers['Authorization'] = `Bearer ${authToken.value}`

    const res = await fetch(`${WORKER_URL}/handoff`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ userId: userId.value }),
    })
    if (!res.ok) throw new Error('Erreur serveur')
    const data = await res.json() as { handoffUrl: string }
    handoffUrl.value = data.handoffUrl
    await renderQr(data.handoffUrl)
    startCountdown()
  } catch {
    error.value = 'Impossible de générer le QR code.'
  }
})

onUnmounted(() => { if (timer) clearInterval(timer) })

async function renderQr(url: string) {
  qrDataUrl.value = await QRCode.toDataURL(url, {
    width: 240,
    margin: 2,
    color: { dark: '#292524', light: '#f7f5f2' },
  })
}

function startCountdown() {
  timer = setInterval(() => {
    secondsLeft.value--
    if (secondsLeft.value <= 0) {
      clearInterval(timer!)
      qrDataUrl.value = ''
    }
  }, 1000)
}

async function copyUrl() {
  await navigator.clipboard.writeText(handoffUrl.value)
}

const isFallback = computed(() => !WORKER_URL)
</script>

<template>
  <div class="modal-backdrop" @click.self="emit('close')">
    <div class="modal">
      <button class="modal-close" @click="emit('close')" aria-label="Fermer">✕</button>

      <h2 class="modal-title">Ouvrir sur mon téléphone</h2>

      <template v-if="isFallback">
        <p class="modal-hint warn">
          Ce lien contient ta clé API — ne le partage pas avec quelqu'un d'autre.
        </p>
      </template>
      <template v-else>
        <p class="modal-hint">Scanne ce code avec ton téléphone. Valable 5 minutes.</p>
      </template>

      <div class="qr-area">
        <div v-if="error" class="qr-error">{{ error }}</div>
        <div v-else-if="expired" class="qr-expired">
          <p>Code expiré.</p>
          <button class="btn btn-primary" @click="$emit('close')">Fermer</button>
        </div>
        <template v-else>
          <img v-if="qrDataUrl" :src="qrDataUrl" class="qr-img" alt="QR code" />
          <div v-else class="qr-loading">Génération…</div>
          <div v-if="!isFallback" :class="['countdown', { warn: secondsLeft < 60 }]">
            {{ minutesDisplay }}
          </div>
        </template>
      </div>

      <div class="url-row">
        <input readonly :value="handoffUrl" class="url-input" />
        <button class="btn" @click="copyUrl">Copier</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  padding: 1rem;
}
.modal {
  background: var(--surface);
  border: 1.5px solid var(--border);
  border-radius: var(--radius);
  padding: 1.75rem;
  width: 100%;
  max-width: 340px;
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.modal-close {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1rem;
  color: var(--muted);
  line-height: 1;
}
.modal-close:hover { color: var(--text); }
.modal-title {
  font-size: 1.1rem;
  font-weight: 700;
  margin: 0;
  color: var(--text);
}
.modal-hint { font-size: 0.82rem; color: var(--muted); margin: 0; line-height: 1.5; }
.modal-hint.warn { color: var(--warning, #d97706); }
.qr-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem;
  background: var(--bg);
  border-radius: var(--radius-sm);
  border: 1.5px solid var(--border);
  min-height: 200px;
  justify-content: center;
}
.qr-img { display: block; border-radius: 4px; }
.qr-loading { color: var(--muted); font-size: 0.85rem; }
.qr-error { color: var(--danger); font-size: 0.85rem; text-align: center; }
.qr-expired { text-align: center; display: flex; flex-direction: column; gap: 0.75rem; align-items: center; color: var(--muted); font-size: 0.85rem; }
.countdown {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--ok, #16a34a);
  font-variant-numeric: tabular-nums;
}
.countdown.warn { color: var(--danger); }
.url-row { display: flex; gap: 0.5rem; }
.url-input {
  flex: 1;
  min-width: 0;
  padding: 0.45rem 0.7rem;
  font-size: 0.75rem;
  border: 1.5px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg);
  color: var(--muted);
  font-family: monospace;
}
.btn {
  padding: 0.45rem 0.85rem;
  border-radius: var(--radius-sm);
  border: 1.5px solid var(--border);
  background: var(--surface);
  color: var(--text);
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 500;
  font-family: inherit;
  white-space: nowrap;
}
.btn:hover { background: var(--bg); }
.btn-primary { background: var(--accent); border-color: var(--accent); color: #fff; }
.btn-primary:hover { background: var(--accent-hover); }
</style>
