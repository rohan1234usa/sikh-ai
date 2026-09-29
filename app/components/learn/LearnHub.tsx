'use client';

import { useState } from 'react';
import {
    ArrowRightIcon,
    ChatBubbleLeftRightIcon,
    PencilSquareIcon,
    PuzzlePieceIcon,
    RectangleStackIcon,
} from '@heroicons/react/24/outline';
import IntentLink from '@/app/components/IntentLink';
import { useT } from '@/app/context/LanguageContext';
import { fmt } from '@/lib/i18n/fmt';
import type { LessonTrackId, TrackId } from '@/lib/learn/config';
import { isLessonDone, nextLesson, trackProgress } from '@/lib/learn/progress';
import { cardCounts } from '@/lib/learn/srs';
import { useLearnProgress } from './useLearnProgress';
import Mixed from './Mixed';

export type HubLesson = { slug: string; track: LessonTrackId; title: string; href: string };

type Props = {
    lessons: HubLesson[];                             // every lesson, in curriculum order
    wordIds: string[];                                // every vocabulary word
    tracks: { id: TrackId; href: string }[];          // the cards, in order
};

const ICONS: Record<TrackId, typeof PencilSquareIcon> = {
    script: PencilSquareIcon,
    grammar: PuzzlePieceIcon,
    vocab: RectangleStackIcon,
    tutor: ChatBubbleLeftRightIcon,
};

// The /learn hub: where to pick up, each track's progress, and a way to wipe
// the slate. Everything that depends on this browser's progress waits for
// it to be read, so the server's HTML and the first render agree.
export default function LearnHub({ lessons, wordIds, tracks }: Props) {
    const t = useT();
    const { progress, hydrated, now, reset } = useLearnProgress();
    const [confirming, setConfirming] = useState(false);

    const slugs = lessons.map((lesson) => lesson.slug);
    const next = hydrated ? nextLesson(progress, slugs) : undefined;
    const nextLink = lessons.find((lesson) => lesson.slug === next);
    const started = slugs.some((slug) => isLessonDone(progress, slug));
    const label = next === progress.lastLesson ? t.learn.hub.continue : started ? t.learn.hub.upNext : t.learn.hub.start;
    const cards = now !== null ? cardCounts(wordIds, progress.cards, now) : null;

    const progressLine = (id: TrackId): string | null => {
        if (!hydrated) return null;
        if (id === 'script' || id === 'grammar') {
            const { done, total } = trackProgress(progress, lessons.filter((l) => l.track === id).map((l) => l.slug));
            return fmt(t.learn.hub.lessonsDone, { done, total });
        }
        if (id === 'vocab' && cards) {
            const learned = fmt(t.learn.hub.wordsLearned, { n: cards.learned, total: cards.total });
            return cards.due > 0 ? `${learned} · ${fmt(t.learn.hub.cardsDue, { n: cards.due })}` : learned;
        }
        return null;
    };

    return (
        <div className="space-y-8">
            {/* Held at the card's usual height until progress is read, so the
                tracks below don't jump: 208px on a phone, where the button
                drops below and most lesson titles take two lines, 120px wider. */}
            {!hydrated ? (
                <div aria-hidden="true" className="h-52 animate-pulse rounded-2xl bg-edge/40 sm:h-30" />
            ) : nextLink ? (
                <div className="flex flex-col gap-4 rounded-2xl bg-navy p-6 text-white shadow-md sm:flex-row sm:items-center">
                    <div className="min-w-0 flex-1 space-y-1">
                        <p className="text-xs font-bold uppercase tracking-widest text-kesri">{label}</p>
                        <p lang="en" className="text-xl font-bold"><Mixed text={nextLink.title} /></p>
                        <p className="text-sm text-slate-300">{t.learn.tracks[nextLink.track].title}</p>
                    </div>
                    <IntentLink
                        href={nextLink.href}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-kesri px-5 py-2.5 font-bold text-navy shadow-lg shadow-kesri/20 transition-colors hover:bg-kesri-hover"
                    >
                        {t.learn.hub.openLesson}
                        <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
                    </IntentLink>
                </div>
            ) : (
                <div className="flex min-h-52 flex-col justify-center rounded-2xl bg-navy p-6 text-white shadow-md sm:min-h-30">
                    <p className="text-xl font-bold">{t.learn.hub.allDone}</p>
                    <p className="text-sm text-slate-300">{t.learn.hub.allDoneBody}</p>
                </div>
            )}

            <ul className="grid gap-4 sm:grid-cols-2">
                {tracks.map(({ id, href }) => {
                    const Icon = ICONS[id];
                    const line = progressLine(id);
                    return (
                        <li key={id}>
                            <IntentLink
                                href={href}
                                className="group flex h-full flex-col gap-3 rounded-2xl border border-edge bg-surface-raised p-6 shadow-sm transition-all hover:border-accent-text/40 hover:shadow-md"
                            >
                                <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-accent-text/10 text-accent-text">
                                    <Icon className="h-6 w-6" aria-hidden="true" />
                                </span>
                                <span className="text-lg font-semibold text-ink">{t.learn.tracks[id].title}</span>
                                <span className="text-sm leading-relaxed text-ink-muted">{t.learn.tracks[id].desc}</span>
                                <span className="mt-auto flex items-center justify-between gap-2 pt-2 text-sm">
                                    {/* Reserves its line before progress is read. */}
                                    <span className="font-semibold text-accent-text">{line ?? ' '}</span>
                                    <span className="inline-flex items-center gap-1 font-medium text-accent-text">
                                        {t.learn.hub.open}
                                        <ArrowRightIcon className="h-4 w-4 transition-transform motion-safe:group-hover:translate-x-0.5" aria-hidden="true" />
                                    </span>
                                </span>
                            </IntentLink>
                        </li>
                    );
                })}
            </ul>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                <p className="text-ink-muted">{t.learn.hub.savedHere}</p>
                {hydrated && (
                    <div className="flex items-center gap-2">
                        {confirming ? (
                            <>
                                <span className="text-ink-muted">{t.learn.hub.resetPrompt}</span>
                                <button
                                    type="button"
                                    onClick={() => { reset(); setConfirming(false); }}
                                    className="font-semibold text-red-600 hover:underline dark:text-red-400"
                                >
                                    {t.learn.hub.resetConfirm}
                                </button>
                                <button type="button" onClick={() => setConfirming(false)} className="text-ink-muted hover:text-ink hover:underline">
                                    {t.learn.hub.cancel}
                                </button>
                            </>
                        ) : (
                            <button type="button" onClick={() => setConfirming(true)} className="text-ink-muted hover:text-ink hover:underline">
                                {t.learn.hub.reset}
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
