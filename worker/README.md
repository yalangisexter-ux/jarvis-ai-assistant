# JARVIS AI proxy

This Worker provides `POST /chat` for the JARVIS GitHub Pages frontend.

It now supports **two providers**:

1. **Gemini Flash** (preferred) — when `GEMINI_API_KEY` secret is set
2. **Cloudflare Workers AI** (Llama 3.1) — always available as fallback

A strong, in-character JARVIS system prompt is applied in both cases.

## Deploy / Update

1. Install Wrangler and authenticate to the Cloudflare account that will host the Worker.
2. From this directory run `npx wrangler deploy`.
3. (Optional but recommended) Set the Gemini key as a Worker secret:

   ```bash
   npx wrangler secret put GEMINI_API_KEY
   ```

   Paste your new Gemini API key when prompted. **Never commit the key.**

4. Verify `https://<your-worker-host>/health` — it will report whether Gemini is configured.
5. In the GitHub repository, add the Actions repository variable `VITE_AI_ENDPOINT` with the full URL ending in `/chat`, for example `https://jarvis-ai-proxy.<your-workers-subdomain>.workers.dev/chat`.
6. Optionally set `VITE_AI_PROVIDER` to `Gemini + Cloudflare`.
7. Run the **Build and Deploy** workflow again so GitHub Pages embeds the endpoint.

## Security and cost

- CORS is restricted to the official GitHub Pages origin.
- Message payloads are validated and size-limited.
- CORS is not authentication. Before sharing the endpoint publicly, configure Cloudflare rate limiting and billing alerts.
- Never put provider secrets in `VITE_*` variables or the frontend.

## Personality

The system prompt makes JARVIS:
- Calm, precise, slightly dry British wit
- Concise and high-signal
- Honest about web/PWA limitations
- Fully in character (does not break immersion by naming underlying models unless asked)
