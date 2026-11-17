// SERVER-ONLY: which Gemini model each feature calls. Do not import from
// client components.
//
// Pinned to specific stable releases, never a `-latest` alias. Google
// hot-swaps `gemini-flash-latest` to each new release — it moved this app from
// a preview model to 3.5 Flash and then to 3.8 Flash with no code change — and
// gives notice only for changes it considers breaking. The prompts, token
// budgets, and translator schema are tuned against one model; a silent swap
// changes verbosity, thinking depth, and price underneath them. Upgrading is
// now a deliberate edit here, or an env override to try a model on one
// deployment.
//
// 3.8 Flash won a side-by-side against 3.6 Flash and 3.5 Flash-Lite (Sept
// 2026): the only one with no altered Gurbani quotes, and ~1 s to first token
// against ~5 s for 3.6, which thinks even at LOW. Flash-Lite slipped other
// scripts' letters into Gurmukhi. On the free tier, pointing translate at a
// different model gives it its own daily quota, apart from chat's.
//
// No feature has a fallback model by default. One can be named per feature in
// its env var, to be tried only when the pinned one is overloaded,
// rate-limited, unavailable, or too slow (lib/gemini/fallback.ts); without
// one, the route answers "busy" (the translator tries Cloud Translation
// first). Every feature named 3.7 Flash, but Google deprecated it on 8 Oct
// 2026 and has served its requests with 3.8 Flash since, so the second try
// asked the same model again. A deprecated name is not a second model: the
// changelog says which model serves it. Nothing else has passed this app's
// checks: 3.6 Flash and Flash-Lite lost the side-by-side above, Flash-Lite
// failed `npm run eval:chat` again in Nov 2026, and Gemini 4 Hydrogen (Nov
// 2026) is untested. Before naming a fallback, run that eval (and `npm run
// eval:translate` for the translator): a "busy" message is better than a
// misquoted tuk.
//
// Every route sets `thinkingLevel` to LOW, a Gemini 3.x parameter that Gemini
// 4 Hydrogen also takes — an override should name a model that accepts it.

const MODELS = {
    chat: {
        env: 'GEMINI_CHAT_MODEL', pinned: 'gemini-3.8-flash',
        fallbackEnv: 'GEMINI_CHAT_FALLBACK_MODEL', fallback: null,
    },
    translate: {
        env: 'GEMINI_TRANSLATE_MODEL', pinned: 'gemini-3.8-flash',
        fallbackEnv: 'GEMINI_TRANSLATE_FALLBACK_MODEL', fallback: null,
    },
    // The live translator (/api/translate/live), which answers while the
    // user types. Its own entry, so a preview can try a faster, cheaper
    // model (Flash-Lite, say) on live lines alone while the Translate
    // button's full result stays on the model it was tuned for.
    translateLive: {
        env: 'GEMINI_TRANSLATE_LIVE_MODEL', pinned: 'gemini-3.8-flash',
        fallbackEnv: 'GEMINI_TRANSLATE_LIVE_FALLBACK_MODEL', fallback: null,
    },
    // Talk's voice route (/api/translate/voice): a recorded clip in, the
    // live translator's four lines out. Its own entry, so a model that hears
    // better, or charges less for audio, can be tried on clips alone. Its
    // model, and any fallback named for it, must take audio input.
    translateVoice: {
        env: 'GEMINI_TRANSLATE_VOICE_MODEL', pinned: 'gemini-3.8-flash',
        fallbackEnv: 'GEMINI_TRANSLATE_VOICE_FALLBACK_MODEL', fallback: null,
    },
    // The Punjabi tutor (/api/learn). Its own entry, so a preview can try
    // another model on the tutor alone, and on the free tier an override
    // gives it a daily quota of its own.
    learn: {
        env: 'GEMINI_LEARN_MODEL', pinned: 'gemini-3.8-flash',
        fallbackEnv: 'GEMINI_LEARN_FALLBACK_MODEL', fallback: null,
    },
} as const;

export type GeminiFeature = keyof typeof MODELS;

const OFF = new Set(['', '0', 'false', 'off', 'none']);

// Read per call rather than at import, so a script that loads .env.local after
// its imports (npm run eval:translate) still sees the override.
export function geminiModel(feature: GeminiFeature): string {
    const { env, pinned } = MODELS[feature];
    return process.env[env]?.trim() || pinned;
}

// null when none is named or it is switched off, or when it would just repeat
// the primary model.
export function geminiFallbackModel(feature: GeminiFeature): string | null {
    const { fallbackEnv, fallback } = MODELS[feature];
    const raw = process.env[fallbackEnv];
    const model: string | null = raw === undefined ? fallback : raw.trim();
    if (model === null || OFF.has(model.toLowerCase())) return null;
    return model === geminiModel(feature) ? null : model;
}
