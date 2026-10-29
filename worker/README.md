# JARVIS AI proxy

This Worker provides `POST /chat` for the JARVIS GitHub Pages frontend and calls Cloudflare Workers AI through the server-side `AI` binding. No provider API key is placed in browser code.

## Deploy

1. Install Wrangler and authenticate to the Cloudflare account that will host the Worker.
2. From this directory run `npx wrangler deploy`.
3. Verify `https://<your-worker-host>/health`.
4. In the GitHub repository, add the Actions repository variable `VITE_AI_ENDPOINT` with the full URL ending in `/chat`, for example `https://jarvis-ai-proxy.<your-workers-subdomain>.workers.dev/chat`.
5. Optionally set `VITE_AI_PROVIDER` to `Cloudflare Workers AI`.
6. Run the **Build and Deploy** workflow again so GitHub Pages embeds the endpoint.

## Security and cost

The Worker restricts browser CORS to the official GitHub Pages origin, validates message payloads, and limits request size. CORS is not authentication and does not stop direct non-browser requests. Before sharing this endpoint publicly, configure Cloudflare rate limiting and usage/billing alerts for the Worker. Never put Cloudflare tokens or model-provider secrets in `VITE_*` variables.
