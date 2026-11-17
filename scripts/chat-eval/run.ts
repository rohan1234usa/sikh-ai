// What one chat eval answer records, how a variant is named, and what an
// answer costs. Shared by the CLI, the report, and the tests.

import { ThinkingLevel } from '@google/genai';
import type { Citation } from '../../lib/gurbani/citations';
import type { Usage } from '../translate-eval/cache';
import { costOf as priceRun, type PriceYear } from '../translate-eval/prices';

export type ChatRun = {
    fixture: string;
    variant: string; // as given to --models, e.g. gemini-3.8-flash@medium
    sample: number;
    model: string;
    modelVersion?: string; // what the API says actually served it
    text: string;
    finishReason?: string;
    blockReason?: string;
    usage: Usage;
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

// At the 2026 rates unless told otherwise; the prices are shared with the
// translator eval (../translate-eval/prices.ts).
export function costOf(run: Pick<ChatRun, 'model' | 'usage'>, year: PriceYear = '2026'): number | null {
    return priceRun(run.model, run.usage, year);
}
