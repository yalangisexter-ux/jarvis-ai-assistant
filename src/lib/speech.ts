export function getSpeechRecognition(): SpeechRecognition | null {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition
  if (!SR) return null
  try {
    return new SR()
  } catch {
    return null
  }
}

export function isSpeechRecognitionSupported(): boolean {
  return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition)
}

export function isSpeechSynthesisSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

export function speak(
  text: string,
  options: {
    rate?: number
    pitch?: number
    voiceURI?: string | null
    lang?: string
    onend?: () => void
    onerror?: () => void
  } = {},
): void {
  if (!isSpeechSynthesisSupported()) {
    options.onend?.()
    return
  }
  if (typeof SpeechSynthesisUtterance === 'undefined') {
    options.onend?.()
    return
  }
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.rate = options.rate ?? 1
  u.pitch = options.pitch ?? 0.92
  u.lang = options.lang ?? 'en-US'
  if (options.voiceURI) {
    const voices = window.speechSynthesis.getVoices()
    const match = voices.find((v) => v.voiceURI === options.voiceURI)
    if (match) u.voice = match
  }
  u.onend = () => options.onend?.()
  u.onerror = () => options.onerror?.()
  window.speechSynthesis.speak(u)
}

export function stopSpeaking(): void {
  if (isSpeechSynthesisSupported()) {
    window.speechSynthesis.cancel()
  }
}

export function listVoices(): SpeechSynthesisVoice[] {
  if (!isSpeechSynthesisSupported()) return []
  return window.speechSynthesis.getVoices()
}
