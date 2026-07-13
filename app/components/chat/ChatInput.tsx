'use client';

import { useEffect, useRef } from 'react';
import { PaperAirplaneIcon, StopIcon } from '@heroicons/react/24/solid';

type Props = {
    value: string;
    onChange: (value: string) => void;
    onSend: () => void;
    onStop: () => void;
    isStreaming: boolean;
};

export default function ChatInput({ value, onChange, onSend, onStop, isStreaming }: Props) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);

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
                <textarea
                    ref={textareaRef}
                    rows={1}
                    autoFocus
                    enterKeyHint="send"
                    aria-label="Message"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask a question..."
                    className="w-full p-4 pr-14 rounded-xl border border-edge bg-surface-raised text-ink placeholder:text-ink-faint resize-none max-h-40 overflow-y-auto focus:ring-2 focus:ring-kesri"
                />
                {isStreaming ? (
                    <button
                        type="button"
                        onClick={onStop}
                        aria-label="Stop generating"
                        className="absolute right-2 top-2 bg-navy text-white dark:bg-kesri dark:text-navy p-3 rounded-lg transition-all hover:opacity-90"
                    >
                        <StopIcon className="w-5 h-5" />
                    </button>
                ) : (
                    <button
                        type="submit"
                        disabled={!value.trim()}
                        aria-label="Send message"
                        className="absolute right-2 top-2 bg-kesri text-navy hover:bg-navy hover:text-white dark:hover:bg-offwhite dark:hover:text-navy p-3 rounded-lg transition-all disabled:opacity-50"
                    >
                        <PaperAirplaneIcon className="w-5 h-5" />
                    </button>
                )}
            </form>
        </div>
    );
}
