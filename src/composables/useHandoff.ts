import { onBeforeUnmount, ref, type Ref } from 'vue'

interface UseHandoffOptions {
  authToken: Ref<string>
  importState: (json: string) => void
  loadStravaActivities: () => Promise<void>
  stravaConnected: Ref<boolean>
}

interface HandoffResponse {
  sessionToken?: string
  profileSnapshot?: Record<string, unknown>
}

export function useHandoff(options: UseHandoffOptions) {
  const showHandoffBadge = ref(false)
  let badgeTimer: number | null = null

  function revealBadge(): void {
    if (badgeTimer !== null) {
      window.clearTimeout(badgeTimer)
    }

    showHandoffBadge.value = true
    badgeTimer = window.setTimeout(() => {
      showHandoffBadge.value = false
      badgeTimer = null
    }, 4000)
  }

  async function handleHandoffFromUrl(): Promise<boolean> {
    const params = new URLSearchParams(window.location.search)
    const handoffToken = params.get('handoff')

    if (!handoffToken) return false

    window.history.replaceState({}, '', window.location.pathname)

    const workerUrl = import.meta.env.VITE_WORKER_URL as string | undefined

    if (workerUrl) {
      try {
        const response = await fetch(`${workerUrl}/handoff/${handoffToken}`)

        if (response.ok) {
          const data = await response.json() as HandoffResponse

          if (data.sessionToken) options.authToken.value = data.sessionToken
          if (data.profileSnapshot) options.importState(JSON.stringify(data.profileSnapshot))

          revealBadge()
        }
      } catch {
        // best effort
      }
    }

    if (options.stravaConnected.value) {
      await options.loadStravaActivities()
    }

    return true
  }

  onBeforeUnmount(() => {
    if (badgeTimer !== null) {
      window.clearTimeout(badgeTimer)
    }
  })

  return {
    showHandoffBadge,
    handleHandoffFromUrl,
  }
}
