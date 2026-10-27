import type { Message } from '../types'

export interface AIRequestOptions {
  messages: Message[]
  signal?: AbortSignal
  timeoutMs?: number
}

export interface AIResponse {
  content: string
  provider: string
  offline?: boolean
}

const DEFAULT_TIMEOUT = 25000

export function getAIConfig() {
  const endpoint = (import.meta.env.VITE_AI_ENDPOINT as string | undefined)?.trim() || null
  const provider = (import.meta.env.VITE_AI_PROVIDER as string | undefined)?.trim() || 'proxy'
  return {
    endpoint,
    provider,
    configured: Boolean(endpoint),
  }
}

function localFallback(userText: string): string {
  const s = userText.trim().toLowerCase()
  if (!s) return 'I did not catch that. Please try again.'

  if (/^(hi|hello|hey|hey jarvis)\b/.test(s)) {
    return "Hello. I'm online and ready. How can I help?"
  }
  if (s.includes('time')) {
    return `The current time is ${new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.`
  }
  if (s.includes('date') || s.includes('today')) {
    return `Today is ${new Date().toLocaleDateString(undefined, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })}.`
  }
  if (s.includes('what can you do') || s === 'help') {
    return 'I can answer questions when an AI endpoint is configured, speak responses, tell the time and date, open selected websites, and manage conversation history. Voice recognition requires Safari microphone permission.'
  }
  if (s.includes('joke')) {
    return 'Why do programmers prefer dark mode? Because light attracts bugs.'
  }
  if (s.includes('open youtube')) {
    window.open('https://www.youtube.com/', '_blank', 'noopener,noreferrer')
    return 'Opening YouTube.'
  }
  if (s.includes('open chatgpt') || s.includes('open chat gpt')) {
    window.open('https://chatgpt.com/', '_blank', 'noopener,noreferrer')
    return 'Opening ChatGPT.'
  }
  if (s.includes('open github')) {
    window.open('https://github.com/', '_blank', 'noopener,noreferrer')
    return 'Opening GitHub.'
  }
  if (s.includes('clear') && s.includes('history')) {
    return 'Use the Clear conversation control in the interface to remove local history.'
  }

  const config = getAIConfig()
  if (!config.configured) {
    return `I heard: "${userText}". No secure AI endpoint is configured yet. Add a server-side proxy and set VITE_AI_ENDPOINT. Never put private API keys in this public web app.`
  }
  return `I could not reach the AI service. Please check your connection or configuration. (You said: ${userText})`
}

export async function requestAI({
  messages,
  signal,
  timeoutMs = DEFAULT_TIMEOUT,
}: AIRequestOptions): Promise<AIResponse> {
  const config = getAIConfig()
  const lastUser = [...messages].reverse().find((m) => m.role === 'user')
  const userText = lastUser?.content ?? ''

  if (!config.endpoint) {
    return { content: localFallback(userText), provider: 'local', offline: true }
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  const combined = signal
    ? (typeof AbortSignal !== 'undefined' && 'any' in AbortSignal
        ? (AbortSignal as unknown as { any: (s: AbortSignal[]) => AbortSignal }).any([signal, controller.signal])
        : controller.signal)
    : controller.signal

  try {
    const payload = {
      messages: messages
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({ role: m.role, content: m.content })),
    }

    const res = await fetch(config.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: combined,
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`AI request failed (${res.status}): ${text.slice(0, 200)}`)
    }

    const data = await res.json()
    const content =
      data.content ??
      data.message ??
      data.choices?.[0]?.message?.content ??
      data.response ??
      null

    if (typeof content !== 'string' || !content.trim()) {
      throw new Error('AI response missing content')
    }

    return { content: content.trim(), provider: config.provider }
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return {
        content: 'The request timed out or was cancelled. Please try again.',
        provider: config.provider,
        offline: true,
      }
    }
    console.warn('AI request error, using local fallback', err)
    return { content: localFallback(userText), provider: 'local', offline: true }
  } finally {
    clearTimeout(timeout)
  }
}
