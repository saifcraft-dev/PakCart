import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

/**
 * Convert a single message's content (string or array of parts) into
 * Gemini API parts. The browser pre-converts image_url → inline_data,
 * so the proxy only needs to handle text and inline_data.
 */
function buildGeminiParts(content: string | any[]): any[] {
  if (typeof content === "string") {
    return [{ text: content }];
  }
  const parts: any[] = [];
  for (const part of content) {
    if (part.type === "text") {
      parts.push({ text: part.text ?? "" });
    } else if (part.type === "inline_data" && part.data && part.mimeType) {
      // Browser already fetched & base64-encoded the image
      parts.push({ inline_data: { mime_type: part.mimeType, data: part.data } });
    } else if (part.type === "image_url" && typeof part.image_url === "string") {
      // Fallback: if somehow an image_url slips through, log it
      console.warn("[AI proxy] Received raw image_url — browser should have resolved it:", part.image_url.slice(0, 80));
      parts.push({ text: `[image: ${part.image_url}]` });
    }
  }
  return parts;
}

/** Collect all configured Gemini API keys in order: AI_INTEGRATIONS_GEMINI_API_KEY (Replit managed), GEMINI_API_KEY, GEMINI_API_KEY_B, … */
function getGeminiApiKeys(): string[] {
  const keys: string[] = [];
  const replitManaged = process.env.AI_INTEGRATIONS_GEMINI_API_KEY;
  if (replitManaged && replitManaged !== "_DUMMY_API_KEY_") keys.push(replitManaged);
  const primary = process.env.GEMINI_API_KEY;
  if (primary) keys.push(primary);
  for (const suffix of ["B", "C", "D", "E", "F"]) {
    const k = process.env[`GEMINI_API_KEY_${suffix}`];
    if (k) keys.push(k);
  }
  return keys;
}

/** Get the Gemini API base URL (Replit-managed proxy or Google's default) */
function getGeminiBaseUrl(): string | null {
  const replitBase = process.env.AI_INTEGRATIONS_GEMINI_BASE_URL;
  if (replitBase) return replitBase;
  return null;
}

/**
 * Fallback model chain. We try the primary model first; if every key is
 * rate-limited (429/503), we degrade to lighter Gemini models that have their
 * own independent quotas. A non-rate-limit error stops the cascade.
 */
const MODEL_FALLBACK_CHAIN = [
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.0-flash",
];

function buildModelChain(primary: string): string[] {
  const chain = [primary, ...MODEL_FALLBACK_CHAIN.filter((m) => m !== primary)];
  // de-duplicate while preserving order
  return Array.from(new Set(chain));
}

/** Returns the assistant text from a Gemini response, or "" if absent. */
function extractGeminiText(data: any): string {
  return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

/** A non-STOP finishReason on an otherwise-OK response means the model produced no usable text. */
function isEmptyFinish(data: any): { empty: boolean; finishReason: string } {
  const text = extractGeminiText(data);
  const finishReason = data?.candidates?.[0]?.finishReason ?? "UNKNOWN";
  // Treat an empty body as "empty"; also treat anything other than STOP as suspicious
  // when text is empty (SAFETY, MAX_TOKENS, RECITATION, OTHER, BLOCKLIST, etc.).
  return { empty: !text || !text.trim(), finishReason };
}

async function callGeminiWithFallback(
  requestBody: any,
  primaryModel: string,
  keys: string[]
): Promise<{ status: number; data: any; keyIndex: number; modelUsed: string | null; emptyReason: string | null }> {
  let lastStatus = 500;
  let lastData: any = { error: "No API keys configured" };
  let lastEmptyReason: string | null = null;
  const models = buildModelChain(primaryModel);

  for (let mi = 0; mi < models.length; mi++) {
    const model = models[mi];
    let allRecoverable = true; // every failure so far is a rate-limit OR an empty response — both worth retrying

    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      try {
        const baseUrl = getGeminiBaseUrl();
        const geminiUrl = baseUrl
          ? `${baseUrl}/models/${model}:generateContent?key=${key}`
          : `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
        const geminiRes = await fetch(geminiUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(requestBody),
            signal: AbortSignal.timeout(120000),
          });
        const data = await geminiRes.json();
        lastStatus = geminiRes.status;
        lastData = data;

        if (geminiRes.ok) {
          const { empty, finishReason } = isEmptyFinish(data);
          if (!empty) {
            if (mi > 0 || i > 0) {
              console.log(`[AI proxy] Succeeded on model "${model}" with key #${i + 1} (after ${mi} model fallback(s))`);
            }
            return { status: geminiRes.status, data, keyIndex: i, modelUsed: model, emptyReason: null };
          }
          // 200 OK but empty text — likely safety/MAX_TOKENS/recitation. Try next key/model.
          lastEmptyReason = finishReason;
          console.warn(`[AI proxy] ${model} key #${i + 1} returned empty text (finishReason=${finishReason}). Falling through.`);
          continue;
        }

        // Recoverable per-key errors: rate limit (429/503), permission denied (403),
        // unauthenticated (401), transient server errors (500/502, 504). For these,
        // switching to a different API key or fallback model may succeed.
        // Truly permanent: 400 BadRequest (malformed body — same body will fail everywhere).
        const status = geminiRes.status;
        const reason = data?.error?.status ?? "";
        const isRateLimit = status === 429 || status === 503;
        const isAuthOrPermDenied = status === 401 || status === 403;
        const isTransientServer = status === 500 || status === 502 || status === 504;
        const isRecoverable = isRateLimit || isAuthOrPermDenied || isTransientServer;
        console.warn(
          `[AI proxy] ${model} key #${i + 1} failed (${status} ${reason}${isRateLimit ? " rate-limited" : isAuthOrPermDenied ? " perm-denied" : ""}):`,
          data.error?.message ?? "unknown"
        );

        if (!isRecoverable) {
          // 400 / 404 etc. — switching keys/models won't help.
          allRecoverable = false;
          break;
        }
        // Otherwise fall through and try the next key.
      } catch (err: any) {
        console.warn(`[AI proxy] ${model} key #${i + 1} threw:`, err.message);
        lastData = { error: err.message };
        allRecoverable = false; // network failure isn't a quota issue; stop cascading
        break;
      }
    }

    if (!allRecoverable) break; // only cascade to next model when every key was a recoverable failure
  }

  return { status: lastStatus, data: lastData, keyIndex: -1, modelUsed: null, emptyReason: lastEmptyReason };
}

