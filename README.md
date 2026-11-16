# JARVIS AI Assistant — offline-first

JARVIS is a local-first personal assistant PWA for iPhone 15 Plus and desktop browsers.

## Offline design

- **Local AI:** Transformers.js runs Qwen3-0.6B in the browser using WebGPU, with a WASM fallback.
- **One-time model setup:** Download the quantized model while online. Transformers.js caches model assets in the browser cache; after successful installation, inference runs locally.
- **No cloud AI calls:** The frontend does not call Gemini, Cloudflare Workers AI, or a remote AI proxy. `VITE_AI_ENDPOINT` is not used.
- **Local commands:** time, date, arithmetic, jokes, status, local notes (`remember that …` / `what do you remember`), and Focus Board tasks (`add task …` / `show tasks`).
- **Local data:** settings, conversation history, notes and tasks are stored in browser storage. The app requests persistent storage where supported, but browsers/OSes may still clear site data.
- **PWA shell:** Vite PWA precaches app assets, including WebAssembly runtime assets, for offline startup after the first successful load.

## Model

Default model: [onnx-community/Qwen3-0.6B-ONNX](https://huggingface.co/onnx-community/Qwen3-0.6B-ONNX).

The WebGPU Q4F16 variant is approximately 570 MB; the WASM Q4 fallback can require a larger download. Qwen3 supports multilingual text including Telugu, but quality on a small 0.6B model is limited compared with larger models. This is a compact on-device assistant, not a frontier-scale model.

## Voice and iOS limitations

- Speech recognition is only enabled when the browser explicitly supports local processing (`processLocally`). JARVIS refuses browser recognition modes that may send microphone audio to a remote service.
- Speech output only selects voices marked as local by the operating system. Install an offline voice/language pack in device settings if none are available.
- Safari/PWA cannot run an always-on wake word while suspended, bypass Face ID, or control arbitrary native apps.
- iOS may evict browser caches under storage pressure. Keep the app and model cache available; verify the model is installed before relying on airplane-mode use.

## First-time setup

1. Open the HTTPS JARVIS PWA while online.
2. Add it to the Home Screen in Safari if using iPhone.
3. Open **Chat → Offline intelligence → Download offline AI model**.
4. Keep JARVIS open until the model download and initialization finish.
5. Send a test prompt, then enable Airplane Mode and test again.
6. Repeat the offline test after an iOS/browser update or if site data has been cleared.

## Offline verification checklist

- [ ] App shell loads after a successful first visit with network disabled.
- [ ] Model can be loaded from browser cache with network disabled.
- [ ] A new conversation prompt receives a local model response in Airplane Mode.
- [ ] Calculator, notes and tasks work offline.
- [ ] No requests are made to Gemini, Cloudflare or any remote AI endpoint.
- [ ] Voice recognition is used only when the browser guarantees local processing.
- [ ] Speech output uses an installed local voice.

## Development

```bash
git clone https://github.com/yalangisexter-ux/jarvis-ai-assistant.git
cd jarvis-ai-assistant
npm install
npm run typecheck
npm run lint
npm test
npm run build
npm run dev
```

GitHub Pages hosts the static PWA. It is used to install/update the application, not to run AI inference. The initial app and model download require internet; normal inference after installation does not.
