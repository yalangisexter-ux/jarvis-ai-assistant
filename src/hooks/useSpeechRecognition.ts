import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { isOfflineSpeechReady, transcribeOfflineAudio } from '../lib/offlineSpeech'

export function useSpeechRecognition(lang = 'en-US') {
  const [supported] = useState(() =>
    typeof navigator !== 'undefined' &&
    Boolean(navigator.mediaDevices?.getUserMedia) &&
    typeof MediaRecorder !== 'undefined' &&
    typeof AudioContext !== 'undefined',
  )
  const [listening, setListening] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<BlobPart[]>([])
  const onResultRef = useRef<(text: string) => void>(() => {})

  const setOnResult = useCallback((fn: (text: string) => void) => {
    onResultRef.current = fn
  }, [])

  const clearError = useCallback(() => setError(null), [])

  const releaseMicrophone = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    recorderRef.current = null
    setListening(false)
  }, [])

  const stop = useCallback(() => {
    const recorder = recorderRef.current
    if (recorder && recorder.state === 'recording') {
      recorder.stop()
      return
    }
    releaseMicrophone()
  }, [releaseMicrophone])

  const start = useCallback(async () => {
    setError(null)
    if (!supported) {
      setError('This browser cannot record microphone audio. Use the text input instead.')
      return
    }
    if (!isOfflineSpeechReady()) {
      setError('Install the offline voice model in the Offline intelligence panel before using the microphone.')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
      })
      streamRef.current = stream
      chunksRef.current = []
      const mimeType = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm']
        .find((type) => MediaRecorder.isTypeSupported(type))
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      recorderRef.current = recorder
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      }
      recorder.onerror = () => {
        setError('Microphone recording failed. Please try again.')
        releaseMicrophone()
      }
      recorder.onstop = async () => {
        const recording = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
        releaseMicrophone()
        if (!recording.size) {
          setError('No audio was captured. Please try again.')
          return
        }
        try {
          const transcript = await transcribeOfflineAudio(recording, lang)
          if (transcript) onResultRef.current(transcript)
          else setError('No speech detected. Please try again.')
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : 'Offline speech recognition failed.')
        }
      }
      recorder.start()
      setListening(true)
    } catch (cause) {
      releaseMicrophone()
      const name = cause instanceof DOMException ? cause.name : ''
      setError(name === 'NotAllowedError'
        ? 'Microphone permission was denied. Allow microphone access for JARVIS in Safari settings.'
        : 'Could not start the local microphone recorder. Check microphone access and try again.')
    }
  }, [lang, releaseMicrophone, supported])

  useEffect(() => () => {
    const recorder = recorderRef.current
    if (recorder && recorder.state === 'recording') {
      recorder.onstop = null
      recorder.stop()
    }
    streamRef.current?.getTracks().forEach((track) => track.stop())
  }, [])

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
