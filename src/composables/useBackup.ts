import type { Ref } from 'vue'

interface UseBackupOptions {
  error: Ref<string | null>
  exportState: () => string
  importState: (json: string) => void
  pushProfileToCloud: () => Promise<void>
}

export function useBackup(options: UseBackupOptions) {
  function downloadExport(): void {
    const blob = new Blob([options.exportState()], { type: 'application/json' })
    const link = document.createElement('a')

    link.href = URL.createObjectURL(blob)
    link.download = 'ride-maintain-backup.json'
    link.click()

    URL.revokeObjectURL(link.href)
  }

  function triggerImport(): void {
    const input = document.createElement('input')

    input.type = 'file'
    input.accept = '.json,application/json'
    input.onchange = async (event) => {
      const file = (event.target as HTMLInputElement).files?.[0]
      if (!file) return

      const text = await file.text()
      options.importState(text)

      if (!options.error.value) {
        await options.pushProfileToCloud()
      }
    }

    input.click()
  }

  return {
    downloadExport,
    triggerImport,
  }
}
