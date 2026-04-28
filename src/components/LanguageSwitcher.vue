<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Languages } from 'lucide-vue-next'
import { setLocale, SUPPORT_LOCALES, type Locale } from '@/i18n'

const { locale, t } = useI18n({ useScope: 'global' })
const isOpen = ref(false)
const menuRef = ref<HTMLDivElement | null>(null)

const localeLabels: Record<Locale, string> = {
  fr: 'FR',
  en: 'EN',
  es: 'ES',
}

const localeNames: Record<Locale, string> = {
  fr: 'Français',
  en: 'English',
  es: 'Español',
}
const currentLocaleLabel = computed(() => localeLabels[locale.value as Locale] ?? locale.value.toUpperCase())

async function handleLocaleChange(nextLocale: Locale) {
  if (locale.value === nextLocale) return
  await setLocale(nextLocale)
  isOpen.value = false
}

function handleDocumentClick(event: MouseEvent) {
  const target = event.target as Node | null
  if (!target || menuRef.value?.contains(target)) return
  isOpen.value = false
}

onMounted(() => document.addEventListener('click', handleDocumentClick))
onBeforeUnmount(() => document.removeEventListener('click', handleDocumentClick))
</script>

<template>
  <div ref="menuRef" class="language-menu">
    <button
      type="button"
      class="icon-button"
      :aria-label="t('common.language')"
      :aria-expanded="isOpen"
      @click.stop="isOpen = !isOpen"
    >
      <Languages :size="18" stroke-width="2.2" />
      <span class="current-locale">{{ currentLocaleLabel }}</span>
    </button>

    <div v-if="isOpen" class="language-popover" role="menu">
      <button
        v-for="supportedLocale in SUPPORT_LOCALES"
        :key="supportedLocale"
        type="button"
        class="language-option"
        :class="{ active: locale === supportedLocale }"
        role="menuitemradio"
        :aria-checked="locale === supportedLocale"
        @click="handleLocaleChange(supportedLocale)"
      >
        <span>{{ localeNames[supportedLocale] }}</span>
        <span class="locale-code">{{ localeLabels[supportedLocale] }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.language-menu {
  position: relative;
}

.icon-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  min-width: 2.5rem;
  height: 2.5rem;
  padding: 0 0.65rem;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  cursor: pointer;
  font: inherit;
  transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}

.icon-button:hover {
  border-color: color-mix(in srgb, var(--accent) 45%, var(--border));
  color: var(--accent);
  background: var(--accent-light);
}

.current-locale {
  font-size: 0.7rem;
  font-weight: 800;
  letter-spacing: 0.04em;
}

.language-popover {
  position: absolute;
  top: calc(100% + 0.45rem);
  right: 0;
  z-index: 20;
  width: 10rem;
  padding: 0.35rem;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--surface);
  box-shadow: var(--shadow);
}

.language-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  min-height: 2.1rem;
  padding: 0.4rem 0.55rem;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--text);
  cursor: pointer;
  font: inherit;
  font-size: 0.84rem;
  text-align: left;
}

.language-option:hover,
.language-option.active {
  background: var(--accent-light);
  color: var(--accent);
}

.locale-code {
  font-size: 0.68rem;
  font-weight: 800;
  color: var(--muted);
}
</style>
