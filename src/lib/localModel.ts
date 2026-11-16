import { env, pipeline } from '@huggingface/transformers'

export const LOCAL_MODEL_ID = 'onnx-community/Qwen3-0.6B-ONNX'

type Progress = {
  status?: string
  progress?: number
  file?: string
}

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string }
type GeneratedMessage = { role?: string; content?: string }
type Generator = (
  messages: ChatMessage[],
  options: Record<string, unknown>,
) => Promise<Array<{ generated_text: string | GeneratedMessage[] }>>

let generator: Generator | null = null
let loading: Promise<void> | null = null

// Transformers.js stores fetched model assets in the browser cache.
// Once the model is installed, inference stays in this device/browser.
env.allowRemoteModels = true
env.allowLocalModels = false
env.useBrowserCache = true
;(env as unknown as { useWasmCache?: boolean }).useWasmCache = true
if (env.backends.onnx.wasm) {
  env.backends.onnx.wasm.wasmPaths = `${import.meta.env.BASE_URL}wasm/`
}

export function isLocalModelReady(): boolean {
  return generator !== null
}

export async function installLocalModel(
  onProgress: (progress: Progress) => void = () => undefined,
): Promise<void> {
  if (generator) return
  if (loading) return loading
  loading = (async () => {
    const progress_callback = (progress: Progress) => onProgress(progress)
    try {
      const webgpuPipeline = await pipeline('text-generation', LOCAL_MODEL_ID, {
        device: 'webgpu',
        dtype: 'q4f16',
        progress_callback,
      })
      generator = webgpuPipeline as unknown as Generator
    } catch (webgpuError) {
      onProgress({ status: 'WebGPU unavailable; trying the local CPU/WASM runtime.' })
      try {
        const wasmPipeline = await pipeline('text-generation', LOCAL_MODEL_ID, {
          device: 'wasm',
          dtype: 'q4',
          progress_callback,
        })
        generator = wasmPipeline as unknown as Generator
      } catch (wasmError) {
        const detail = wasmError instanceof Error ? wasmError.message : String(webgpuError)
        throw new Error(`Could not install the local model: ${detail}`)
      }
    }
  })()

  try {
    await loading
  } finally {
    loading = null
  }
}

export async function generateLocalResponse(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
): Promise<string | null> {
  if (!generator) return null
  const chat: ChatMessage[] = [
    {
      role: 'system',
      content: 'You are JARVIS, a private offline personal assistant. Be accurate, concise, practical and honest about uncertainty. Reply in the same language as the user, including Telugu or English. You have no internet access. Never claim to have checked live information or performed actions outside this device.',
    },
    ...messages.slice(-10),
  ]

  const output = await generator(chat, {
    max_new_tokens: 220,
    temperature: 0.65,
    top_p: 0.9,
    do_sample: true,
    repetition_penalty: 1.08,
  })
  const generated = output[0]?.generated_text
  if (typeof generated === 'string') return generated.trim() || null
  if (Array.isArray(generated)) {
    const lastAssistant = [...generated].reverse().find(
      (message) => message.role === 'assistant' && typeof message.content === 'string',
    )
    return lastAssistant?.content?.trim() || null
  }
  return null
}
