'use client';

import { useCallback, useMemo, useState, useSyncExternalStore } from 'react';
import { CheckIcon, LinkIcon, XMarkIcon } from '@heroicons/react/24/outline';
import type { ChatHome, ShareRef } from '@/lib/chat/chatMeta';
import { buildShareSnapshot, newSinceShared } from '@/lib/chat/share';
import { moveChats } from '@/lib/chat/store/move';
import type { InflightReply } from '@/lib/chat/runtime';
import type { ChatState } from '@/lib/chat/store/types';
import { formatDate } from '@/lib/i18n/date';
import { fmt } from '@/lib/i18n/fmt';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useModalDialog } from '../useModalDialog';
import { getAccountChatStore, getLocalChatStore, getReplyRuntime } from './chatStores';
import { storeFor, useChatHomes } from './useChatHomes';
import type { ChatListItem } from './useChatList';

type Props = {
    // The chat to share; null keeps the dialog closed.
    chat: ChatListItem | null;
    onClose: () => void;
};

const LOADING: ChatState = { status: 'loading' };
const NONE: ReadonlyMap<string, InflightReply> = new Map();
const subscribeReplies = (cb: () => void) => getReplyRuntime().subscribe(cb);
const getReplies = () => getReplyRuntime().getSnapshot();

type Note = { tone: 'status' | 'alert'; text: string } | null;

const PRIMARY = 'rounded-lg bg-kesri px-4 py-2 text-sm font-bold text-navy transition-colors hover:bg-kesri-hover disabled:opacity-60';
const SECONDARY = 'rounded-lg border border-edge px-4 py-2 text-sm font-semibold text-ink transition-colors hover:bg-edge/60 disabled:opacity-60';

// A chat's public, read-only link: made, copied, refreshed with what the chat
// has said since, or ended. Only account chats have one (a link has to live
// somewhere), so a chat still in this browser is moved first.
export default function ShareDialog({ chat, onClose }: Props) {
    const { ref, onCancel, onClick } = useModalDialog(chat !== null, onClose);
    return (
        <dialog
            ref={ref}
            onCancel={onCancel}
            onClick={onClick}
            aria-labelledby="share-dialog-title"
            className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-2xl border border-edge bg-surface-raised p-0 text-ink shadow-2xl backdrop:bg-black/40"
        >
            {/* Keyed by chat and gone when closed, however it was closed:
                nothing about one chat's sharing carries into the next. */}
            {chat && <ShareBody key={chat.id} chat={chat} onClose={onClose} />}
        </dialog>
    );
}

