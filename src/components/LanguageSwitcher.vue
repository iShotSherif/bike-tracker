<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { setLocale, SUPPORT_LOCALES, type Locale } from '@/i18n'

const { locale, t } = useI18n({ useScope: 'global' })

const localeLabels: Record<Locale, string> = {
  fr: 'FR',
  en: 'EN',
  es: 'ES',
}

async function handleLocaleChange(nextLocale: Locale) {
  if (locale.value === nextLocale) return
  await setLocale(nextLocale)
}
</script>

<template>
  <div class="language-switcher" :aria-label="t('common.language')" role="group">
    <button
      v-for="supportedLocale in SUPPORT_LOCALES"
      :key="supportedLocale"
      type="button"
      class="language-button"
      :class="{ active: locale === supportedLocale }"
      :aria-label="localeLabels[supportedLocale]"
      :aria-pressed="locale === supportedLocale"
      @click="handleLocaleChange(supportedLocale)"
    >
      {{ localeLabels[supportedLocale] }}
    </button>
  </div>
</template>

<style scoped>
.language-switcher {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.2rem;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--surface);
}

.language-button {
  min-width: 2.5rem;
  padding: 0.35rem 0.65rem;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  font: inherit;
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  transition: background 0.15s, color 0.15s;
}

.language-button:hover {
  color: var(--text);
}

.language-button.active {
  background: var(--accent);
  color: #fff;
}
</style>
