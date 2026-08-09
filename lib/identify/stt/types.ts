// Shared contract for speech-to-text engines. Client-safe: the engine IDs are
// referenced by config and docs, the implementations are not.
//
// Punjabi ASR has no benchmark that covers what this feature actually hears.
// Published word-error rates are measured on read speech — someone reciting
// sentences into a good microphone — while a user points a phone at kirtan
// sung over harmonium and tabla in a hall. Which engine wins on that audio is
// an empirical question about *your* recordings, so the engine is a swap
// rather than a decision baked into the code.

export const STT_ENGINES = ['groq', 'gemini', 'sarvam', 'elevenlabs'] as const;
export type SttEngineId = (typeof STT_ENGINES)[number];

export const isSttEngineId = (v: unknown): v is SttEngineId =>
    STT_ENGINES.includes(v as SttEngineId);

export type TranscriptWord = {
    text: string;
    start: number; // seconds from the start of the clip
    end: number;
};

export type TranscriptResult = {
    engine: SttEngineId;
    text: string;
    // Empty when the engine does not report word timings (Gemini). The line
    // splitter falls back to a single line in that case.
    words: TranscriptWord[];
    // '' when the engine does not detect language. The route's not-Gurbani
    // gate skips the check rather than guessing.
    languageCode: string;
    languageProbability: number; // 0 when unknown
};

export type SttFailure =
    | 'unconfigured'      // no key for this engine, or it rejected the key
    | 'busy'              // rate limited or over the local daily ceiling
    | 'unsupported-audio' // this engine cannot read the container the browser recorded
    | 'failed';           // everything else

// Failures worth one more attempt. A rate limit, a rejected key, and a
// container the engine cannot parse are all deterministic — retrying them
// burns latency to arrive at the same answer.
export const isRetryable = (failure: SttFailure): boolean => failure === 'failed';

export type SttProvider = {
    id: SttEngineId;
    // Env var holding this engine's credential. Checked before any request, so
    // a half-configured engine reports 'unconfigured' instead of a 401 that
    // reads like an outage.
    keyEnv: string;
    // One attempt. Retries, timeouts, metering, and the kill switch are the
    // registry's job so every engine behaves the same way under load.
    transcribe(audio: Blob, mimeType: string, signal: AbortSignal): Promise<TranscriptResult | SttFailure>;
};

export const isSttFailure = (v: TranscriptResult | SttFailure): v is SttFailure =>
    typeof v === 'string';
