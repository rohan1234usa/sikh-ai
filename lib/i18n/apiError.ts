import type { Dictionary } from '@/lib/i18n';

// Translate a known API error `code` to the current dictionary; unknown or
// missing codes fall back to the server's English `error` string, then to
// null (callers substitute t.errors.generic). Lifted from the chat page so
// every feature that consumes {error, code} responses shares one mapping.
export function apiErrorText(t: Dictionary, data: unknown): string | null {
    if (!data || typeof data !== 'object') return null;
    const { code, error } = data as { code?: unknown; error?: unknown };
    if (typeof code === 'string' && code in t.errors) {
        return t.errors[code as keyof Dictionary['errors']];
    }
    return typeof error === 'string' && error ? error : null;
}

// An error whose message is already fit to show the user. Anything else that
// reaches a catch — a dropped stream, a proxy's HTML error page, a JSON
// parse failure — carries text from the browser or the network, often in the
// wrong language, so callers show t.errors.generic for it instead.
export class FriendlyError extends Error {}

// The API's own message for a failed response; failing that, the busy message
// for a bare 429 (the host's rate limiter answers without our JSON), else
// generic.
export function responseErrorText(
    t: Dictionary,
    res: Response,
    data: unknown,
    busy: keyof Dictionary['errors'],
): string {
    return apiErrorText(t, data) ?? (res.status === 429 ? t.errors[busy] : t.errors.generic);
}
