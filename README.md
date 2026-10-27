# JARVIS AI Assistant

A lightweight, voice-first web assistant prototype designed for iPhone Safari.

## Current capabilities

- Responsive dark JARVIS-style interface.
- Browser speech recognition when supported and permitted.
- Spoken responses using the browser's speech synthesis.
- Built-in demo commands for time, date, jokes, and opening selected websites.
- PWA manifest and an offline application shell.

## Important limitations

This repository currently contains a **front-end prototype**, not a full AI assistant. It does not yet connect to an AI model. Unrecognized commands receive a notice explaining this. Do not put provider API keys in `index.html`, any other browser code, or public repository files.

A normal iOS web app cannot unlock the iPhone, bypass Face ID, or control arbitrary apps/system settings. Wake-word detection in the background is not guaranteed on iOS; use supported Siri Shortcuts and user-initiated microphone access.

## Deploy with GitHub Actions

The workflow at `.github/workflows/deploy.yml` validates the static app and deploys the repository root to GitHub Pages on pushes to `main`.

1. Open **Settings → Pages** in this repository.
2. Set the publishing source to **GitHub Actions** if it is not already selected.
3. Push a commit to `main`, or manually run **Actions → Build and deploy JARVIS → Run workflow**.
4. Check the workflow run for its actual result and open the deployment URL shown by the successful deployment.

Expected project-site URL (only after Pages is enabled and deployment succeeds):
https://yalangisexter-ux.github.io/jarvis-ai-assistant/

## Install on iPhone

1. Open the successfully deployed HTTPS site in Safari.
2. Tap Share → Add to Home Screen.
3. Add JARVIS to the Home Screen.
4. Allow microphone access when prompted, if using voice recognition.

## Local testing

Serve the repository over HTTP rather than opening `index.html` as a file, because service workers require a secure context (HTTPS or localhost). For example, with Python installed:

```sh
python3 -m http.server 8000
```

Then open http://localhost:8000.

## Next steps for a real AI assistant

Implement a separately deployed backend endpoint that authenticates requests, validates input, rate-limits usage, and calls the chosen AI provider using a server-side secret. Configure the frontend with only the backend's public URL. Do not expose provider secrets in GitHub Pages builds. Add automated unit/browser tests and verify them before describing the app as production-ready.
