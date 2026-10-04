'use client';

import { useAuth } from '@/app/context/AuthContext';
import type { AccountCopy } from '@/lib/i18n/account';
import { SECONDARY_BUTTON } from '../buttons';
import { openDeleteAccount, preloadDeleteAccount } from './AccountDialogHost';

// On /privacy, under "Removing it", for someone signed in: the Delete account
// dialog, as the account menu opens it. The page passes the words.
export default function DeleteAccountPanel({ copy }: { copy: AccountCopy['deletePanel'] }) {
    const { user } = useAuth();
    if (!user) return null;
    return (
        <div className="rounded-xl border border-edge bg-surface-raised p-4 space-y-3">
            <h3 className="font-semibold text-ink">{copy.heading}</h3>
            <p className="text-sm text-ink-muted">{copy.body}</p>
            <button
                type="button"
                onClick={openDeleteAccount}
                onPointerEnter={preloadDeleteAccount}
                onFocus={preloadDeleteAccount}
                className={SECONDARY_BUTTON}
            >
                {copy.open}
            </button>
        </div>
    );
}
