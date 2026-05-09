import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  callGeminiWithFallback,
  extractRetryAfter,
  getGeminiApiKeys,
} from "./_gemini.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const { messages } = req.body;
  const keys = getGeminiApiKeys();

  if (keys.length === 0) {
    return res.status(500).json({ error: "GEMINI_API_KEY not configured" });
  }

  // Merge ALL system messages (base prompt + live site context, etc.) into a
  // single system_instruction so Gemini sees every directive.
  const systemParts = (messages || [])
    .filter((m: any) => m.role === "system")
    .map((m: any) => String(m.content || "").trim())
    .filter(Boolean);
  const systemMessage = systemParts.length
    ? { content: systemParts.join("\n\n") }
    : null;
  const userMessages = (messages || []).filter((m: any) => m.role !== "system");

  const geminiContents = userMessages.map((m: any) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: String(m.content ?? "") }],
  }));

  // Gemini requires the first turn to be from 'user' — strip any leading model turns
  while (geminiContents.length > 0 && geminiContents[0].role === "model") {
    geminiContents.shift();
  }

  if (geminiContents.length === 0) {
    return res.status(400).json({ error: "No user messages to respond to." });
  }

  try {
    const requestBody: any = {
      system_instruction: systemMessage
        ? { parts: [{ text: systemMessage.content }] }
        : undefined,
      contents: geminiContents,
      generationConfig: {
        maxOutputTokens: 900,
        temperature: 0.7,
      },
    };

    const { status, data, keyIndex, modelUsed, emptyReason } =
      await callGeminiWithFallback(requestBody, "gemini-2.5-flash", keys, "Chat");

    if (keyIndex === -1) {
      const retryAfter = extractRetryAfter(data);
      const baseMsg = data?.error?.message ?? "Gemini API error";
      let friendlyMsg: string;
      let httpStatus = status;
      if (emptyReason) {
        httpStatus = 502;
        friendlyMsg = `Gemini returned no text on every key/model (finishReason=${emptyReason}).`;
      } else if (status === 429 || status === 503) {
        friendlyMsg = `All ${keys.length} Gemini API key(s) are rate-limited on every fallback model${retryAfter ? `. Try again in ~${retryAfter}s.` : "."} (${baseMsg})`;
      } else if (status === 401 || status === 403) {
        friendlyMsg = `All ${keys.length} Gemini API key(s) were denied by Google on every fallback model. Generate fresh keys at https://aistudio.google.com/app/apikey from a supported region. (${baseMsg})`;
      } else {
        friendlyMsg = baseMsg;
      }
      return res.status(httpStatus).json({ error: friendlyMsg, retryAfter, finishReason: emptyReason });
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    console.log(`[Chat] OK — model=${modelUsed} key=#${keyIndex + 1} response length=${text.length} chars`);

    return res.status(200).json({
      choices: [{ message: { content: text } }],
    });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message ?? "Unknown error" });
  }
}
