'use client';

import { memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { rehypeGurmukhiRuns, type GurbaniIn } from '@/lib/chat/gurmukhiRuns';
import { splitMarkdownBlocks } from '@/lib/chat/markdownBlocks';
import { markdownComponents } from './markdownComponents';
import { TURN_LABEL, TURN_TEXT } from './turns';

// The plain pieces live in ./turns.tsx, for pages that show no markdown.
export { ERROR_TURN, TURN_LABEL, TURN_TEXT, Waiting } from './turns';

// The transcript's pieces, shared by the chat (./ChatMessage.tsx) and the
// Punjabi tutor (app/components/learn/), so the tutor's replies read like the
// chat's. Kept apart from ChatMessage, whose citations the tutor doesn't use
// and shouldn't download.
//
// A transcript, not bubbles (docs/design/pothi.md): each turn is its label
// and its text, the full width of the column. Three voices, three registers:
// the reader's turn hangs on a kesri rule; the assistant's is plain prose
// under its name; and Gurbani quoted in a reply is set like the source
// (lib/chat/gurmukhiRuns.ts). The names keep "Bubble" for their callers.

// The reader's turn. The label is "You" in the chat and the tutor; a shared
// chat shows someone else's questions, so there the rule alone marks them.
export function QuestionBubble({ text, label }: { text: string; label?: string }) {
    return (
        <div className="border-l-2 border-accent-text pl-4">
            {label && <p className={TURN_LABEL}>{label}</p>}
            <p className={`whitespace-pre-wrap text-ink ${TURN_TEXT}`}>{text}</p>
        </div>
    );
}

const REMARK_PLUGINS = [remarkGfm];
// Fixed lists, one per choice, so a memoized block keeps its props.
const REHYPE_PLUGINS: Record<GurbaniIn, [typeof rehypeGurmukhiRuns, { gurbani: GurbaniIn }][]> = {
    quotes: [[rehypeGurmukhiRuns, { gurbani: 'quotes' }]],
    all: [[rehypeGurmukhiRuns, { gurbani: 'all' }]],
};

// `gurbani` says which of the text's Gurmukhi is Gurbani (lib/chat/gurmukhiRuns.ts):
// only what's quoted (the default), or all of it, in a reply in English.
export function Markdown({ text, gurbani = 'quotes' }: { text: string; gurbani?: GurbaniIn }) {
    return (
        <ReactMarkdown remarkPlugins={REMARK_PLUGINS} rehypePlugins={REHYPE_PLUGINS[gurbani]} components={markdownComponents}>
            {text}
        </ReactMarkdown>
    );
}

// A reply that is still streaming, a block at a time (lib/chat/markdownBlocks.ts):
// finished blocks keep what they rendered, so each new piece re-parses only
// the unfinished end, not the whole reply.
const MarkdownBlock = memo(Markdown);
export function StreamingMarkdown({ text, gurbani = 'quotes' }: { text: string; gurbani?: GurbaniIn }) {
    return splitMarkdownBlocks(text).map((block, i) => <MarkdownBlock key={i} text={block} gurbani={gurbani} />);
}

// The assistant's opening words, under its name. Memoized, like the replies:
// the chat redraws with every streamed piece, and none of that concerns the
// greeting.
export const GreetingBubble = memo(function GreetingBubble({ text, label }: { text: string; label: string }) {
    return (
        <div>
            <p className={TURN_LABEL}>{label}</p>
            <div className={`mt-1 text-ink ${TURN_TEXT}`}>
                <Markdown text={text} />
            </div>
        </div>
    );
});
