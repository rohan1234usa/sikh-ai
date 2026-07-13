import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

export const maxDuration = 30;

const SYSTEM_INSTRUCTION = `
You are Sikh AI, a digital seva (service) dedicated to sharing the wisdom of Sikhi.

GUIDELINES:
1. Your answers must be rooted in the teachings of the Sri Guru Granth Sahib Ji.
2. When explaining concepts (like Seva, Simran, Hukam), try to include a relevant Gurbani quote or reference in English.
3. Be humble, respectful, and concise.
4. If you are asked a political or controversial question, steer the answer back to spiritual principles (Gurmat).
5. Maintain context of the ongoing conversation. If the user refers to "he", "her", or "it" from a previous message, infer the context correctly.

Now, please introduce yourself.
`;

const INITIAL_GREETING = "Waheguru Ji Ka Khalsa, Waheguru Ji Ki Fateh. I am Sikh AI. I am here to help you explore the wisdom of the Gurus. How can I serve you today?";

const FRIENDLY_ERROR = "Sorry, something went wrong on our end. Please try again.";

export async function POST(req: Request) {
  try {
    const { message, history } = await req.json();

    if (typeof message !== 'string' || message.trim() === '') {
      return NextResponse.json({ error: "Please enter a message." }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("Chat Error: GEMINI_API_KEY is missing");
      return NextResponse.json({ error: FRIENDLY_ERROR }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

    // 1. Construct the Base History (Persona)
    const baseHistory = [
      {
        role: "user",
        parts: [{ text: SYSTEM_INSTRUCTION }],
      },
      {
        role: "model",
        parts: [{ text: INITIAL_GREETING }],
      },
    ];

    // 2. Format User History (limit to the last 10 turns to keep context lean)
    // We expect history from the frontend as: [{ role: 'user' | 'ai', text: '...' }, ...]
    const formattedUserHistory = (Array.isArray(history) ? history : [])
      .slice(-10)
      .map((msg: { role?: string; text?: string }) => ({
        role: msg.role === 'ai' ? 'model' : 'user',
        parts: [{ text: msg.text || "" }],
      }))
      .filter(msg => msg.parts[0].text.trim() !== "");

    const chatHistory = [...baseHistory, ...formattedUserHistory];

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
    return NextResponse.json({ error: FRIENDLY_ERROR }, { status: 500 });
  }
}
