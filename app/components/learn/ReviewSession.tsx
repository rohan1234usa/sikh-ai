'use client';

import { useMemo } from 'react';
import { useT } from '@/app/context/LanguageContext';
import { fmt } from '@/lib/i18n/fmt';
import type { FlashcardWord } from '@/lib/learn/config';
import { cardCounts } from '@/lib/learn/srs';
import Flashcards from './Flashcards';
import { useLearnProgress, useLiveNow } from './useLearnProgress';

// The review page's island: every topic's due flashcards, twenty a session
// as on a topic page, lowest box first (dueQueue in lib/learn/srs.ts), each
// card naming its topic. The line above says how many are due in all, so a
// learner with more than twenty sees what Review again will bring. It owns
// the page's progress, as VocabTopic does a topic's.
export default function ReviewSession({ words, topicsHref }: { words: FlashcardWord[]; topicsHref: string }) {
    const t = useT();
    const { progress, now, loadedAt, reviewCard } = useLearnProgress();
    const liveNow = useLiveNow(now);
    const ids = useMemo(() => words.map((word) => word.id), [words]);
    const counts = liveNow !== null ? cardCounts(ids, progress.cards, liveNow) : null;

    return (
        <div className="space-y-5">
            {/* New words aren't counted: a review brings none in. */}
            <p className="min-h-5 text-sm font-semibold text-accent-text">
                {counts && [
                    counts.due > 0 ? fmt(t.learn.vocab.due, { n: counts.due }) : null,
                    fmt(t.learn.vocab.learned, { n: counts.learned }),
                ].filter(Boolean).join(' · ')}
            </p>

            {/* A session starts again when another tab, or a page restored by
                Back, brings new progress, never for the clock. */}
            {liveNow !== null
                ? <Flashcards key={loadedAt} mode="review" topicsHref={topicsHref} words={words} cards={progress.cards} now={liveNow} onReview={reviewCard} />
                : <div aria-hidden="true" className="h-64 animate-pulse rounded-2xl bg-edge/40" />}
        </div>
    );
}
