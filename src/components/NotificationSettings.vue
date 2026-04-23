<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useTracker } from '@/composables/useTracker'
import { todayISO } from '@/utils/date'
import type { NotificationSettings } from '@/types'

const props = defineProps<{ inline?: boolean }>()

const { t } = useI18n({ useScope: 'global' })
const { notificationSettings, setNotificationSettings, userId, alertComponents, kmAtDate } = useTracker()

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string

const open = ref(false)
const localEmail = ref(notificationSettings.value.email ?? '')
const localLevel = ref<NotificationSettings['alertLevel']>(notificationSettings.value.alertLevel ?? 'soon-and-overdue')
const saveVisible = ref(false)
const testStatus = ref<'' | 'sending' | 'ok' | 'error'>('')
const pushStatus = ref<'idle' | 'requesting' | 'active' | 'unsupported'>('idle')

const hasPush = computed(() => !!notificationSettings.value.pushSubscription)

watch(notificationSettings, (settings) => {
  localEmail.value = settings.email ?? ''
  localLevel.value = settings.alertLevel ?? 'soon-and-overdue'
  pushStatus.value = settings.pushSubscription ? 'active' : 'idle'
}, { immediate: true })

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)))
}

function alertDetailText(
  bikeId: string,
  component: {
    intervalKm?: number
    intervalDays?: number
    dateStarted: string
  },
): string {
  const parts: string[] = []
  const currentKm = kmAtDate(bikeId, todayISO())
  const startKm = kmAtDate(bikeId, component.dateStarted)

  if (component.intervalKm) {
    const used = Math.floor(Math.max(0, currentKm - startKm))
    const left = component.intervalKm - used
    parts.push(left <= 0
      ? t('alerts.detail.kmOverdue', { count: Math.abs(left) })
      : t('alerts.detail.kmRemaining', { count: left }))
  }

  if (component.intervalDays) {
    const startMs = new Date(component.dateStarted).getTime()
    const nowMs = new Date(todayISO()).getTime()
    const elapsed = Math.floor((nowMs - startMs) / (24 * 60 * 60 * 1000))
    const left = component.intervalDays - elapsed
    parts.push(left <= 0
      ? Math.abs(left) === 1
        ? t('alerts.detail.daysOverdueSingle')
        : t('alerts.detail.daysOverdueMultiple', { count: Math.abs(left) })
      : left === 1
        ? t('alerts.detail.daysRemainingSingle')
        : t('alerts.detail.daysRemainingMultiple', { count: left }))
  }

  return parts.join(' - ')
}

async function enablePush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    pushStatus.value = 'unsupported'
    return
  }

  pushStatus.value = 'requesting'

  try {
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
      pushStatus.value = 'idle'
      return
    }

    const registration = await navigator.serviceWorker.register('/sw.js')
    await navigator.serviceWorker.ready

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    })

    const nextSettings = {
      ...notificationSettings.value,
      pushSubscription: subscription.toJSON(),
    }

    setNotificationSettings(nextSettings)
    pushStatus.value = 'active'
  } catch (error) {
    console.error('Push subscription failed', error)
    pushStatus.value = 'idle'
  }
}

async function disablePush() {
  try {
    const registration = await navigator.serviceWorker.getRegistration('/sw.js')
    if (registration) {
      const subscription = await registration.pushManager.getSubscription()
      if (subscription) await subscription.unsubscribe()
    }
  } catch {
    // best effort
  }

  setNotificationSettings({ ...notificationSettings.value, pushSubscription: undefined })
  pushStatus.value = 'idle'
}

