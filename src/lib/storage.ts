import type { AppSettings, Message } from '../types'

const SETTINGS_KEY = 'jarvis_settings_v1'
const HISTORY_KEY = 'jarvis_history_v1'
const MAX_HISTORY = 100
const MEMORY_KEY = 'jarvis_local_memory_v1'

export const defaultSettings: AppSettings = {
  assistantName: 'JARVIS',
  voiceEnabled: true,
  speechRate: 1,
  speechPitch: 0.92,
  language: 'en-US',
  voiceURI: null,
  wakeWordEnabled: false,
  theme: 'dark',
}

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return { ...defaultSettings }
    return { ...defaultSettings, ...JSON.parse(raw) }
  } catch {
    return { ...defaultSettings }
  }
}

export function saveSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  } catch {
    // quota or private mode
  }
}

export function loadHistory(): Message[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as Message[]
    return Array.isArray(parsed) ? parsed.slice(-MAX_HISTORY) : []
  } catch {
    return []
  }
}

export function saveHistory(messages: Message[]): void {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(messages.slice(-MAX_HISTORY)))
  } catch {
    // ignore
  }
}

export function clearHistory(): void {
  try {
    localStorage.removeItem(HISTORY_KEY)
  } catch {
    // ignore
  }
}

export function exportHistory(messages: Message[]): string {
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      messages,
    },
    null,
    2,
  )
}

export function loadLocalMemory(): string[] {
  try {
    const raw = localStorage.getItem(MEMORY_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string').slice(-100)
      : []
  } catch {
    return []
  }
}

export function saveLocalMemory(note: string): void {
  const clean = note.trim().slice(0, 500)
  if (!clean) return
  const notes = loadLocalMemory()
  notes.push(clean)
  try {
    localStorage.setItem(MEMORY_KEY, JSON.stringify(notes.slice(-100)))
  } catch {
    // Keep the current session usable when browser storage is unavailable.
  }
}

export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (typeof navigator === 'undefined' || !navigator.storage?.persist) return false
    return await navigator.storage.persist()
  } catch {
    return false
  }
}
