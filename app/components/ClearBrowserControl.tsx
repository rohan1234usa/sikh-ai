'use client';

import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import { useAuth } from '@/app/context/AuthContext';
import { clearThisBrowser } from '@/lib/browserData';
import type { AccountCopy } from '@/lib/i18n/account';
import { DANGER_BUTTON, SECONDARY_BUTTON } from './buttons';

// Whether this page came from clearing the browser: marked on <html> before
// first paint (lib/browserData.ts), and never changed after.
const never = () => () => {};
const wasCleared = () => document.documentElement.dataset.cleared === 'all';
const notYet = () => false;

// On /privacy, under "Removing it", for anyone: everything SikhAI keeps in
// this browser removed (lib/browserData.ts), after a word of confirmation,
// since chats kept only here can't be brought back. Whoever is signed in is
// signed out first. The page then loads again, here, and says it's done.
export default function ClearBrowserControl({ copy }: { copy: AccountCopy['clearBrowser'] }) {
    const { user, loading, logOut } = useAuth();
    const cleared = useSyncExternalStore(never, wasCleared, notYet);
    const [mode, setMode] = useState<'idle' | 'confirm' | 'clearing'>('idle');
    const promptId = useId();

    // Asking and answering swap the buttons, so focus moves with them: to
    // Cancel when the question appears, then back. Not on arrival.
    const actionRef = useRef<HTMLButtonElement>(null);
    const asked = useRef(false);
    useEffect(() => {
        if (mode === 'confirm') asked.current = true;
        else if (mode === 'idle' && asked.current) actionRef.current?.focus();
    }, [mode]);

    // Arriving from a clear: the news, above the button (which stays, for
    // whatever this visit adds).
    const doneRef = useRef<HTMLParagraphElement>(null);
    useEffect(() => {
        if (cleared) doneRef.current?.focus();
    }, [cleared]);

    const clear = async () => {
        if (mode === 'clearing' || loading) return;
        setMode('clearing');
        if (user) await logOut();
        clearThisBrowser();
    };

    return (
        <div className="rounded-xl border border-edge bg-surface-raised p-4 space-y-3">
            <h3 className="font-semibold text-ink">{copy.heading}</h3>
            <p className="text-sm text-ink-muted">
                {copy.body}
                {user && ` ${copy.signedIn}`}
            </p>
            {cleared && mode === 'idle' && (
                <p ref={doneRef} tabIndex={-1} role="status" className="text-sm font-semibold text-ink">
                    {copy.done}
                </p>
            )}
            {mode === 'idle' ? (
                <button ref={actionRef} type="button" onClick={() => setMode('confirm')} className={SECONDARY_BUTTON}>
                    {copy.action}
                </button>
            ) : (
                <div role="group" aria-labelledby={promptId} className="space-y-3">
                    <p id={promptId} className="text-sm text-ink">{copy.prompt}</p>
                    <div className="flex flex-wrap gap-2">
                        {/* autoFocus: it takes the place of the button just pressed. */}
                        <button type="button" autoFocus onClick={() => { if (mode !== 'clearing') setMode('idle'); }} aria-disabled={mode === 'clearing'} className={SECONDARY_BUTTON}>
                            {copy.cancel}
                        </button>
                        <button type="button" onClick={() => void clear()} aria-disabled={mode === 'clearing' || loading} className={DANGER_BUTTON}>
                            {mode === 'clearing' ? copy.clearing : copy.confirm}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
