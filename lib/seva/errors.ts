// Why a Firestore call failed, as far as a page needs to know: refused by the
// rules (the event filled up, ended or was hidden meanwhile; the caller
// re-reads to say which), gone, or no answer at all. Apart from ./client.ts so
// a page can ask without importing Firestore.

export type SevaErrorKind = 'denied' | 'missing' | 'unavailable';

export function errorKind(error: unknown): SevaErrorKind {
    const code = (error as { code?: unknown } | null)?.code;
    if (code === 'permission-denied') return 'denied';
    if (code === 'not-found') return 'missing';
    return 'unavailable';
}
