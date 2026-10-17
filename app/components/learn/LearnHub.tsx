'use client';

import { useEffect, useId, useRef, useState } from 'react';
import {
    ArrowRightIcon,
    ChatBubbleLeftRightIcon,
    PencilSquareIcon,
    PuzzlePieceIcon,
    RectangleStackIcon,
} from '@heroicons/react/24/outline';
import IntentLink from '@/app/components/IntentLink';
import { PRIMARY_BUTTON } from '@/app/components/buttons';
import { useT } from '@/app/context/LanguageContext';
import { fmt } from '@/lib/i18n/fmt';
import type { LessonTrackId, TrackId } from '@/lib/learn/config';
import { isLessonDone, lessonPlace, nextLesson, placeHash, trackProgress, type LessonPlace } from '@/lib/learn/progress';
import { cardCounts } from '@/lib/learn/srs';
import { useLearnProgress } from './useLearnProgress';
import Mixed from './Mixed';

export type HubLesson = {
    slug: string;
    track: LessonTrackId;
    title: string;
    href: string;
    sections: number; // its section count, for "Section 2 of 4"
};

type Props = {
    lessons: HubLesson[];                             // every lesson, in curriculum order
    wordIds: string[];                                // every vocabulary word
    tracks: { id: TrackId; href: string }[];          // the tracks, in order
};

const ICONS: Record<TrackId, typeof PencilSquareIcon> = {
    script: PencilSquareIcon,
    grammar: PuzzlePieceIcon,
    vocab: RectangleStackIcon,
    tutor: ChatBubbleLeftRightIcon,
};

// The /learn hub: where to pick up, each track's progress, and a way to wipe
// the slate. Everything that depends on this browser's progress waits for
// it to be read, so the server's HTML and the first render agree. "Continue"
// reopens a lesson at the section the learner reached.
export default function LearnHub({ lessons, wordIds, tracks }: Props) {
    const t = useT();
    const { progress, hydrated, now, reset } = useLearnProgress();
    const [confirming, setConfirming] = useState(false);
    // Asking and answering swap the buttons, so focus moves with them: to
    // Cancel when the question appears (the group's label reads it out),
    // then back to Reset progress. Not on arrival.
    const promptId = useId();
    const resetRef = useRef<HTMLButtonElement>(null);
    const asked = useRef(false);
    useEffect(() => {
        if (confirming) asked.current = true;
        else if (asked.current) resetRef.current?.focus();
    }, [confirming]);

    const slugs = lessons.map((lesson) => lesson.slug);
    const next = hydrated ? nextLesson(progress, slugs) : undefined;
    const nextLink = lessons.find((lesson) => lesson.slug === next);
    const started = slugs.some((slug) => isLessonDone(progress, slug));
    const label = next === progress.lastLesson ? t.learn.hub.continue : started ? t.learn.hub.upNext : t.learn.hub.start;
    const place: LessonPlace = nextLink ? lessonPlace(progress, nextLink.slug, nextLink.sections) : { kind: 'new' };
    // How far into it the learner is, once they've started it.
    const where = !nextLink ? null
        : place.kind === 'section' ? fmt(t.learn.lesson.sectionOf, { n: place.index + 1, total: nextLink.sections })
            : place.kind === 'quiz' ? t.learn.lesson.atQuiz
                : null;
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
            {/* Held at the panel's usual height until progress is read, so the
                tracks below don't jump: 226px on a phone, where the button
                drops below, most lesson titles take two lines and the place in
                the lesson has a line of its own; 120px wider, where it shares
                the track's line. */}
            {!hydrated ? (
                <div aria-hidden="true" className="h-56.5 animate-pulse rounded-2xl bg-edge/40 sm:h-30" />
            ) : nextLink ? (
                <div className="flex flex-col gap-4 rounded-2xl border border-edge-strong bg-surface-raised p-6 text-ink sm:flex-row sm:items-center">
                    <div className="min-w-0 flex-1 space-y-1">
                        <p className="text-xs font-bold uppercase tracking-widest text-accent-text">{label}</p>
                        <p lang="en" className="text-xl font-bold"><Mixed text={nextLink.title} /></p>
                        <p className="text-sm text-ink-muted">
                            {t.learn.tracks[nextLink.track].title}
                            {where && <span className="hidden sm:inline"> · </span>}
                            {/* Its own line on a phone, held even when empty. */}
                            <span className="block sm:inline">{where ?? ' '}</span>
                        </p>
                    </div>
                    <IntentLink
                        href={nextLink.href + placeHash(place)}
                        className={PRIMARY_BUTTON}
                    >
                        {t.learn.hub.openLesson}
                        <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
                    </IntentLink>
                </div>
            ) : (
                <div className="flex min-h-56.5 flex-col justify-center rounded-2xl border border-edge-strong bg-surface-raised p-6 text-ink sm:min-h-30">
                    <p className="text-xl font-bold">{t.learn.hub.allDone}</p>
                    <p className="text-sm text-ink-muted">{t.learn.hub.allDoneBody}</p>
                </div>
            )}

            {/* Equal cells, as on the home page: the four tracks fill one
                column or two evenly, and an odd last one would span the row. */}
            <ul className="grid border-l border-t border-edge sm:grid-cols-2">
                {tracks.map(({ id, href }) => {
                    const Icon = ICONS[id];
                    const line = progressLine(id);
                    return (
                        <li key={id} className="border-b border-r border-edge sm:last:odd:col-span-2">
                            <IntentLink
                                href={href}
                                className="flex h-full flex-col gap-3 p-6 transition-colors hover:bg-surface-raised"
                            >
                                <Icon className="h-6 w-6 text-accent-text" aria-hidden="true" />
                                <span className="text-lg font-semibold text-ink">{t.learn.tracks[id].title}</span>
                                <span className="text-sm leading-relaxed text-ink-muted">{t.learn.tracks[id].desc}</span>
                                <span className="mt-auto flex items-center justify-between gap-2 pt-2 text-sm">
                                    {/* Reserves its line before progress is read. */}
                                    <span className="font-semibold text-accent-text">{line ?? ' '}</span>
                                    <span className="inline-flex items-center gap-1 font-semibold text-link">
                                        {t.learn.hub.open}
                                        <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
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
                            <div role="group" aria-labelledby={promptId} className="flex items-center gap-2">
                                <span id={promptId} className="text-ink-muted">{t.learn.hub.resetPrompt}</span>
                                <button
                                    type="button"
                                    onClick={() => { reset(); setConfirming(false); }}
                                    className="font-semibold text-red-700 hover:underline dark:text-red-400"
                                >
                                    {t.learn.hub.resetConfirm}
                                </button>
                                {/* autoFocus: it takes the place of the button just pressed. */}
                                <button type="button" autoFocus onClick={() => setConfirming(false)} className="text-ink-muted hover:text-ink hover:underline">
                                    {t.learn.hub.cancel}
                                </button>
                            </div>
                        ) : (
                            <button ref={resetRef} type="button" onClick={() => setConfirming(true)} className="text-ink-muted hover:text-ink hover:underline">
                                {t.learn.hub.reset}
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
