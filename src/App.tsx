import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { AssistantStatus, Message, QuickAction } from './types'
import FocusPanel from './components/FocusPanel'
import { useSettings } from './hooks/useSettings'
import { useSpeechRecognition } from './hooks/useSpeechRecognition'
import { requestAI } from './lib/ai'
import { installLocalModel, isLocalModelReady, LOCAL_MODEL_ID } from './lib/localModel'
import { installOfflineSpeechModel, isOfflineSpeechReady, OFFLINE_SPEECH_MODEL_ID } from './lib/offlineSpeech'
import { speak, stopSpeaking, listVoices, isSpeechSynthesisSupported } from './lib/speech'
import {
  clearHistory,
  exportHistory,
  loadHistory,
  saveHistory,
  requestPersistentStorage,
} from './lib/storage'

const QUICK_ACTIONS: QuickAction[] = [
  { id: 'time', label: 'Time', command: 'What time is it?' },
  { id: 'help', label: 'Help', command: 'What can you do?' },
  { id: 'youtube', label: 'YouTube', command: 'Open YouTube' },
  { id: 'chatgpt', label: 'ChatGPT', command: 'Open ChatGPT' },
  { id: 'joke', label: 'Joke', command: 'Tell me a joke' },
]

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function statusLabel(status: AssistantStatus): string {
  switch (status) {
    case 'ready':
      return 'System ready'
    case 'listening':
      return 'Listening'
    case 'processing':
      return 'Processing'
    case 'speaking':
      return 'Speaking'
    case 'error':
      return 'Issue'
    case 'offline':
      return 'Offline mode'
    default:
      return 'Ready'
  }
}

