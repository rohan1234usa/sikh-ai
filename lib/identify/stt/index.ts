// SERVER-ONLY: engine selection and the concerns every engine shares — the
// kill switch, the local spend ceiling, the timeout, and the one retry. Keeping
// those here rather than in each provider is what makes an A/B between engines
// a comparison of transcription quality instead of a comparison of four
// slightly different retry policies.
//
// Selection: IDENTIFY_STT=groq|gemini|sarvam|elevenlabs. Unset picks the first
// engine that actually has a key, in PREFERENCE order.

import { elevenLabsProvider } from './elevenlabs';
import { geminiProvider } from './gemini';
import { groqProvider } from './groq';
import { sarvamProvider } from './sarvam';
import {
    isRetryable,
    isSttEngineId,
    isSttFailure,
    type SttEngineId,
    type SttFailure,
    type SttProvider,
    type TranscriptResult,
} from './types';

export * from './types';

const PROVIDERS: Record<SttEngineId, SttProvider> = {
    groq: groqProvider,
    gemini: geminiProvider,
    sarvam: sarvamProvider,
    elevenlabs: elevenLabsProvider,
};

// Order used when IDENTIFY_STT is unset. Groq leads because its free tier needs
// no card, so a fresh clone with one key works; Gemini follows because that key
// already exists for chat and translate. The two paid specialists come last —
// opting into a bill should be deliberate.
const PREFERENCE: SttEngineId[] = ['groq', 'gemini', 'sarvam', 'elevenlabs'];

// Generous: a 20s clip usually returns in 2-5s, but the route's own ceiling is
// 60s and a slow transcription still beats no answer.
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
    // exhaust the budget rather than calling the vendor forever.
    clipsUsed += 1;
    return false;
}

function disabled(): boolean {
    const flag = (process.env.IDENTIFY ?? '').trim().toLowerCase();
    return flag === '0' || flag === 'false' || flag === 'off';
}

const configured = (provider: SttProvider): boolean => !!process.env[provider.keyEnv];

// Which engines could run right now. Exported so the route can log a useful
// message instead of a bare "unavailable".
export function availableEngines(): SttEngineId[] {
    return PREFERENCE.filter(id => configured(PROVIDERS[id]));
}

// The chosen engine, plus any it fell back past. Falling back happens only when
// an engine has no key — a configuration problem. A runtime failure is NOT
// retried on a different vendor: that would double-bill and, worse, quietly
// blend two engines' output while you are trying to measure one.
function selectProvider(): SttProvider | null {
    const requested = (process.env.IDENTIFY_STT ?? '').trim().toLowerCase();

    if (requested) {
        if (!isSttEngineId(requested)) {
            console.error(`Identify Error: IDENTIFY_STT="${requested}" is not a known engine; using the first configured one`);
        } else if (configured(PROVIDERS[requested])) {
            return PROVIDERS[requested];
        } else {
            console.error(`Identify Error: IDENTIFY_STT="${requested}" but ${PROVIDERS[requested].keyEnv} is not set; falling back`);
        }
    }

    const available = availableEngines();
    return available.length > 0 ? PROVIDERS[available[0]] : null;
}

// Never throws. Returns the transcription, or a failure the route maps to an
// error code.
export async function transcribe(
    audio: Blob,
    mimeType: string,
): Promise<TranscriptResult | SttFailure> {
    // One switch stops every outbound identification call without a redeploy.
    if (disabled()) return 'unconfigured';

    const provider = selectProvider();
    if (!provider) {
        console.error(
            'Identify Error: no speech-to-text engine is configured. Set one of ' +
            PREFERENCE.map(id => PROVIDERS[id].keyEnv).join(', '),
        );
        return 'unconfigured';
    }

    if (overBudget()) {
        console.error('Identify Error: daily clip ceiling reached for this instance');
        return 'busy';
    }

    for (let attempt = 0; attempt < 2; attempt++) {
        try {
            const result = await provider.transcribe(audio, mimeType, AbortSignal.timeout(TIMEOUT_MS));
            if (isSttFailure(result)) {
                if (attempt === 0 && isRetryable(result)) continue;
                return result;
            }
            return result;
        } catch (error) {
            // A timeout on the first try is worth one more shot; the second
            // failure ends it.
            if (attempt === 0) continue;
            console.error(
                `Identify Error: ${provider.id} request failed`,
                error instanceof Error ? error.message : error,
            );
            return 'failed';
        }
    }

    return 'failed';
}
