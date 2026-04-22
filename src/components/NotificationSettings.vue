<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useTracker } from '@/composables/useTracker'
import type { NotificationSettings } from '@/types'

const { notificationSettings, setNotificationSettings, userId, alertComponents, kmAtDate } = useTracker()
import { alertDetail } from '@/utils/status'
import { todayISO } from '@/utils/date'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string

const open = ref(false)
const localEmail = ref(notificationSettings.value.email ?? '')
const localLevel = ref<NotificationSettings['alertLevel']>(notificationSettings.value.alertLevel ?? 'soon-and-overdue')

const saveStatus = ref('')
const testStatus = ref<'' | 'sending' | 'ok' | 'error'>('')
const pushStatus = ref<'idle' | 'requesting' | 'active' | 'unsupported'>('idle')

const hasPush = computed(() => !!notificationSettings.value.pushSubscription)

watch(notificationSettings, (s) => {
  localEmail.value = s.email ?? ''
  localLevel.value = s.alertLevel ?? 'soon-and-overdue'
  pushStatus.value = s.pushSubscription ? 'active' : 'idle'
}, { immediate: true })

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)))
}

async function enablePush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    pushStatus.value = 'unsupported'
    return
  }
  pushStatus.value = 'requesting'
  try {
    const perm = await Notification.requestPermission()
    if (perm !== 'granted') { pushStatus.value = 'idle'; return }

    const reg = await navigator.serviceWorker.register('/sw.js')
    await navigator.serviceWorker.ready

    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    })

    const subJson = sub.toJSON()
    setNotificationSettings({ ...notificationSettings.value, pushSubscription: subJson })
    pushStatus.value = 'active'
  } catch (e) {
    console.error('Push subscription failed', e)
    pushStatus.value = 'idle'
  }
}

async function disablePush() {
  try {
    const reg = await navigator.serviceWorker.getRegistration('/sw.js')
    if (reg) {
      const sub = await reg.pushManager.getSubscription()
      if (sub) await sub.unsubscribe()
    }
  } catch { /* best effort */ }
  setNotificationSettings({ ...notificationSettings.value, pushSubscription: undefined })
  pushStatus.value = 'idle'
}

