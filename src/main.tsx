import { Component, StrictMode, type ErrorInfo, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles/index.css'

type BoundaryState = { error: Error | null }

class AppErrorBoundary extends Component<{ children: ReactNode }, BoundaryState> {
  state: BoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('JARVIS UI failed to render', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <main style={{
          minHeight: '100dvh',
          boxSizing: 'border-box',
          padding: 'max(24px, env(safe-area-inset-top)) 22px 28px',
          display: 'grid',
          placeContent: 'center',
          background: 'radial-gradient(ellipse at top, #142b49 0%, #07111f 58%, #030712 100%)',
          color: '#f8fafc',
          fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
        }}>
          <section style={{
            width: 'min(100%, 520px)',
            boxSizing: 'border-box',
            padding: 24,
            borderRadius: 22,
            border: '1px solid rgba(148, 163, 184, .28)',
            background: 'rgba(15, 23, 42, .88)',
            boxShadow: '0 24px 70px rgba(0,0,0,.35)',
          }}>
            <p style={{ color: '#67e8f9', fontSize: 12, letterSpacing: 2, fontWeight: 800 }}>JARVIS RECOVERY</p>
            <h1 style={{ fontSize: 25, lineHeight: 1.2, margin: '8px 0 12px' }}>The interface could not load</h1>
            <p style={{ color: '#cbd5e1', lineHeight: 1.6 }}>
              The page hit a startup error instead of showing a blank screen. Reload the latest app; if it repeats, the diagnostic below can help identify the issue.
            </p>
            <pre style={{
              whiteSpace: 'pre-wrap',
              overflowWrap: 'anywhere',
              maxHeight: 160,
              overflow: 'auto',
              padding: 12,
              borderRadius: 10,
              background: 'rgba(2, 6, 23, .72)',
              color: '#fda4af',
              fontSize: 12,
            }}>{this.state.error.message || String(this.state.error)}</pre>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                width: '100%',
                minHeight: 46,
                marginTop: 10,
                border: 0,
                borderRadius: 12,
                background: 'linear-gradient(110deg, #06b6d4, #6366f1)',
                color: '#fff',
                fontSize: 15,
                fontWeight: 750,
              }}
            >Reload JARVIS</button>
          </section>
        </main>
      )
    }
    return this.props.children
  }
}

const root = document.getElementById('root')

if (root) {
  createRoot(root).render(
    <StrictMode>
      <AppErrorBoundary>
        <App />
      </AppErrorBoundary>
    </StrictMode>,
  )
} else {
  document.body.innerHTML = '<main style="min-height:100vh;display:grid;place-content:center;background:#07111f;color:#f8fafc;font:16px system-ui;padding:24px;text-align:center">JARVIS could not find its app container. Refresh the page to try again.</main>'
}
