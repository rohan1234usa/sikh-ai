// SERVER-ONLY: minimal Cloud Translation v2 (Basic) client, shared by the
// /api/translate Gemini fallback and /api/translate/crosscheck, each on its
// own daily allowance. Do not import from client components — it reads API
// keys.
//
// Deliberately separate from scripts/i18n-audit/translate.ts: that one batches
// and caches for an offline audit and wants loud failures. This one is on a
// user request path, so it times out fast, meters itself, and never throws.

import { logEvent } from '../log';

export type CloudLang = 'en' | 'pa';
// Who's asking: the translator's fallback when Gemini can't answer, or
// "Compare with Google Translate".
export type CloudPurpose = 'fallback' | 'compare';

export type CloudTranslateOpts = {
    text: string;        // caller has already trimmed and length-capped this
    source?: CloudLang;  // omit to let Cloud detect (resolves English vs romanized)
    target: CloudLang;
    purpose: CloudPurpose;
};

export type CloudTranslateResult = {
    translatedText: string;
    detectedSourceLanguage?: string; // present only when `source` was omitted
};

const ENDPOINT = 'https://translation.googleapis.com/language/translate/v2';
const TIMEOUT_MS = 8000;

// Best-effort spend ceilings, one per purpose, so a day of comparisons can't
// switch the fallback off, nor the other way round. On Vercel each warm
// instance keeps its own counters and cold starts reset them, so this bounds
// runaway usage — it does not meter it precisely. The real backstop is the
// cap on input (1,000 characters to translate, 2,000 to compare).
export const DAILY_CHAR_CEILING = 10_000;

export type CharAllowance = { spend(chars: number): boolean; remaining(): number };

// A day's allowance of characters, like the GurbaniNow meters' allowance of
// calls (dailyMeter in lib/gurbani/gurbaninow.ts): spend() takes them, or
// says there aren't that many left; the count starts again each UTC date.
export function charAllowance(ceiling: number, today = () => new Date().toISOString().slice(0, 10)): CharAllowance {
    let day = '';
    let used = 0;
    const roll = () => {
        const now = today();
        if (now !== day) {
            day = now;
            used = 0;
        }
    };
    return {
        spend(chars) {
            roll();
            if (used + chars > ceiling) return false;
            // Charged before the request, not after: a failing API that we
            // retry in a loop must still exhaust the budget rather than
            // calling Google forever.
            used += chars;
            return true;
        },
        remaining() {
            roll();
            return Math.max(0, ceiling - used);
        },
    };
}

export const cloudAllowances: Record<CloudPurpose, CharAllowance> = {
    fallback: charAllowance(DAILY_CHAR_CEILING),
    compare: charAllowance(DAILY_CHAR_CEILING),
};

function disabled(): boolean {
    const flag = (process.env.TRANSLATE_FALLBACK ?? '').trim().toLowerCase();
    return flag === '0' || flag === 'false' || flag === 'off';
}

export async function cloudTranslate(opts: CloudTranslateOpts): Promise<CloudTranslateResult | null> {
    // One switch disables every runtime call to Cloud Translation — fallback
    // and cross-check alike — without a redeploy.
    if (disabled()) return null;

    const key = process.env.GOOGLE_TRANSLATE_API_KEY ?? process.env.GEMINI_API_KEY;
    if (!key) {
        logEvent('config_error', { missing: 'GOOGLE_TRANSLATE_API_KEY' }, 'error');
        return null;
    }

    if (!opts.text.trim()) return null;
    if (!cloudAllowances[opts.purpose].spend(opts.text.length)) {
        // This instance's daily ceiling for that purpose.
        logEvent('cloud_translate_ceiling', { purpose: opts.purpose, chars: opts.text.length }, 'warn');
        return null;
    }

    try {
        const res = await fetch(`${ENDPOINT}?key=${key}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                q: opts.text,
                ...(opts.source ? { source: opts.source } : {}),
                target: opts.target,
                format: 'text', // plain text in, plain text out — no HTML entities
            }),
            signal: AbortSignal.timeout(TIMEOUT_MS),
        });

        if (!res.ok) {
            // Never log the body verbatim — it can echo the request URL, key included.
            logEvent('upstream_error', { upstream: 'cloud_translate', status: res.status }, 'warn');
            return null;
        }

        const data = await res.json() as {
            data?: { translations?: { translatedText?: string; detectedSourceLanguage?: string }[] };
        };
        const first = data?.data?.translations?.[0];
        const translatedText = first?.translatedText;
        if (typeof translatedText !== 'string' || translatedText.trim() === '') return null;

        return { translatedText, detectedSourceLanguage: first?.detectedSourceLanguage };
    } catch (error) {
        // The name only: the request URL carries the key.
        logEvent('upstream_error', { upstream: 'cloud_translate', error: error instanceof Error ? error.name : typeof error }, 'warn');
        return null;
    }
}
