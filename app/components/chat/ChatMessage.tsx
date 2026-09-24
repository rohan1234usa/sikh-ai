'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ClipboardIcon, CheckIcon, ArrowPathIcon, StopCircleIcon } from '@heroicons/react/24/outline';
import type { Reply, ReplySettings } from '@/lib/chat/transcript';
import type { Dictionary } from '@/lib/i18n';
import { fmt } from '@/lib/i18n/fmt';
import { markdownComponents } from './markdownComponents';
import Citations from './Citations';
import { useT } from '../../context/LanguageContext';

const BUBBLE = {
    user: 'bg-navy text-white rounded-br-none',
    ai: 'bg-surface-raised border border-edge text-ink rounded-bl-none',
    error: 'bg-red-50 border border-red-200 text-red-600 dark:bg-red-950/40 dark:border-red-900 dark:text-red-400 rounded-bl-none',
};
const SHAPE = 'max-w-[85%] md:max-w-[75%] p-4 rounded-2xl shadow-sm text-sm md:text-base leading-relaxed';

export function QuestionBubble({ text }: { text: string }) {
    return (
        <div className="flex flex-col items-end">
            <div className={`${SHAPE} ${BUBBLE.user}`}>
                <p className="whitespace-pre-wrap">{text}</p>
            </div>
        </div>
    );
}

export function GreetingBubble({ text }: { text: string }) {
    return (
        <div className="flex flex-col items-start">
            <div className={`${SHAPE} ${BUBBLE.ai}`}>
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>{text}</ReactMarkdown>
            </div>
        </div>
    );
}

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
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-accent-text hover:bg-kesri/10 transition-colors"
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

export default function ReplyMessage({ reply, onRetry, onRegenerate, unsaved, actions = true }: ReplyProps) {
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

    if (reply.status === 'error') {
        return (
            <div className="flex flex-col items-start gap-1">
                <div role="alert" className={`${SHAPE} ${BUBBLE.error}`}>
                    <p>{t.errors[reply.errorCode ?? 'generic']}</p>
                </div>
                {actions && onRetry && <RetryButton onRetry={onRetry} />}
            </div>
        );
    }

    const waiting = reply.status === 'streaming' && reply.text === '';
    const label = reply.settings ? settingsParts(t, reply.settings) : null;
    const finished = reply.status === 'done' || reply.status === 'interrupted';

    return (
        <div className="flex flex-col items-start group">
            <div id={`reply-${reply.id}`} className={`${SHAPE} ${BUBBLE.ai}`}>
                {waiting ? (
                    <span className="flex items-center gap-1.5 py-1" aria-label={t.chat.thinking}>
                        <span className="w-2 h-2 rounded-full bg-ink-faint animate-bounce" />
                        <span className="w-2 h-2 rounded-full bg-ink-faint animate-bounce [animation-delay:150ms]" />
                        <span className="w-2 h-2 rounded-full bg-ink-faint animate-bounce [animation-delay:300ms]" />
                    </span>
                ) : (
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                        {reply.text}
                    </ReactMarkdown>
                )}
            </div>

            {reply.status === 'interrupted' && (
                <p className="text-xs text-ink-muted italic mt-1">{t.chat.interrupted}</p>
            )}
            {unsaved && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{t.chat.notSaved}</p>}

            {reply.citations && <Citations citations={reply.citations} replyText={reply.text} />}

            {(label || (actions && finished)) && (
                <div className="mt-1 flex max-w-[85%] md:max-w-[75%] flex-wrap items-center gap-x-2 gap-y-0.5">
                    {/* The settings that shaped this answer, always in view. */}
                    {label && (
                        <p className="text-[11px] text-ink-muted">
                            <span aria-hidden="true">{label.join(' · ')}</span>
                            <span className="sr-only">{fmt(t.chat.answeredWith, { settings: label.join(', ') })}</span>
                        </p>
                    )}
                    {actions && finished && (
                        <div className="flex gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100 transition-opacity">
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
            )}
        </div>
    );
}
