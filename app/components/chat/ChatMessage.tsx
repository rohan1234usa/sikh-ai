'use client';

import { memo, useState } from 'react';
import { ClipboardIcon, CheckIcon, ArrowPathIcon, StopCircleIcon } from '@heroicons/react/24/outline';
import type { Reply, ReplySettings } from '@/lib/chat/transcript';
import type { Dictionary } from '@/lib/i18n';
import { fmt } from '@/lib/i18n/fmt';
import { ERROR_TURN, Markdown, StreamingMarkdown, TURN_LABEL, TURN_TEXT, Waiting } from './Bubbles';
import Citations from './Citations';
import { useT } from '../../context/LanguageContext';

// "Guru Nanak Dev Ji · Gurbani-first · English": what the reply was asked for,
// in the current site language. Stored ids were checked on load.
export function settingsParts(t: Dictionary, s: ReplySettings): string[] {
    const { lenses, modes, replyLanguages } = t.chat.config;
    return [lenses[s.lensId].name, modes[s.modeId].name, replyLanguages[s.languageId].name];
}

function RetryButton({ onRetry }: { onRetry: () => void }) {
    const t = useT();
    return (
        <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-link hover:bg-link/10 transition-colors"
        >
            <ArrowPathIcon className="h-3.5 w-3.5" aria-hidden="true" />
            {t.chat.retry}
        </button>
    );
}

type ReplyProps = {
    reply: Reply;
    // Only on the last reply, and not while it streams (lib/chat/exchange.ts).
    onRetry?: () => void;      // failed, or stopped before any text
    onRegenerate?: () => void; // said something
    // Finished but not saved (storage full): shown for this visit only.
    unsaved?: boolean;
    // Copy, regenerate and retry; off on a shared chat's read-only page.
    actions?: boolean;
};

// Memoized: while one reply streams, the replies above it are unchanged objects
// and skip the redraw, instead of re-parsing their Markdown with every piece.
export default memo(ReplyMessage);

function ReplyMessage({ reply, onRetry, onRegenerate, unsaved, actions = true }: ReplyProps) {
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
                <span className="italic">{t.chat.stopped}</span>
                {actions && onRetry && <RetryButton onRetry={onRetry} />}
            </div>
        );
    }

    // No role="alert": errors are saved now, and an alert on each would be read
    // out every time the chat opens. The conversation announces a live one.
    if (reply.status === 'error') {
        return (
            <div className="flex flex-col items-start gap-1">
                <div className={`${ERROR_TURN} ${TURN_TEXT}`}>
                    <p>{t.errors[reply.errorCode ?? 'generic']}</p>
                </div>
                {actions && onRetry && <RetryButton onRetry={onRetry} />}
            </div>
        );
    }

    const waiting = reply.status === 'streaming' && reply.text === '';
    const label = reply.settings ? settingsParts(t, reply.settings) : null;
    // Beside the name, the settings that shaped the answer. The default lens is
    // SikhAI itself, so it isn't said twice.
    const shownSettings = label && reply.settings?.lensId === 'sikhai' ? label.slice(1) : label;
    const finished = reply.status === 'done' || reply.status === 'interrupted';
    // In a reply written in Punjabi, Gurmukhi is prose; in one in English it's
    // quoted Gurbani, set in the Gurbani face wherever it sits.
    const gurbani = reply.settings && reply.settings.languageId !== 'punjabi' ? 'all' : 'quotes';

    return (
        <div className="group">
            {/* The turn is always SikhAI's, never a Guru's, whatever lens it was
                asked through (rule 1 of lib/chat/prompts.ts): the lens is a
                setting, said after the name. */}
            <p className={TURN_LABEL}>
                {t.chat.config.lenses.sikhai.name}
                {shownSettings && shownSettings.length > 0 && (
                    <span className="not-italic text-ink-faint" aria-hidden="true"> · {shownSettings.join(' · ')}</span>
                )}
                {label && <span className="sr-only">{fmt(t.chat.answeredWith, { settings: label.join(', ') })}</span>}
            </p>
            <div id={`reply-${reply.id}`} className={`mt-1 text-ink ${TURN_TEXT}`}>
                {waiting ? (
                    <Waiting label={t.chat.thinking} />
                ) : reply.status === 'streaming' ? (
                    <StreamingMarkdown text={reply.text} gurbani={gurbani} />
                ) : (
                    <Markdown text={reply.text} gurbani={gurbani} />
                )}
            </div>

            {reply.status === 'interrupted' && (
                <p className="text-xs text-ink-muted italic mt-1">{t.chat.interrupted}</p>
            )}
            {unsaved && <p className="text-xs text-red-700 dark:text-red-400 mt-1">{t.chat.notSaved}</p>}

            {reply.citations && <Citations citations={reply.citations} replyText={reply.text} />}

            {actions && finished && (
                <div className="mt-1 flex gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100 transition-opacity">
                    <button
                        type="button"
                        onClick={copy}
                        aria-label={copied ? t.chat.copiedAria : t.chat.copyAria}
                        className="p-1.5 rounded-lg text-ink-faint hover:text-ink hover:bg-edge/60 transition-colors"
                    >
                        {copied ? <CheckIcon className="w-4 h-4" /> : <ClipboardIcon className="w-4 h-4" />}
                    </button>
                    {onRegenerate && (
                        <button
                            type="button"
                            onClick={onRegenerate}
                            aria-label={t.chat.regenerateAria}
                            className="p-1.5 rounded-lg text-ink-faint hover:text-ink hover:bg-edge/60 transition-colors"
                        >
                            <ArrowPathIcon className="w-4 h-4" />
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