function ShareBody({ chat, onClose }: { chat: ChatListItem; onClose: () => void }) {
    const { lang, t } = useLanguage();
    const s = t.chat.shareDialog;
    const { signIn } = useAuth();
    const { uid, accountOk } = useChatHomes();
    // Where the chat is now: moving it to the account (to share it) changes this.
    const [home, setHome] = useState<ChatHome>(chat.home);
    // The link as last made or ended here, until the store reflects it.
    const [made, setMade] = useState<ShareRef | null | undefined>(undefined);
    const [busy, setBusy] = useState<'share' | 'unshare' | null>(null);
    const [confirmingUnshare, setConfirmingUnshare] = useState(false);
    const [copied, setCopied] = useState(false);
    const [note, setNote] = useState<Note>(null);

    const subscribe = useCallback((cb: () => void) => storeFor(home, uid).subscribeChat(chat.id, cb), [chat.id, home, uid]);
    const getChat = useCallback(() => storeFor(home, uid).getChat(chat.id), [chat.id, home, uid]);
    const state = useSyncExternalStore(subscribe, getChat, () => LOADING);
    const replies = useSyncExternalStore(subscribeReplies, getReplies, () => NONE);
    const record = state.status === 'ready' ? state.record : null;
    const share = made === undefined ? record?.meta.share ?? null : made;
    const streaming = replies.get(chat.id)?.reply.status === 'streaming';
    // Serializes the whole chat: only when the chat changes, not on every render.
    const snapshot = useMemo(() => (record ? buildShareSnapshot(record) : null), [record]);
    const url = share ? `${window.location.origin}/share/${share.id}` : '';

    const publish = async () => {
        if (!record || !snapshot || !uid) return;
        setBusy('share');
        setNote(null);
        try {
            if (home === 'local') {
                // The link belongs to the account: move the chat there first.
                // As used now: sharing it is using it, and a full account keeps
                // only its most recent chats.
                const moved = await moveChats([record.meta.id], getLocalChatStore(), getAccountChatStore(uid), {
                    isBusy: (id) => getReplyRuntime().isBusy(id),
                    touch: Date.now(),
                });
                if (moved.failed || moved.moved === 0) throw new Error('move failed');
                setHome('account');
            }
            const wasShared = !!share;
            setMade(await getAccountChatStore(uid).share(record, snapshot));
            if (snapshot.truncated) setNote({ tone: 'status', text: s.truncated });
            else if (wasShared) setNote({ tone: 'status', text: s.updated });
        } catch {
            setNote({ tone: 'alert', text: s.error });
        } finally {
            setBusy(null);
        }
    };

    const unshare = async () => {
        if (!share || !uid) return;
        setBusy('unshare');
        setNote(null);
        try {
            await getAccountChatStore(uid).unshare(chat.id, share.id);
            setMade(null);
            setConfirmingUnshare(false);
            setNote({ tone: 'status', text: s.unshared });
        } catch {
            setNote({ tone: 'alert', text: s.error });
        } finally {
            setBusy(null);
        }
    };

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch { /* the field can still be copied by hand */ }
    };

    const stale = share && record ? newSinceShared(record, share) > 0 : false;

    return (
        <div className="space-y-4 p-5">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <h2 id="share-dialog-title" className="text-base font-bold text-ink">{s.title}</h2>
                    <p className="truncate text-sm text-ink-muted">{chat.title || t.chat.history.untitled}</p>
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    aria-label={s.close}
                    className="rounded-lg p-1.5 text-ink-muted transition-colors hover:bg-edge/60 hover:text-ink"
                >
                    <XMarkIcon className="h-5 w-5" />
                </button>
            </div>

            {!uid ? (
                <div className="space-y-3 text-sm">
                    <p className="text-ink-muted">{s.signedOut}</p>
                    <button type="button" data-initial-focus onClick={() => void signIn()} className={PRIMARY}>
                        {s.signIn}
                    </button>
                </div>
            ) : share ? (
                <div className="space-y-3 text-sm">
                    <label className="block">
                        <span className="sr-only">{s.linkLabel}</span>
                        <span className="flex gap-2">
                            <input
                                readOnly
                                value={url}
                                onFocus={(e) => e.currentTarget.select()}
                                className="min-w-0 flex-1 rounded-lg border border-edge bg-surface px-3 py-2 text-sm text-ink"
                            />
                            <button type="button" data-initial-focus onClick={() => void copy()} className={`${PRIMARY} inline-flex items-center gap-1.5`}>
                                {copied ? <CheckIcon className="h-4 w-4" aria-hidden="true" /> : <LinkIcon className="h-4 w-4" aria-hidden="true" />}
                                {copied ? s.copied : s.copy}
                            </button>
                        </span>
                    </label>
                    <p className="text-xs text-ink-muted">{fmt(s.snapshot, { date: formatDate(share.updatedAt, lang) })}</p>
                    {stale && <p className="text-xs text-accent-text">{s.stale}</p>}
                    <div className="flex flex-wrap items-center gap-2 border-t border-edge pt-4">
                        {confirmingUnshare ? (
                            <div role="group" aria-label={s.unshare} className="flex flex-wrap items-center gap-2">
                                <span className="text-ink-muted">{s.unsharePrompt}</span>
                                <button
                                    type="button"
                                    onClick={() => void unshare()}
                                    disabled={busy !== null}
                                    className="font-semibold text-red-600 dark:text-red-400 hover:underline disabled:opacity-60"
                                >
                                    {busy === 'unshare' ? s.unsharing : s.unshare}
                                </button>
                                <button type="button" autoFocus onClick={() => setConfirmingUnshare(false)} className="text-ink-muted hover:text-ink hover:underline">
                                    {t.chat.cancel}
                                </button>
                            </div>
                        ) : (
                            <>
                                <button
                                    type="button"
                                    onClick={() => void publish()}
                                    disabled={busy !== null || streaming || !snapshot}
                                    className={SECONDARY}
                                >
                                    {busy === 'share' ? s.updating : s.update}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setConfirmingUnshare(true)}
                                    disabled={busy !== null}
                                    className="ml-auto text-sm font-semibold text-red-600 dark:text-red-400 hover:underline disabled:opacity-60"
                                >
                                    {s.unshare}
                                </button>
                            </>
                        )}
                    </div>
                </div>
            ) : state.status === 'loading' || busy === 'share' ? (
                // Still reading the chat (or, mid-move, reading it in its new home).
                <p role="status" className="text-sm text-ink-muted">{busy === 'share' ? s.creating : t.chat.loadingChat}</p>
            ) : state.status === 'error' ? (
                <p role="alert" className="text-sm text-red-600 dark:text-red-400">{s.error}</p>
            ) : !snapshot ? (
                <p className="text-sm text-ink-muted">{s.nothingYet}</p>
            ) : (
                <div className="space-y-3 text-sm">
                    <p className="text-ink-muted">{s.intro}</p>
                    <p className="text-ink-muted">{s.noName}</p>
                    {home === 'local' && <p className="text-ink-muted">{s.moveFirst}</p>}
                    {!accountOk && <p className="text-ink-muted">{t.chat.history.accountUnavailable}</p>}
                    <button
                        type="button"
                        data-initial-focus
                        onClick={() => void publish()}
                        disabled={busy !== null || streaming || !accountOk}
                        className={PRIMARY}
                    >
                        {home === 'local' ? s.moveAndShare : s.create}
                    </button>
                </div>
            )}

            {streaming && uid && <p className="text-xs text-ink-muted">{s.waitForReply}</p>}
            {note && (
                <p role={note.tone} className={`text-xs ${note.tone === 'alert' ? 'text-red-600 dark:text-red-400' : 'text-ink-muted'}`}>
                    {note.text}
                </p>
            )}
        </div>
    );
}
