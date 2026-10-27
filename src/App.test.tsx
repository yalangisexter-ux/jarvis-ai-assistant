import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'

describe('JARVIS App', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.stubGlobal('speechSynthesis', {
      speak: vi.fn(),
      cancel: vi.fn(),
      getVoices: () => [],
      onvoiceschanged: null,
    })
  })

  it('renders main interface', () => {
    render(<App />)
    expect(screen.getByText(/At your/i)).toBeInTheDocument()
    expect(screen.getByTestId('status')).toBeInTheDocument()
    expect(screen.getByTestId('mic-btn')).toBeInTheDocument()
    expect(screen.getByTestId('command-input')).toBeInTheDocument()
  })

  it('submits a text command and shows response', async () => {
    const user = userEvent.setup()
    render(<App />)
    const input = screen.getByTestId('command-input')
    await user.type(input, 'What time is it?')
    fireEvent.submit(input.closest('form')!)
    await waitFor(() => {
      expect(screen.getByTestId('messages').textContent).toMatch(/time|current/i)
    })
  })

  it('shows help response', async () => {
    const user = userEvent.setup()
    render(<App />)
    const input = screen.getByTestId('command-input')
    await user.type(input, 'help')
    fireEvent.submit(input.closest('form')!)
    await waitFor(() => {
      expect(screen.getByTestId('messages').textContent).toMatch(/can answer|help/i)
    })
  })

  it('clears conversation', async () => {
    render(<App />)
    const clearBtns = screen.getAllByRole('button', { name: /clear/i })
    fireEvent.click(clearBtns[0])
    await waitFor(() => {
      expect(screen.getByTestId('messages').textContent).toMatch(/cleared/i)
    })
  })

  it('opens settings tab', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('tab', { name: /settings/i }))
    expect(screen.getByText(/Assistant name/i)).toBeInTheDocument()
  })
})
