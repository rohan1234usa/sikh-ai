// SERVER-ONLY: Groq-hosted Whisper. The cheapest option by a wide margin
// ($0.04/hr for turbo) and the only one whose free tier needs no card at all,
// which makes it the sensible default to develop against.
//
// The trade-off is that this is stock Whisper — strong across many languages,
// but not tuned for Punjabi the way Sarvam is, and with no knowledge of
// Gurbani at all. The cleanup pass downstream matters most for this engine.

import type { SttFailure, SttProvider, TranscriptResult, TranscriptWord } from './types';

const ENDPOINT = 'https://api.groq.com/openai/v1/audio/transcriptions';

// Turbo is 2.8x cheaper than large-v3 and much faster. Override to
// 'whisper-large-v3' if accuracy on sung Gurbani turns out to need it — that is
// exactly the comparison this seam exists to let you run.
const MODEL = process.env.GROQ_STT_MODEL ?? 'whisper-large-v3-turbo';

function toWords(raw: unknown): TranscriptWord[] {
    if (!Array.isArray(raw)) return [];
    const words: TranscriptWord[] = [];
    for (const item of raw) {
        if (!item || typeof item !== 'object') continue;
        const o = item as Record<string, unknown>;
        const text = typeof o.word === 'string' ? o.word.trim()
            : typeof o.text === 'string' ? o.text.trim() : '';
        if (!text) continue;
        words.push({
            text,
            start: typeof o.start === 'number' ? o.start : 0,
            end: typeof o.end === 'number' ? o.end : 0,
        });
    }
    return words;
}

export const groqProvider: SttProvider = {
    id: 'groq',
    keyEnv: 'GROQ_API_KEY',

    async transcribe(audio, mimeType, signal): Promise<TranscriptResult | SttFailure> {
        const form = new FormData();
        // Whisper infers the container from the filename extension, so the
        // upload has to carry one that matches what the browser recorded.
        form.append('file', audio, `clip.${extensionFor(mimeType)}`);
        form.append('model', MODEL);
        // ISO-639-1. Naming the language beats detection on short, sung clips.
        form.append('language', 'pa');
        form.append('response_format', 'verbose_json');
        form.append('timestamp_granularities[]', 'word');
        // Whisper drifts into transliteration or English on unfamiliar audio.
        // A prompt in the target script anchors it to Gurmukhi. Capped at 224
        // tokens upstream, so this stays short.
        form.append('prompt', 'ਗੁਰਬਾਣੀ ਦਾ ਪਾਠ। ਸ਼ਬਦ ਕੀਰਤਨ।');

        const res = await fetch(ENDPOINT, {
            method: 'POST',
            headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
            body: form,
            signal,
        });

        if (res.status === 429) return 'busy';
        if (res.status === 401 || res.status === 403) {
            console.error(`Identify Error: Groq rejected the API key (HTTP ${res.status})`);
            return 'unconfigured';
        }
        if (!res.ok) {
            // Never log the body verbatim; error payloads can echo request details.
            console.error(`Identify Error: Groq HTTP ${res.status}`);
            return 'failed';
        }

        const data = await res.json() as Record<string, unknown>;
        return {
            engine: 'groq',
            text: typeof data.text === 'string' ? data.text.trim() : '',
            words: toWords(data.words),
            languageCode: typeof data.language === 'string' ? data.language : '',
            // Whisper reports no confidence in its language guess. Left at 0 so
            // the route's not-Gurbani gate declines to act on it rather than
            // treating silence as certainty.
            languageProbability: 0,
        };
    },
};

// Maps the browser's recording container to the extension Whisper expects.
export function extensionFor(mimeType: string): string {
    const base = mimeType.split(';')[0].trim().toLowerCase();
    switch (base) {
        case 'audio/mp4':
        case 'audio/x-m4a': return 'm4a';
        case 'audio/mpeg': return 'mp3';
        case 'audio/ogg': return 'ogg';
        case 'audio/wav': return 'wav';
        case 'audio/flac': return 'flac';
        case 'audio/aac': return 'aac';
        default: return 'webm';
    }
}
