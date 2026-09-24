'use client';

import { CloudArrowUpIcon } from '@heroicons/react/24/outline';
import { useT } from '../../context/LanguageContext';
import { MAX_ACCOUNT_CHATS } from '@/lib/chat/config';
import { fmt } from '@/lib/i18n/fmt';
import type { MoveProgress } from './useMoveOffer';

type Props = { progress: MoveProgress; onMove: () => void; onDismiss: () => void };

// At the top of the chat list, when signed in with chats still in this browser.
export default function MoveChatsBanner({ progress, onMove, onDismiss }: Props) {
    const t = useT();
    const h = t.chat.history;
    const { phase, done, total } = progress;
    const finished = phase === 'done' || phase === 'full';
    return (
        <div className="mb-2 rounded-xl border border-kesri/40 bg-kesri/10 p-3 text-xs">
            <p className="flex items-center gap-1.5 font-semibold text-ink">
                <CloudArrowUpIcon className="h-4 w-4 text-accent-text" aria-hidden="true" />
                {h.moveTitle}
            </p>
            {phase === 'done' ? (
                <p role="status" className="mt-1 text-ink-muted">{h.moved}</p>
            ) : phase === 'full' ? (
                <p role="status" className="mt-1 text-ink-muted">{fmt(h.moveFull, { max: MAX_ACCOUNT_CHATS })}</p>
            ) : (
                <>
                    <p className="mt-1 text-ink-muted">{h.moveBody}</p>
                    {phase === 'moving' && <p role="status" className="mt-1 text-ink-muted">{fmt(h.moving, { done, total })}</p>}
                    {phase === 'error' && <p role="alert" className="mt-1 text-red-600 dark:text-red-400">{h.moveError}</p>}
                </>
            )}
            <div className="mt-2 flex flex-wrap gap-2">
                {!finished && (
                    <button
                        type="button"
                        onClick={onMove}
                        disabled={phase === 'moving'}
                        className="rounded-lg bg-kesri px-3 py-1.5 font-bold text-navy transition-colors hover:bg-kesri-hover disabled:opacity-60"
                    >
                        {h.moveAction}
                    </button>
                )}
                <button
                    type="button"
                    onClick={onDismiss}
                    disabled={phase === 'moving'}
                    className="rounded-lg px-3 py-1.5 text-ink-muted transition-colors hover:bg-edge/60 hover:text-ink disabled:opacity-60"
                >
                    {finished ? t.chat.dismiss : h.moveNotNow}
                </button>
            </div>
        </div>
    );
}
