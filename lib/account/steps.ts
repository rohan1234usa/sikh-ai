// Client-safe and dependency-free: the steps of deleting an account, and what
// can go wrong, in words a person can act on. The Delete account dialog reads
// these without loading the deletion itself (./deletion.ts), which arrives
// later, with Firestore, once someone confirms.

export const DELETION_STEPS = ['links', 'events', 'signups', 'chats'] as const;
export type DeletionStep = (typeof DELETION_STEPS)[number];

// What went wrong, for the person deleting their account: Google's window,
// the connection, or anything else (where trying again is still safe).
export type DeletionProblem = 'cancelled' | 'blocked' | 'wrong-account' | 'recent-login' | 'offline' | 'failed';

const PROBLEMS: Record<string, DeletionProblem> = {
    'auth/popup-closed-by-user': 'cancelled',
    'auth/cancelled-popup-request': 'cancelled',
    'auth/user-cancelled': 'cancelled',
    'auth/popup-blocked': 'blocked',
    'auth/user-mismatch': 'wrong-account',
    'auth/requires-recent-login': 'recent-login',
    'auth/network-request-failed': 'offline',
    unavailable: 'offline',
    'deadline-exceeded': 'offline',
};

export function problemOf(error: unknown, online = true): DeletionProblem {
    if (!online) return 'offline';
    const code = (error as { code?: unknown } | null)?.code;
    return typeof code === 'string' && Object.hasOwn(PROBLEMS, code) ? PROBLEMS[code] : 'failed';
}
