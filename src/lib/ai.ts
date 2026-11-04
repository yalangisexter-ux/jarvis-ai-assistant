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
  if (!s) return 'I did not catch that, sir. Please try again.'

  if (/^(hi|hello|hey|hey jarvis|good morning|good afternoon|good evening)\b/.test(s)) {
    return "Good day. JARVIS online and at your service. How may I assist you?"
  }

  if (s.includes('time') || s.includes('what time')) {
    return `The current time is ${new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.`
  }

  if (s.includes('date') || s.includes('today') || s.includes('what day')) {
    return `Today is ${new Date().toLocaleDateString(undefined, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })}.`
  }

  if (s.includes('what can you do') || s === 'help' || s.includes('capabilities')) {
    return 'I can answer questions when the AI proxy is online, speak responses, report time and date, open selected websites, manage conversation history, and help with planning via Mission Control. Voice recognition requires Safari microphone permission. I remain fully operational even offline for basic commands.'
  }

  if (s.includes('joke') || s.includes('tell me a joke')) {
    const jokes = [
      'Why do programmers prefer dark mode? Because light attracts bugs.',
      'I would tell you a UDP joke, but you might not get it.',
      'There are only 10 types of people in the world: those who understand binary and those who do not.',
      'Why did the AI go to therapy? It had too many unresolved dependencies.',
    ]
    return jokes[Math.floor(Math.random() * jokes.length)]
  }

  if (s.includes('open youtube')) {
    window.open('https://www.youtube.com/', '_blank', 'noopener,noreferrer')
    return 'Opening YouTube now.'
  }
  if (s.includes('open chatgpt') || s.includes('open chat gpt')) {
    window.open('https://chatgpt.com/', '_blank', 'noopener,noreferrer')
    return 'Opening ChatGPT.'
  }
  if (s.includes('open github')) {
    window.open('https://github.com/', '_blank', 'noopener,noreferrer')
    return 'Opening GitHub.'
  }
  if (s.includes('open google')) {
    window.open('https://www.google.com/', '_blank', 'noopener,noreferrer')
    return 'Opening Google.'
  }

  if (s.includes('clear') && s.includes('history')) {
    return 'Use the Clear conversation control in the interface to remove local history, sir.'
  }

  if (s.includes('status') || s.includes('are you online') || s.includes('are you there')) {
    const config = getAIConfig()
    return config.configured
      ? 'All systems operational. AI proxy is connected and ready.'
      : 'Local systems online. Full AI capabilities require the proxy endpoint to be configured.'
  }

  const config = getAIConfig()
  if (!config.configured) {
    return `I heard: "${userText}". The secure AI endpoint is not yet configured. I can still handle time, date, basic commands, and opening sites. Configure VITE_AI_ENDPOINT on the server side for full intelligence.`
  }

  return `I could not reach the AI service at the moment. Local systems remain available. You said: ${userText}`
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
