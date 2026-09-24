'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { LinkIcon } from '@heroicons/react/24/outline';
import { isChatId } from '@/lib/chat/chatMeta';
import { toDisplayItems } from '@/lib/chat/exchange';
import { parseShareDoc, shareToRecord, type SharedChat } from '@/lib/chat/share';
import { db } from '@/lib/firebase';
import { formatDate } from '@/lib/i18n/date';
import { fmt } from '@/lib/i18n/fmt';
import { useLanguage } from '../../context/LanguageContext';
import ContextChip from '../chat/ContextChip';
import ReplyMessage, { QuestionBubble } from '../chat/ChatMessage';
import NoticeDivider from '../chat/NoticeDivider';
import { storeFor, useChatHomes } from '../chat/useChatHomes';

type State = { status: 'loading' } | { status: 'missing' } | { status: 'error' } | { status: 'ready'; chat: SharedChat };

// No answer by then (offline, or Firestore unreachable): say so, and offer to
// try again, rather than loading for ever.
const LOAD_TIMEOUT_MS = 15_000;

const PRIMARY = 'rounded-lg bg-kesri px-4 py-2 text-sm font-bold text-navy transition-colors hover:bg-kesri-hover disabled:opacity-60';

// A shared chat, read-only, for anyone holding the link — signed in or not.
// Read with the ordinary client (public reads are allowed on shared_chats),
// and checked like anything else loaded before a word of it is shown.
export default function SharedChatView({ shareId }: { shareId: string }) {
    const { lang, t } = useLanguage();
    const router = useRouter();
    const { uid, homeForNew } = useChatHomes();
    const valid = isChatId(shareId);
    const [state, setState] = useState<State>({ status: 'loading' });
    const [attempt, setAttempt] = useState(0);
    const [opening, setOpening] = useState(false);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        if (!valid) return;
        let settled = false;
        const settle = (next: State) => {
            if (settled) return;
            settled = true;
            setState(next);
        };
        const timer = setTimeout(() => settle({ status: 'error' }), LOAD_TIMEOUT_MS);
        getDoc(doc(db, 'shared_chats', shareId))
            .then((snap) => {
                const chat = snap.exists() ? parseShareDoc(snap.data()) : null;
                settle(chat ? { status: 'ready', chat } : { status: 'missing' });
            })
            // Refused reads are links that don't exist for anyone; anything
            // else is worth another try.
            .catch((e: { code?: string }) => settle({ status: e?.code === 'permission-denied' ? 'missing' : 'error' }))
            .finally(() => clearTimeout(timer));
        return () => {
            settled = true;
            clearTimeout(timer);
        };
    }, [shareId, valid, attempt]);

    const retry = () => {
        setState({ status: 'loading' });
        setAttempt((n) => n + 1);
    };

    const shown: State = valid ? state : { status: 'missing' };

    // A new chat of the reader's own, starting from this one.
    const continueChat = async (chat: SharedChat) => {
        setOpening(true);
        setFailed(false);
        const record = shareToRecord(chat, { now: Date.now(), newId: () => crypto.randomUUID() });
        try {
            await storeFor(homeForNew, uid).importChat(record);
            router.push(`/chat/${record.meta.id}`);
        } catch {
            setFailed(true);
            setOpening(false);
        }
    };

    if (shown.status === 'error') {
        return (
            <main className="flex-1">
                <div className="mx-auto w-full max-w-3xl px-4 py-16 text-center space-y-3">
                    <p role="alert" className="text-sm text-ink-muted">{t.share.loadError}</p>
                    <button type="button" onClick={retry} className={PRIMARY}>{t.chat.retry}</button>
                </div>
            </main>
        );
    }

    if (shown.status === 'missing') {
        return (
            <main className="flex-1">
                <div className="mx-auto w-full max-w-3xl px-4 py-16 text-center space-y-3">
                    <h1 className="text-2xl font-bold text-ink">{t.share.unavailableHeading}</h1>
                    <p className="text-sm text-ink-muted">{t.share.unavailableBody}</p>
                    <Link href="/chat" className={`inline-block ${PRIMARY}`}>{t.share.newChat}</Link>
                </div>
            </main>
        );
    }

    if (shown.status === 'loading') {
        return (
            <main className="flex-1">
                <div className="mx-auto w-full max-w-3xl px-4 py-12 space-y-6" aria-hidden="true">
                    <div className="h-8 w-2/3 rounded-lg bg-edge/60 animate-pulse" />
                    <div className="ml-auto h-12 w-1/2 rounded-2xl bg-edge/60 animate-pulse" />
                    <div className="h-24 w-3/4 rounded-2xl bg-edge/60 animate-pulse" />
                </div>
                <p className="sr-only" role="status">{t.share.loading}</p>
            </main>
        );
    }

    const { chat } = shown;
    return (
        <main className="flex-1">
            <article className="mx-auto w-full max-w-3xl px-4 py-8 md:py-12">
                <header className="mb-8 space-y-3 border-b border-edge pb-6">
                    <p className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-accent-text">
                        <LinkIcon className="h-3.5 w-3.5" aria-hidden="true" />
                        {t.share.badge}
                    </p>
                    <h1 className="text-2xl font-bold text-ink md:text-3xl">{chat.title || t.chat.history.untitled}</h1>
                    {chat.updatedAt > 0 && (
                        <p className="text-sm text-ink-muted">{fmt(t.share.sharedOn, { date: formatDate(chat.updatedAt, lang) })}</p>
                    )}
                    <p className="text-xs text-ink-muted">{t.share.disclaimer}</p>
                    {chat.context && <ContextChip context={chat.context} />}
                </header>

                {chat.truncated && <p className="mb-6 text-center text-xs text-ink-muted">{t.share.truncated}</p>}

                <div className="space-y-6">
                    {toDisplayItems(chat.transcript).map((item) =>
                        item.kind === 'notice' ? (
                            <NoticeDivider key={item.notice.id} notice={item.notice} />
                        ) : item.kind === 'question' ? (
                            <QuestionBubble key={`${item.exchange.id}:question`} text={item.exchange.question.text} />
                        ) : (
                            <ReplyMessage key={item.exchange.reply.id} reply={item.exchange.reply} actions={false} />
                        ),
                    )}
                </div>
            </article>

            <div className="sticky bottom-0 border-t border-edge bg-surface/95 backdrop-blur pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-center gap-3 px-4">
                    <button type="button" onClick={() => void continueChat(chat)} disabled={opening} className={PRIMARY}>
                        {opening ? t.share.continuing : t.share.continue}
                    </button>
                    <Link href="/chat" className="text-sm font-semibold text-accent-text hover:underline">
                        {t.share.newChat}
                    </Link>
                    {failed && <p role="alert" className="w-full text-center text-xs text-red-600 dark:text-red-400">{t.share.continueError}</p>}
                </div>
            </div>
        </main>
    );
}