export default function App() {
  const { settings, update } = useSettings()
  const [messages, setMessages] = useState<Message[]>(() => {
    const stored = loadHistory()
    if (stored.length) return stored
    return [
      {
        id: uid(),
        role: 'assistant',
        content: `${settings.assistantName} local core is ready. Install the offline AI model for open-ended conversations, or type a command.`,
        timestamp: Date.now(),
      },
    ]
  })
  const messagesRef = useRef<Message[]>(messages)
  messagesRef.current = messages

  const [status, setStatus] = useState<AssistantStatus>('ready')
  const [input, setInput] = useState('')
  const [view, setView] = useState<'chat' | 'settings'>('chat')
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [modelReady, setModelReady] = useState(() => isLocalModelReady())
  const [modelBusy, setModelBusy] = useState(false)
  const [modelProgress, setModelProgress] = useState('')
  const [modelError, setModelError] = useState<string | null>(null)
  const [voiceModelReady, setVoiceModelReady] = useState(() => isOfflineSpeechReady())
  const [voiceModelBusy, setVoiceModelBusy] = useState(false)
  const [voiceModelProgress, setVoiceModelProgress] = useState('')
  const [voiceModelError, setVoiceModelError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => () => {
    abortRef.current?.abort()
    stopSpeaking()
  }, [])

  const speech = useSpeechRecognition(settings.language)

  useEffect(() => {
    void requestPersistentStorage()
  }, [])

  useEffect(() => {
    saveHistory(messages)
  }, [messages])

  useEffect(() => {
    if (!isSpeechSynthesisSupported()) return
    const load = () => setVoices(listVoices())
    load()
    window.speechSynthesis.onvoiceschanged = load
    return () => {
      window.speechSynthesis.onvoiceschanged = null
    }
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView?.({ behavior: 'smooth' })
  }, [messages, status])

  const lastAssistant = useMemo(
    () => [...messages].reverse().find((m) => m.role === 'assistant')?.content ?? '',
    [messages],
  )

  const speakResponse = useCallback(
    (text: string) => {
      if (!settings.voiceEnabled) {
        setStatus('ready')
        return
      }
      setStatus('speaking')
      speak(text, {
        rate: settings.speechRate,
        pitch: settings.speechPitch,
        voiceURI: settings.voiceURI,
        lang: settings.language,
        onend: () => setStatus('ready'),
        onerror: () => setStatus('ready'),
      })
    },
    [settings],
  )

  const handleUserText = useCallback(
    async (raw: string, source: 'voice' | 'text' = 'text') => {
      const text = raw.trim()
      if (!text) return

      speech.clearError()
      stopSpeaking()
      abortRef.current?.abort()

      const userMsg: Message = {
        id: uid(),
        role: 'user',
        content: text,
        timestamp: Date.now(),
        source,
      }
      const historyForAI = [...messagesRef.current, userMsg]
      messagesRef.current = historyForAI
      setMessages(historyForAI)
      setStatus('processing')
      setInput('')

      const controller = new AbortController()
      abortRef.current = controller

      const result = await requestAI({
        messages: historyForAI,
        signal: controller.signal,
      })

      // A newer prompt or a clear action may have cancelled this request.
      // Never let a stale response re-enter the conversation.
      if (controller.signal.aborted) return

      const assistantMsg: Message = {
        id: uid(),
        role: 'assistant',
        content: result.content,
        timestamp: Date.now(),
      }
      const nextMessages = [...messagesRef.current, assistantMsg]
      messagesRef.current = nextMessages
      setMessages(nextMessages)

      if (result.offline) setStatus('offline')
      speakResponse(result.content)
    },
    [speech, speakResponse],
  )

  useEffect(() => {
    speech.setOnResult((transcript) => {
      void handleUserText(transcript, 'voice')
    })
  }, [speech, handleUserText])

  useEffect(() => {
    if (speech.listening) setStatus('listening')
    else if (status === 'listening') setStatus('ready')
  }, [speech.listening, status])

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    void handleUserText(input, 'text')
  }

  const onClear = () => {
    stopSpeaking()
    abortRef.current?.abort()
    clearHistory()
    const clearedMessages: Message[] = [{
      id: uid(),
      role: 'assistant',
      content: 'Conversation cleared. Systems remain fully operational. How may I assist you?',
      timestamp: Date.now(),
    }]
    messagesRef.current = clearedMessages
    setMessages(clearedMessages)
    setStatus('ready')
  }

  const onExport = () => {
    const blob = new Blob([exportHistory(messages)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `jarvis-history-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const onListenToggle = () => {
    if (speech.listening) {
      speech.stop()
      setStatus('ready')
    } else {
      stopSpeaking()
      speech.start()
    }
  }

  const orbClass =
    status === 'listening' ? 'listening' : status === 'processing' ? 'processing' : ''

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">{settings.assistantName}</div>
        <div className={`status-pill ${status}`} data-testid="status">
          {statusLabel(status)}
        </div>
      </header>

      <div className="nav-tabs" role="tablist">
        <button
          type="button"
          className={view === 'chat' ? 'active' : ''}
          onClick={() => setView('chat')}
          role="tab"
          aria-selected={view === 'chat'}
        >
          Chat
        </button>
        <button
          type="button"
          className={view === 'settings' ? 'active' : ''}
          onClick={() => setView('settings')}
          role="tab"
          aria-selected={view === 'settings'}
        >
          Settings
        </button>
      </div>

      {view === 'chat' ? (
        <>
          <section className="hero">
            <h1>
              At your
              <br />
              command.
            </h1>
            <p>Voice-first personal assistant for iPhone.</p>
          </section>

          <div className="orb-wrap">
            <div className={`orb ${orbClass}`} id="orb" aria-hidden>
              <span>J</span>
            </div>
          </div>

          <section className="panel" aria-label="Conversation">
            <div className="label">Conversation</div>
            <div className="messages" data-testid="messages">
              {messages.map((m) => (
                <div key={m.id} className={`message ${m.role}`}>
                  <div className="meta">
                    {m.role === 'user' ? 'You' : settings.assistantName}
                    {m.source === 'voice' ? ' · voice' : ''}
                  </div>
                  {m.content}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          </section>

          <section className="panel">
            <div className="label">Voice controls</div>
            <div className="controls">
              <button
                type="button"
                className="btn primary"
                onClick={onListenToggle}
                data-testid="mic-btn"
                aria-pressed={speech.listening}
              >
                {speech.listening ? '■ Stop' : '🎙 Listen'}
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  stopSpeaking()
                  setStatus('ready')
                }}
              >
                🔇 Stop voice
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => lastAssistant && speakResponse(lastAssistant)}
                disabled={!lastAssistant}
              >
                🔊 Repeat
              </button>
              <button type="button" className="btn danger" onClick={onClear}>
                Clear
              </button>
            </div>
            {speech.error && (
              <p className="error-text" role="alert">
                {speech.error}
              </p>
            )}
            {!speech.supported && (
              <p className="small">
                Speech recognition is not available here. Use the text box below.
              </p>
            )}
          </section>

          <section className="panel">
            <div className="label">Type a command</div>
            <form className="input-row" onSubmit={onSubmit}>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder='Try "What time is it?"'
                aria-label="Command"
                data-testid="command-input"
                autoComplete="off"
              />
              <button className="btn primary" type="submit" data-testid="send-btn">
                Send
              </button>
            </form>
          </section>

          <section className="panel">
            <div className="label">Quick actions</div>
            <div className="quick">
              {QUICK_ACTIONS.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  className="chip"
                  onClick={() => void handleUserText(a.command, 'text')}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </section>

          <FocusPanel />

          <section className="panel">
            <div className="label">Limits</div>
            <p className="small">
              This is a web PWA. Microphone access requires permission and an open page.
              Websites can be opened; controlling other apps, changing system settings, or
              unlocking the iPhone is not available to a website. Always-on wake-word is not
              supported while Safari is suspended.
            </p>
            <div className="label">Offline intelligence</div>
            <p className="small">
              JARVIS never sends your prompts to a cloud AI service. Install the local model once while connected; the model is then cached for on-device inference.
            </p>
            <p className="small">Model: {LOCAL_MODEL_ID}</p>
            <div className="controls">
              <button
                type="button"
                className="btn primary"
                disabled={modelBusy || modelReady}
                onClick={async () => {
                  setModelBusy(true)
                  setModelError(null)
                  setModelProgress('Preparing local model…')
                  try {
                    await installLocalModel((progress) => {
                      const percent = typeof progress.progress === 'number'
                        ? ` ${Math.round(progress.progress)}%`
                        : ''
                      setModelProgress(`${progress.status ?? 'Downloading model'}${percent}`)
                    })
                    setModelReady(true)
                    setModelProgress('Local AI model installed and ready.')
                  } catch (error) {
                    setModelError(error instanceof Error ? error.message : String(error))
                  } finally {
                    setModelBusy(false)
                  }
                }}
              >
                {modelReady ? 'Local AI installed' : modelBusy ? 'Installing…' : 'Download offline AI model'}
              </button>
            </div>
            {modelProgress && <p className="small" role="status">{modelProgress}</p>}
            {modelError && <p className="error-text" role="alert">{modelError}</p>}
            <p className="small">
              {modelReady
                ? 'On-device language model is loaded. Conversation inference runs locally.'
                : 'Until the model is installed, JARVIS supports local commands and the Focus Board. First-time model download requires internet.'}
            </p>
            <divider className="offline-divider" />
            <p className="small">Offline voice model: {OFFLINE_SPEECH_MODEL_ID}</p>
            <div className="controls">
              <button
                type="button"
                className="btn"
                disabled={voiceModelBusy || voiceModelReady}
                onClick={async () => {
                  setVoiceModelBusy(true)
                  setVoiceModelError(null)
                  setVoiceModelProgress('Preparing offline voice model…')
                  try {
                    await installOfflineSpeechModel((progress) => {
                      const percent = typeof progress.progress === 'number'
                        ? ` ${Math.round(progress.progress)}%`
                        : ''
                      setVoiceModelProgress(`${progress.status ?? 'Downloading voice model'}${percent}`)
                    })
                    setVoiceModelReady(true)
                    setVoiceModelProgress('Offline voice recognition is ready.')
                  } catch (error) {
                    setVoiceModelError(error instanceof Error ? error.message : String(error))
                  } finally {
                    setVoiceModelBusy(false)
                  }
                }}
              >
                {voiceModelReady ? 'Offline voice installed' : voiceModelBusy ? 'Installing voice…' : 'Download offline voice model'}
              </button>
            </div>
            {voiceModelProgress && <p className="small" role="status">{voiceModelProgress}</p>}
            {voiceModelError && <p className="error-text" role="alert">{voiceModelError}</p>}
            <p className="small">
              {voiceModelReady
                ? 'Microphone recordings are transcribed on this device using Whisper. Audio is not uploaded.'
                : 'Microphone input stays disabled until the local Whisper model is installed. First-time download requires internet.'}
            </p>
          </section>
        </>
      ) : (
        <section className="panel">
          <div className="label">Settings</div>
          <div className="settings-grid">
            <label>
              Assistant name
              <input
                type="text"
                value={settings.assistantName}
                onChange={(e) => update({ assistantName: e.target.value || 'JARVIS' })}
                maxLength={32}
              />
            </label>

            <div className="row">
              <span>Spoken replies</span>
              <input
                className="toggle"
                type="checkbox"
                checked={settings.voiceEnabled}
                onChange={(e) => update({ voiceEnabled: e.target.checked })}
                aria-label="Enable spoken replies"
              />
            </div>

            <label>
              Speech rate ({settings.speechRate.toFixed(1)})
              <input
                type="range"
                min={0.6}
                max={1.4}
                step={0.1}
                value={settings.speechRate}
                onChange={(e) => update({ speechRate: Number(e.target.value) })}
              />
            </label>

            <label>
              Speech pitch ({settings.speechPitch.toFixed(2)})
              <input
                type="range"
                min={0.7}
                max={1.3}
                step={0.02}
                value={settings.speechPitch}
                onChange={(e) => update({ speechPitch: Number(e.target.value) })}
              />
            </label>

            <label>
              Recognition language
              <select
                value={settings.language}
                onChange={(e) => update({ language: e.target.value })}
              >
                <option value="en-US">English (US)</option>
                <option value="en-GB">English (UK)</option>
                <option value="en-IN">English (India)</option>
                <option value="te-IN">Telugu (India)</option>
              </select>
            </label>

            <label>
              Voice
              <select
                value={settings.voiceURI ?? ''}
                onChange={(e) => update({ voiceURI: e.target.value || null })}
              >
                <option value="">System default</option>
                {voices.map((v) => (
                  <option key={v.voiceURI} value={v.voiceURI}>
                    {v.name} ({v.lang})
                  </option>
                ))}
              </select>
            </label>

            <div className="row">
              <span>Wake-word mode (experimental)</span>
              <input
                className="toggle"
                type="checkbox"
                checked={settings.wakeWordEnabled}
                onChange={(e) => update({ wakeWordEnabled: e.target.checked })}
                aria-label="Enable wake word notes"
              />
            </div>
            {settings.wakeWordEnabled && (
              <p className="small">
                Continuous background listening is not available on iOS Safari. Use Siri
                Shortcuts or the Home Screen icon to open JARVIS, then tap Listen. Do not
                expect always-on “Hey JARVIS” while the app is backgrounded.
              </p>
            )}

            <div className="controls" style={{ marginTop: 8 }}>
              <button type="button" className="btn" onClick={onExport}>
                Export history
              </button>
              <button type="button" className="btn danger" onClick={onClear}>
                Clear history
              </button>
            </div>

            <p className="small">
              Preferences, conversation history, notes and tasks stay on this device. JARVIS
              does not send prompts or microphone audio to Gemini, Cloudflare or other cloud AI
              services. Browser storage can still be cleared by the operating system.
            </p>
          </div>
        </section>
      )}

      <p className="footer">
        JARVIS PWA · iPhone Safari · GitHub Pages ·{' '}
        {modelReady ? 'on-device AI mode' : 'offline command mode'}
      </p>
    </div>
  )
}
