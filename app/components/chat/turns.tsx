// The transcript's plain pieces, which need no markdown: the turn styles and
// the waiting dots. ./Bubbles.tsx passes them on to the chat and the tutor;
// Talk (app/components/translate/TalkExchange.tsx) takes them from here, so
// its page doesn't download react-markdown, which it never uses.

export const TURN_LABEL = 'text-sm italic text-accent-text';
export const TURN_TEXT = 'text-base leading-relaxed md:text-[1.0625rem]';
// A reply that failed, in the reply's place. No role="alert" here: see
// ChatMessage.
export const ERROR_TURN = 'border-l-2 border-red-700 pl-4 text-red-700 dark:border-red-400 dark:text-red-400';

// "Thinking", while a reply has started and has no words yet: three dots that
// fade in turn (nothing bounces), named for a screen reader by the caller.
export function Waiting({ label }: { label: string }) {
    return (
        <span className="flex items-center gap-1.5 py-2" role="img" aria-label={label}>
            <span className="h-1.5 w-1.5 rounded-full bg-ink-faint animate-pulse" />
            <span className="h-1.5 w-1.5 rounded-full bg-ink-faint animate-pulse [animation-delay:300ms]" />
            <span className="h-1.5 w-1.5 rounded-full bg-ink-faint animate-pulse [animation-delay:600ms]" />
        </span>
    );
}
