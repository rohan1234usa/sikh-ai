// SERVER-ONLY: ElevenLabs Scribe speech-to-text client for /api/identify. Do
// not import from client components — it reads an API key.
//
// Same posture as lib/translate/cloud.ts: this sits on a user request path, so
// it times out, meters itself, and reports failure as data rather than
// throwing. Unlike Cloud Translation there is no second engine behind it — a
// failure here ends the request, so the caller needs to tell the reasons apart
// (a rate limit is "wait", a missing key is "not configured", a 5xx is "retry").

export type ScribeWord = {
    text: string;
    start: number; // seconds from the start of the clip
    end: number;
};

export type ScribeResult = {
    text: string;
    languageCode: string;       // ISO code Scribe detected, e.g. 'pan'
    languageProbability: number; // 0..1 confidence in that detection
    words: ScribeWord[];         // empty when Scribe returned no word timings
};

export type ScribeFailure = 'unconfigured' | 'busy' | 'failed';

const ENDPOINT = 'https://api.elevenlabs.io/v1/speech-to-text';
const MODEL_ID = 'scribe_v2';
// Punjabi (ISO-639-3). Naming the language rather than letting Scribe detect
// it measurably helps on short, sung clips.
const LANGUAGE_CODE = 'pan';
// Generous: a 20s clip normally returns in 2-5s, but the route's own ceiling
// is 60s and a slow transcription is still better than no answer.
const TIMEOUT_MS = 25_000;

// Best-effort spend ceiling, same caveat as the translator's: on Vercel each
// warm instance keeps its own counter and cold starts reset it, so this bounds
// runaway usage rather than metering it. Audio is billed by duration, so the
// real backstop is the 20-second cap on every clip.
const DAILY_CLIP_CEILING = 300;
let counterDate = '';
let clipsUsed = 0;

function overBudget(): boolean {
    const today = new Date().toISOString().slice(0, 10);
    if (today !== counterDate) {
        counterDate = today;
        clipsUsed = 0;
    }
    if (clipsUsed >= DAILY_CLIP_CEILING) return true;
    // Charged before the request: a failing API retried in a loop must still
    // exhaust the budget rather than calling ElevenLabs forever.
    clipsUsed += 1;
    return false;
}

function disabled(): boolean {
    const flag = (process.env.IDENTIFY ?? '').trim().toLowerCase();
    return flag === '0' || flag === 'false' || flag === 'off';
}

function toWords(raw: unknown): ScribeWord[] {
    if (!Array.isArray(raw)) return [];
    const words: ScribeWord[] = [];
    for (const item of raw) {
        if (!item || typeof item !== 'object') continue;
        const o = item as Record<string, unknown>;
        // 'spacing' and 'audio_event' entries carry no lexical content.
        if (o.type !== 'word') continue;
        const text = typeof o.text === 'string' ? o.text.trim() : '';
        if (!text) continue;
        words.push({
            text,
            start: typeof o.start === 'number' ? o.start : 0,
            end: typeof o.end === 'number' ? o.end : 0,
        });
    }
    return words;
}

async function callScribe(audio: Blob, filename: string): Promise<Response> {
    const form = new FormData();
    form.append('file', audio, filename);
    form.append('model_id', MODEL_ID);
    form.append('language_code', LANGUAGE_CODE);
    // Laughter/applause markers would be noise in a first-letter query.
    form.append('tag_audio_events', 'false');
    // Word timings are how the fallback line-splitter finds tuk boundaries
    // when the cleanup pass is unavailable.
    form.append('timestamps_granularity', 'word');

    return fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY as string },
        body: form,
        signal: AbortSignal.timeout(TIMEOUT_MS),
    });
}

// Never throws. Returns the transcription, or a failure reason the route maps
// to an error code.
export async function transcribe(
    audio: Blob,
    filename: string,
): Promise<ScribeResult | ScribeFailure> {
    // One switch stops every outbound identification call without a redeploy.
    if (disabled()) return 'unconfigured';
    if (!process.env.ELEVENLABS_API_KEY) {
        console.error('Identify Error: ELEVENLABS_API_KEY is missing');
        return 'unconfigured';
    }
    if (overBudget()) {
        console.error('Identify Error: daily clip ceiling reached for this instance');
        return 'busy';
    }

    for (let attempt = 0; attempt < 2; attempt++) {
        try {
            const res = await callScribe(audio, filename);

            if (res.status === 429) return 'busy';
            if (res.status === 401 || res.status === 403) {
                console.error(`Identify Error: Scribe rejected the API key (HTTP ${res.status})`);
                return 'unconfigured';
            }
            if (res.status >= 500 && attempt === 0) {
                // Transient upstream: one retry, then give up. Never retry a
                // 4xx — the same request would fail the same way.
                continue;
            }
            if (!res.ok) {
                // Never log the body verbatim; error payloads can echo request
                // details back.
                console.error(`Identify Error: Scribe HTTP ${res.status}`);
                return 'failed';
            }

            const data = await res.json() as Record<string, unknown>;
            const text = typeof data.text === 'string' ? data.text.trim() : '';
            return {
                text,
                languageCode: typeof data.language_code === 'string' ? data.language_code : '',
                languageProbability:
                    typeof data.language_probability === 'number' ? data.language_probability : 0,
                words: toWords(data.words),
            };
        } catch (error) {
            // A timeout on the first try is worth one more shot; the second
            // failure ends it.
            if (attempt === 0) continue;
            console.error('Identify Error: Scribe request failed', error instanceof Error ? error.message : error);
            return 'failed';
        }
    }

    return 'failed';
}

export const isScribeFailure = (v: ScribeResult | ScribeFailure): v is ScribeFailure =>
    typeof v === 'string';
