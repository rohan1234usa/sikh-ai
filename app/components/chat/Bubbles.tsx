'use client';

import { memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { splitMarkdownBlocks } from '@/lib/chat/markdownBlocks';
import { markdownComponents } from './markdownComponents';

// The message bubbles and Markdown rendering, shared by the chat
// (./ChatMessage.tsx) and the Punjabi tutor (app/components/learn/), so the
// tutor's replies look like the chat's. Kept apart from ChatMessage, whose
// citations the tutor doesn't use and shouldn't download.

export const BUBBLE = {
    user: 'bg-navy text-white rounded-br-none',
    ai: 'bg-surface-raised border border-edge text-ink rounded-bl-none',
    error: 'bg-red-50 border border-red-200 text-red-600 dark:bg-red-950/40 dark:border-red-900 dark:text-red-400 rounded-bl-none',
};
export const SHAPE = 'max-w-[85%] md:max-w-[75%] p-4 rounded-2xl shadow-sm text-sm md:text-base leading-relaxed';

export function QuestionBubble({ text }: { text: string }) {
    return (
        <div className="flex flex-col items-end">
            <div className={`${SHAPE} ${BUBBLE.user}`}>
                <p className="whitespace-pre-wrap">{text}</p>
            </div>
        </div>
    );
}

const REMARK_PLUGINS = [remarkGfm];

export function Markdown({ text }: { text: string }) {
    return <ReactMarkdown remarkPlugins={REMARK_PLUGINS} components={markdownComponents}>{text}</ReactMarkdown>;
}

// A reply that is still streaming, a block at a time (lib/chat/markdownBlocks.ts):
// finished blocks keep what they rendered, so each new piece re-parses only
// the unfinished end, not the whole reply.
const MarkdownBlock = memo(Markdown);
export function StreamingMarkdown({ text }: { text: string }) {
    return splitMarkdownBlocks(text).map((block, i) => <MarkdownBlock key={i} text={block} />);
}

// Memoized, like the replies: the chat redraws with every streamed piece, and
// none of that concerns the greeting.
export const GreetingBubble = memo(function GreetingBubble({ text }: { text: string }) {
    return (
        <div className="flex flex-col items-start">
            <div className={`${SHAPE} ${BUBBLE.ai}`}>
                <Markdown text={text} />
            </div>
        </div>
    );
});
