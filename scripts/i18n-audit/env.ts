// Minimal .env.local reader. The audit script runs outside Next, so nothing
// loads env files for us — and we deliberately avoid adding `dotenv` for a
// dozen lines of parsing.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ENV_PATH = resolve(import.meta.dirname, '../../.env.local');

export function loadEnvLocal(): Record<string, string> {
    const out: Record<string, string> = {};
    let raw: string;
    try {
        raw = readFileSync(ENV_PATH, 'utf8');
    } catch {
        return out; // missing file is not fatal — only key-requiring paths care
    }
    for (const line of raw.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eq = trimmed.indexOf('=');
        if (eq === -1) continue;
        const key = trimmed.slice(0, eq).trim();
        let value = trimmed.slice(eq + 1).trim();
        // Strip one layer of matching quotes
        if (
            (value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))
        ) {
            value = value.slice(1, -1);
        }
        out[key] = value;
    }
    return out;
}

// Only called on code paths that actually hit the network, so --dry-run works
// with no key configured at all.
export function requireApiKey(): string {
    const env = loadEnvLocal();
    // A real environment variable wins over the file, so the key can be
    // supplied inline or by CI without editing .env.local.
    const key =
        process.env.GOOGLE_TRANSLATE_API_KEY ||
        env.GOOGLE_TRANSLATE_API_KEY ||
        process.env.GEMINI_API_KEY ||
        env.GEMINI_API_KEY;
    if (!key) {
        console.error(
            'No API key found. Add GOOGLE_TRANSLATE_API_KEY to .env.local\n' +
            '(a Cloud Translation-enabled key; the Gemini key may be restricted\n' +
            'to the Generative Language API and will return 403 API_KEY_SERVICE_BLOCKED).'
        );
        process.exit(1);
    }
    return key;
}
