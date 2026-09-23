// SERVER-ONLY: the complete Gemini request for one chat turn. Shared by the
// route, the tests and `npm run eval:chat`, so an eval measures exactly what
// production sends. Transport settings (abort signal, timeout) are added by
// the caller — see withTransport() in lib/gemini/fallback.ts.

import { ThinkingLevel, type Content, type GenerateContentParameters } from '@google/genai';
import { MAX_MESSAGE_CHARS, type ChatContext, type LanguageId, type LensId, type ModeId, type Script } from './config';
import { composeSystemInstruction } from './prompts';

// Replies on 3.8 Flash run ~270-1,000 output tokens; explaining a whole Ang
// line by line (41 lines, npm run eval:chat) took 3,059 in 12.8 s. Thinking
// tokens draw from the same budget. A higher cap would mostly buy time against
// the route's 27 s stream deadline. A reply that hits the cap is cut short, and
// the route reports it that way.
export const CHAT_MAX_OUTPUT_TOKENS = 4096;

// How many past messages ride along (5 exchanges keeps context lean).
const MAX_HISTORY_TURNS = 10;

export type ChatInput = {
    message: string;
    history: Content[];
    lensId: LensId;
    modeId: ModeId;
    languageId: LanguageId;
    script?: Script;
    context: ChatContext | null;
};

// The client sends [{ role: 'user' | 'ai', text }]. Each turn is capped too,
// so the per-message limit can't be bypassed by stuffing megabytes into the
// history of this public endpoint.
export function toChatHistory(raw: unknown): Content[] {
    return (Array.isArray(raw) ? raw : [])
        .slice(-MAX_HISTORY_TURNS)
        .map((msg: { role?: unknown; text?: unknown }) => ({
            role: msg?.role === 'ai' ? 'model' : 'user',
            text: typeof msg?.text === 'string' ? msg.text.slice(0, MAX_MESSAGE_CHARS) : '',
        }))
        .filter(turn => turn.text.trim() !== '')
        .map(turn => ({ role: turn.role, parts: [{ text: turn.text }] }));
}

export function buildChatRequest(
    model: string,
    input: ChatInput,
    overrides: { thinkingLevel?: ThinkingLevel; nonce?: string } = {},
): GenerateContentParameters {
    return {
        model,
        contents: [...input.history, { role: 'user', parts: [{ text: input.message }] }],
        config: {
            systemInstruction: composeSystemInstruction({
                lensId: input.lensId,
                modeId: input.modeId,
                languageId: input.languageId,
                script: input.script,
                context: input.context,
                nonce: overrides.nonce,
            }),
            maxOutputTokens: CHAT_MAX_OUTPUT_TOKENS,
            // Low: a streaming chat is judged on time-to-first-token, and the
            // default (medium) is tuned for code and agentic work. Measured on
            // 3.8 Flash in gurbani-first mode (npm run eval:chat, Sept 2026,
            // 9 answers each): both verified every quote (low 21/21, medium
            // 20/20), but medium took 4.1 s to first text against 1.2 s, at
            // 2.1x the cost.
            thinkingConfig: { thinkingLevel: overrides.thinkingLevel ?? ThinkingLevel.LOW },
        },
    };
}
