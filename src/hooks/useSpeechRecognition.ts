import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getSpeechRecognition, isSpeechRecognitionSupported } from '../lib/speech'

export function useSpeechRecognition(lang = 'en-US') {
  const [supported] = useState(() => isSpeechRecognitionSupported())
  const [listening, setListening] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const onResultRef = useRef<(text: string) => void>(() => {})

  const setOnResult = useCallback((fn: (text: string) => void) => {
    onResultRef.current = fn
  }, [])

  const clearError = useCallback(() => setError(null), [])

  const stop = useCallback(() => {
    const r = recognitionRef.current
    if (r) {
      try {
        r.onend = null
        r.stop()
      } catch {
        // ignore
      }
      recognitionRef.current = null
    }
    setListening(false)
  }, [])

  const start = useCallback(() => {
    setError(null)
    if (!supported) {
      setError('Speech recognition is not supported in this browser. Use the text input instead.')
      return
    }
    stop()
    const recognition = getSpeechRecognition()
    if (!recognition) {
      setError('Could not initialize speech recognition.')
      return
    }
    recognition.lang = lang
    recognition.interimResults = false
    recognition.maxAlternatives = 1
    recognition.continuous = false

    recognition.onstart = () => setListening(true)
    recognition.onend = () => {
      setListening(false)
      recognitionRef.current = null
    }
    recognition.onerror = (e) => {
      setListening(false)
      recognitionRef.current = null
      const code = e.error
      if (code === 'not-allowed' || code === 'service-not-allowed') {
        setError('Microphone permission was denied. Allow microphone access in Safari Settings → Websites → Microphone.')
      } else if (code === 'no-speech') {
        setError('No speech detected. Please try again.')
      } else if (code === 'aborted') {
        // user cancelled
      } else {
        setError(`Voice input issue: ${code}`)
      }
    }
    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript?.trim()
      if (transcript) onResultRef.current(transcript)
    }

    recognitionRef.current = recognition
    try {
      recognition.start()
    } catch {
      setError('Could not start listening. Please try again.')
      setListening(false)
      recognitionRef.current = null
    }
  }, [lang, stop, supported])

  useEffect(() => () => stop(), [stop])

  return useMemo(() => ({
    supported,
    listening,
    error,
    start,
    stop,
    setOnResult,
    clearError,
  }), [supported, listening, error, start, stop, setOnResult, clearError])
}
