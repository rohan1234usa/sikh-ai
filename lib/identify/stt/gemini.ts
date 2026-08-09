// SERVER-ONLY: Gemini as the transcriber, reusing the key the app already has.
// Zero new billing, zero new signup — the reason it is worth having in the mix
// even though it is not an ASR model.
//
// Its distinctive advantage is knowledge: alone among these engines, Gemini has
// read Gurbani, so it can resolve a half-heard line the others render as
// phonetic mush. That is also its distinctive risk — a model that knows the
// text can supply words it never heard. The two-channel cleanup prompt and
// verification against GurbaniNow exist to contain exactly that, and they apply
// to this engine's output the same as any other.
//
// Container caveat: Gemini accepts wav, mp3, aiff, aac, ogg, and flac — but not
// webm, which is what Chrome and Firefox record. In practice that makes this
// engine usable from Safari (mp4/aac) and from scripted clients sending wav,
// and not from a default Chrome recording. The check below says so plainly
// rather than letting it surface as an opaque 400.

import { GoogleGenerativeAI } from '@google/generative-ai';
import { composeRawTranscriptionInstruction } from '../prompts';
import type { SttFailure, SttProvider, TranscriptResult } from './types';

const MODEL = process.env.GEMINI_STT_MODEL ?? 'gemini-flash-latest';

// Per Gemini's audio documentation. webm is deliberately absent.
const SUPPORTED = new Set([
    'audio/wav', 'audio/mp3', 'audio/mpeg', 'audio/aiff',
    'audio/aac', 'audio/ogg', 'audio/flac', 'audio/mp4', 'audio/x-m4a',
]);

export const geminiProvider: SttProvider = {
    id: 'gemini',
    keyEnv: 'GEMINI_API_KEY',

    async transcribe(audio, mimeType): Promise<TranscriptResult | SttFailure> {
        const base = mimeType.split(';')[0].trim().toLowerCase();
        if (!SUPPORTED.has(base)) {
            console.error(
                `Identify Error: Gemini cannot read ${base}. It accepts wav/mp3/aiff/aac/ogg/flac/mp4 — ` +
                `Chrome and Firefox record webm, so use a different IDENTIFY_STT engine for those browsers.`,
            );
            return 'unsupported-audio';
        }

        // Gemini takes audio inline as base64. A 20-second clip is well under
        // the 20 MB request cap, so no Files API round-trip is needed.
        const data = Buffer.from(await audio.arrayBuffer()).toString('base64');

        try {
            const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);
            const model = genAI.getGenerativeModel({
                model: MODEL,
                systemInstruction: composeRawTranscriptionInstruction(),
                generationConfig: {
                    // Transcription is a fidelity task: near-greedy decoding
                    // keeps it from paraphrasing what it heard.
                    temperature: 0,
                    maxOutputTokens: 2048,
                },
            });

            const result = await model.generateContent([
                { text: 'Transcribe this clip per your instructions.' },
                { inlineData: { mimeType: base, data } },
            ]);

            return {
                engine: 'gemini',
                text: result.response.text().trim(),
                // Gemini returns no word timings. The line splitter falls back
                // to treating the transcript as one line, and the cleanup pass
                // — which this engine's output still goes through — does the
                // real splitting.
                words: [],
                languageCode: '',
                languageProbability: 0,
            };
        } catch (error) {
            const status = (error as { status?: number })?.status;
            if (status === 429) return 'busy';
            console.error('Identify Error: Gemini transcription failed', error instanceof Error ? error.message : error);
            return 'failed';
        }
    },
};
