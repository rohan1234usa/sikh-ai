'use client';

import { ChatBubbleLeftRightIcon, PencilSquareIcon, ShareIcon } from '@heroicons/react/24/outline';
import { useT } from '../../context/LanguageContext';

type Props = {
    title: string | null;
    sidebarOpen: boolean;
    drawerOpen: boolean;
    onOpenDrawer: () => void;
    onShowSidebar: () => void;
    onNewChat: () => void;
    // Shown for a saved chat when shared links are on.
    onShare?: () => void;
};

const BUTTON = 'flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-ink transition-colors p-1.5 rounded-lg hover:bg-edge/60 shrink-0';

// Above the conversation: the way to the chat list (the drawer on narrow
// screens, or the sidebar once hidden), the open chat's name, and New chat —
// which no longer clears anything: the chat just left stays in the list.
export default function ChatHeader({ title, sidebarOpen, drawerOpen, onOpenDrawer, onShowSidebar, onNewChat, onShare }: Props) {
    const t = useT();
    const h = t.chat.history;
    return (
        <div className="flex h-12 shrink-0 items-center gap-1 border-b border-edge bg-surface-raised px-2 sm:px-3">
            <button
                type="button"
                onClick={onOpenDrawer}
                aria-haspopup="dialog"
                aria-expanded={drawerOpen}
                aria-controls="chat-history-drawer"
                className={`${BUTTON} lg:hidden`}
            >
                <ChatBubbleLeftRightIcon className="h-5 w-5" aria-hidden="true" />
                <span className="sr-only sm:not-sr-only">{h.open}</span>
            </button>
            {!sidebarOpen && (
                <button id="chat-show-sidebar" type="button" onClick={onShowSidebar} aria-expanded={false} className={`${BUTTON} hidden lg:flex`}>
                    <ChatBubbleLeftRightIcon className="h-5 w-5" aria-hidden="true" />
                    {h.show}
                </button>
            )}
            <p className="min-w-0 flex-1 truncate px-1.5 text-sm font-medium text-ink" title={title ?? undefined}>
                {title}
            </p>
            {onShare && (
                <button type="button" onClick={onShare} aria-haspopup="dialog" className={BUTTON}>
                    <ShareIcon className="h-4 w-4" aria-hidden="true" />
                    <span className="sr-only sm:not-sr-only">{t.chat.share}</span>
                </button>
            )}
            <button type="button" onClick={onNewChat} className={BUTTON}>
                <PencilSquareIcon className="h-4 w-4" aria-hidden="true" />
                <span className="sr-only sm:not-sr-only">{t.chat.newChat}</span>
            </button>
        </div>
    );
}
