# JARVIS AI Assistant

Personal voice-first AI assistant web app optimized for **iPhone 15 Plus** (Safari + PWA).

Inspired by the idea of Tony Stark’s JARVIS — **not** a copy of any movie assets, logos, or proprietary implementations.

**Live (after GitHub Pages is enabled):**  
`https://yalangisexter-ux.github.io/jarvis-ai-assistant/`

---

## Features

- Dark futuristic UI with animated orb, status indicators, conversation history
- Voice input via Web Speech API (when supported) + text fallback
- Text-to-speech replies (rate, pitch, voice selection)
- Local rule-based commands (time, date, help, jokes, open selected sites)
- Optional **server-side AI proxy** (no private API keys in the browser)
- Settings: assistant name, language (English / Telugu where the engine allows), voice
- Conversation history in `localStorage` + export JSON
- Progressive Web App (manifest, service worker, installable)
- GitHub Actions: typecheck, lint, test, build, deploy to GitHub Pages

---

## Architecture

```
Browser (React + Vite PWA)
  ├── Web Speech API (recognition / synthesis)
  ├── localStorage (settings + history)
  └── optional HTTPS POST → your AI proxy
        └── private keys stay on the server
```

GitHub Pages hosts **only** static assets. It is not a secure backend.

---

## Local development

```bash
git clone https://github.com/yalangisexter-ux/jarvis-ai-assistant.git
cd jarvis-ai-assistant
npm install
npm run dev
```

Open the printed URL (usually `http://localhost:5173/jarvis-ai-assistant/`).

### Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Vite dev server |
| `npm run build` | Typecheck + production build |
| `npm run preview` | Preview production build |
| `npm test` | Vitest (jsdom) |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc -b --noEmit` |

---

## AI configuration (optional)

1. Deploy a **server-side** proxy that accepts `POST` `{ "messages": [{ "role", "content" }] }` and returns `{ "content": "..." }`.
2. Set `VITE_AI_ENDPOINT` (and optional `VITE_AI_PROVIDER`) as repository **Variables** or local `.env` (see `.env.example`).
3. Never put private API keys in `VITE_*` variables or the frontend.

Without an endpoint, JARVIS uses the built-in local command engine.

---

## GitHub Pages setup

1. Repository **Settings → Pages** → Source: **GitHub Actions**
2. Push to `main` or run the workflow manually
3. Open: `https://yalangisexter-ux.github.io/jarvis-ai-assistant/`

`vite.config.ts` sets `base: '/jarvis-ai-assistant/'` for project pages.

---

## Install on iPhone 15 Plus (PWA)

1. Open the deployed **HTTPS** URL in **Safari**
2. Tap **Share** → **Add to Home Screen**
3. Confirm the name and tap **Add**
4. Launch from the Home Screen icon

This is a PWA, not a native App Store app. Background execution is limited by iOS.

---

## Siri / Shortcuts

Continuous background “Hey JARVIS” is **not** available while Safari/PWA is suspended.

Create a Shortcut: **Open URL** → your JARVIS Pages URL, optionally assign a Siri phrase. Inside the app, tap **Listen** for voice input.

---

## Known iOS limitations

- No always-on wake word while backgrounded
- Cannot unlock the phone or bypass Face ID
- Cannot control arbitrary other apps
- Speech engines depend on Safari / language packs

---

## Security

- No private API keys in the repo or frontend bundle
- `.env` is gitignored; use `.env.example`
- History stays in localStorage until exported or cleared
- Service worker caches the app shell only

---

## License

Use and modify freely for personal projects. Do not use trademarked Iron Man / Marvel branding.
