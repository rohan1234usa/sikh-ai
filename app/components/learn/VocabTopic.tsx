'use client';

import { useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useT } from '@/app/context/LanguageContext';
import { fmt } from '@/lib/i18n/fmt';
import type { VocabTopicId, VocabWord } from '@/lib/learn/config';
import { topicRecord } from '@/lib/learn/progress';
import { buildVocabQuiz } from '@/lib/learn/quiz';
import { cardCounts } from '@/lib/learn/srs';
import Flashcards from './Flashcards';
import Quiz from './Quiz';
import { useLearnProgress } from './useLearnProgress';
import WordList from './WordList';

const MODES = ['words', 'cards', 'quiz'] as const;
type Mode = (typeof MODES)[number];

// A vocabulary topic's three ways in: the word list, flashcards on this
// browser's schedule, and a quiz. The one island on the page, so it owns the
// progress.
export default function VocabTopic({ topic, words }: { topic: VocabTopicId; words: VocabWord[] }) {
    const t = useT();
    const { progress, now, reviewCard, recordTopicQuiz } = useLearnProgress();
    const [mode, setMode] = useState<Mode>('words');
    const [round, setRound] = useState(0);
    const tabs = useRef<(HTMLButtonElement | null)[]>([]);

    const quiz = useMemo(
        () => buildVocabQuiz(words, `${topic}:${round}`, { meaning: t.learn.quiz.vocabMeaning, say: t.learn.quiz.vocabSay }),
        [words, topic, round, t],
    );
    const counts = now !== null ? cardCounts(words.map((w) => w.id), progress.cards, now) : null;
    const best = now !== null ? topicRecord(progress, topic)?.best : undefined;

    // Arrow keys move between the tabs, as a tab list should.
    const onTabKey = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
        const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
        if (!step) return;
        event.preventDefault();
        const next = (index + step + MODES.length) % MODES.length;
        setMode(MODES[next]);
        tabs.current[next]?.focus();
    };

    return (
        <div className="space-y-5">
            <p className="min-h-5 text-sm font-semibold text-accent-text">
                {counts && [
                    counts.due > 0 ? fmt(t.learn.vocab.due, { n: counts.due }) : null,
                    fmt(t.learn.vocab.fresh, { n: counts.fresh }),
                    fmt(t.learn.vocab.learned, { n: counts.learned }),
                    best ? fmt(t.learn.lesson.best, best) : null,
                ].filter(Boolean).join(' · ')}
            </p>

            <div role="tablist" aria-label={t.learn.vocab.modesAria} className="flex gap-2 border-b border-edge">
                {MODES.map((m, i) => (
                    <button
                        key={m}
                        ref={(el) => { tabs.current[i] = el; }}
                        type="button"
                        role="tab"
                        id={`tab-${m}`}
                        aria-selected={mode === m}
                        aria-controls={`panel-${m}`}
                        tabIndex={mode === m ? 0 : -1}
                        onClick={() => setMode(m)}
                        onKeyDown={(e) => onTabKey(e, i)}
                        className={`-mb-px border-b-2 px-4 py-2 text-sm transition-colors ${mode === m
                            ? 'border-kesri font-semibold text-ink'
                            : 'border-transparent text-ink-muted hover:text-ink'}`}
                    >
                        {t.learn.vocab.modes[m]}
                    </button>
                ))}
            </div>

            <div role="tabpanel" id={`panel-${mode}`} aria-labelledby={`tab-${mode}`}>
                {mode === 'words' && <WordList words={words} />}
                {mode === 'cards' && (now !== null
                    ? <Flashcards words={words} cards={progress.cards} now={now} onReview={reviewCard} />
                    : <div aria-hidden="true" className="h-64 animate-pulse rounded-2xl bg-edge/40" />)}
                {mode === 'quiz' && (
                    <Quiz
                        key={round}
                        questions={quiz}
                        seed={`${topic}:${round}`}
                        onChecked={(score) => recordTopicQuiz(topic, score)}
                        onNewQuestions={() => setRound((r) => r + 1)}
                    />
                )}
            </div>
        </div>
    );
}
