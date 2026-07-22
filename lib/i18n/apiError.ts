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
