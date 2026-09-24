'use client';

import { useEffect } from 'react';
import { useModalDialog } from '../useModalDialog';
import ChatHistoryPanel from './ChatHistoryPanel';
import type { ChatListItem } from './useChatList';

type Props = {
    open: boolean;
    onClose: () => void;
    activeId: string | null;
    onNavigate: (href: string) => void;
    onShare?: (chat: ChatListItem) => void;
};

// Narrow screens: the chat list slides over the page as a modal <dialog>.
export default function ChatHistoryDrawer({ open, onClose, activeId, onNavigate, onShare }: Props) {
    const { ref, onCancel, onClick } = useModalDialog(open, onClose);

    // Widened to where the sidebar shows: a hidden modal would still leave
    // the rest of the page unusable, so close it.
    useEffect(() => {
        if (!open) return;
        const wide = window.matchMedia('(min-width: 1024px)');
        const onChange = () => { if (wide.matches) onClose(); };
        wide.addEventListener('change', onChange);
        return () => wide.removeEventListener('change', onChange);
    }, [open, onClose]);

    return (
        <dialog
            id="chat-history-drawer"
            ref={ref}
            onCancel={onCancel}
            onClick={onClick}
            aria-labelledby="chat-history-drawer-title"
            className="m-0 h-dvh max-h-none w-[min(20rem,85vw)] max-w-none border-0 border-r border-edge bg-surface-raised p-0 text-ink backdrop:bg-black/40"
        >
            {open && (
                <ChatHistoryPanel
                    variant="drawer"
                    headingId="chat-history-drawer-title"
                    activeId={activeId}
                    onNavigate={onNavigate}
                    onClose={onClose}
                    onShare={onShare}
                />
            )}
        </dialog>
    );
}
