import { env, pipeline } from '@huggingface/transformers'

export const OFFLINE_SPEECH_MODEL_ID = 'onnx-community/whisper-tiny'

type Progress = { status?: string; progress?: number; file?: string }
type Recognizer = (
  audio: Float32Array,
  options: { sampling_rate: number; language: string; task: 'transcribe' },
) => Promise<{ text?: string }>

let recognizer: Recognizer | null = null
let loading: Promise<void> | null = null

env.allowRemoteModels = true
env.allowLocalModels = false
env.useBrowserCache = true

export function isOfflineSpeechReady(): boolean {
  return recognizer !== null
}

export async function installOfflineSpeechModel(
  onProgress: (progress: Progress) => void = () => undefined,
): Promise<void> {
  if (recognizer) return
  if (loading) return loading
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new Error('Connect once to download the offline voice model. After installation, speech recognition runs on this device.')
  }

  loading = (async () => {
    const progress_callback = (progress: Progress) => onProgress(progress)
    try {
      const webgpu = await pipeline('automatic-speech-recognition', OFFLINE_SPEECH_MODEL_ID, {
        device: 'webgpu',
        dtype: 'q8',
        progress_callback,
      })
      recognizer = webgpu as unknown as Recognizer
    } catch (webgpuError) {
      onProgress({ status: 'WebGPU unavailable; loading the offline CPU/WASM voice engine.' })
      try {
        const wasm = await pipeline('automatic-speech-recognition', OFFLINE_SPEECH_MODEL_ID, {
          device: 'wasm',
          dtype: 'q8',
          progress_callback,
        })
        recognizer = wasm as unknown as Recognizer
      } catch (wasmError) {
        const detail = wasmError instanceof Error ? wasmError.message : String(webgpuError)
        throw new Error(`Could not install the offline voice model: ${detail}`)
      }
    }
  })()

  try {
    await loading
  } finally {
    loading = null
  }
}

function resampleTo16k(audio: AudioBuffer): Float32Array {
  const channels = Array.from({ length: audio.numberOfChannels }, (_, index) => audio.getChannelData(index))
  const mono = new Float32Array(audio.length)
  for (let i = 0; i < audio.length; i += 1) {
    let sample = 0
    for (const channel of channels) sample += channel[i] ?? 0
    mono[i] = sample / channels.length
  }

  if (audio.sampleRate === 16000) return mono
  const ratio = audio.sampleRate / 16000
  const output = new Float32Array(Math.floor(mono.length / ratio))
  for (let i = 0; i < output.length; i += 1) {
    const position = i * ratio
    const left = Math.floor(position)
    const right = Math.min(left + 1, mono.length - 1)
    const fraction = position - left
    output[i] = (mono[left] ?? 0) * (1 - fraction) + (mono[right] ?? 0) * fraction
  }
  return output
}

export async function transcribeOfflineAudio(blob: Blob, language: string): Promise<string> {
  if (!recognizer) throw new Error('Install the offline voice model before using microphone input.')
  const AudioContextConstructor = window.AudioContext
  const context = new AudioContextConstructor()
  try {
    const decoded = await context.decodeAudioData(await blob.arrayBuffer())
    const audio = resampleTo16k(decoded)
    const languageName = language.toLowerCase().startsWith('te') ? 'telugu' : 'english'
    const result = await recognizer(audio, {
      sampling_rate: 16000,
      language: languageName,
      task: 'transcribe',
    })
    return result.text?.trim() ?? ''
  } finally {
    await context.close()
  }
}
