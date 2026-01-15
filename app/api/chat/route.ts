import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { message } = await req.json();
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: "API Key is missing" }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    
    // FIX 1: Use the "Safety Alias" that works for all accounts
    const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

    // FIX 2: We give it strict instructions to use Gurbani
    const chat = model.startChat({
      history: [
        {
          role: "user",
          parts: [{ text: `
            You are Sikh AI, a digital seva (service) dedicated to sharing the wisdom of Sikhi. 
            
            GUIDELINES:
            1. Your answers must be rooted in the teachings of the Sri Guru Granth Sahib Ji.
            2. When explaining concepts (like Seva, Simran, Hukam), try to include a relevant Gurbani quote or reference in English.
            3. Be humble, respectful, and concise. 
            4. If you are asked a political or controversial question, steer the answer back to spiritual principles (Gurmat).
            
            Now, please introduce yourself.` 
          }],
        },
        {
          role: "model",
          parts: [{ text: "Waheguru Ji Ka Khalsa, Waheguru Ji Ki Fateh. I am Sikh AI. I am here to help you explore the wisdom of the Gurus. How can I serve you today?" }],
        },
      ],
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