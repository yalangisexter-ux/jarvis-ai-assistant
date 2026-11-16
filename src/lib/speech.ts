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
  const voices = window.speechSynthesis.getVoices()
  const localVoices = voices.filter((voice) => voice.localService)
  const language = u.lang.toLowerCase().split('-')[0]
  const selected = options.voiceURI
    ? localVoices.find((voice) => voice.voiceURI === options.voiceURI)
    : localVoices.find((voice) => voice.lang.toLowerCase().split('-')[0] === language)
  if (!selected) {
    options.onerror?.()
    return
  }
  u.voice = selected
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
  return window.speechSynthesis.getVoices().filter((voice) => voice.localService)
}
