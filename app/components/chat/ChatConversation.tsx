'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowDownIcon } from '@heroicons/react/24/outline';
import { DEFAULT_PREFS, type LanguageId, type LensId, type ModeId } from '@/lib/chat/config';
import type { Exchange, Reply, ReplySettings, Transcript } from '@/lib/chat/transcript';
import type { Dictionary } from '@/lib/i18n';
import { useLanguage } from '../../context/LanguageContext';
import ChatInput from './ChatInput';
import ChatSettingsBar from './ChatSettingsBar';
import ChatUnavailable from './ChatUnavailable';
import ReplyMessage, { GreetingBubble, QuestionBubble } from './ChatMessage';
import NoticeDivider from './NoticeDivider';
import StarterPrompts from './StarterPrompts';
import TopicPacks from './TopicPacks';
import { fetchChatContext, parseDeepLink } from './deepLink';
import { setOpenChat } from './chatStores';
import { useChatSession, type SendResult } from './useChatSession';
import type { ChatPrefs } from './useChatPrefs';

// What the composer holds, per chat, across switching chats (this tab only).
const drafts = new Map<string, string>();

type Props = {
    routeId: string | null | 'invalid';
    settings: ReplySettings;
    prefs: ChatPrefs;
    prefsHydrated: boolean;
    onSelectLens: (id: LensId) => void;
    onSelectMode: (id: ModeId) => void;
    onSelectLanguage: (id: LanguageId | null) => void;
    onCreated: (chatId: string) => void;
    onNewChat: () => void;
};

