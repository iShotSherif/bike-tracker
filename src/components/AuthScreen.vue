<script setup lang="ts">
import { ref } from 'vue'
import { useTracker } from '@/composables/useTracker'

const emit = defineEmits<{ done: [] }>()

const { login } = useTracker()

const WORKER_URL = import.meta.env.VITE_WORKER_URL as string | undefined

const step = ref<'email' | 'otp'>('email')
const email = ref('')
const otp = ref('')
const loading = ref(false)
const errorMsg = ref('')
const resendCooldown = ref(0)

async function requestOtp() {
  if (!email.value.trim() || !WORKER_URL) return
  loading.value = true
  errorMsg.value = ''
  try {
    const res = await fetch(`${WORKER_URL}/auth/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.value.trim() }),
    })
    if (!res.ok) throw new Error('Erreur serveur')
    step.value = 'otp'
    startCooldown()
  } catch {
    errorMsg.value = 'Impossible d'envoyer l'email. Vérifie ta connexion.'
  } finally {
    loading.value = false
  }
}

async function verifyOtp() {
  if (!otp.value.trim()) return
  loading.value = true
  errorMsg.value = ''
  try {
    const ok = await login(email.value.trim(), otp.value.trim())
    if (!ok) {
      errorMsg.value = 'Code invalide ou expiré. Réessaie.'
    } else {
      emit('done')
    }
  } finally {
    loading.value = false
  }
}

function startCooldown() {
  resendCooldown.value = 30
  const t = setInterval(() => {
    resendCooldown.value--
    if (resendCooldown.value <= 0) clearInterval(t)
  }, 1000)
}
</script>

<template>
  <div class="auth-screen">
    <div class="auth-card">
      <div class="auth-icon">🔑</div>
      <h2 class="auth-title">Connexion</h2>
      <p class="auth-sub">Retrouve ton profil sur n'importe quel appareil.</p>

      <template v-if="step === 'email'">
        <div class="field">
          <label class="field-label">Ton adresse email</label>
          <input
            v-model="email"
            type="email"
            class="input"
            placeholder="toi@exemple.com"
            @keydown.enter="requestOtp"
            autofocus
          />
        </div>
        <button class="btn btn-primary" :disabled="loading || !email.trim()" @click="requestOtp">
          {{ loading ? 'Envoi…' : 'M\'envoyer un lien de connexion' }}
        </button>
      </template>

      <template v-else>
        <p class="sent-hint">Un code à 6 chiffres a été envoyé à <strong>{{ email }}</strong>.</p>
        <div class="field">
          <label class="field-label">Code de connexion</label>
          <input
            v-model="otp"
            type="text"
            inputmode="numeric"
            maxlength="6"
            class="input otp-input"
            placeholder="123456"
            @keydown.enter="verifyOtp"
            autofocus
          />
        </div>
        <button class="btn btn-primary" :disabled="loading || otp.trim().length < 6" @click="verifyOtp">
          {{ loading ? 'Vérification…' : 'Confirmer' }}
        </button>
        <button
          class="btn btn-ghost"
          :disabled="resendCooldown > 0"
          @click="requestOtp"
        >
          {{ resendCooldown > 0 ? `Renvoyer (${resendCooldown}s)` : 'Renvoyer le code' }}
        </button>
        <button class="btn btn-ghost" @click="step = 'email'">Changer d'adresse</button>
      </template>

      <p v-if="errorMsg" class="error">{{ errorMsg }}</p>

      <button class="skip-link" @click="emit('done')">Continuer sans compte →</button>
    </div>
  </div>
</template>

<style scoped>
.auth-screen {
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 2rem 1rem;
}
.auth-card {
  width: 100%;
  max-width: 400px;
  background: var(--surface);
  border: 1.5px solid var(--border);
  border-radius: var(--radius);
  padding: 2rem 1.75rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.auth-icon { font-size: 2rem; text-align: center; }
.auth-title {
  font-size: 1.25rem;
  font-weight: 700;
  margin: 0;
  color: var(--text);
  text-align: center;
}
.auth-sub {
  font-size: 0.85rem;
  color: var(--muted);
  margin: 0;
  text-align: center;
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
  padding: 0.6rem 0.85rem;
  border: 1.5px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg);
  color: var(--text);
  font-size: 0.95rem;
  font-family: inherit;
  transition: border-color 0.15s;
}
.input:focus { outline: none; border-color: var(--accent); }
.otp-input {
  font-size: 1.5rem;
  font-weight: 700;
  letter-spacing: 0.3em;
  text-align: center;
}
.btn {
  padding: 0.6rem 1rem;
  border-radius: var(--radius-sm);
  border: 1.5px solid var(--border);
  background: var(--surface);
  color: var(--text);
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 500;
  font-family: inherit;
  transition: background 0.15s;
}
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-primary { background: var(--accent); border-color: var(--accent); color: #fff; font-weight: 600; }
.btn-primary:hover:not(:disabled) { background: var(--accent-hover); border-color: var(--accent-hover); }
.btn-ghost { background: transparent; border-color: transparent; color: var(--muted); font-size: 0.85rem; }
.btn-ghost:hover:not(:disabled) { color: var(--text); }
.sent-hint { font-size: 0.85rem; color: var(--muted); margin: 0; }
.error {
  font-size: 0.85rem;
  color: var(--danger);
  background: var(--danger-light);
  padding: 0.5rem 0.75rem;
  border-radius: var(--radius-sm);
  margin: 0;
}
.skip-link {
  background: none;
  border: none;
  color: var(--muted);
  font-size: 0.8rem;
  cursor: pointer;
  font-family: inherit;
  padding: 0;
  text-align: center;
  margin-top: 0.25rem;
}
.skip-link:hover { color: var(--accent); text-decoration: underline; }
</style>
