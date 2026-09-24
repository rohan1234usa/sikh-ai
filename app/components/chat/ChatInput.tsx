'use client';

import { useEffect, useId, useRef } from 'react';
import { PaperAirplaneIcon, StopIcon } from '@heroicons/react/24/solid';
import { useT } from '../../context/LanguageContext';
import { MAX_MESSAGE_CHARS, type ChatContext } from '@/lib/chat/config';
import { fmt } from '@/lib/i18n/fmt';
import ContextChip from './ContextChip';

type Props = {
    value: string;
    onChange: (value: string) => void;
    onSend: () => void;
    onStop: () => void;
    isStreaming: boolean;
    /** False while there is nothing to send to yet (a saved chat still loading) */
    canSend?: boolean;
    /** The answer settings (ChatSettingsBar), shown under the question */
    settings: React.ReactNode;
    /** A passage the chat is about, shown inside the box above the question */
    context: ChatContext | null;
    contextError: boolean;
    onDismissContext: () => void;
    onDismissContextError: () => void;
    disclaimer: string;
};

function fitHeight(el: HTMLTextAreaElement) {
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
}

export default function ChatInput({
    value,
    onChange,
    onSend,
    onStop,
    isStreaming,
    canSend = true,
    settings,
    context,
    contextError,
    onDismissContext,
    onDismissContextError,
    disclaimer,
}: Props) {
    const t = useT();
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const countId = useId();
    const nearCap = value.length >= MAX_MESSAGE_CHARS * 0.8;
    const atCap = value.length >= MAX_MESSAGE_CHARS;
    const canSubmit = canSend && value.trim() !== '';

    // Auto-grow up to max-h, and collapse back when cleared after send
    useEffect(() => {
        const el = textareaRef.current;
        if (el) fitHeight(el);
    }, [value]);

    // A change of width (the window, the chats sidebar opening) re-wraps the
    // text, so the height is fitted again. Only width: fitting changes the
    // height, which would otherwise call this straight back.
    useEffect(() => {
        const el = textareaRef.current;
        if (!el) return;
        let width = el.clientWidth;
        const observer = new ResizeObserver(() => {
            if (el.clientWidth === width) return;
            width = el.clientWidth;
            fitHeight(el);
        });
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    const submit = () => {
        if (!isStreaming && canSubmit) onSend();
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            submit();
        }
    };

    // A press on the box's own padding (data-pad: the box, the passage row,
    // the gaps in the settings row) puts the caret in the question. On
    // mousedown with preventDefault, so focus never detours through <body>:
    // no blur, and no keyboard flicker on phones.
    const focusFromPadding = (e: React.MouseEvent) => {
        if (!(e.target instanceof Element) || !e.target.hasAttribute('data-pad')) return;
        e.preventDefault();
        textareaRef.current?.focus();
    };

    // Dismissing unmounts the button that had focus; keep it in the question.
    const refocus = (dismiss: () => void) => () => {
        dismiss();
        textareaRef.current?.focus();
    };

    return (
        <div className="shrink-0 border-t border-edge bg-surface-raised px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-4">
            <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="mx-auto max-w-3xl">
                {/* One box holds everything that goes into the next answer: the
                    passage, the question, and the settings. It shows the site's
                    focus outline only while the question has focus; a chip or
                    the send button shows its own. */}
                <div
                    data-pad
                    onMouseDown={focusFromPadding}
                    className="cursor-text rounded-2xl border border-edge bg-surface-raised has-[textarea:focus]:outline-2 has-[textarea:focus]:outline-offset-2 has-[textarea:focus]:outline-kesri"
                >
                    {(context || contextError) && (
                        <div data-pad className="flex min-w-0 px-2.5 pt-2.5">
                            {context ? (
                                <ContextChip context={context} onDismiss={refocus(onDismissContext)} />
                            ) : (
                                <p role="alert" className="flex items-center gap-2 px-1 text-xs text-red-600 dark:text-red-400">
                                    {t.errors.contextLoad}
                                    <button type="button" onClick={refocus(onDismissContextError)} className="underline font-semibold">
                                        {t.chat.dismiss}
                                    </button>
                                </p>
                            )}
                        </div>
                    )}

                    {/* maxLength stops typing without a word, so the counter describes
                        the field once it shows, and reaching the limit is announced.
                        text-base keeps it at 16px, below which iOS zooms in on focus. */}
                    <textarea
                        ref={textareaRef}
                        rows={1}
                        autoFocus
                        enterKeyHint="send"
                        aria-label={t.chat.messageAria}
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={t.chat.inputPlaceholder}
                        maxLength={MAX_MESSAGE_CHARS}
                        aria-describedby={nearCap ? countId : undefined}
                        className="block max-h-40 w-full resize-none overflow-y-auto bg-transparent px-4 pt-3 pb-1 text-base text-ink placeholder:text-ink-faint outline-none"
                    />

                    <div data-pad className="flex items-end gap-2 px-2 pb-2">
                        {settings}
                        {/* Send and Stop are one element in one spot, so the second
                            click of a double-click on Send lands on Stop. `detail` is
                            the platform's click count, not tied to the element, so
                            that click reports 2 and is ignored; a deliberate Stop is
                            a single click. Keyboard activation reports 0, but a held
                            Enter repeats, so repeats are dropped. aria-disabled (not
                            disabled) keeps the button focusable when Stop turns back
                            into an empty Send, so keyboard focus isn't lost. */}
                        <button
                            type={isStreaming ? 'button' : 'submit'}
                            aria-label={isStreaming ? t.chat.stopAria : t.chat.sendAria}
                            aria-disabled={!isStreaming && !canSubmit ? true : undefined}
                            onClick={isStreaming ? (e) => { if (e.detail <= 1) onStop(); } : undefined}
                            onKeyDown={isStreaming ? (e) => { if (e.repeat) e.preventDefault(); } : undefined}
                            className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl transition-colors ${
                                isStreaming
                                    ? 'bg-navy text-white hover:opacity-90 dark:bg-kesri dark:text-navy'
                                    : 'bg-kesri text-navy aria-disabled:cursor-not-allowed aria-disabled:opacity-50 not-aria-disabled:hover:bg-navy not-aria-disabled:hover:text-white dark:not-aria-disabled:hover:bg-offwhite dark:not-aria-disabled:hover:text-navy'
                            }`}
                        >
                            {isStreaming ? <StopIcon className="w-5 h-5" /> : <PaperAirplaneIcon className="w-5 h-5" />}
                        </button>
                    </div>
                </div>
            </form>
            {/* The one place the chat page says what the AI is and where messages
                go — the site footer is hidden here. ink-muted keeps AA contrast
                in dark mode, which ink-faint does not. */}
            <div className="max-w-3xl mx-auto mt-2 flex items-start justify-between gap-3 text-[11px] text-ink-muted">
                <p>{disclaimer}</p>
                {nearCap && (
                    <span id={countId} className={`shrink-0 tabular-nums ${atCap ? 'text-red-600 dark:text-red-400 font-semibold' : ''}`}>
                        {fmt(t.chat.charCount, { n: value.length, max: MAX_MESSAGE_CHARS })}
                    </span>
                )}
                <span className="sr-only" aria-live="polite">
                    {atCap ? fmt(t.chat.charLimit, { max: MAX_MESSAGE_CHARS }) : ''}
                </span>
            </div>
        </div>
    );
}
