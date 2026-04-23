import { createI18n } from 'vue-i18n'
import type { DefineLocaleMessage } from 'vue-i18n'

export const SUPPORT_LOCALES = ['fr', 'en', 'es'] as const

export type Locale = typeof SUPPORT_LOCALES[number]

export const FALLBACK_LOCALE: Locale = 'en'
export const LOCALE_STORAGE_KEY = 'app-locale'

function isLocale(value: string): value is Locale {
  return (SUPPORT_LOCALES as readonly string[]).includes(value)
}

export function normalizeLocale(locale?: string | null): Locale {
  const normalized = locale?.toLowerCase().split(/[-_]/)[0]
  return normalized && isLocale(normalized) ? normalized : FALLBACK_LOCALE
}

function readStoredLocale(): Locale | null {
  if (typeof window === 'undefined') return null

  try {
    const storedLocale = window.localStorage.getItem(LOCALE_STORAGE_KEY)
    return storedLocale && isLocale(storedLocale) ? storedLocale : null
  } catch {
    return null
  }
}

function persistLocale(locale: Locale): void {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale)
  } catch {
    // localStorage can be unavailable in private or restricted contexts.
  }
}

function updateDocumentLanguage(locale: Locale): void {
  if (typeof document === 'undefined') return
  document.documentElement.lang = locale
}

export function getDefaultLocale(): Locale {
  if (typeof navigator === 'undefined') return FALLBACK_LOCALE
  return normalizeLocale(navigator.language)
}

export function getInitialLocale(): Locale {
  return readStoredLocale() ?? getDefaultLocale()
}

const loadedLocales = new Set<Locale>()

export const i18n = createI18n({
  legacy: false,
  locale: FALLBACK_LOCALE,
  fallbackLocale: FALLBACK_LOCALE,
  messages: {},
  globalInjection: true,
})

export async function loadLocaleMessages(locale: Locale): Promise<void> {
  if (loadedLocales.has(locale)) return

  try {
    const messages = await import(`./locales/${locale}.json`)
    i18n.global.setLocaleMessage(locale, messages.default as DefineLocaleMessage)
    loadedLocales.add(locale)
  } catch (error) {
    console.error(`[i18n] Failed to load locale "${locale}".`, error)

    if (locale !== FALLBACK_LOCALE) {
      await loadLocaleMessages(FALLBACK_LOCALE)
      throw error
    }

    throw error
  }
}

export async function setLocale(locale: Locale): Promise<void> {
  const targetLocale = isLocale(locale) ? locale : FALLBACK_LOCALE

  try {
    await loadLocaleMessages(targetLocale)
    i18n.global.locale.value = targetLocale
    persistLocale(targetLocale)
    updateDocumentLanguage(targetLocale)
  } catch (error) {
    console.error(`[i18n] Falling back to "${FALLBACK_LOCALE}".`, error)

    if (targetLocale !== FALLBACK_LOCALE) {
      await setLocale(FALLBACK_LOCALE)
      return
    }

    i18n.global.locale.value = FALLBACK_LOCALE
    updateDocumentLanguage(FALLBACK_LOCALE)
  }
}
