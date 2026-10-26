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
import { BUTTON_LG, PRIMARY_BUTTON } from '@/app/components/buttons';
import { useLocalePath, useT } from '@/app/context/LanguageContext';
import { isLessonTrack, type LessonTrackId, type TrackId } from '@/lib/learn/config';
import type { LessonPace } from '@/lib/learn/pace';
import { orderLine, stepKind, trackLine, type TrackFacts } from '@/lib/learn/hub';
import { lessonPlace, nextLesson, placeHash, trackProgress, type LessonPlace } from '@/lib/learn/progress';
import { cardCounts } from '@/lib/learn/srs';
import { placeWords, timeWords } from '@/lib/learn/status';
import { useLearnProgress, useLiveNow } from './useLearnProgress';
import Mixed from './Mixed';
import ReviewSlot from './ReviewSlot';

export type HubLesson = {
    slug: string;
    track: LessonTrackId;
    title: string;
    href: string;
    pace: LessonPace; // its sections' and quiz's seconds: "Section 2 of 4", "About 6 min"
};

type Props = {
    lessons: HubLesson[];                             // every lesson, in curriculum order
    wordIds: string[];                                // every vocabulary word
    tracks: { id: TrackId; href: string }[];          // the tracks, in order
    reviewHref: string;                               // every topic's due flashcards
};

const ICONS: Record<TrackId, typeof PencilSquareIcon> = {
    script: PencilSquareIcon,
    grammar: PuzzlePieceIcon,
    vocab: RectangleStackIcon,
    tutor: ChatBubbleLeftRightIcon,
};

