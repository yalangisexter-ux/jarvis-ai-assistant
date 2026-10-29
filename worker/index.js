const ALLOWED_ORIGIN = "https://yalangisexter-ux.github.io";
const MODEL = "@cf/meta/llama-3.1-8b-instruct";
const MAX_BODY_BYTES = 24_000;
const MAX_MESSAGES = 20;
const MAX_MESSAGE_CHARS = 4_000;

function json(data, status = 200, origin = "") {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": origin,
      "Vary": "Origin",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const corsOrigin = origin === ALLOWED_ORIGIN ? origin : "";

    if (request.method === "OPTIONS") {
      if (!corsOrigin) return new Response(null, { status: 403 });
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": corsOrigin,
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Max-Age": "86400",
          "Vary": "Origin",
        },
      });
    }

    const url = new URL(request.url);
    if (url.pathname === "/health" && request.method === "GET") {
      return json({ ok: true, service: "jarvis-ai-proxy" }, 200, corsOrigin);
    }
    if (url.pathname !== "/chat" || request.method !== "POST") {
      return json({ error: "Not found" }, 404, corsOrigin);
    }
    if (!corsOrigin) return json({ error: "Origin not allowed" }, 403);
    if (!request.headers.get("content-type")?.includes("application/json")) {
      return json({ error: "Content-Type must be application/json" }, 415, corsOrigin);
    }

    const declaredLength = Number(request.headers.get("content-length") || 0);
    if (declaredLength > MAX_BODY_BYTES) {
      return json({ error: "Request too large" }, 413, corsOrigin);
    }

    let body;
    try {
      const raw = await request.text();
      if (raw.length > MAX_BODY_BYTES) return json({ error: "Request too large" }, 413, corsOrigin);
      body = JSON.parse(raw);
    } catch {
      return json({ error: "Invalid JSON" }, 400, corsOrigin);
    }

    if (!Array.isArray(body.messages) || body.messages.length === 0 || body.messages.length > MAX_MESSAGES) {
      return json({ error: "messages must contain 1 to 20 items" }, 400, corsOrigin);
    }

    let messages;
    try {
      messages = body.messages.map((message) => {
        if (!message || !["user", "assistant"].includes(message.role) ||
            typeof message.content !== "string" || !message.content.trim() ||
            message.content.length > MAX_MESSAGE_CHARS) {
          throw new Error("Invalid message");
        }
        return { role: message.role, content: message.content.trim() };
      });
    } catch {
      return json({ error: "Invalid message format" }, 400, corsOrigin);
    }

    try {
      const result = await env.AI.run(MODEL, {
        messages: [
          { role: "system", content: "You are JARVIS, a helpful, concise personal assistant. Be clear about uncertainty and never claim to control iPhone settings or other apps." },
          ...messages,
        ],
        max_tokens: 700,
      });
      const content = result?.response;
      if (typeof content !== "string" || !content.trim()) {
        return json({ error: "AI returned no response" }, 502, corsOrigin);
      }
      return json({ content: content.trim(), provider: "cloudflare-workers-ai" }, 200, corsOrigin);
    } catch {
      return json({ error: "AI service unavailable" }, 503, corsOrigin);
    }
  },
};
