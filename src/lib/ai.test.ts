import { describe, it, expect, vi, afterEach } from 'vitest'
import { getAIConfig, requestAI } from './ai'
import type { Message } from '../types'

describe('AI module', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('reports unconfigured when no endpoint', () => {
    const cfg = getAIConfig()
    expect(cfg.configured).toBe(false)
  })

  it('returns local time for time query without endpoint', async () => {
    const messages: Message[] = [
      { id: '1', role: 'user', content: 'What time is it?', timestamp: Date.now() },
    ]
    const res = await requestAI({ messages })
    expect(res.provider).toBe('local')
    expect(res.content.toLowerCase()).toMatch(/time/)
  })

  it('returns setup message for unknown query without endpoint', async () => {
    const messages: Message[] = [
      { id: '1', role: 'user', content: 'Explain quantum computing', timestamp: Date.now() },
    ]
    const res = await requestAI({ messages })
    expect(res.offline).toBe(true)
    expect(res.content).toMatch(/No secure AI endpoint|VITE_AI_ENDPOINT/i)
  })

  it('handles greeting without endpoint', async () => {
    const messages: Message[] = [
      { id: '1', role: 'user', content: 'hi', timestamp: Date.now() },
    ]
    const res = await requestAI({ messages })
    expect(res.content).toMatch(/Hello|online|ready/i)
  })
})
