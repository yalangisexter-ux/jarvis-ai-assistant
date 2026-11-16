import { env, pipeline } from '@huggingface/transformers'

export const LOCAL_MODEL_ID = 'onnx-community/Qwen2.5-0.5B-Instruct'

type Progress = {
  status?: string
  progress?: number
  file?: string
}

type Generator = (
  prompt: string,
  options: Record<string, unknown>,
) => Promise<Array<{ generated_text: string }>>

let generator: Generator | null = null
let loading: Promise<void> | null = null

// Model weights are downloaded once and kept in the browser's Cache API.
// Inference is performed in this browser tab; prompts are never sent to a server.
env.allowRemoteModels = true
env.allowLocalModels = false
env.useBrowserCache = true

export function isLocalModelReady(): boolean {
  return generator !== null
}

export async function installLocalModel(
  onProgress: (progress: Progress) => void = () => undefined,
): Promise<void> {
  if (generator) return
  if (loading) return loading
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new Error('Connect once to download the offline AI model. After installation, JARVIS can run without internet.')
  }

  loading = (async () => {
    const options = {
      dtype: 'q4' as const,
      progress_callback: (progress: Progress) => onProgress(progress),
    }

    try {
      const webgpuPipeline = await pipeline('text-generation', LOCAL_MODEL_ID, {
        ...options,
        device: 'webgpu',
      })
      generator = webgpuPipeline as unknown as Generator
    } catch (webgpuError) {
      onProgress({ status: 'WebGPU unavailable; trying local CPU/WASM runtime.' })
      try {
        const wasmPipeline = await pipeline('text-generation', LOCAL_MODEL_ID, {
          ...options,
          device: 'wasm',
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
  const recent = messages.slice(-10)
  const prompt = [
    '<|im_start|>system',
    'You are JARVIS, a helpful private offline assistant. Be accurate, concise, practical, and honest about uncertainty. Reply in the same language as the user, including Telugu or English. You have no internet access and must not claim to have checked live information or performed actions outside this device.',
    '<|im_end|>',
    ...recent.map((message) => `<|im_start|>${message.role}\n${message.content}\n<|im_end|>`),
    '<|im_start|>assistant',
  ].join('\n')

  const output = await generator(prompt, {
    max_new_tokens: 220,
    temperature: 0.65,
    top_p: 0.9,
    do_sample: true,
    repetition_penalty: 1.08,
  })
  const generated = output[0]?.generated_text ?? ''
  const answer = generated.startsWith(prompt)
    ? generated.slice(prompt.length).trim()
    : generated.trim()
  return answer.replace(/<\|im_end\|>[\s\S]*$/, '').trim() || null
}
