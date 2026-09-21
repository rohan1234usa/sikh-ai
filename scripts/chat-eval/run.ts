// What one chat eval answer records, how a variant is named, and what an
// answer costs. Shared by the CLI, the report, and the tests.

import { ThinkingLevel } from '@google/genai';
import type { Citation } from '../../lib/gurbani/citations';

export type ChatRun = {
    fixture: string;
    variant: string; // as given to --models, e.g. gemini-3.8-flash@medium
    sample: number;
    model: string;
    modelVersion?: string; // what the API says actually served it
    text: string;
    finishReason?: string;
    blockReason?: string;
    usage: { prompt?: number; output?: number; thoughts?: number };
    ttftMs: number | null;
    latencyMs: number;
    at: string;
    citations?: Citation[]; // absent until GurbaniNow has answered every lookup
};

// A model, optionally at a thinking level; without one, the production
// default in buildChatRequest (low) applies.
export type Variant = { label: string; model: string; thinkingLevel?: ThinkingLevel };

const LEVELS: Record<string, ThinkingLevel> = {
    minimal: ThinkingLevel.MINIMAL,
    low: ThinkingLevel.LOW,
    medium: ThinkingLevel.MEDIUM,
    high: ThinkingLevel.HIGH,
};

export function parseVariant(label: string): Variant {
    const [model, level, extra] = label.split('@');
    if (!model || extra !== undefined) throw new Error(`--models: expected model or model@level, got "${label}"`);
    if (level === undefined) return { label, model };
    const thinkingLevel = LEVELS[level.toLowerCase()];
    if (!thinkingLevel) throw new Error(`--models: unknown thinking level "${level}" (use ${Object.keys(LEVELS).join(', ')})`);
    return { label, model, thinkingLevel };
}

// Paid tier, US$ per 1M tokens (input; output including thinking), from
// Google's pricing page as of 16 Sep 2026. The 3.6-3.8 Flash rates are
// introductory until 31 Dec 2026 and double on 1 Jan 2027.
export const PRICES: Record<string, [number, number]> = {
    'gemini-3.8-flash': [0.75, 3.75],
    'gemini-3.7-flash': [0.75, 3.75],
    'gemini-3.6-flash': [0.75, 3.75],
    'gemini-3.5-flash': [1.5, 9],
    'gemini-3.5-flash-lite': [0.3, 2.5],
};

export function costOf(run: Pick<ChatRun, 'model' | 'usage'>): number | null {
    const price = PRICES[run.model];
    if (!price || run.usage.prompt === undefined) return null;
    const output = (run.usage.output ?? 0) + (run.usage.thoughts ?? 0);
    return (run.usage.prompt * price[0] + output * price[1]) / 1e6;
}
