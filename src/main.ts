import { createApp } from 'vue'
import App from './App.vue'
import { getInitialLocale, i18n, setLocale } from '@/i18n'
import './style.css'

async function bootstrap() {
  const app = createApp(App)
  const initialLocale = getInitialLocale()

  await setLocale(initialLocale)
  app.use(i18n)
  app.mount('#app')
}

void bootstrap()
