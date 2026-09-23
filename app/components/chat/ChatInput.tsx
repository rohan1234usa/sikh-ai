'use client';

import { useEffect, useId, useRef } from 'react';
import { PaperAirplaneIcon, StopIcon } from '@heroicons/react/24/solid';
import { useT } from '../../context/LanguageContext';
import { MAX_MESSAGE_CHARS } from '@/lib/chat/config';
import { fmt } from '@/lib/i18n/fmt';

type Props = {
    value: string;
    onChange: (value: string) => void;
    onSend: () => void;
    onStop: () => void;
    isStreaming: boolean;
};

export default function ChatInput({ value, onChange, onSend, onStop, isStreaming }: Props) {
    const t = useT();
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const countId = useId();
    const nearCap = value.length >= MAX_MESSAGE_CHARS * 0.8;
    const atCap = value.length >= MAX_MESSAGE_CHARS;

    // Auto-grow up to max-h, and collapse back when cleared after send
    useEffect(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = `${el.scrollHeight}px`;
    }, [value]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            onSend();
        }
    };

    return (
        <div className="p-4 pb-[max(1rem,env(safe-area-inset-bottom))] bg-surface-raised border-t border-edge shrink-0">
            <form
                onSubmit={(e) => { e.preventDefault(); onSend(); }}
                className="max-w-4xl mx-auto relative flex gap-2"
            >
                {/* maxLength stops typing without a word, so the counter describes
                    the field once it shows, and reaching the limit is announced. */}
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
                    className="w-full p-4 pr-14 rounded-xl border border-edge bg-surface-raised text-ink placeholder:text-ink-faint resize-none max-h-40 overflow-y-auto focus:ring-2 focus:ring-kesri"
                />
                {isStreaming ? (
                    <button
                        type="button"
                        onClick={onStop}
                        aria-label={t.chat.stopAria}
                        className="absolute right-2 top-2 bg-navy text-white dark:bg-kesri dark:text-navy p-3 rounded-lg transition-all hover:opacity-90"
                    >
                        <StopIcon className="w-5 h-5" />
                    </button>
                ) : (
                    <button
                        type="submit"
                        disabled={!value.trim()}
                        aria-label={t.chat.sendAria}
                        className="absolute right-2 top-2 bg-kesri text-navy hover:bg-navy hover:text-white dark:hover:bg-offwhite dark:hover:text-navy p-3 rounded-lg transition-all disabled:opacity-50"
                    >
                        <PaperAirplaneIcon className="w-5 h-5" />
                    </button>
                )}
            </form>
            {/* The one place the chat page says what the AI is and where messages
                go — the site footer is hidden here. ink-muted keeps AA contrast
                in dark mode, which ink-faint does not. */}
            <div className="max-w-4xl mx-auto mt-2 flex items-start justify-between gap-3 text-[11px] text-ink-muted">
                <p>{t.chat.disclaimer}</p>
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
