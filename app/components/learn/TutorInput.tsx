'use client';

import { useEffect, useId, useRef } from 'react';
import Link from 'next/link';
import { PaperAirplaneIcon, StopIcon } from '@heroicons/react/24/solid';
import { useLocalePath, useT } from '@/app/context/LanguageContext';
import { fmt } from '@/lib/i18n/fmt';
import { MAX_TUTOR_MESSAGE_CHARS } from '@/lib/learn/tutor';

type Props = {
    value: string;
    onChange: (value: string) => void;
    onSend: () => void;
    onStop: () => void;
    isStreaming: boolean;
    canSend: boolean;
    lessonChip: React.ReactNode; // the lesson in use, or nothing
};

function fitHeight(el: HTMLTextAreaElement) {
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
}

// The tutor's composer: the chat's (app/components/chat/ChatInput.tsx)
// without its answer settings. One box holds the lesson chip and the
// question; Enter sends, Shift+Enter starts a new line.
export default function TutorInput({ value, onChange, onSend, onStop, isStreaming, canSend, lessonChip }: Props) {
    const t = useT();
    const to = useLocalePath();
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const countId = useId();
    const nearCap = value.length >= MAX_TUTOR_MESSAGE_CHARS * 0.8;
    const atCap = value.length >= MAX_TUTOR_MESSAGE_CHARS;
    const canSubmit = canSend && value.trim() !== '';

    // Ready to type on arrival with a mouse; on a touch screen focus would
    // open the keyboard over the page just opened, so it waits for a tap.
    useEffect(() => {
        if (window.matchMedia('(pointer: fine)').matches) textareaRef.current?.focus({ preventScroll: true });
    }, []);

    useEffect(() => {
        const el = textareaRef.current;
        if (el) fitHeight(el);
    }, [value]);

    const submit = () => {
        if (!isStreaming && canSubmit) onSend();
    };

    return (
        <div className="shrink-0 border-t border-edge bg-surface-raised px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-4">
            <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="mx-auto max-w-3xl">
                <div className="rounded-2xl border border-edge bg-surface-raised has-[textarea:focus]:outline-2 has-[textarea:focus]:outline-offset-2 has-[textarea:focus]:outline-kesri">
                    {lessonChip && <div className="flex min-w-0 px-2.5 pt-2.5">{lessonChip}</div>}
                    <div className="flex items-end gap-2 pr-2 pb-2">
                        {/* text-base keeps it at 16px, below which iOS zooms in on focus. */}
                        <textarea
                            ref={textareaRef}
                            rows={1}
                            enterKeyHint="send"
                            aria-label={t.learn.tutor.messageAria}
                            value={value}
                            onChange={(e) => onChange(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                                    e.preventDefault();
                                    submit();
                                }
                            }}
                            placeholder={t.learn.tutor.inputPlaceholder}
                            maxLength={MAX_TUTOR_MESSAGE_CHARS}
                            aria-describedby={nearCap ? countId : undefined}
                            className="block max-h-40 min-w-0 flex-1 resize-none overflow-y-auto bg-transparent px-4 pt-3 pb-1 text-base text-ink outline-none placeholder:text-ink-faint"
                        />
                        {/* Send and Stop are one button in one spot; the second click
                            of a double-click on Send lands on Stop and is ignored. */}
                        <button
                            type={isStreaming ? 'button' : 'submit'}
                            aria-label={isStreaming ? t.learn.tutor.stopAria : t.learn.tutor.sendAria}
                            aria-disabled={!isStreaming && !canSubmit ? true : undefined}
                            onClick={isStreaming ? (e) => { if (e.detail <= 1) onStop(); } : undefined}
                            onKeyDown={isStreaming ? (e) => { if (e.repeat) e.preventDefault(); } : undefined}
                            className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl transition-colors ${isStreaming
                                ? 'bg-navy text-white hover:opacity-90 dark:bg-kesri dark:text-navy'
                                : 'bg-kesri text-navy aria-disabled:cursor-not-allowed aria-disabled:opacity-50 not-aria-disabled:hover:bg-navy not-aria-disabled:hover:text-white dark:not-aria-disabled:hover:bg-offwhite dark:not-aria-disabled:hover:text-navy'}`}
                        >
                            {isStreaming ? <StopIcon className="h-5 w-5" /> : <PaperAirplaneIcon className="h-5 w-5" />}
                        </button>
                    </div>
                </div>
            </form>
            <div className="mx-auto mt-2 flex max-w-3xl items-start justify-between gap-3 text-[11px] text-ink-muted">
                <p>
                    {t.learn.tutor.disclaimer}{' '}
                    <Link href={to('/privacy')} className="underline hover:text-accent-text">{t.footer.privacy}</Link>
                </p>
                {nearCap && (
                    <span id={countId} className={`shrink-0 tabular-nums ${atCap ? 'font-semibold text-red-600 dark:text-red-400' : ''}`}>
                        {fmt(t.learn.tutor.charCount, { n: value.length, max: MAX_TUTOR_MESSAGE_CHARS })}
                    </span>
                )}
                <span className="sr-only" aria-live="polite">
                    {atCap ? fmt(t.learn.tutor.charLimit, { max: MAX_TUTOR_MESSAGE_CHARS }) : ''}
                </span>
            </div>
        </div>
    );
}
