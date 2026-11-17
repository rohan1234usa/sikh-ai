// What an eval run cost, from its own token counts. Shared by both evals'
// reports (npm run eval:translate, npm run eval:chat) and the tests.
//
// Gemini's paid tier, Standard, US$ per 1M tokens, from Google's pricing
// page (https://ai.google.dev/gemini-api/docs/pricing), read 16 Nov 2026:
// input, cached input, and output with thinking included. 3.6 and 3.8 Flash
// cost twice as much from 1 Jan 2027 (issue #12). A token Gemini's implicit
// cache served costs a tenth of an input token.

import type { Usage } from './cache';

export type Price = { input: number; cached: number; output: number };

// The 2026 rates hold through 31 Dec 2026, the 2027 rates from 1 Jan 2027.
export type PriceYear = '2026' | '2027';

const FLASH: Record<PriceYear, Price> = {
    '2026': { input: 0.75, cached: 0.075, output: 3.75 },
    '2027': { input: 1.5, cached: 0.15, output: 7.5 },
};
const FLASH_LITE: Price = { input: 0.3, cached: 0.03, output: 2.5 };

export const PRICES: Record<string, Record<PriceYear, Price>> = {
    'gemini-3.8-flash': FLASH,
    // Retired on 8 Oct 2026: Google answers requests for it with 3.8 Flash.
    'gemini-3.7-flash': FLASH,
    'gemini-3.6-flash': FLASH,
    'gemini-3.5-flash-lite': { '2026': FLASH_LITE, '2027': FLASH_LITE },
};

// The rates in force on a date, for an estimate made before a run.
export function priceYear(on: Date): PriceYear {
    return on.getTime() < Date.UTC(2027, 0, 1) ? '2026' : '2027';
}

// null for a model with no price here, or a run the API reported no
// prompt tokens for.
export function costOf(model: string, usage: Usage, year: PriceYear): number | null {
    const price = PRICES[model]?.[year];
    if (!price || usage.prompt === undefined) return null;
    const cached = Math.min(usage.cached ?? 0, usage.prompt);
    const output = (usage.output ?? 0) + (usage.thoughts ?? 0);
    return ((usage.prompt - cached) * price.input + cached * price.cached + output * price.output) / 1e6;
}
