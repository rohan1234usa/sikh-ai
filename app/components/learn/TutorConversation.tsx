'use client';

import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { AcademicCapIcon, ArrowDownIcon, PlusIcon } from '@heroicons/react/24/outline';
import IntentLink from '@/app/components/IntentLink';
import { GreetingBubble, QuestionBubble } from '@/app/components/chat/Bubbles';
import StarterPrompts from '@/app/components/chat/StarterPrompts';
import { useLocalePath, useT } from '@/app/context/LanguageContext';
import type { Dictionary } from '@/lib/i18n';
import { isLessonSlug, lessonMeta } from '@/lib/learn/config';
import type { TutorReply } from '@/lib/learn/tutor';
import LessonChip from './LessonChip';
import TutorInput from './TutorInput';
import TutorMessage from './TutorMessage';
import { useTutor } from './useTutor';

// Markdown read aloud as its words, not its asterisks.
function plainText(markdown: string): string {
    return markdown
        .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
        .replace(/^\s{0,3}(#{1,6}|>|[-+*]|\d+\.)\s+/gm, '')
        .replace(/[*_`~|]+/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

// What a screen reader hears when a reply ends.
function spoken(t: Dictionary, reply: TutorReply): string {
    switch (reply.status) {
        case 'done': return plainText(reply.text);
        case 'interrupted': return `${plainText(reply.text)} ${t.learn.tutor.interrupted}`;
        case 'stopped': return t.learn.tutor.stopped;
        case 'error': return t.errors[reply.errorCode ?? 'generic'];
        default: return '';
    }
}

// The Punjabi tutor's screen: a conversation that fills the window under the
// navbar, like the chat's, with the composer pinned to the bottom.
export default function TutorConversation() {
    const t = useT();
    const to = useLocalePath();
    const tutor = useTutor();
    const { session, hydrated } = tutor;
    const [input, setInput] = useState('');
    const lessonTitle = session.lesson && isLessonSlug(session.lesson) ? lessonMeta(session.lesson).title : null;
    const last = session.exchanges.at(-1);
    const canRetry = !tutor.busy && (last?.reply.status === 'error' || last?.reply.status === 'stopped');
    const inputRef = useRef<HTMLTextAreaElement>(null);

    // New conversation, a starter and Retry go away when pressed, so keyboard
    // focus moves to the question box. Only with a mouse or trackpad: on a
    // touch screen, focus would open the keyboard over the reply.
    const refocus = useCallback(() => {
        if (window.matchMedia('(pointer: fine)').matches) inputRef.current?.focus({ preventScroll: true });
    }, []);
    const { retry: retryLast, dismissLesson } = tutor;
    const retry = useCallback(() => { retryLast(); refocus(); }, [retryLast, refocus]);

    // Stick to the bottom while a reply arrives, unless the reader scrolled up.
    const scrollRef = useRef<HTMLDivElement>(null);
    const atBottomRef = useRef(true);
    const [showJump, setShowJump] = useState(false);
    useEffect(() => {
        const el = scrollRef.current;
        if (el && atBottomRef.current) el.scrollTop = el.scrollHeight;
    }, [session.exchanges]);

    const onScroll = () => {
        const el = scrollRef.current;
        if (!el) return;
        const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        atBottomRef.current = atBottom;
        setShowJump(!atBottom);
    };

    const jumpToBottom = () => {
        const el = scrollRef.current;
        if (!el) return;
        el.scrollTop = el.scrollHeight;
        atBottomRef.current = true;
        setShowJump(false);
    };

    // Screen readers hear "thinking" when a reply starts and the reply once
    // it ends, not every word as it streams.
    const liveId = last?.reply.status === 'streaming' ? last.id : null;
    const [watching, setWatching] = useState(liveId);
    const [announcement, setAnnouncement] = useState('');
    if (liveId !== watching) {
        setWatching(liveId);
        if (liveId) setAnnouncement(t.learn.tutor.thinking);
        else if (watching) {
            const ended = session.exchanges.find((e) => e.id === watching);
            setAnnouncement(ended ? spoken(t, ended.reply) : '');
        }
    }
    // The lesson-not-found notice appears after load, so it is announced here.
    const [notFound, setNotFound] = useState(tutor.lessonNotFound);
    if (tutor.lessonNotFound !== notFound) {
        setNotFound(tutor.lessonNotFound);
        if (tutor.lessonNotFound) setAnnouncement(t.learn.tutor.lessonNotFound);
    }

    const ask = (text: string, fromInput: boolean) => {
        atBottomRef.current = true;
        if (tutor.send(text) && fromInput) setInput('');
    };

    return (
        <div className="flex h-[calc(100dvh-4rem)] min-h-0 flex-col">
            <div className="shrink-0 border-b border-edge bg-surface-raised px-4 py-2">
                <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
                    <h1 className="flex min-w-0 items-center gap-2 font-bold text-ink">
                        <AcademicCapIcon className="h-5 w-5 shrink-0 text-accent-text" aria-hidden="true" />
                        <span className="truncate">{t.learn.tracks.tutor.title}</span>
                    </h1>
                    <div className="flex shrink-0 items-center gap-3 text-sm">
                        {/* On a phone the navbar's menu leads back; the row keeps to one line. */}
                        <IntentLink href={to('/learn')} className="hidden whitespace-nowrap text-ink-muted hover:text-ink hover:underline sm:inline">
                            {t.meta.learnTitle}
                        </IntentLink>
                        <button
                            type="button"
                            onClick={() => { tutor.reset(); setInput(''); refocus(); }}
                            disabled={session.exchanges.length === 0}
                            className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg px-2 py-1 font-semibold text-accent-text transition-colors hover:bg-kesri/10 disabled:opacity-40"
                        >
                            <PlusIcon className="h-4 w-4" aria-hidden="true" />
                            {t.learn.tutor.newConversation}
                        </button>
                    </div>
                </div>
            </div>

            <div className="relative min-h-0 flex-1">
                <div ref={scrollRef} onScroll={onScroll} className="relative h-full overflow-y-auto p-4 md:p-8">
                    <div className="mx-auto w-full max-w-3xl space-y-6">
                        {tutor.lessonNotFound && (
                            <p className="text-center text-sm text-ink-muted">{t.learn.tutor.lessonNotFound}</p>
                        )}
                        <GreetingBubble text={t.learn.tutor.greeting} />
                        {session.exchanges.map((exchange) => (
                            <Fragment key={exchange.id}>
                                <QuestionBubble text={exchange.question} />
                                <TutorMessage
                                    reply={exchange.reply}
                                    onRetry={exchange === last && canRetry ? retry : undefined}
                                />
                            </Fragment>
                        ))}
                        {hydrated && session.exchanges.length === 0 && (
                            <StarterPrompts
                                prompts={lessonTitle ? t.learn.tutor.lessonStarters : t.learn.tutor.starters}
                                onSelect={(prompt) => { ask(prompt, false); refocus(); }}
                            />
                        )}
                    </div>
                </div>

                {showJump && (
                    <button
                        type="button"
                        onClick={jumpToBottom}
                        className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-navy px-3 py-2 text-xs font-semibold text-white shadow-lg transition-opacity hover:opacity-90 dark:bg-kesri dark:text-navy"
                    >
                        <ArrowDownIcon className="h-3.5 w-3.5" aria-hidden="true" />
                        {t.learn.tutor.latest}
                    </button>
                )}
            </div>

            <p className="sr-only" role="status" aria-atomic="true">{announcement}</p>

            <TutorInput
                value={input}
                onChange={setInput}
                onSend={() => ask(input, true)}
                onStop={tutor.stop}
                isStreaming={tutor.busy}
                canSend={hydrated}
                lessonChip={lessonTitle ? (
                    <LessonChip
                        title={lessonTitle}
                        // Dismissing unmounts the button that had focus; keep it in the question.
                        onDismiss={() => { dismissLesson(); inputRef.current?.focus(); }}
                    />
                ) : null}
                textareaRef={inputRef}
            />
        </div>
    );
}