async function geminiProxy(req: any, res: any, model: string, defaults: { max_tokens: number; temperature: number }) {
  let body = "";
  req.on("data", (chunk: Buffer) => { body += chunk.toString(); });
  req.on("end", async () => {
    try {
      const parsed = JSON.parse(body);
      const keys = getGeminiApiKeys();

      if (keys.length === 0) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "GEMINI_API_KEY not configured" }));
        return;
      }

      const messages: { role: string; content: string | any[] }[] = parsed.messages ?? [];
      const systemMsg = messages.find((m) => m.role === "system");
      const conversationMsgs = messages.filter((m) => m.role !== "system");

      const imageCount = conversationMsgs.reduce((acc, m) => {
        if (Array.isArray(m.content)) {
          return acc + m.content.filter((p: any) => p.type === "inline_data").length;
        }
        return acc;
      }, 0);
      console.log(`[AI proxy] ${model} | maxTokens=${parsed.maxTokens ?? defaults.max_tokens} | images=${imageCount} | keys=${keys.length}`);

      const contents = conversationMsgs.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: buildGeminiParts(m.content),
      }));

      const requestBody: any = {
        contents,
        generationConfig: {
          maxOutputTokens: parsed.maxTokens ?? parsed.max_tokens ?? defaults.max_tokens,
          temperature: parsed.temperature ?? defaults.temperature,
          ...(typeof parsed.thinkingBudget === "number"
            ? { thinkingConfig: { thinkingBudget: parsed.thinkingBudget } }
            : {}),
        },
      };

      if (systemMsg) {
        requestBody.system_instruction = { parts: [{ text: systemMsg.content }] };
      }

      const { status, data, keyIndex, modelUsed, emptyReason } = await callGeminiWithFallback(requestBody, model, keys);

      if (keyIndex === -1) {
        console.error(`[AI proxy] Exhausted ${keys.length} key(s) across all fallback models. Last status: ${status}, emptyReason=${emptyReason}`);
        // Try to extract a retry-after hint from the upstream error so the UI can show it.
        let retryAfter: number | undefined;
        const detailsArr = data?.error?.details;
        if (Array.isArray(detailsArr)) {
          const retryInfo = detailsArr.find((d: any) => typeof d?.retryDelay === "string");
          if (retryInfo) {
            const m = String(retryInfo.retryDelay).match(/(\d+(?:\.\d+)?)/);
            if (m) retryAfter = Math.ceil(parseFloat(m[1]));
          }
        }
        const baseMsg = data?.error?.message ?? "Gemini API error";
        let friendlyMsg: string;
        let httpStatus = status;
        if (emptyReason) {
          // 200 OK but every attempt returned empty text — surface the finishReason so the user knows why.
          httpStatus = 502;
          if (emptyReason === "SAFETY" || emptyReason === "BLOCKLIST" || emptyReason === "PROHIBITED_CONTENT") {
            friendlyMsg = `Gemini blocked the response on every key/model (finishReason=${emptyReason}). Try removing emojis, slang, or sensitive wording from your input and try again.`;
          } else if (emptyReason === "MAX_TOKENS") {
            friendlyMsg = `The model ran out of output tokens (finishReason=MAX_TOKENS) on every fallback. Try shorter input or fewer images.`;
          } else if (emptyReason === "RECITATION") {
            friendlyMsg = `Gemini suppressed the response due to recitation policy on every key/model. Try rewording your input.`;
          } else {
            friendlyMsg = `Gemini returned no text on every key/model (finishReason=${emptyReason}). Try again or simplify your input.`;
          }
        } else if (status === 429 || status === 503) {
          friendlyMsg = `All ${keys.length} Gemini API key(s) are rate-limited on every fallback model${retryAfter ? `. Try again in ~${retryAfter}s.` : "."} Add another GEMINI_API_KEY_B/C/D… to increase capacity. (${baseMsg})`;
        } else if (status === 401 || status === 403) {
          friendlyMsg = `All ${keys.length} Gemini API key(s) were denied by Google on every fallback model. Common causes: (1) the API key's Google Cloud project is in a country/region where Gemini API is unavailable — create the keys at https://aistudio.google.com from a supported region; (2) the project has billing or admin restrictions; (3) the key was revoked. Generate fresh keys at https://aistudio.google.com/app/apikey and replace GEMINI_API_KEY / GEMINI_API_KEY_B / GEMINI_API_KEY_C in Replit Secrets. (${baseMsg})`;
        } else {
          friendlyMsg = baseMsg;
        }
        res.writeHead(httpStatus, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: friendlyMsg, retryAfter, finishReason: emptyReason }));
        return;
      }

      const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
      console.log(`[AI proxy] OK — model=${modelUsed} key=#${keyIndex + 1} response length=${text.length} chars`);

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ choices: [{ message: { role: "assistant", content: text } }] }));
    } catch (err: any) {
      console.error("[AI proxy] Unhandled error:", err.message);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
  });
}

