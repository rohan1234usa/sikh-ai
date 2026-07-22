# Sikh AI: Engineering Spiritual Intelligence 🪯

[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![Firebase](https://img.shields.io/badge/Firebase-Auth%20%2B%20Firestore-orange?style=for-the-badge&logo=firebase)](https://firebase.google.com/)
[![Google Gemini](https://img.shields.io/badge/AI-Gemini-blueviolet?style=for-the-badge&logo=google-gemini)](https://deepmind.google/technologies/gemini/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](LICENSE)
[![Live Demo](https://img.shields.io/badge/Demo-Visit%20Live%20Site-2ea44f?style=for-the-badge&logo=vercel)](https://sikhai.vercel.app)

> **Architecting a Modern Bridge Between Ancient Heritage and Generative AI.**

## 📖 About The Project

**Sikh AI** is a web platform designed to modernize how the Sikh community interacts with its spiritual heritage. It pairs **Google Gemini** with a carefully-tuned Sikhi system prompt and streaming responses, so answers stay rooted in the teachings of the *Sri Guru Granth Sahib Ji* rather than drifting into generic advice.

Whether it's fetching the daily *Hukamnama* from Darbar Sahib, coordinating *Seva* (community service) events, looking up Shabads from the *Guru Granth Sahib* by Ang, or translating between English and Punjabi in either script, Sikh AI aims for a calm, culturally-considered experience — now with light/dark theming and an accessible, mobile-friendly interface.

### 🌟 Key Features

*   **💬 Streaming, Gurbani-Guided Chat**: Responses stream token-by-token from Google Gemini (`gemini-flash-latest`), steered by a system instruction to stay grounded in Guru Granth Sahib teachings. Conversations persist locally (`localStorage`) and include starter prompts, copy, regenerate, and a stop control.
*   **🧭 Guru Teachings-Lenses**: Ask for guidance through the lens of any of the ten Gurus (or the default SikhAI). Each lens shifts emphasis, preferred Bani, and sakhis while never impersonating a Guru — answers stay in the third person with honorifics. Switching mid-conversation drops an in-thread divider and applies from the next message.
*   **🎛️ Response Styles & Languages**: Orthogonal to the lens, pick a response style (Balanced, Simple/newcomer, Gurbani-first, Vichaar/reflection, Sakhi/story) and a language (English, Punjabi-American bilingual, or Punjabi with Gurmukhi/romanized script-matching). All three axes are composed server-side into one Gemini `systemInstruction`.
*   **🧩 Guided Prompting**: Per-lens starter chips plus categorized topic packs (Life advice, Hardship & grief, Concepts, History & sakhis, Daily practice), and deep links from the Hukamnama and Shabad pages that open the chat with that passage attached as context.
*   **🔤 Punjabi ↔ English Translator**: Type English, Gurmukhi, or romanized Punjabi and get **all three renditions at once**, plus a word-by-word gloss, "tricky parts" notes (idioms, the ergative *ne*, honorifics, false friends), and pronunciation tips anchored to real words from the result. Input script is auto-detected and overridable. Built for diaspora learners who speak some Punjabi but may not read Gurmukhi — so it ships a 50-phrase curated phrasebook across five categories (greetings, kinship, gurdwara, everyday, food) and local translation history that restores a full past result instantly with no re-fetch.
*   **⚡ Daily Hukamnama**: Server-rendered fetch of the day's decree from Darbar Sahib (via the GurbaniNow API), rendered in Gurmukhi with English translation.
*   **📖 Shabad Lookup**: Browse any Ang (1–1430) of the Guru Granth Sahib through a validated proxy to the GurbaniNow API.
*   **🤝 Seva Event Coordination**: A real-time event board backed by Firestore, with Google sign-in (Firebase Auth) so Sangat can post and join volunteering opportunities.
*   **🎨 Accessible, Themeable UI**: A bespoke design system in "Nihang Navy" and "Kesri Saffron" with class-based light/dark mode (no-flash theme script, semantic CSS-variable tokens), keyboard focus-visible rings, ARIA-labelled controls, `prefers-reduced-motion` support, and an AA-contrast accent token.
*   **🌐 Site-Wide Punjabi UI**: A navbar language picker (like the theme toggle) switches the whole interface between English, ਪੰਜਾਬੀ (Gurmukhi), and romanized Punjabi. The choice is stored in a cookie so server-rendered pages and metadata arrive already translated (no flash of English), the `<html lang>` attribute and body font follow the script, and the chat's reply language defaults to the site language while remaining overridable in chat settings. All copy lives in typed dictionaries under `lib/i18n/dictionaries/` — missing translation keys are compile errors.

## 🏗️ Technical Architecture

A **Next.js 16 App Router** application (React 19, Tailwind CSS v4) that talks directly to Gemini and Firebase — no intermediate services to keep the stack lean.

```mermaid
graph TD
    User([User]) --> Next[Next.js 16 App Router]
    Next --> Auth[Firebase Auth]
    Next --> DB[Firestore Real-time DB]
    Next --> Hukam[GurbaniNow / Darbar Sahib API]

    subgraph "AI Core"
    Next --> Route["/api/chat Route (streaming)"]
    Route --> Compose["composeSystemInstruction()<br/>lens × mode × language"]
    Next --> TRoute["/api/translate Route (JSON mode)"]
    TRoute --> TCompose["composeTranslateInstruction()<br/>+ RESPONSE_SCHEMA"]
    Compose --> Gemini[Google Gemini API]
    TCompose --> Gemini
    end
```

The chat client sends only whitelisted IDs (`lensId` / `modeId` / `languageId`, plus an optional `script` hint) and an optional reference passage — never prompt text. The route validates each value, silently falls back to defaults on anything unknown, and assembles the persona server-side in `lib/chat/`, so prompt fragments never ship to the browser and can't be tampered with from the client.

### Engineering Highlights
*   **Hybrid Rendering**: React Server Components for static/data-fetched content (e.g. the server-rendered Hukamnama) with Client Components for the interactive AI chat.
*   **Streamed Responses**: The chat API returns a raw `text/plain` `ReadableStream`, so tokens render as they generate — minimizing time-to-first-token.
*   **Schema-constrained JSON output**: The translator uses Gemini's `responseMimeType: 'application/json'` + `responseSchema`, with the schema enums generated from the same `as const` unions as the TypeScript types so the two can't drift. The response is then re-validated at runtime in `lib/translate/parse.ts` — malformed list entries are dropped rather than failing the whole translation, and a truncated response is caught via its `MAX_TOKENS` finish reason instead of surfacing as a JSON parse error.
*   **Server-only prompts + nonce fencing**: Both the chat and translate system prompts live in server-only modules, so prompt text never ships to the browser. Untrusted user text is wrapped in a per-request UUID-nonce fence, so crafted input can't forge the closing delimiter and break out into instructions.
*   **Theming without flash**: An inline pre-paint script applies the stored/system theme before first paint; semantic `@theme inline` tokens drive both light and dark modes.
*   **Cookie-backed i18n, no library**: A site-wide language (English / Gurmukhi / romanized Punjabi) lives in a `sikhai.lang` cookie, so server components and metadata render already-translated on the first byte — no flash of English. UI copy is typed dictionaries in `lib/i18n/dictionaries/` (`Dictionary = typeof en`, so missing keys are compile errors), read via `useT()` in client components and `getServerT()` on the server.
*   **Multilingual typography**: Geist / Geist Mono for Latin text and Noto Sans Gurmukhi for Gurmukhi script, wired through Tailwind v4 font tokens; an `html[lang='pa']` rule swaps the body stack to Gurmukhi automatically when that language is active.

## 🚀 Getting Started

Follow these steps to set up the project locally.

### Prerequisites

*   Node.js 18+
*   npm or yarn
*   A Firebase project (Auth + Firestore)
*   A Google Gemini API key ([Google AI Studio](https://aistudio.google.com/))

### Installation

1.  **Clone the repository**
    ```bash
    git clone https://github.com/rohan1234usa/sikh-ai.git
    cd sikh-ai
    ```

2.  **Install dependencies**
    ```bash
    npm install
    ```

3.  **Set up Environment Variables**
    Create a `.env.local` file in the root directory:
    ```env
    # Google Gemini (server-side)
    GEMINI_API_KEY=your_gemini_key

    # Firebase (client-side)
    NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
    NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
    NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
    ```

4.  **Run the dev server**
    ```bash
    npm run dev
    ```

## 💻 Usage Examples

### 1. The Hukamnama Fetcher (Server-Side)
A server component fetches the daily decree fresh on each request.

```typescript
// app/hukamnama/page.tsx
async function getHukamnama() {
  const res = await fetch('https://api.gurbaninow.com/v2/hukamnama/today', {
    cache: 'no-store', // always the current day's Hukamnama
  });

  if (!res.ok) throw new Error('Failed to fetch');
  return res.json();
}
```

### 2. The Streaming Chat Route
The chat endpoint composes a persona from the selected lens, style, and language, applies it as Gemini's native `systemInstruction`, then streams the output back as `text/plain`.

```typescript
// app/api/chat/route.ts
const systemInstruction = composeSystemInstruction({
  lensId: isLensId(lensId) ? lensId : DEFAULT_PREFS.lensId,     // whitelisted; else default
  modeId: isModeId(modeId) ? modeId : DEFAULT_PREFS.modeId,
  languageId: isLanguageId(languageId) ? languageId : DEFAULT_PREFS.languageId,
  script: isScript(script) ? script : undefined,                // Gurmukhi/romanized hint from the site language
  context: sanitizeContext(context),                            // optional deep-linked passage
});
const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest', systemInstruction });

const chat = model.startChat({ history: chatHistory });
const result = await chat.sendMessageStream(message);

const stream = new ReadableStream<Uint8Array>({
  async start(controller) {
    for await (const chunk of result.stream) {
      controller.enqueue(new TextEncoder().encode(chunk.text()));
    }
    controller.close();
  },
});

return new Response(stream, {
  headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
});
```

### 3. The Translator Route (Structured JSON)

The translator needs three renditions, a word gloss, notes, and pronunciation tips as *data*, so it constrains decoding with a schema instead of streaming prose — then re-validates the result server-side.

```typescript
// app/api/translate/route.ts
const model = genAI.getGenerativeModel({
  model: 'gemini-flash-latest',
  systemInstruction: composeTranslateInstruction({ sourceHint, detectedScript }),
  generationConfig: {
    responseMimeType: 'application/json',
    responseSchema: RESPONSE_SCHEMA,   // enums derived from the TS unions
    temperature: 0.2,                  // fidelity, but not stilted
    maxOutputTokens: 8192,
  },
});

const result = await model.generateContent(buildUserMessage(text)); // nonce-fenced
const parsed = parseTranslationResult(result.response.text(), fallbackDetected);
if (!parsed) return NextResponse.json({ error, code: 'translate_failed' }, { status: 502 });
```

## 🗺️ Roadmap

*   [ ] **Voice Mode**: Text-to-speech playback for translator pronunciation tips and phrasebook entries, plus speech-to-text for audio queries in Punjabi.
*   [ ] **Retrieval grounding**: A real citation/retrieval layer over Gurbani texts to anchor answers to specific Shabads.
*   [ ] **Cloud-synced history**: Optional Firestore-backed chat history across devices (currently local only).
*   [ ] **Mobile App**: React Native export for iOS/Android.

## 🤝 Contributing

Contributions are welcome. Any contributions you make are **greatly appreciated**.

1.  Fork the Project
2.  Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3.  Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4.  Push to the Branch (`git push origin feature/AmazingFeature`)
5.  Open a Pull Request

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

## 👤 Contact

**Rohan Singh** — [Portfolio](https://built-by-rohan.vercel.app/) · [LinkedIn](https://www.linkedin.com/in/rohan123/)

Project Link: [https://github.com/rohan1234usa/sikh-ai](https://github.com/rohan1234usa/sikh-ai)
