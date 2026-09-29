'use client';

import { ArrowRightIcon } from '@heroicons/react/24/outline';
import IntentLink from '@/app/components/IntentLink';
import { useT } from '@/app/context/LanguageContext';
import { fmt } from '@/lib/i18n/fmt';
import type { VocabTopicId } from '@/lib/learn/config';
import { cardCounts } from '@/lib/learn/srs';
import { useLearnProgress } from './useLearnProgress';

export type TopicLink = { id: VocabTopicId; href: string; wordIds: string[] };

// Every vocabulary topic, with its flashcard counts once this browser's
// progress is read.
export default function TopicList({ topics }: { topics: TopicLink[] }) {
    const t = useT();
    const { progress, now } = useLearnProgress();

    return (
        <ul className="grid gap-3 sm:grid-cols-2">
            {topics.map(({ id, href, wordIds }) => {
                const counts = now !== null ? cardCounts(wordIds, progress.cards, now) : null;
                return (
                    <li key={id}>
                        <IntentLink
                            href={href}
                            className="group flex h-full flex-col gap-1 rounded-xl border border-edge bg-surface-raised p-4 shadow-sm transition-colors hover:border-accent-text/40"
                        >
                            <span className="flex items-center justify-between gap-2">
                                <span className="font-semibold text-ink">{t.learn.topics[id]}</span>
                                <ArrowRightIcon className="h-4 w-4 shrink-0 text-accent-text transition-transform motion-safe:group-hover:translate-x-0.5" aria-hidden="true" />
                            </span>
                            <span className="text-sm text-ink-muted">{fmt(t.learn.vocab.wordCount, { n: wordIds.length })}</span>
                            <span className="text-xs font-semibold text-accent-text">
                                {counts
                                    ? [
                                        counts.due > 0 ? fmt(t.learn.vocab.due, { n: counts.due }) : null,
                                        fmt(t.learn.vocab.fresh, { n: counts.fresh }),
                                        fmt(t.learn.vocab.learned, { n: counts.learned }),
                                    ].filter(Boolean).join(' · ')
                                    : ' '}
                            </span>
                        </IntentLink>
                    </li>
                );
            })}
        </ul>
    );
}