function save() {
  setNotificationSettings({
    ...notificationSettings.value,
    email: localEmail.value.trim() || undefined,
    alertLevel: localLevel.value,
  })

  const workerUrl = import.meta.env.VITE_WORKER_URL as string | undefined
  if (workerUrl && userId.value && (localEmail.value.trim() || hasPush.value)) {
    const payload = {
      userId: userId.value,
      notificationSettings: notificationSettings.value,
      alertComponents: alertComponents.value.map((item) => ({
        componentName: item.component.name,
        bikeName: item.bikeName,
        status: item.status,
        detail: alertDetail(item.component, kmAtDate(item.bikeId, todayISO())),
      })),
    }
    fetch(`${workerUrl}/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => {})
  }

  saveStatus.value = 'Alertes enregistrées.'
  setTimeout(() => { saveStatus.value = '' }, 2500)
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
  setTimeout(() => { testStatus.value = '' }, 3000)
}
</script>

<template>
  <section class="notif-panel">
    <button type="button" class="notif-toggle" @click="open = !open">
      <span class="notif-icon">🔔</span>
      Mes alertes
      <span class="chevron">{{ open ? '▲' : '▼' }}</span>
    </button>

    <div v-if="open" class="notif-body">
      <div class="field">
        <label class="field-label">Email</label>
        <input
          v-model="localEmail"
          type="email"
          class="input"
          placeholder="toi@exemple.com"
        />
      </div>

      <div class="field">
        <label class="field-label">Notifications sur ce téléphone</label>
        <template v-if="localEmail.trim()">
          <div v-if="pushStatus === 'unsupported'" class="hint warn">
            Les notifications push ne sont pas supportées par ce navigateur.
          </div>
          <template v-else-if="pushStatus === 'active' || hasPush">
            <div class="push-active">
              <span class="push-badge">✓ Push activé</span>
              <button type="button" class="btn btn-ghost" @click="disablePush">Désactiver</button>
            </div>
          </template>
          <template v-else>
            <button
              type="button"
              class="btn btn-push"
              :disabled="pushStatus === 'requesting'"
              @click="enablePush"
            >
              {{ pushStatus === 'requesting' ? 'En cours…' : '🔔 Activer les notifications' }}
            </button>
            <p class="hint">Un seul clic — les rappels arrivent directement sur ce téléphone, sans appli à installer.</p>
          </template>
        </template>
        <p v-else class="hint">Entre ton email ci-dessus pour activer les rappels sur ce téléphone.</p>
      </div>

      <div class="field">
        <label class="field-label">Niveau d'alerte</label>
        <div class="toggle-row">
          <button
            type="button"
            :class="['toggle-btn', { active: localLevel === 'soon-and-overdue' }]"
            @click="localLevel = 'soon-and-overdue'"
          >Bientôt dû + En retard</button>
          <button
            type="button"
            :class="['toggle-btn', { active: localLevel === 'overdue-only' }]"
            @click="localLevel = 'overdue-only'"
          >En retard uniquement</button>
        </div>
      </div>

      <div class="notif-actions">
        <button type="button" class="btn btn-primary" @click="save">Enregistrer</button>
        <button
          type="button"
          class="btn"
          :disabled="testStatus === 'sending' || (!hasPush && !localEmail.trim())"
          @click="sendTest"
        >
          {{ testStatus === 'sending' ? 'Envoi…' : testStatus === 'ok' ? '✓ Envoyé !' : testStatus === 'error' ? '✗ Erreur' : 'Tester' }}
        </button>
        <span v-if="saveStatus" class="save-feedback">{{ saveStatus }}</span>
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
.notif-toggle:hover { color: var(--text); background: var(--bg); }
.notif-icon { font-size: 1rem; }
.chevron { margin-left: auto; font-size: 0.7rem; }

.notif-body {
  padding: 1rem 1.25rem 1.25rem;
  border-top: 1.5px solid var(--border);
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.field { display: flex; flex-direction: column; gap: 0.3rem; }
.field-label {
  font-size: 0.78rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--muted);
}
.input {
  padding: 0.5rem 0.75rem;
  border: 1.5px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg);
  color: var(--text);
  font-size: 0.9rem;
  font-family: inherit;
  transition: border-color 0.15s;
}
.input:focus { outline: none; border-color: var(--accent); }

.push-active {
  display: flex;
  align-items: center;
  gap: 0.75rem;
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
  padding: 0.5rem 1rem;
  border-radius: var(--radius-sm);
  border: 1.5px solid var(--accent);
  background: var(--accent-light, #fff5f0);
  color: var(--accent);
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 600;
  font-family: inherit;
  transition: background 0.15s;
}
.btn-push:hover:not(:disabled) { background: var(--accent); color: #fff; }
.btn-push:disabled { opacity: 0.5; cursor: not-allowed; }

.hint {
  font-size: 0.78rem;
  color: var(--muted);
  margin: 0;
  line-height: 1.6;
}
.hint.warn { color: var(--danger, #dc2626); }

.toggle-row { display: flex; gap: 0.35rem; flex-wrap: wrap; }
.toggle-btn {
  padding: 0.3rem 0.75rem;
  font-size: 0.82rem;
  font-weight: 500;
  font-family: inherit;
  border-radius: 5px;
  border: 1.5px solid var(--border);
  background: var(--bg);
  color: var(--muted);
  cursor: pointer;
  transition: all 0.12s;
}
.toggle-btn.active { background: var(--accent); border-color: var(--accent); color: #fff; font-weight: 600; }

.notif-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}
.btn {
  padding: 0.45rem 0.9rem;
  border-radius: var(--radius-sm);
  border: 1.5px solid var(--border);
  background: var(--surface);
  color: var(--text);
  cursor: pointer;
  font-size: 0.88rem;
  font-weight: 500;
  font-family: inherit;
  transition: background 0.12s;
}
.btn:hover:not(:disabled) { background: var(--bg); border-color: var(--muted); }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-primary { background: var(--accent); border-color: var(--accent); color: #fff; font-weight: 600; }
.btn-primary:hover { background: var(--accent-hover); border-color: var(--accent-hover); }
.btn-ghost {
  background: transparent;
  border-color: transparent;
  color: var(--muted);
  padding: 0.25rem 0.5rem;
  font-size: 0.8rem;
}
.btn-ghost:hover { color: var(--danger, #dc2626); background: var(--danger-light, #fef2f2); }

.save-feedback { font-size: 0.82rem; color: var(--ok, #16a34a); font-weight: 600; }
</style>
