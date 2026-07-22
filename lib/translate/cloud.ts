// SERVER-ONLY: minimal Cloud Translation v2 (Basic) client, shared by the
// /api/translate Gemini fallback and /api/translate/crosscheck. Do not import
// from client components — it reads API keys.
//
// Deliberately separate from scripts/i18n-audit/translate.ts: that one batches
// and caches for an offline audit and wants loud failures. This one is on a
// user request path, so it times out fast, meters itself, and never throws.

export type CloudLang = 'en' | 'pa';

export type CloudTranslateOpts = {
    text: string;        // caller has already trimmed and length-capped this
    source?: CloudLang;  // omit to let Cloud detect (resolves English vs romanized)
    target: CloudLang;
};

export type CloudTranslateResult = {
    translatedText: string;
    detectedSourceLanguage?: string; // present only when `source` was omitted
};

const ENDPOINT = 'https://translation.googleapis.com/language/translate/v2';
const TIMEOUT_MS = 8000;

// Best-effort spend ceiling. On Vercel each warm instance keeps its own
// counter and cold starts reset it, so this bounds runaway usage — it does not
// meter it precisely. The real backstop is the 1,000-char cap on input.
const DAILY_CHAR_CEILING = 10_000;
let counterDate = '';
let charsUsed = 0;

function overBudget(chars: number): boolean {
    const today = new Date().toISOString().slice(0, 10);
    if (today !== counterDate) {
        counterDate = today;
        charsUsed = 0;
    }
    if (charsUsed + chars > DAILY_CHAR_CEILING) return true;
    // Charged before the request, not after: a failing API that we retry in a
    // loop must still exhaust the budget rather than calling Google forever.
    charsUsed += chars;
    return false;
}

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
        console.error('Cloud Translate: no GOOGLE_TRANSLATE_API_KEY (or GEMINI_API_KEY) set');
        return null;
    }

    if (!opts.text.trim()) return null;
    if (overBudget(opts.text.length)) {
        console.error('Cloud Translate: daily character ceiling reached for this instance');
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
            console.error(`Cloud Translate: HTTP ${res.status}`);
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
        console.error('Cloud Translate: request failed', error instanceof Error ? error.message : error);
        return null;
    }
}
