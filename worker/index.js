const ALLOWED_ORIGIN = "https://yalangisexter-ux.github.io";
const CF_MODEL = "@cf/meta/llama-3.1-8b-instruct";
const GEMINI_MODEL = "gemini-flash-latest";
const MAX_BODY_BYTES = 24_000;
const MAX_MESSAGES = 20;
const MAX_MESSAGE_CHARS = 4_000;

const JARVIS_SYSTEM = `You are JARVIS (Just A Rather Very Intelligent System), the personal AI assistant of the user.

Personality & Style:
- Calm, precise, slightly dry British wit (Tony Stark's JARVIS energy).
- Concise but complete. Prefer short, high-signal answers.
- Address the user respectfully. Occasionally use "sir" or the user's name if known, but do not overdo it.
- Confident and capable. Never robotic or overly apologetic.
- When uncertain, say so clearly and offer the best available information or next step.
- Stay in character. Do not break immersion by mentioning you are an LLM, Claude, GPT, Gemini, or Llama unless the user explicitly asks about your underlying model.

Capabilities & Honesty:
- You can answer questions, reason, brainstorm, summarize, write code, plan, and help with daily tasks.
- You can open websites when the frontend supports it (YouTube, GitHub, ChatGPT, etc.).
- You cannot unlock the phone, control other native apps, change system settings, or perform actions that require OS-level privileges. Be transparent about these web/PWA limitations when relevant.
- Prefer actionable, practical responses.

Response rules:
- Keep replies under ~180 words unless the user asks for depth.
- Use natural spoken English suitable for text-to-speech.
- End with a helpful offer or question only when it genuinely adds value.`;

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

async function callGemini(messages, apiKey) {
  const contents = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const body = {
    system_instruction: {
      parts: [{ text: JARVIS_SYSTEM }],
    },
    contents,
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 800,
    },
  };

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Gemini error ${res.status}: ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  const text =
    data?.candidates?.[0]?.content?.parts?.[0]?.text ??
    data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") ??
    null;

  if (typeof text !== "string" || !text.trim()) {
    throw new Error("Gemini returned empty content");
  }
  return text.trim();
}

async function callCloudflare(messages, env) {
  const result = await env.AI.run(CF_MODEL, {
    messages: [
      { role: "system", content: JARVIS_SYSTEM },
      ...messages,
    ],
    max_tokens: 700,
  });
  const content = result?.response;
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("Cloudflare AI returned empty content");
  }
  return content.trim();
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
      return json(
        {
          ok: true,
          service: "jarvis-ai-proxy",
          providers: {
            gemini: Boolean(env.GEMINI_API_KEY),
            cloudflare: true,
          },
        },
        200,
        corsOrigin
      );
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
        if (
          !message ||
          !["user", "assistant"].includes(message.role) ||
          typeof message.content !== "string" ||
          !message.content.trim() ||
          message.content.length > MAX_MESSAGE_CHARS
        ) {
          throw new Error("Invalid message");
        }
        return { role: message.role, content: message.content.trim() };
      });
    } catch {
      return json({ error: "Invalid message format" }, 400, corsOrigin);
    }

    try {
      let content;
      let provider;

      // Prefer Gemini when key is present
      if (env.GEMINI_API_KEY) {
        try {
          content = await callGemini(messages, env.GEMINI_API_KEY);
          provider = "gemini-flash";
        } catch (geminiErr) {
          console.warn("Gemini failed, falling back to Cloudflare:", geminiErr.message);
          content = await callCloudflare(messages, env);
          provider = "cloudflare-workers-ai (gemini-fallback)";
        }
      } else {
        content = await callCloudflare(messages, env);
        provider = "cloudflare-workers-ai";
      }

      return json({ content, provider }, 200, corsOrigin);
    } catch (err) {
      console.error("AI error:", err);
      return json({ error: "AI service unavailable" }, 503, corsOrigin);
    }
  },
};
