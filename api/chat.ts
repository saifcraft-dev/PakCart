// Vercel serverless function — mirrors the /api/chat middleware in vite.config.ts
// This runs in production on Vercel where the Vite dev server is not present.

function buildGeminiParts(content: string | any[]): any[] {
  if (typeof content === "string") return [{ text: content }];
  const parts: any[] = [];
  for (const part of content) {
    if (part.type === "text") {
      parts.push({ text: part.text ?? "" });
    } else if (part.type === "inline_data" && part.data && part.mimeType) {
      parts.push({ inline_data: { mime_type: part.mimeType, data: part.data } });
    } else if (part.type === "image_url" && typeof part.image_url === "string") {
      parts.push({ text: `[image: ${part.image_url.slice(0, 80)}]` });
    }
  }
  return parts;
}

function getGeminiApiKeys(): string[] {
  const keys: string[] = [];
  const managed = process.env.AI_INTEGRATIONS_GEMINI_API_KEY;
  if (managed) keys.push(managed);
  const primary = process.env.GEMINI_API_KEY;
  if (primary) keys.push(primary);
  for (const suffix of ["B", "C", "D", "E", "F"]) {
    const k = process.env[`GEMINI_API_KEY_${suffix}`];
    if (k) keys.push(k);
  }
  return keys;
}

function getGeminiBaseUrl(): string | null {
  return process.env.AI_INTEGRATIONS_GEMINI_BASE_URL ?? null;
}

function extractGeminiText(data: any): string {
  return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

function isEmptyFinish(data: any): { empty: boolean; finishReason: string } {
  const text = extractGeminiText(data);
  const finishReason = data?.candidates?.[0]?.finishReason ?? "UNKNOWN";
  return { empty: !text || !text.trim(), finishReason };
}

const MODEL_FALLBACK_CHAIN = ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.0-flash"];

function buildModelChain(primary: string): string[] {
  return Array.from(new Set([primary, ...MODEL_FALLBACK_CHAIN.filter((m) => m !== primary)]));
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
    let allRecoverable = true;

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
            return { status: geminiRes.status, data, keyIndex: i, modelUsed: model, emptyReason: null };
          }
          lastEmptyReason = finishReason;
          console.warn(`[chat] ${model} key #${i + 1} returned empty (finishReason=${finishReason})`);
          continue;
        }

        const status = geminiRes.status;
        const isRecoverable = status === 429 || status === 503 || status === 401 || status === 403 || status === 500 || status === 502 || status === 504;
        console.warn(`[chat] ${model} key #${i + 1} failed (${status}):`, data?.error?.message ?? "unknown");

        if (!isRecoverable) { allRecoverable = false; break; }
      } catch (err: any) {
        console.warn(`[chat] ${model} key #${i + 1} threw:`, err.message);
        lastData = { error: err.message };
        allRecoverable = false;
        break;
      }
    }

    if (!allRecoverable) break;
  }

  return { status: lastStatus, data: lastData, keyIndex: -1, modelUsed: null, emptyReason: lastEmptyReason };
}

export default async function handler(req: any, res: any) {
  // CORS — allow pakcart.store and Vercel preview URLs
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") { res.status(200).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ error: "Method Not Allowed" }); return; }

  try {
    const parsed = typeof req.body === "object" ? req.body : JSON.parse(req.body ?? "{}");
    const keys = getGeminiApiKeys();

    if (keys.length === 0) {
      res.status(500).json({ error: "GEMINI_API_KEY is not configured in Vercel environment variables. Add it in your Vercel project settings → Environment Variables." });
      return;
    }

    const messages: { role: string; content: string | any[] }[] = parsed.messages ?? [];
    const systemMessages = messages.filter((m) => m.role === "system");
    const conversationMsgs = messages.filter((m) => m.role !== "system");

    const systemText = systemMessages
      .map((m) => (typeof m.content === "string" ? m.content : JSON.stringify(m.content)))
      .join("\n\n");

    const contents = conversationMsgs.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: buildGeminiParts(m.content),
    }));

    const requestBody: any = {
      contents,
      generationConfig: {
        maxOutputTokens: parsed.maxTokens ?? parsed.max_tokens ?? 2048,
        temperature: parsed.temperature ?? 0.7,
      },
    };

    if (systemText) {
      requestBody.system_instruction = { parts: [{ text: systemText }] };
    }

    const { status, data, keyIndex, modelUsed, emptyReason } = await callGeminiWithFallback(
      requestBody,
      "gemini-2.5-flash",
      keys
    );

    if (keyIndex === -1) {
      const baseMsg = data?.error?.message ?? "Gemini API error";
      let friendlyMsg = baseMsg;
      let httpStatus = status;

      if (emptyReason) {
        httpStatus = 502;
        friendlyMsg = `Gemini returned empty response (finishReason=${emptyReason}). Try again.`;
      } else if (status === 429 || status === 503) {
        friendlyMsg = `All Gemini API keys are rate-limited. Try again shortly. (${baseMsg})`;
      } else if (status === 401 || status === 403) {
        friendlyMsg = `Gemini API key denied. Please check GEMINI_API_KEY in Vercel environment variables. (${baseMsg})`;
      }

      res.status(httpStatus).json({ error: friendlyMsg });
      return;
    }

    const text = extractGeminiText(data);
    console.log(`[chat] OK — model=${modelUsed} key=#${keyIndex + 1} length=${text.length}`);

    res.status(200).json({ choices: [{ message: { role: "assistant", content: text } }] });
  } catch (err: any) {
    console.error("[chat] Unhandled error:", err.message);
    res.status(500).json({ error: err.message });
  }
}
