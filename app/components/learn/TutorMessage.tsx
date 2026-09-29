'use client';

import { memo, useState } from 'react';
import { ArrowPathIcon, CheckIcon, ClipboardIcon, StopCircleIcon } from '@heroicons/react/24/outline';
import { BUBBLE, Markdown, SHAPE, StreamingMarkdown } from '@/app/components/chat/Bubbles';
import { useT } from '@/app/context/LanguageContext';
import type { TutorReply } from '@/lib/learn/tutor';

function RetryButton({ onRetry }: { onRetry: () => void }) {
    const t = useT();
    return (
        <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-accent-text transition-colors hover:bg-kesri/10"
        >
            <ArrowPathIcon className="h-3.5 w-3.5" aria-hidden="true" />
            {t.learn.tutor.retry}
        </button>
    );
}

// One tutor reply, drawn like the chat's: thinking dots, then Markdown as it
// streams, then a copy button; or why it failed, with Retry. Memoized, so
// while one reply streams the replies above it don't redraw.
export default memo(function TutorMessage({ reply, onRetry }: { reply: TutorReply; onRetry?: () => void }) {
    const t = useT();
    const [copied, setCopied] = useState(false);

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(reply.text);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch { /* clipboard unavailable */ }
    };

    if (reply.status === 'stopped') {
        return (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-muted">
                <StopCircleIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="italic">{t.learn.tutor.stopped}</span>
                {onRetry && <RetryButton onRetry={onRetry} />}
            </div>
        );
    }

    if (reply.status === 'error') {
        return (
            <div className="flex flex-col items-start gap-1">
                <div className={`${SHAPE} ${BUBBLE.error}`}>
                    <p>{t.errors[reply.errorCode ?? 'generic']}</p>
                </div>
                {onRetry && <RetryButton onRetry={onRetry} />}
            </div>
        );
    }

    const waiting = reply.status === 'streaming' && reply.text === '';
    const finished = reply.status === 'done' || reply.status === 'interrupted';

    return (
        <div className="group flex flex-col items-start">
            <div className={`${SHAPE} ${BUBBLE.ai}`}>
                {waiting ? (
                    <span className="flex items-center gap-1.5 py-1" aria-label={t.learn.tutor.thinking}>
                        <span className="h-2 w-2 animate-bounce rounded-full bg-ink-faint" />
                        <span className="h-2 w-2 animate-bounce rounded-full bg-ink-faint [animation-delay:150ms]" />
                        <span className="h-2 w-2 animate-bounce rounded-full bg-ink-faint [animation-delay:300ms]" />
                    </span>
                ) : reply.status === 'streaming' ? (
                    <StreamingMarkdown text={reply.text} />
                ) : (
                    <Markdown text={reply.text} />
                )}
            </div>
            {reply.status === 'interrupted' && <p className="mt-1 text-xs italic text-ink-muted">{t.learn.tutor.interrupted}</p>}
            {finished && (
                <div className="mt-1 flex gap-1 opacity-100 transition-opacity md:opacity-0 md:focus-within:opacity-100 md:group-hover:opacity-100">
                    <button
                        type="button"
                        onClick={copy}
                        aria-label={copied ? t.learn.tutor.copiedAria : t.learn.tutor.copyAria}
                        className="rounded-lg p-1.5 text-ink-faint transition-colors hover:bg-edge/60 hover:text-ink"
                    >
                        {copied ? <CheckIcon className="h-4 w-4" /> : <ClipboardIcon className="h-4 w-4" />}
                    </button>
                </div>
            )}
        </div>
    );
});
