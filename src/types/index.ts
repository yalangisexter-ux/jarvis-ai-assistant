export type AssistantStatus =
  | 'ready'
  | 'listening'
  | 'processing'
  | 'speaking'
  | 'error'
  | 'offline'

export type MessageRole = 'user' | 'assistant' | 'system'

export interface Message {
  id: string
  role: MessageRole
  content: string
  timestamp: number
  source?: 'voice' | 'text'
}

export interface AppSettings {
  assistantName: string
  voiceEnabled: boolean
  speechRate: number
  speechPitch: number
  language: string
  voiceURI: string | null
  wakeWordEnabled: boolean
  theme: 'dark'
}

export interface AIConfig {
  endpoint: string | null
  provider: string
  configured: boolean
}

export type QuickAction = {
  id: string
  label: string
  command: string
}
