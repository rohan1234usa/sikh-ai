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
// Both routes set `thinkingLevel`, a Gemini 3.x parameter — an override should
// name a 3.x model.

const MODELS = {
    chat: { env: 'GEMINI_CHAT_MODEL', pinned: 'gemini-3.8-flash' },
    translate: { env: 'GEMINI_TRANSLATE_MODEL', pinned: 'gemini-3.8-flash' },
} as const;

export type GeminiFeature = keyof typeof MODELS;

// Read per call rather than at import, so a script that loads .env.local after
// its imports (npm run eval:translate) still sees the override.
export function geminiModel(feature: GeminiFeature): string {
    const { env, pinned } = MODELS[feature];
    return process.env[env]?.trim() || pinned;
}
