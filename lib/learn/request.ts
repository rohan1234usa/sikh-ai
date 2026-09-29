// SERVER-ONLY: the complete Gemini request for one tutor turn, shared by the
// route and the tests so they exercise exactly what production sends.
// Transport settings (abort signal, timeout) are added by the caller; see
// withTransport() in lib/gemini/fallback.ts.

import { ThinkingLevel, type Content, type GenerateContentParameters } from '@google/genai';
import type { Lesson } from './config';
import { composeTutorInstruction } from './prompts';
import { MAX_TUTOR_HISTORY_TURNS, MAX_TUTOR_HISTORY_TURN_CHARS, MAX_TUTOR_MESSAGE_CHARS } from './tutor';

// A tutor turn is short: a sentence in three forms is 60 to 90 tokens (Gurmukhi
// costs more tokens than English), an explanation with a few examples 500 to
// 800, and LOW thinking takes 100 to 300 from the same budget. 1,536 fits any
// of those with room, and bounds a turn's cost at about 40% of a chat
// answer's cap. A reply that reaches it is cut short, and marked that way.
export const LEARN_MAX_OUTPUT_TOKENS = 1536;

// The largest body a real client can send: the message and a full history,
// each at its cap, doubled for worst-case JSON escaping, plus room for the
// lesson id. Anything larger is refused before it is parsed.
export const MAX_LEARN_BODY_CHARS =
    2 * (MAX_TUTOR_MESSAGE_CHARS + MAX_TUTOR_HISTORY_TURNS * MAX_TUTOR_HISTORY_TURN_CHARS) + 1000;

export type TutorInput = {
    message: string;
    history: Content[];
    lesson: Lesson | null;
};

// The client sends [{ role: 'user' | 'ai', text }]. Each turn is capped, so
// the message limit can't be bypassed by stuffing the history.
export function toTutorHistory(raw: unknown): Content[] {
    return (Array.isArray(raw) ? raw : [])
        .slice(-MAX_TUTOR_HISTORY_TURNS)
        .map((turn: { role?: unknown; text?: unknown }) => ({
            role: turn?.role === 'ai' ? 'model' : 'user',
            text: typeof turn?.text === 'string' ? turn.text.slice(0, MAX_TUTOR_HISTORY_TURN_CHARS) : '',
        }))
        .filter((turn) => turn.text.trim() !== '')
        .map((turn) => ({ role: turn.role, parts: [{ text: turn.text }] }));
}

export function buildTutorRequest(
    model: string,
    input: TutorInput,
    overrides: { thinkingLevel?: ThinkingLevel; nonce?: string } = {},
): GenerateContentParameters {
    return {
        model,
        contents: [...input.history, { role: 'user', parts: [{ text: input.message }] }],
        config: {
            systemInstruction: composeTutorInstruction({ lesson: input.lesson, nonce: overrides.nonce }),
            maxOutputTokens: LEARN_MAX_OUTPUT_TOKENS,
            // Low, as for the chat: a streaming reply is judged on time to its
            // first word. No temperature: Gemini 3.x deprecates it.
            thinkingConfig: { thinkingLevel: overrides.thinkingLevel ?? ThinkingLevel.LOW },
        },
    };
}
