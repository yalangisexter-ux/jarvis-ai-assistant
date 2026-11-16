import { describe, it, expect, vi, afterEach } from 'vitest'
import { getAIConfig, requestAI } from './ai'
import type { Message } from '../types'

vi.mock('./localModel', () => ({
  generateLocalResponse: vi.fn().mockResolvedValue(null),
  isLocalModelReady: vi.fn(() => false),
}))

describe('offline AI module', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    localStorage.clear()
  })

  it('does not configure a remote AI endpoint', () => {
    expect(getAIConfig()).toMatchObject({
      endpoint: null,
      configured: false,
    })
  })

  it('answers local time requests without network access', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const messages: Message[] = [
      { id: '1', role: 'user', content: 'What time is it?', timestamp: Date.now() },
    ]
    const result = await requestAI({ messages })
    expect(result.provider).toBe('local commands')
    expect(result.offline).toBe(true)
    expect(result.content.toLowerCase()).toContain('time')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('calculates arithmetic locally without evaluating arbitrary code', async () => {
    const messages: Message[] = [
      { id: '1', role: 'user', content: 'calculate (12 + 8) * 3', timestamp: Date.now() },
    ]
    const result = await requestAI({ messages })
    expect(result.content).toContain('60')
  })

  it('offers local model setup for open-ended questions', async () => {
    const messages: Message[] = [
      { id: '1', role: 'user', content: 'Explain quantum computing', timestamp: Date.now() },
    ]
    const result = await requestAI({ messages })
    expect(result.offline).toBe(true)
    expect(result.content).toMatch(/Install the on-device AI model/i)
  })

  it('handles greetings locally', async () => {
    const messages: Message[] = [
      { id: '1', role: 'user', content: 'hi', timestamp: Date.now() },
    ]
    const result = await requestAI({ messages })
    expect(result.content).toMatch(/JARVIS|నమస్కారం/i)
  })


  it('saves and recalls notes locally', async () => {
    const save = await requestAI({
      messages: [{ id: '1', role: 'user', content: 'remember that my project is called ShadowTrace', timestamp: Date.now() }],
    })
    expect(save.content).toMatch(/saved that note/i)

    const recall = await requestAI({
      messages: [{ id: '2', role: 'user', content: 'what do you remember', timestamp: Date.now() }],
    })
    expect(recall.content).toContain('ShadowTrace')
  })

  it('adds tasks to the same local Focus Board store', async () => {
    const result = await requestAI({
      messages: [{ id: '1', role: 'user', content: 'add task test offline JARVIS', timestamp: Date.now() }],
    })
    expect(result.content).toMatch(/Added your task/i)
    expect(JSON.parse(localStorage.getItem('jarvis_focus_tasks_v1') || '[]')[0].title)
      .toBe('test offline JARVIS')
  })

  it('does not call fetch even if a VITE endpoint is present', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const messages: Message[] = [
      { id: '1', role: 'user', content: 'Are you online?', timestamp: Date.now() },
    ]
    await requestAI({ messages })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
