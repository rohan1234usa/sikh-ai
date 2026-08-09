// SERVER-ONLY: Sarvam AI Saarika/Saaras — an Indian-languages ASR specialist.
//
// The interesting bet of the four. It does not top generic multilingual
// leaderboards, but it is trained for Indian languages, Indian accents, and
// Punjabi/English code-mixing, which is exactly the diaspora case this feature
// serves. Generic benchmarks measure a different population than the one
// recording in a gurdwara.

import type { SttFailure, SttProvider, TranscriptResult, TranscriptWord } from './types';

const ENDPOINT = 'https://api.sarvam.ai/speech-to-text';

// saaras:v3 is the documented recommendation; v4 is newer. Overridable so the
// two can be compared without a code change.
const MODEL = process.env.SARVAM_STT_MODEL ?? 'saaras:v3';

// Sarvam returns timings as three parallel arrays rather than a list of
// objects, so they are zipped here into the shared shape.
function toWords(raw: unknown): TranscriptWord[] {
    if (!raw || typeof raw !== 'object') return [];
    const o = raw as Record<string, unknown>;
    const texts = Array.isArray(o.words) ? o.words : [];
    const starts = Array.isArray(o.start_time_seconds) ? o.start_time_seconds : [];
    const ends = Array.isArray(o.end_time_seconds) ? o.end_time_seconds : [];

    const words: TranscriptWord[] = [];
    for (let i = 0; i < texts.length; i++) {
        const text = typeof texts[i] === 'string' ? (texts[i] as string).trim() : '';
        if (!text) continue;
        words.push({
            text,
            start: typeof starts[i] === 'number' ? starts[i] as number : 0,
            end: typeof ends[i] === 'number' ? ends[i] as number : 0,
        });
    }
    return words;
}

export const sarvamProvider: SttProvider = {
    id: 'sarvam',
    keyEnv: 'SARVAM_API_KEY',

    async transcribe(audio, mimeType, signal): Promise<TranscriptResult | SttFailure> {
        const form = new FormData();
        form.append('file', audio, 'clip');
        form.append('model', MODEL);
        // Punjabi. 'unknown' would let Sarvam detect, but naming it is more
        // reliable on short clips — and a wrong detection here would send the
        // whole pipeline looking for the wrong script.
        form.append('language_code', 'pa-IN');
        form.append('with_timestamps', 'true');

        const res = await fetch(ENDPOINT, {
            method: 'POST',
            headers: { 'api-subscription-key': process.env.SARVAM_API_KEY as string },
            body: form,
            signal,
        });

        if (res.status === 429) return 'busy';
        if (res.status === 401 || res.status === 403) {
            console.error(`Identify Error: Sarvam rejected the API key (HTTP ${res.status})`);
            return 'unconfigured';
        }
        if (!res.ok) {
            console.error(`Identify Error: Sarvam HTTP ${res.status}`);
            return 'failed';
        }

        const data = await res.json() as Record<string, unknown>;
        return {
            engine: 'sarvam',
            text: typeof data.transcript === 'string' ? data.transcript.trim() : '',
            words: toWords(data.timestamps),
            languageCode: typeof data.language_code === 'string' ? data.language_code : '',
            languageProbability:
                typeof data.language_probability === 'number' ? data.language_probability : 0,
        };
    },
};

// Sarvam reports language as a locale ('pa-IN'); the route compares against
// bare codes, so both forms are recognised there.