// Markdown read aloud as its words, not its asterisks.
function plainText(markdown: string): string {
    return markdown
        .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
        .replace(/^\s{0,3}(#{1,6}|>|[-+*]|\d+\.)\s+/gm, '')
        .replace(/[*_`~]+/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

// What a screen reader hears when a reply ends. An error is its own alert.
function spoken(t: Dictionary, reply: Reply): string {
    switch (reply.status) {
        case 'done': return plainText(reply.text);
        case 'interrupted': return `${plainText(reply.text)} ${t.chat.interrupted}`;
        case 'stopped': return t.chat.stopped;
        default: return '';
    }
}

const findReply = (t: Transcript, replyId: string) =>
    t.find((e): e is Exchange => e.kind === 'exchange' && e.reply.id === replyId)?.reply;

// One conversation: its messages and the chat bar. Keyed by chat in
// ChatScreen, so switching chats starts from a fresh view.
export default function ChatConversation({
    routeId,
    settings,
    prefs,
    prefsHydrated,
    onSelectLens,
    onSelectMode,
    onSelectLanguage,
    onCreated,
    onNewChat,
}: Props) {
    const { t } = useLanguage();
    const session = useChatSession({ routeId, settings, onCreated });
    const draftKey = session.chatId ?? 'new';
    const [input, setInputState] = useState(() => drafts.get(draftKey) ?? '');
    const [contextError, setContextError] = useState(false);
    // Why the last question didn't go (storage full, chat full, …).
    const [blocked, setBlocked] = useState<string | null>(null);
    const [openedAs] = useState(routeId);

    const setInput = (value: string) => {
        setInputState(value);
        if (value) drafts.set(draftKey, value);
        else drafts.delete(draftKey);
    };

    // Mirrors the latest dictionary so async work reads the current language.
    const tRef = useRef(t);
    useEffect(() => { tRef.current = t; }, [t]);

    // The chat on screen is never evicted to make room for another.
    useEffect(() => {
        setOpenChat(session.chatId);
        return () => setOpenChat(null);
    }, [session.chatId]);

    // A deep link (/chat?context=hukamnama | ?context=shabad&ang=N) opens a new
    // chat about that passage. The params stay in the URL until the first
    // question saves the chat, so a reload before then keeps the passage.
    const { setDraftContext } = session;
    useEffect(() => {
        if (openedAs !== null) return;
        const link = parseDeepLink(window.location.search);
        if (!link) return;
        let cancelled = false;
        fetchChatContext(link, tRef.current)
            .then((ctx) => {
                if (cancelled) return;
                setDraftContext(ctx);
                setContextError(false);
            })
            .catch(() => {
                if (!cancelled) setContextError(true);
            });
        return () => { cancelled = true; };
    }, [openedAs, setDraftContext]);

    // Stick to the bottom while new content arrives, unless the user scrolled up.
    const scrollRef = useRef<HTMLDivElement>(null);
    const atBottomRef = useRef(true);
    const [showJump, setShowJump] = useState(false);
    useEffect(() => {
        const el = scrollRef.current;
        if (el && atBottomRef.current) el.scrollTop = el.scrollHeight;
    }, [session.items, prefsHydrated]);

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
    // when it ends — not every word as it streams, and nothing when a saved
    // chat opens.
    const liveId = session.streaming?.id ?? null;
    const [watching, setWatching] = useState(liveId);
    const [announcement, setAnnouncement] = useState('');
    if (liveId !== watching) {
        setWatching(liveId);
        if (liveId) setAnnouncement(t.chat.thinking);
        else if (watching) {
            const ended = findReply(session.transcript, watching);
            setAnnouncement(ended ? spoken(t, ended) : '');
        }
    }

    const reasons: Partial<Record<SendResult, string>> = {
        full: t.chat.chatFull,
        quota: t.chat.storageFull,
        gone: t.errors.generic,
        permission: t.errors.generic,
        unavailable: t.errors.generic,
    };

    const submit = async (text: string, fromInput: boolean) => {
        setBlocked(null);
        atBottomRef.current = true;
        const result = await session.send(text);
        if (result === 'sent') {
            if (fromInput) setInput('');
        } else {
            setBlocked(reasons[result] ?? null);
        }
    };

    const retry = async () => {
        setBlocked(null);
        atBottomRef.current = true;
        const result = await session.retry();
        if (result !== 'sent') setBlocked(reasons[result] ?? null);
    };

    const dismissContext = () => {
        void session.dismissContext();
        // A passage from a deep link: drop the params too, or a reload brings it back.
        if (session.chatId === null && window.location.search) window.history.replaceState(null, '', '/chat');
    };

    const firstExchange = session.transcript.find((e): e is Exchange => e.kind === 'exchange');
    // A new chat greets in the chosen lens; a saved one in the lens it began with.
    const greetingLens = session.status === 'draft'
        ? prefs.lensId
        : firstExchange?.reply.settings?.lensId ?? DEFAULT_PREFS.lensId;
    const starterPrompts = session.context
        ? t.chat.config.contextStarters[session.context.type]
        : t.chat.config.lenses[prefs.lensId].starterPrompts;
    const missing = session.status === 'missing';

    return (
        <>
            <div className="relative flex-1 min-h-0">
                {/* relative: the screen-reader-only text inside is absolutely positioned,
                    and must scroll (and be clipped) with the list, not stretch the page. */}
                <div ref={scrollRef} onScroll={onScroll} className="relative h-full overflow-y-auto p-4 md:p-8">
                    <div className="mx-auto w-full max-w-3xl space-y-6">
                        {missing ? (
                            <ChatUnavailable onNewChat={onNewChat} />
                        ) : !prefsHydrated ? null : session.status === 'loading' ? (
                            <div className="space-y-6" aria-hidden="true">
                                <div className="h-16 w-2/3 rounded-2xl bg-edge/60 animate-pulse" />
                                <div className="ml-auto h-12 w-1/2 rounded-2xl bg-edge/60 animate-pulse" />
                                <div className="h-24 w-3/4 rounded-2xl bg-edge/60 animate-pulse" />
                                <span className="sr-only">{t.chat.loadingChat}</span>
                            </div>
                        ) : (
                            <>
                                <GreetingBubble text={t.chat.config.lenses[greetingLens].greeting} />
                                {session.items.map((item) =>
                                    item.kind === 'notice' ? (
                                        <NoticeDivider key={item.notice.id} notice={item.notice} />
                                    ) : item.kind === 'question' ? (
                                        <QuestionBubble key={`${item.exchange.id}:question`} text={item.exchange.question.text} />
                                    ) : (
                                        <ReplyMessage
                                            key={item.exchange.reply.id}
                                            reply={item.exchange.reply}
                                            onRetry={item.canRetry ? retry : undefined}
                                            onRegenerate={item.canRegenerate ? retry : undefined}
                                            unsaved={session.unsaved?.reply.id === item.exchange.reply.id}
                                        />
                                    ),
                                )}
                                {!firstExchange && (
                                    <div className="space-y-1">
                                        <StarterPrompts prompts={starterPrompts} onSelect={(prompt) => void submit(prompt, false)} />
                                        {!session.context && <TopicPacks onSelect={(prompt) => void submit(prompt, false)} />}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>

                {showJump && (
                    <button
                        type="button"
                        onClick={jumpToBottom}
                        className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-navy text-white dark:bg-kesri dark:text-navy text-xs font-semibold px-3 py-2 rounded-full shadow-lg hover:opacity-90 transition-opacity"
                    >
                        <ArrowDownIcon className="w-3.5 h-3.5" aria-hidden="true" />
                        {t.chat.latest}
                    </button>
                )}
            </div>

            <p className="sr-only" role="status" aria-atomic="true">{announcement}</p>

            {!missing && (
                <>
                    {(blocked || session.full) && (
                        <p
                            role={blocked ? 'alert' : 'status'}
                            className="mx-auto w-full max-w-3xl px-4 pb-2 text-xs text-red-600 dark:text-red-400"
                        >
                            {blocked ?? t.chat.chatFull}
                        </p>
                    )}
                    <ChatInput
                        value={input}
                        onChange={setInput}
                        onSend={() => void submit(input, true)}
                        onStop={session.stop}
                        isStreaming={!!session.streaming}
                        canSend={session.status === 'draft' || session.status === 'ready'}
                        settings={
                            <ChatSettingsBar
                                prefs={prefs}
                                hydrated={prefsHydrated}
                                onSelectLens={onSelectLens}
                                onSelectMode={onSelectMode}
                                onSelectLanguage={onSelectLanguage}
                            />
                        }
                        context={session.context}
                        contextError={contextError}
                        onDismissContext={dismissContext}
                        onDismissContextError={() => setContextError(false)}
                        disclaimer={t.chat.disclaimer}
                    />
                </>
            )}
        </>
    );
}
