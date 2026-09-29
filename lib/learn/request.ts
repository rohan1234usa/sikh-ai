// SERVER-ONLY: the complete Gemini request for one tutor turn, shared by the
// route and the tests so they exercise exactly what production sends.
// Transport settings (abort signal, timeout) are added by the caller; see
// withTransport() in lib/gemini/fallback.ts.

import { ThinkingLevel, type Content, type GenerateContentParameters } from '@google/genai';
import type { Lesson } from './config';
import { composeTutorInstruction } from './prompts';
import { MAX_TUTOR_HISTORY_TURNS, MAX_TUTOR_HISTORY_TURN_CHARS, MAX_TUTOR_MESSAGE_CHARS, cap } from './tutor';

// A tutor turn is short: a sentence in three forms is 60 to 90 tokens (Gurmukhi
// costs more tokens than English), an explanation with a few examples 500 to
// 800, and LOW thinking takes 100 to 300 from the same budget. 1,536 fits any
// of those with room, and bounds a turn's cost at about 40% of a chat
// answer's cap. A reply that reaches it is cut short, and marked that way.
export const LEARN_MAX_OUTPUT_TOKENS = 1536;

// The largest body a real client sends: the message and four earlier
// exchanges, every question and reply at its cap, twice over for the quotes,
// backslashes and line breaks JSON escapes, plus room for the lesson id.
// Anything larger is refused before it is parsed.
const HISTORY_EXCHANGES = MAX_TUTOR_HISTORY_TURNS / 2;
export const MAX_LEARN_BODY_CHARS =
    2 * (MAX_TUTOR_MESSAGE_CHARS * (1 + HISTORY_EXCHANGES) + MAX_TUTOR_HISTORY_TURN_CHARS * HISTORY_EXCHANGES) + 1000;

export type TutorInput = {
    message: string;
    history: Content[];
    lesson: Lesson | null;
};

// The client sends [{ role: 'user' | 'ai', text }], the last turns kept. A
// question is cut to the message cap and a reply to the turn cap, so the
// history can't carry more than a real conversation would.
export function toTutorHistory(raw: unknown): Content[] {
    return (Array.isArray(raw) ? raw : [])
        .slice(-MAX_TUTOR_HISTORY_TURNS)
        .map((turn: { role?: unknown; text?: unknown }) => {
            const role = turn?.role === 'ai' ? 'model' : 'user';
            const max = role === 'model' ? MAX_TUTOR_HISTORY_TURN_CHARS : MAX_TUTOR_MESSAGE_CHARS;
            return { role, text: typeof turn?.text === 'string' ? cap(turn.text, max) : '' };
        })
        .filter((turn) => turn.text.trim() !== '')
        .map((turn) => ({ role: turn.role, parts: [{ text: turn.text }] }));
}

export function buildTutorRequest(
    model: string,
    input: TutorInput,
    overrides: { thinkingLevel?: ThinkingLevel } = {},
): GenerateContentParameters {
    return {
        model,
        contents: [...input.history, { role: 'user', parts: [{ text: input.message }] }],
        config: {
            systemInstruction: composeTutorInstruction({ lesson: input.lesson }),
            maxOutputTokens: LEARN_MAX_OUTPUT_TOKENS,
            // Low, as for the chat: a streaming reply is judged on time to its
            // first word. No temperature: Gemini 3.x deprecates it.
            thinkingConfig: { thinkingLevel: overrides.thinkingLevel ?? ThinkingLevel.LOW },
        },
    };
}