function geminiApiPlugin() {
  return {
    name: "gemini-api-middleware",
    configureServer(server: any) {
      server.middlewares.use("/api/ai", (req: any, res: any) => {
        if (req.method !== "POST") { res.writeHead(405); res.end("Method Not Allowed"); return; }
        geminiProxy(req, res, "gemini-2.5-flash", { max_tokens: 512, temperature: 0.7 });
      });

      server.middlewares.use("/api/chat", (req: any, res: any) => {
        if (req.method !== "POST") { res.writeHead(405); res.end("Method Not Allowed"); return; }
        geminiProxy(req, res, "gemini-2.5-flash", { max_tokens: 2048, temperature: 0.7 });
      });

      server.middlewares.use("/api/groq-proxy", (req: any, res: any) => {
        if (req.method !== "POST") { res.writeHead(405); res.end("Method Not Allowed"); return; }
        geminiProxy(req, res, "gemini-2.5-flash", { max_tokens: 2048, temperature: 0.7 });
      });
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    geminiApiPlugin(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer(),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  base: "/",
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    chunkSizeWarningLimit: 1000,
    reportCompressedSize: false,
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("/react/") || id.includes("/react-dom/") || id.includes("/scheduler/") || id.includes("/wouter/"))
              return "vendor-react";
            if (id.includes("@tanstack/react-query")) return "vendor-query";
            if (id.includes("framer-motion")) return "vendor-motion";
            if (id.includes("react-helmet-async")) return "vendor-helmet";
            if (id.includes("@radix-ui/")) return "vendor-radix";
            if (id.includes("recharts") || id.includes("d3-")) return "vendor-charts";
            if (id.includes("@tiptap") || id.includes("prosemirror")) return "vendor-tiptap";
            if (id.includes("embla-carousel")) return "vendor-embla";
            if (id.includes("@dnd-kit")) return "vendor-dnd";
            if (id.includes("firebase/firestore") || id.includes("firebase-admin")) return "vendor-firestore";
            if (id.includes("firebase/auth")) return "vendor-firebase-auth";
            if (id.includes("firebase/")) return "vendor-firebase";
            if (id.includes("lucide-react") || id.includes("clsx") || id.includes("tailwind-merge") || id.includes("class-variance-authority"))
              return "vendor-ui";
            if (id.includes("zod") || id.includes("@hookform") || id.includes("react-hook-form")) return "vendor-forms";
            if (id.includes("date-fns")) return "vendor-date";
          }
          return undefined;
        },
      },
    },
  },
  server: {
    port: 5000,
    host: true,
    allowedHosts: true,
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
  define: {
    "process.env": {},
  },
});
