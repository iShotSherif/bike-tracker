<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import QRCode from 'qrcode'
import { useTracker } from '@/composables/useTracker'

const emit = defineEmits<{ close: [] }>()

const { t } = useI18n({ useScope: 'global' })
const { authToken, exportState, userId } = useTracker()

const WORKER_URL = import.meta.env.VITE_WORKER_URL as string | undefined

type HandoffErrorKey = '' | 'handoff.generateError'

const qrDataUrl = ref('')
const handoffUrl = ref('')
const secondsLeft = ref(300)
const errorKey = ref<HandoffErrorKey>('')
let timer: ReturnType<typeof setInterval> | null = null

const minutesDisplay = computed(() => {
  const minutes = Math.floor(secondsLeft.value / 60)
  const seconds = secondsLeft.value % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
})

const expired = computed(() => secondsLeft.value <= 0)
const isFallback = computed(() => !WORKER_URL)

function encodeTransferState(value: string): string {
  const bytes = new TextEncoder().encode(value)
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('')
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

onMounted(async () => {
  if (!WORKER_URL) {
    const fallbackUrl = `${window.location.origin}${window.location.pathname}?import=${encodeURIComponent(encodeTransferState(exportState()))}`
    handoffUrl.value = fallbackUrl
    await renderQr(fallbackUrl)
    return
  }

  try {
    const response = await fetch(`${WORKER_URL}/handoff`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: userId.value,
        sessionToken: authToken.value || undefined,
      }),
    })

    if (!response.ok) throw new Error('Request failed')

    const data = await response.json() as { handoffUrl: string }
    handoffUrl.value = data.handoffUrl
    await renderQr(data.handoffUrl)
    startCountdown()
  } catch {
    errorKey.value = 'handoff.generateError'
  }
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})

async function renderQr(url: string) {
  qrDataUrl.value = await QRCode.toDataURL(url, {
    width: 240,
    margin: 2,
    color: { dark: '#292524', light: '#f7f5f2' },
  })
}

function startCountdown() {
  timer = setInterval(() => {
    secondsLeft.value -= 1

    if (secondsLeft.value <= 0) {
      clearInterval(timer!)
      qrDataUrl.value = ''
    }
  }, 1000)
}

async function copyUrl() {
  await navigator.clipboard.writeText(handoffUrl.value)
}
</script>

<template>
  <div class="modal-backdrop" @click.self="emit('close')">
    <div class="modal">
      <button class="modal-close" :aria-label="t('handoff.close')" @click="emit('close')">✕</button>

      <h2 class="modal-title">{{ t('handoff.title') }}</h2>

      <template v-if="isFallback">
        <p class="modal-hint warn">{{ t('handoff.fallbackWarning') }}</p>
      </template>
      <template v-else>
        <p class="modal-hint">{{ t('handoff.scanHint') }}</p>
      </template>

      <div class="qr-area">
        <div v-if="errorKey" class="qr-error">{{ t(errorKey) }}</div>

        <div v-else-if="expired" class="qr-expired">
          <p>{{ t('handoff.expired') }}</p>
          <button class="btn btn-primary" @click="emit('close')">{{ t('common.close') }}</button>
        </div>

        <template v-else>
          <img v-if="qrDataUrl" :src="qrDataUrl" class="qr-img" :alt="t('handoff.qrAlt')" />
          <div v-else class="qr-loading">{{ t('handoff.generating') }}</div>
          <div v-if="!isFallback" :class="['countdown', { warn: secondsLeft < 60 }]">{{ minutesDisplay }}</div>
        </template>
      </div>

      <div class="url-row">
        <input readonly :value="handoffUrl" class="url-input" />
        <button class="btn" @click="copyUrl">{{ t('common.copy') }}</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
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

.modal-close:hover {
  color: var(--text);
}

.modal-title {
  font-size: 1.1rem;
  font-weight: 700;
  margin: 0;
  color: var(--text);
}

.modal-hint {
  font-size: 0.82rem;
  color: var(--muted);
  margin: 0;
  line-height: 1.5;
}

.modal-hint.warn {
  color: var(--warning, #d97706);
}

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

.qr-img {
  display: block;
  border-radius: 4px;
}

.qr-loading {
  color: var(--muted);
  font-size: 0.85rem;
}

.qr-error {
  color: var(--danger);
  font-size: 0.85rem;
  text-align: center;
}

.qr-expired {
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  align-items: center;
  color: var(--muted);
  font-size: 0.85rem;
}

.countdown {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--ok, #16a34a);
  font-variant-numeric: tabular-nums;
}

.countdown.warn {
  color: var(--danger);
}

.url-row {
  display: flex;
  gap: 0.5rem;
}

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

.btn:hover {
  background: var(--bg);
}

.btn-primary {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}

.btn-primary:hover {
  background: var(--accent-hover);
}
</style>
