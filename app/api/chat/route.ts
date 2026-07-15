import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { DEFAULT_PREFS, MAX_MESSAGE_CHARS, isLensId, isModeId, isLanguageId, isScript, type ChatContext } from "@/lib/chat/config";
import { composeSystemInstruction } from "@/lib/chat/prompts";

export const maxDuration = 30;

const FRIENDLY_ERROR = "Sorry, something went wrong on our end. Please try again.";

// Whitelist the deep-link context: unknown type drops the whole thing, and
// title/text are truncated inside composeSystemInstruction. Client strings
// never become prompt instructions — only the quoted passage block.
function sanitizeContext(raw: unknown): ChatContext | null {
  if (!raw || typeof raw !== "object") return null;
  const c = raw as { type?: unknown; title?: unknown; text?: unknown };
  if (c.type !== "hukamnama" && c.type !== "shabad") return null;
  if (typeof c.text !== "string" || c.text.trim() === "") return null;
  return {
    type: c.type,
    title: typeof c.title === "string" ? c.title : "",
    text: c.text,
    capturedAt: Date.now(),
  };
}

export async function POST(req: Request) {
  try {
    const { message, history, lensId, modeId, languageId, script, context } = await req.json();

    // The `code` field lets clients render a translated message; the English
    // `error` string stays for logs and older clients.
    if (typeof message !== 'string' || message.trim() === '') {
      return NextResponse.json({ error: "Please enter a message.", code: "chat_empty" }, { status: 400 });
    }
    if (message.length > MAX_MESSAGE_CHARS) {
      return NextResponse.json({ error: "That message is too long. Please shorten it and try again.", code: "chat_too_long" }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("Chat Error: GEMINI_API_KEY is missing");
      return NextResponse.json({ error: FRIENDLY_ERROR, code: "chat_failed" }, { status: 500 });
    }

    // Unknown IDs fall back to defaults silently: stale localStorage or an
    // old client must never brick the chat. IDs are lookup keys only.
    const systemInstruction = composeSystemInstruction({
      lensId: isLensId(lensId) ? lensId : DEFAULT_PREFS.lensId,
      modeId: isModeId(modeId) ? modeId : DEFAULT_PREFS.modeId,
      languageId: isLanguageId(languageId) ? languageId : DEFAULT_PREFS.languageId,
      script: isScript(script) ? script : undefined,
      context: sanitizeContext(context),
    });

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-flash-latest", systemInstruction });

    // Format user history (limit to the last 10 turns to keep context lean).
    // We expect history from the frontend as: [{ role: 'user' | 'ai', text: '...' }, ...]
    // Cap each turn's length too, so the per-message limit above can't be
    // bypassed by stuffing megabytes into the history of this public endpoint.
    const chatHistory = (Array.isArray(history) ? history : [])
      .slice(-10)
      .map((msg: { role?: string; text?: string }) => ({
        role: msg.role === 'ai' ? 'model' : 'user',
        parts: [{ text: (msg.text || "").slice(0, MAX_MESSAGE_CHARS) }],
      }))
      .filter(msg => msg.parts[0].text.trim() !== "");

    const chat = model.startChat({ history: chatHistory });
    const result = await chat.sendMessageStream(message);

    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const chunk of result.stream) {
            controller.enqueue(encoder.encode(chunk.text()));
          }
          controller.close();
        } catch (err) {
          console.error("Stream error:", err);
          // Aborts the HTTP body; the client's reader throws and keeps partial text
          controller.error(err);
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Accel-Buffering": "no",
      },
    });

  } catch (error) {
    console.error("Chat Error:", error);
    return NextResponse.json({ error: FRIENDLY_ERROR, code: "chat_failed" }, { status: 500 });
  }
}
