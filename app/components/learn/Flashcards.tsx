'use client';

import { useEffect, useRef, useState, type SetStateAction } from 'react';
import { PRIMARY_BUTTON } from '@/app/components/StatusPage';
import { useT } from '@/app/context/LanguageContext';
import { fmt } from '@/lib/i18n/fmt';
import type { VocabWord } from '@/lib/learn/config';
import { seededShuffle } from '@/lib/learn/quiz';
import { reviewQueue, type CardState } from '@/lib/learn/srs';
import { useSwapGuard } from './useSwapGuard';

type Props = {
    words: VocabWord[];
    cards: Readonly<Record<string, CardState>>; // this browser's schedule
    now: number;                                // when that schedule was read
    onReview: (wordId: string, correct: boolean) => void;
};

type Session = {
    queue: string[];
    index: number;
    revealed: boolean;
    right: number;
    wrong: number;
    missed: string[]; // cards already sent to the back once
};

const SESSION_SIZE = 20;

const startSession = (queue: string[]): Session => ({ queue, index: 0, revealed: false, right: 0, wrong: 0, missed: [] });

// One flashcard at a time: the due cards first, then new ones (lib/learn/srs.ts).
// "Not yet" sends a card to the back of this session once, as well as back
// to the first box of the schedule. Rendered only once progress is read.
export default function Flashcards({ words, cards, now, onReview }: Props) {
    const t = useT();
    const ids = words.map((word) => word.id);
    const [direction, setDirection] = useState<'pa' | 'en'>('pa');
    const [session, setSession] = useState<Session>(() => startSession(reviewQueue(ids, cards, now, SESSION_SIZE)));
    const showRef = useRef<HTMLButtonElement>(null);
    const answerRef = useRef<HTMLDivElement>(null);
    const doneRef = useRef<HTMLDivElement>(null);
    const shown = useRef(session);

    // Focus follows the card, since the button pressed goes away: to the
    // answer when it shows (so a screen reader reads it), then to the next
    // card's button, or to the end of the session. Not on arrival.
    useEffect(() => {
        if (shown.current === session) return;
        shown.current = session;
        if (session.revealed) answerRef.current?.focus();
        else (showRef.current ?? doneRef.current)?.focus();
    }, [session]);

    // The answer buttons take the place of Show answer, and the next card's
    // Show answer theirs, so a double-click would answer a card nobody has
    // judged (./useSwapGuard.ts).
    const { mark, allowed, noRepeat } = useSwapGuard();
    const change = (update: SetStateAction<Session>) => {
        mark();
        setSession(update);
    };

    const id = session.queue[session.index];
    const word = words.find((w) => w.id === id);

    const answer = (correct: boolean) => {
        if (!id) return;
        onReview(id, correct);
        change((s) => {
            const again = !correct && !s.missed.includes(id);
            return {
                ...s,
                queue: again ? [...s.queue, id] : s.queue,
                missed: again ? [...s.missed, id] : s.missed,
                index: s.index + 1,
                revealed: false,
                right: s.right + (correct ? 1 : 0),
                wrong: s.wrong + (correct ? 0 : 1),
            };
        });
    };

    // A new session reads the schedule as it is now, answers included.
    const reviewAgain = () => change(startSession(reviewQueue(ids, cards, Date.now(), SESSION_SIZE)));
    const practiceAll = () => change(startSession(seededShuffle(ids, String(Date.now())).slice(0, SESSION_SIZE)));

    const directionPicker = (
        <div role="group" aria-label={t.learn.cards.directionAria} className="flex flex-wrap gap-2">
            {(['pa', 'en'] as const).map((side) => (
                <button
                    key={side}
                    type="button"
                    onClick={() => setDirection(side)}
                    aria-pressed={direction === side}
                    className={`rounded-full border px-3 py-1 text-sm transition-colors ${direction === side
                        ? 'border-navy bg-navy font-semibold text-white dark:border-kesri dark:bg-kesri dark:text-navy'
                        : 'border-edge bg-surface-raised text-ink-muted hover:text-ink'}`}
                >
                    {side === 'pa' ? t.learn.cards.punjabiFirst : t.learn.cards.englishFirst}
                </button>
            ))}
        </div>
    );

    if (session.queue.length === 0) {
        return (
            <div ref={doneRef} tabIndex={-1} className="space-y-4 rounded-xl border border-edge bg-surface-raised p-6 text-center outline-none">
                <p className="text-ink-muted">{t.learn.cards.nothingDue}</p>
                {/* A page left open overnight: check the schedule again. */}
                <div className="flex flex-wrap justify-center gap-3">
                    <button
                        type="button"
                        onClick={(e) => allowed(e) && reviewAgain()}
                        className="rounded-lg border border-edge bg-surface-raised px-5 py-2.5 text-sm font-bold text-ink transition-colors hover:bg-edge/40"
                    >
                        {t.learn.cards.checkAgain}
                    </button>
                    <button type="button" onClick={(e) => allowed(e) && practiceAll()} className={PRIMARY_BUTTON}>{t.learn.cards.practice}</button>
                </div>
            </div>
        );
    }

    if (!word) {
        return (
            <div ref={doneRef} tabIndex={-1} className="space-y-4 rounded-xl border border-edge bg-surface-raised p-6 text-center outline-none">
                <p className="text-xl font-bold text-ink">{t.learn.cards.doneTitle}</p>
                <p className="text-ink-muted">{fmt(t.learn.cards.doneBody, { right: session.right, wrong: session.wrong })}</p>
                <button type="button" onClick={(e) => allowed(e) && reviewAgain()} className={PRIMARY_BUTTON}>{t.learn.cards.again}</button>
            </div>
        );
    }

    const punjabi = (
        <div className="space-y-1">
            <p lang="pa" className="font-gurmukhi text-5xl leading-snug text-ink">{word.gurmukhi}</p>
            <p lang="pa-Latn" className="text-lg font-medium text-ink-muted">{word.roman}</p>
        </div>
    );
    const english = <p lang="en" className="text-2xl font-semibold text-ink">{word.english}</p>;

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                {directionPicker}
                <p className="text-sm text-ink-muted">{fmt(t.learn.cards.progress, { n: session.index + 1, total: session.queue.length })}</p>
            </div>

            <div className="flex min-h-64 flex-col items-center justify-center gap-4 rounded-2xl border border-edge bg-surface-raised p-6 text-center shadow-sm">
                {direction === 'pa' ? punjabi : english}
                {session.revealed && (
                    <div ref={answerRef} tabIndex={-1} className="w-full space-y-2 border-t border-edge pt-4 outline-none">
                        {direction === 'pa' ? english : punjabi}
                        {word.note && <p lang="en" className="text-sm text-ink-muted">{word.note}</p>}
                    </div>
                )}
            </div>

            {session.revealed ? (
                <div className="grid grid-cols-2 gap-3">
                    <button
                        type="button"
                        onClick={(e) => allowed(e) && answer(false)}
                        onKeyDown={noRepeat}
                        className="rounded-lg border border-edge bg-surface-raised px-5 py-2.5 text-sm font-bold text-ink transition-colors hover:bg-edge/40"
                    >
                        {t.learn.cards.notYet}
                    </button>
                    <button type="button" onClick={(e) => allowed(e) && answer(true)} onKeyDown={noRepeat} className={`${PRIMARY_BUTTON} text-center`}>
                        {t.learn.cards.knewIt}
                    </button>
                </div>
            ) : (
                <button
                    ref={showRef}
                    type="button"
                    onClick={(e) => allowed(e) && change((s) => ({ ...s, revealed: true }))}
                    onKeyDown={noRepeat}
                    className={`${PRIMARY_BUTTON} w-full text-center`}
                >
                    {t.learn.cards.show}
                </button>
            )}
        </div>
    );
}