function save() {
  const nextSettings = {
    ...notificationSettings.value,
    email: localEmail.value.trim() || undefined,
    alertLevel: localLevel.value,
  }

  setNotificationSettings(nextSettings)

  const workerUrl = import.meta.env.VITE_WORKER_URL as string | undefined
  if (workerUrl && userId.value && (localEmail.value.trim() || hasPush.value)) {
    const payload = {
      userId: userId.value,
      notificationSettings: nextSettings,
      alertComponents: alertComponents.value.map((item) => ({
        componentName: item.component.name,
        bikeName: item.bikeName,
        status: item.status,
        detail: alertDetailText(item.bikeId, item.component),
      })),
    }

    void fetch(`${workerUrl}/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => {})
  }

  saveVisible.value = true
  window.setTimeout(() => {
    saveVisible.value = false
  }, 2500)
}

async function sendTest() {
  testStatus.value = 'sending'

  try {
    const workerUrl = import.meta.env.VITE_WORKER_URL as string | undefined

    if (hasPush.value && workerUrl) {
      await fetch(`${workerUrl}/test-notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userId.value,
          pushSubscription: notificationSettings.value.pushSubscription,
        }),
      })
    }

    const email = localEmail.value.trim()
    if (workerUrl && email) {
      await fetch(`${workerUrl}/test-notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, userId: userId.value }),
      })
    }

    testStatus.value = 'ok'
  } catch {
    testStatus.value = 'error'
  }

  window.setTimeout(() => {
    testStatus.value = ''
  }, 3000)
}
</script>

<template>
  <section class="notif-panel" :class="{ 'notif-panel-inline': props.inline }">
    <button v-if="!props.inline" type="button" class="notif-toggle" @click="open = !open">
      <span class="notif-icon">🔔</span>
      {{ t('notifications.title') }}
      <span class="chevron">{{ open ? '▲' : '▼' }}</span>
    </button>

    <div v-if="props.inline || open" class="notif-body" :class="{ 'notif-body-inline': props.inline }">
      <div class="field">
        <label class="field-label">{{ t('common.email') }}</label>
        <input v-model="localEmail" type="email" class="input" :placeholder="t('auth.emailPlaceholder')" />
      </div>

      <div class="field">
        <label class="field-label">{{ t('notifications.phoneLabel') }}</label>

        <template v-if="localEmail.trim()">
          <div v-if="pushStatus === 'unsupported'" class="hint warn">
            {{ t('notifications.pushUnsupported') }}
          </div>

          <template v-else-if="pushStatus === 'active' || hasPush">
            <div class="push-active">
              <span class="push-badge">✓ {{ t('notifications.pushEnabled') }}</span>
              <button type="button" class="btn btn-ghost" @click="disablePush">{{ t('notifications.disable') }}</button>
            </div>
          </template>

          <template v-else>
            <button type="button" class="btn btn-push" :disabled="pushStatus === 'requesting'" @click="enablePush">
              {{ pushStatus === 'requesting' ? t('notifications.enabling') : `🔔 ${t('notifications.enable')}` }}
            </button>
            <p class="hint">{{ t('notifications.pushHint') }}</p>
          </template>
        </template>

        <p v-else class="hint">{{ t('notifications.emailHint') }}</p>
      </div>

      <div class="field">
        <label class="field-label">{{ t('notifications.alertLevel') }}</label>

        <div class="toggle-row">
          <button
            type="button"
            :class="['toggle-btn', { active: localLevel === 'soon-and-overdue' }]"
            @click="localLevel = 'soon-and-overdue'"
          >
            {{ t('notifications.soonAndOverdue') }}
          </button>

          <button
            type="button"
            :class="['toggle-btn', { active: localLevel === 'overdue-only' }]"
            @click="localLevel = 'overdue-only'"
          >
            {{ t('notifications.overdueOnly') }}
          </button>
        </div>
      </div>

      <div class="notif-actions">
        <button type="button" class="btn btn-primary" @click="save">{{ t('common.save') }}</button>

        <button
          type="button"
          class="btn"
          :disabled="testStatus === 'sending' || (!hasPush && !localEmail.trim())"
          @click="sendTest"
        >
          {{
            testStatus === 'sending'
              ? t('notifications.testSending')
              : testStatus === 'ok'
                ? `✓ ${t('notifications.testSuccess')}`
                : testStatus === 'error'
                  ? `✕ ${t('notifications.testError')}`
                  : t('notifications.test')
          }}
        </button>

        <span v-if="saveVisible" class="save-feedback">{{ t('notifications.saved') }}</span>
      </div>
    </div>
  </section>
</template>

<style scoped>
.notif-panel {
  margin-top: 1rem;
  border: 1.5px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
  background: var(--surface);
}

.notif-panel-inline {
  margin-top: 0;
  border: none;
  border-radius: 0;
  overflow: visible;
  background: transparent;
}

.notif-toggle {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--muted);
  font-family: inherit;
  text-align: left;
  transition: color 0.15s, background 0.15s;
}

.notif-toggle:hover {
  color: var(--text);
  background: var(--bg);
}

.notif-icon {
  font-size: 1rem;
}

.chevron {
  margin-left: auto;
  font-size: 0.7rem;
}

.notif-body {
  padding: 1rem 1.25rem 1.25rem;
  border-top: 1.5px solid var(--border);
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.notif-body-inline {
  border-top: none;
  padding: 1rem 1.25rem 1.2rem;
  gap: 1rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.notif-body-inline .field {
  padding: 0;
}

.field-label {
  font-size: 0.78rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--muted);
}

.input {
  padding: 0.62rem 0.85rem;
  border: 1.5px solid var(--border);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.72);
  color: var(--text);
  font-size: 0.9rem;
  font-family: inherit;
  transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
}

.input:focus {
  outline: none;
  border-color: color-mix(in srgb, var(--accent) 65%, white);
  box-shadow: 0 0 0 3px rgba(232, 93, 38, 0.1);
  background: #fff;
}

.push-active {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.push-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--ok, #16a34a);
  background: var(--ok-light, #f0fdf4);
  border: 1.5px solid currentColor;
  border-radius: 5px;
  padding: 0.25rem 0.6rem;
}

.btn-push {
  padding: 0.52rem 1rem;
  border-radius: 999px;
  border: 1.5px solid var(--accent);
  background: var(--accent-light, #fff5f0);
  color: var(--accent);
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 600;
  font-family: inherit;
  transition: background 0.15s;
}

.btn-push:hover:not(:disabled) {
  background: var(--accent);
  color: #fff;
}

.btn-push:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.hint {
  font-size: 0.78rem;
  color: var(--muted);
  margin: 0;
  line-height: 1.5;
  max-width: 42rem;
}

.hint.warn {
  color: var(--danger, #dc2626);
}

.toggle-row {
  display: flex;
  gap: 0.45rem;
  flex-wrap: wrap;
}

.toggle-btn {
  padding: 0.45rem 0.9rem;
  font-size: 0.83rem;
  font-weight: 600;
  font-family: inherit;
  border-radius: 999px;
  border: 1.5px solid var(--border);
  background: rgba(255, 255, 255, 0.7);
  color: var(--muted);
  cursor: pointer;
  transition: all 0.12s;
}

.toggle-btn.active {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}

.notif-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  padding-top: 0.1rem;
}

.btn {
  padding: 0.5rem 0.95rem;
  border-radius: 999px;
  border: 1.5px solid var(--border);
  background: rgba(255, 255, 255, 0.72);
  color: var(--text);
  cursor: pointer;
  font-size: 0.88rem;
  font-weight: 600;
  font-family: inherit;
  transition: background 0.12s, border-color 0.12s;
}

.btn:hover:not(:disabled) {
  background: var(--bg);
  border-color: var(--muted);
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
  font-weight: 600;
}

.btn-primary:hover {
  background: var(--accent-hover);
  border-color: var(--accent-hover);
}

.btn-ghost {
  background: transparent;
  border-color: transparent;
  color: var(--muted);
  padding: 0.25rem 0.5rem;
  font-size: 0.8rem;
}

.btn-ghost:hover {
  color: var(--danger, #dc2626);
  background: var(--danger-light, #fef2f2);
}

.save-feedback {
  font-size: 0.82rem;
  color: var(--ok, #16a34a);
  font-weight: 600;
}

@media (max-width: 640px) {
  .notif-body-inline {
    padding: 0.95rem 1rem 1.05rem;
  }
}
</style>
