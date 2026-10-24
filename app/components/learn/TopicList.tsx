'use client';

import { ArrowRightIcon } from '@heroicons/react/24/outline';
import IntentLink from '@/app/components/IntentLink';
import { useT } from '@/app/context/LanguageContext';
import { fmt } from '@/lib/i18n/fmt';
import type { VocabTopicId } from '@/lib/learn/config';
import { cardCounts } from '@/lib/learn/srs';
import { useLearnProgress, useLiveNow } from './useLearnProgress';

export type TopicLink = { id: VocabTopicId; href: string; wordIds: string[] };

// Every vocabulary topic in equal cells, as the hub's tracks are, with its
// flashcard counts once this browser's progress is read. The cells draw the
// rules, so an odd last one spans the row and the outline still closes.
export default function TopicList({ topics }: { topics: TopicLink[] }) {
    const t = useT();
    const { progress, now } = useLearnProgress();
    const liveNow = useLiveNow(now);

    return (
        <ul className="grid border-l border-t border-edge sm:grid-cols-2">
            {topics.map(({ id, href, wordIds }) => {
                const counts = liveNow !== null ? cardCounts(wordIds, progress.cards, liveNow) : null;
                return (
                    <li key={id} className="border-b border-r border-edge sm:last:odd:col-span-2">
                        <IntentLink
                            href={href}
                            className="flex h-full flex-col gap-1 p-4 transition-colors hover:bg-surface-raised"
                        >
                            <span className="flex items-center justify-between gap-2">
                                <span className="font-semibold text-ink">{t.learn.topics[id]}</span>
                                <ArrowRightIcon className="h-4 w-4 shrink-0 text-link" aria-hidden="true" />
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
