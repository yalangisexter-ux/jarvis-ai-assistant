import type { Message } from '../types'
import { generateLocalResponse, isLocalModelReady } from './localModel'
import { loadLocalMemory, saveLocalMemory } from './storage'

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

export function getAIConfig() {
  return {
    endpoint: null,
    provider: isLocalModelReady() ? 'on-device Qwen 0.5B' : 'local commands',
    configured: isLocalModelReady(),
  }
}

function calculate(expression: string): string | null {
  const source = expression.replace(/,/g, '').trim()
  if (!source || !/^[\d\s()+*/.%\-]+$/.test(source)) return null
  let index = 0

  const number = (): number => {
    const start = index
    while (/[\d.]/.test(source[index] ?? '')) index += 1
    const value = Number(source.slice(start, index))
    if (start === index || !Number.isFinite(value)) throw new Error('Invalid number')
    return value
  }

  const factor = (): number => {
    while (source[index] === ' ') index += 1
    if (source[index] === '+') { index += 1; return factor() }
    if (source[index] === '-') { index += 1; return -factor() }
    if (source[index] === '(') {
      index += 1
      const value = expressionValue()
      while (source[index] === ' ') index += 1
      if (source[index] !== ')') throw new Error('Missing closing bracket')
      index += 1
      return value
    }
    return number()
  }

  const term = (): number => {
    let value = factor()
    while (true) {
      while (source[index] === ' ') index += 1
      const operator = source[index]
      if (operator !== '*' && operator !== '/' && operator !== '%') break
      index += 1
      const right = factor()
      if ((operator === '/' || operator === '%') && right === 0) throw new Error('Cannot divide by zero')
      value = operator === '*' ? value * right : operator === '/' ? value / right : value % right
    }
    return value
  }

  const expressionValue = (): number => {
    let value = term()
    while (true) {
      while (source[index] === ' ') index += 1
      const operator = source[index]
      if (operator !== '+' && operator !== '-') break
      index += 1
      const right = term()
      value = operator === '+' ? value + right : value - right
    }
    return value
  }

  try {
    const result = expressionValue()
    while (source[index] === ' ') index += 1
    if (index !== source.length || !Number.isFinite(result)) return null
    return Number(result.toPrecision(12)).toString()
  } catch {
    return null
  }
}

type LocalTask = {
  id: string
  title: string
  dueDate: string
  priority: 'Low' | 'Normal' | 'High'
  completed: boolean
  createdAt: number
}

function handleLocalDataCommand(text: string): string | null {
  const remember = text.match(/^(?:please )?remember(?: that)?\s+(.+)$/i)
  if (remember) {
    saveLocalMemory(remember[1])
    return 'I have saved that note on this device only.'
  }

  if (/^(what do you remember|show my memory|list my notes)$/i.test(text.trim())) {
    const notes = loadLocalMemory()
    return notes.length
      ? `Your local notes:\n${notes.map((note, index) => `${index + 1}. ${note}`).join('\n')}`
      : 'There are no saved notes yet. Say “remember that …” to save one locally.'
  }

  const add = text.match(/^(?:please )?(?:add|create) (?:a )?task[: ]+(.+)$/i)
  if (add) {
    try {
      const key = 'jarvis_focus_tasks_v1'
      const parsed: unknown = JSON.parse(localStorage.getItem(key) || '[]')
      const tasks: LocalTask[] = Array.isArray(parsed) ? parsed as LocalTask[] : []
      const now = new Date()
      const dueDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
      tasks.unshift({
        id: `voice-${Date.now()}`,
        title: add[1].trim().slice(0, 160),
        dueDate,
        priority: 'Normal',
        completed: false,
        createdAt: Date.now(),
      })
      localStorage.setItem(key, JSON.stringify(tasks))
      window.dispatchEvent(new Event('jarvis:tasks-updated'))
      return `Added your task: ${add[1].trim()}.`
    } catch {
      return 'I could not save the task because local browser storage is unavailable.'
    }
  }

  if (/^(show|list)( my)? tasks$/i.test(text.trim())) {
    try {
      const parsed: unknown = JSON.parse(localStorage.getItem('jarvis_focus_tasks_v1') || '[]')
      const tasks: LocalTask[] = Array.isArray(parsed) ? parsed as LocalTask[] : []
      const open = tasks.filter((task) => !task.completed)
      return open.length
        ? `Your open tasks:\n${open.slice(0, 15).map((task, index) => `${index + 1}. ${task.title}`).join('\n')}`
        : 'You have no open tasks.'
    } catch {
      return 'I could not read the local task list.'
    }
  }

  return null
}

function localFallback(userText: string): string {
  const localDataCommand = handleLocalDataCommand(userText)
  if (localDataCommand) return localDataCommand
  const s = userText.trim().toLowerCase()
  if (!s) return 'I did not catch that. Please try again.'
  if (/^(hi|hello|hey|hey jarvis|good morning|good afternoon|good evening)\b/.test(s)) {
    return 'JARVIS is ready. నమస్కారం! How may I assist you?'
  }
  if (s.includes('time') || s.includes('what time')) {
    return `The current time is ${new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.`
  }
  if (s.includes('date') || s.includes('today') || s.includes('what day')) {
    return `Today is ${new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.`
  }
  const math = s.match(/(?:calculate|what is|solve)\s+(.+?)[?]?$/i)
  if (math) {
    const result = calculate(math[1])
    if (result !== null) return `The answer is ${result}.`
  }
  if (s.includes('what can you do') || s === 'help' || s.includes('capabilities')) {
    return 'I work offline for time, date, calculations, local notes, conversation history and focus tasks. Install the on-device AI model for open-ended conversations. Voice recognition depends on the offline speech model being installed; system voice availability depends on your device.'
  }
  if (s.includes('joke')) {
    const jokes = [
      'Why do programmers prefer dark mode? Because light attracts bugs.',
      'I would tell you a UDP joke, but you might not get it.',
      'There are 10 types of people: those who understand binary and those who do not.',
    ]
    return jokes[Math.floor(Math.random() * jokes.length)]
  }
  if (s.includes('status') || s.includes('are you online') || s.includes('are you there')) {
    return isLocalModelReady()
      ? 'All local systems operational. The on-device AI model is loaded. No network connection is required.'
      : 'JARVIS core is running locally. The on-device language model has not been installed yet.'
  }
  return 'I am running in offline command mode. Install the on-device AI model from the setup panel to enable open-ended local conversations. No message has been sent to a cloud service.'
}

export async function requestAI({
  messages,
  signal,
}: AIRequestOptions): Promise<AIResponse> {
  const lastUser = [...messages].reverse().find((message) => message.role === 'user')
  const userText = lastUser?.content ?? ''

  if (signal?.aborted) {
    return { content: 'Request cancelled.', provider: 'local', offline: true }
  }

  const commandResponse = localFallback(userText)
  if (!commandResponse.startsWith('I am running in offline command mode.')) {
    return { content: commandResponse, provider: 'local commands', offline: true }
  }

  if (isLocalModelReady()) {
    try {
      const content = await generateLocalResponse(
        messages.filter(
          (message): message is Message & { role: 'user' | 'assistant' } =>
            message.role === 'user' || message.role === 'assistant',
        ),
      )
      if (signal?.aborted) return { content: 'Request cancelled.', provider: 'local', offline: true }
      if (content) return { content, provider: 'on-device Qwen 0.5B', offline: true }
    } catch (error) {
      console.warn('Local model inference failed; using offline commands.', error)
    }
  }

  return { content: commandResponse, provider: 'local commands', offline: true }
}
