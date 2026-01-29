import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

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

export async function POST(req: Request) {
  try {
    const { message, history } = await req.json();
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: "API Key is missing" }, { status: 500 });
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

    // 2. Format User History (Limit to last 10 turns to save context/tokens if needed, 
    // though Gemini has a large window, this is good hygiene)
    // We expect history from frontend to be: [{ role: 'user' | 'ai', text: '...' }, ...]
    const formattedUserHistory = (Array.isArray(history) ? history : [])
      .slice(-10) // Take last 10 messages
      .map((msg: any) => ({
        role: msg.role === 'ai' ? 'model' : 'user',
        parts: [{ text: msg.text || "" }],
      }))
      // Filter out any messages that might be invalid or empty
      .filter(msg => msg.parts[0].text.trim() !== "");

    // 3. specific check: passing the exact same message as the last history item 
    // can sometimes confuse models if logic isn't clean, but here we just append.

    // Combine Base + User History
    const chatHistory = [...baseHistory, ...formattedUserHistory];

    const chat = model.startChat({
      history: chatHistory,
    });

    const result = await chat.sendMessage(message);
    const response = await result.response;
    const text = response.text();

    return NextResponse.json({ text });

  } catch (error: any) {
    console.error("Chat Error:", error);
    return NextResponse.json({ error: error.message || "Unknown Error" }, { status: 500 });
  }
}