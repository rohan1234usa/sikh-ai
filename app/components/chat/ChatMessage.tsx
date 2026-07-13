'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ClipboardIcon, CheckIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { markdownComponents } from './markdownComponents';
import type { Message } from './useChatStorage';

type Props = {
    message: Message;
    isTyping: boolean;          // waiting for the first token — show bounce dots
    showActions: boolean;       // copy row under AI bubbles
    onRegenerate?: () => void;  // rendered only when provided (last AI message)
};

const BUBBLE = {
    user: 'bg-navy text-white rounded-br-none',
    ai: 'bg-surface-raised border border-edge text-ink rounded-bl-none',
    error: 'bg-red-50 border border-red-200 text-red-600 dark:bg-red-950/40 dark:border-red-900 dark:text-red-400 rounded-bl-none',
};

export default function ChatMessage({ message, isTyping, showActions, onRegenerate }: Props) {
    const [copied, setCopied] = useState(false);

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(message.text);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch { /* clipboard unavailable */ }
    };

    const isUser = message.role === 'user';
    const bubbleStyle = isUser ? BUBBLE.user : message.isError ? BUBBLE.error : BUBBLE.ai;

    return (
        <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} group`}>
            <div
                {...(message.isError ? { role: 'alert' as const } : {})}
                className={`max-w-[85%] md:max-w-[75%] p-4 rounded-2xl shadow-sm text-sm md:text-base leading-relaxed ${bubbleStyle}`}
            >
                {isTyping ? (
                    <span className="flex items-center gap-1.5 py-1" aria-label="Sikh AI is thinking">
                        <span className="w-2 h-2 rounded-full bg-ink-faint animate-bounce" />
                        <span className="w-2 h-2 rounded-full bg-ink-faint animate-bounce [animation-delay:150ms]" />
                        <span className="w-2 h-2 rounded-full bg-ink-faint animate-bounce [animation-delay:300ms]" />
                    </span>
                ) : isUser ? (
                    <p className="whitespace-pre-wrap">{message.text}</p>
                ) : (
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                        {message.text}
                    </ReactMarkdown>
                )}
            </div>

            {message.interrupted && (
                <p className="text-xs text-ink-faint italic mt-1">Response interrupted</p>
            )}

            {showActions && (
                <div className="flex gap-1 mt-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100 transition-opacity">
                    <button
                        type="button"
                        onClick={copy}
                        aria-label={copied ? 'Copied' : 'Copy message'}
                        className="p-1.5 rounded-lg text-ink-faint hover:text-ink hover:bg-edge/60 transition-colors"
                    >
                        {copied ? <CheckIcon className="w-4 h-4" /> : <ClipboardIcon className="w-4 h-4" />}
                    </button>
                    {onRegenerate && (
                        <button
                            type="button"
                            onClick={onRegenerate}
                            aria-label="Regenerate response"
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
