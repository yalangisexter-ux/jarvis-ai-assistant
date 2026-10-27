import { useCallback, useEffect, useState } from 'react'
import type { AppSettings } from '../types'
import { defaultSettings, loadSettings, saveSettings } from '../lib/storage'

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings())

  useEffect(() => {
    saveSettings(settings)
  }, [settings])

  const update = useCallback((partial: Partial<AppSettings>) => {
    setSettings((prev) => ({ ...prev, ...partial }))
  }, [])

  const reset = useCallback(() => {
    setSettings({ ...defaultSettings })
  }, [])

  return { settings, update, reset }
}
