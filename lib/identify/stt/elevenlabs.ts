// SERVER-ONLY: ElevenLabs Scribe. Holds the best published Punjabi word-error
// rate (3.1% on FLEURS) — but FLEURS is read speech, people reciting sentences
// into a good microphone. Nothing in that benchmark resembles kirtan sung over
// harmonium, so treat the ranking as a starting hypothesis, not a result.
//
// Practical note: the ElevenLabs free tier grants no commercial rights, so a
// public deployment needs a paid plan regardless of how little audio it sends.

import type { SttFailure, SttProvider, TranscriptResult, TranscriptWord } from './types';

const ENDPOINT = 'https://api.elevenlabs.io/v1/speech-to-text';
const MODEL = process.env.ELEVENLABS_STT_MODEL ?? 'scribe_v2';

function toWords(raw: unknown): TranscriptWord[] {
    if (!Array.isArray(raw)) return [];
    const words: TranscriptWord[] = [];
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

export const elevenLabsProvider: SttProvider = {
    id: 'elevenlabs',
    keyEnv: 'ELEVENLABS_API_KEY',

    async transcribe(audio, mimeType, signal): Promise<TranscriptResult | SttFailure> {
        const form = new FormData();
        form.append('file', audio, 'clip');
        form.append('model_id', MODEL);
        // Punjabi (ISO-639-3).
        form.append('language_code', 'pan');
        // Laughter and applause markers would be noise in a first-letter query.
        form.append('tag_audio_events', 'false');
        form.append('timestamps_granularity', 'word');

        const res = await fetch(ENDPOINT, {
            method: 'POST',
            headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY as string },
            body: form,
            signal,
        });

        if (res.status === 429) return 'busy';
        if (res.status === 401 || res.status === 403) {
            console.error(`Identify Error: ElevenLabs rejected the API key (HTTP ${res.status})`);
            return 'unconfigured';
        }
        if (!res.ok) {
            console.error(`Identify Error: ElevenLabs HTTP ${res.status}`);
            return 'failed';
        }

        const data = await res.json() as Record<string, unknown>;
        return {
            engine: 'elevenlabs',
            text: typeof data.text === 'string' ? data.text.trim() : '',
            words: toWords(data.words),
            languageCode: typeof data.language_code === 'string' ? data.language_code : '',
            languageProbability:
                typeof data.language_probability === 'number' ? data.language_probability : 0,
        };
    },
};