// The /learn hub: today's next step, each track's progress, and at its foot
// where progress is kept, a way to wipe the slate, and the caveat every
// lesson carries too. Everything that depends on this browser's progress
// waits for it to be read, so the server's HTML and the first render agree.
// The Today panel holds at most two actions: the next lesson, reopened at
// the section the learner reached with how long the rest takes, and a review
// of every flashcard due, once one is.
export default function LearnHub({ lessons, wordIds, tracks, reviewHref }: Props) {
    const t = useT();
    const to = useLocalePath();
    const { progress, hydrated, now, reset } = useLearnProgress();
    const liveNow = useLiveNow(now);
    const [confirming, setConfirming] = useState(false);
    // Asking and answering swap the buttons, so focus moves with them: to
    // Cancel when the question appears (the group's label reads it out),
    // then back to Reset progress. Not on arrival.
    const promptId = useId();
    const todayId = useId();
    const resetRef = useRef<HTMLButtonElement>(null);
    const asked = useRef(false);
    useEffect(() => {
        if (confirming) asked.current = true;
        else if (asked.current) resetRef.current?.focus();
    }, [confirming]);

    const slugs = lessons.map((lesson) => lesson.slug);
    const next = hydrated ? nextLesson(progress, slugs) : undefined;
    const nextLink = lessons.find((lesson) => lesson.slug === next);
    const place: LessonPlace = nextLink ? lessonPlace(progress, nextLink.slug, nextLink.pace.sections.length) : { kind: 'new' };
    const kind = nextLink ? stepKind(progress, nextLink.slug, place, slugs) : null;
    // How far into it the learner is, and how long it (or the rest of it) takes.
    const meta = nextLink ? [placeWords(t, place, nextLink.pace), timeWords(t, place, nextLink.pace)].filter(Boolean).join(' · ') : '';
    const cards = liveNow !== null ? cardCounts(wordIds, progress.cards, liveNow) : null;

    // How far each track has come, once progress is read: lessons done, or
    // words learned. Its cell shows a first milestone, then the count.
    const facts = (id: TrackId): TrackFacts | null => {
        if (!hydrated) return null;
        if (isLessonTrack(id)) return trackProgress(progress, lessons.filter((l) => l.track === id).map((l) => l.slug));
        return id === 'vocab' && cards ? { done: cards.learned, total: cards.total } : null;
    };

    return (
        <div className="space-y-8">
            {/* Held at the panel's height until progress is read, so the tracks
                below don't jump: 282px on a phone, where the actions drop below,
                most lesson titles take two lines and the place and time have a
                line of their own; 146px wider (its border included), where the
                actions stand beside them. The review button's room is held
                from the start (ReviewSlot), so a card coming due moves nothing,
                and the panel never ends shorter. */}
            {!hydrated ? (
                <div aria-hidden="true" className="h-70.5 animate-pulse rounded-2xl bg-edge/40 sm:h-36.5" />
            ) : (
                <section
                    aria-labelledby={todayId}
                    className="flex min-h-70.5 flex-col gap-4 rounded-2xl border border-edge-strong bg-surface-raised p-6 text-ink sm:min-h-36.5 sm:flex-row sm:items-center"
                >
                    <div className={`min-w-0 flex-1 space-y-1 ${nextLink ? '' : 'flex flex-col justify-center'}`}>
                        <h2 id={todayId} className="text-xs font-bold uppercase tracking-widest text-accent-text">{t.learn.hub.today}</h2>
                        {nextLink && kind ? (
                            <>
                                <p lang="en" className="text-xl font-bold"><Mixed text={nextLink.title} /></p>
                                <p className="text-sm text-ink-muted">
                                    {t.learn.hub[kind]} · {t.learn.tracks[nextLink.track].title}
                                    <span className="hidden sm:inline"> · </span>
                                    {/* A line of its own on a phone. */}
                                    <span className="block sm:inline">{meta}</span>
                                </p>
                            </>
                        ) : (
                            <>
                                <p className="text-xl font-bold">{t.learn.hub.allDone}</p>
                                <p className="text-sm text-ink-muted">{t.learn.hub.allDoneBody}</p>
                            </>
                        )}
                    </div>
                    <div className="flex flex-col gap-2 sm:shrink-0">
                        {nextLink && (
                            <IntentLink href={nextLink.href + placeHash(place)} className={`${PRIMARY_BUTTON} ${BUTTON_LG}`}>
                                {t.learn.hub.openLesson}
                                <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
                            </IntentLink>
                        )}
                        <ReviewSlot href={reviewHref} due={cards?.due ?? null} className="justify-center" />
                    </div>
                </section>
            )}

            {/* Equal cells, as on the home page: the four tracks fill one
                column or two evenly, and an odd last one would span the row.
                Each says where it fits, then how far it has come. */}
            <ul className="grid border-l border-t border-edge sm:grid-cols-2">
                {tracks.map(({ id, href }) => {
                    const Icon = ICONS[id];
                    const known = facts(id);
                    const line = trackLine(t, id, known);
                    return (
                        <li key={id} className="border-b border-r border-edge sm:last:odd:col-span-2">
                            <IntentLink
                                href={href}
                                className="flex h-full flex-col gap-3 p-6 transition-colors hover:bg-surface-raised"
                            >
                                {/* Where the track fits: in the page as built, and
                                    gone (its place kept) once a lesson track is
                                    finished. */}
                                <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                    <Icon className="h-6 w-6 text-accent-text" aria-hidden="true" />
                                    <span className="text-xs font-semibold text-ink-muted">{orderLine(t, id, known) ?? ' '}</span>
                                </span>
                                <span className="text-lg font-semibold text-ink">{t.learn.tracks[id].title}</span>
                                <span className="text-sm leading-relaxed text-ink-muted">{t.learn.tracks[id].desc}</span>
                                <span className="mt-auto flex flex-col gap-2 pt-2 text-sm">
                                    <span className="flex items-center justify-between gap-2">
                                        {/* Reserves its line before progress is read. */}
                                        <span className="font-semibold text-accent-text">{line?.text ?? ' '}</span>
                                        <span className="inline-flex items-center gap-1 font-semibold text-link">
                                            {t.learn.hub.open}
                                            <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
                                        </span>
                                    </span>
                                    {/* The track's share done, a gold rule as on a lesson
                                        page: its fill is a border, so forced colours keep
                                        it. In the flow from the start, and shown with the
                                        count, so a cell never changes height. */}
                                    <span aria-hidden="true" className={`block h-0.5 bg-edge ${line?.kind === 'count' ? '' : 'invisible'}`}>
                                        <span
                                            className="block h-0.5 border-t-2 border-rule-gold"
                                            style={{ width: `${line?.kind === 'count' ? line.fill * 100 : 0}%` }}
                                        />
                                    </span>
                                </span>
                            </IntentLink>
                        </li>
                    );
                })}
            </ul>

            {/* The housekeeping, kept below what a learner can do. */}
            <footer className="space-y-2 border-t border-edge pt-6 text-sm">
                <h2 className="text-xs font-bold uppercase tracking-widest text-accent-text">{t.learn.hub.aboutProgress}</h2>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <p className="text-ink-muted">
                        {t.learn.hub.savedHere}{' '}
                        <IntentLink href={to('/privacy#browser')} className="underline hover:text-link">{t.footer.privacy}</IntentLink>
                    </p>
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
                <p className="text-xs italic text-ink-muted">{t.learn.caveat}</p>
            </footer>
        </div>
    );
}
