'use client';

import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { usePathname } from 'next/navigation';
import { chatIdFromPath } from '@/lib/chat/chatMeta';
import { siteDefaultLanguageId, siteScript } from '@/lib/chat/config';
import type { ReplySettings } from '@/lib/chat/transcript';
import { useLanguage } from '../../context/LanguageContext';
import ChatConversation from './ChatConversation';
import ChatHeader from './ChatHeader';
import ChatHistoryDrawer from './ChatHistoryDrawer';
import ChatHistoryPanel from './ChatHistoryPanel';
import { useChatList } from './useChatList';
import { useChatPrefs } from './useChatPrefs';

// The whole chat screen, rendered by app/chat/layout.tsx rather than a page:
// a layout on the static /chat segment is never remounted, so neither moving
// between chats nor the router.refresh() of a language switch can reset it.
// The open chat comes from the URL — /chat is a new chat, /chat/{id} a saved
// one — and moves with pushState/replaceState, which Next's router follows.
export default function ChatScreen() {
    const pathname = usePathname();
    const routeId = chatIdFromPath(pathname);
    const activeId = routeId === 'invalid' ? null : routeId;
    const { lang, t } = useLanguage();
    const { prefs, update: updatePrefs, hydrated: prefsHydrated } = useChatPrefs();
    const list = useChatList();
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(true);

    // The conversation view is keyed so every other chat, and every new one,
    // starts fresh — except when a new chat's first question saves it and the
    // URL gains its id: that is still the same conversation, mid-reply.
    const [draftKey, setDraftKey] = useState(0);
    const [promotedId, setPromotedId] = useState<string | null>(null);
    const [shownRoute, setShownRoute] = useState(routeId);
    if (routeId !== shownRoute) {
        setShownRoute(routeId);
        if (routeId === null) {
            setDraftKey((k) => k + 1);
            setPromotedId(null);
        } else if (routeId !== promotedId) {
            setPromotedId(null);
        }
    }
    const viewKey = routeId === null || routeId === promotedId ? `new-${draftKey}` : routeId;

    // Set before the URL changes, so the new key is in place when it does.
    const onCreated = useCallback((chatId: string) => {
        flushSync(() => setPromotedId(chatId));
        window.history.replaceState(null, '', `/chat/${chatId}`);
    }, []);

    const navigate = useCallback((href: string) => {
        setDrawerOpen(false);
        if (window.location.pathname + window.location.search !== href) window.history.pushState(null, '', href);
    }, []);

    const startNewChat = useCallback(() => {
        setDraftKey((k) => k + 1);
        setPromotedId(null);
        navigate('/chat');
    }, [navigate]);

    const closeDrawer = useCallback(() => setDrawerOpen(false), []);

    // Hiding the sidebar unmounts the button that did it: focus goes to the
    // one that brings it back, and the other way round.
    const sidebarToggled = useRef(false);
    useLayoutEffect(() => {
        if (!sidebarToggled.current) return;
        sidebarToggled.current = false;
        document.getElementById(sidebarOpen ? 'chat-history-title-new' : 'chat-show-sidebar')?.focus();
    }, [sidebarOpen]);
    const hideSidebar = () => {
        sidebarToggled.current = true;
        setSidebarOpen(false);
    };
    const showSidebar = () => {
        sidebarToggled.current = true;
        setSidebarOpen(true);
    };

    // What the next reply is asked for: the chips, with Auto resolved to the
    // site language, and the site's script for a Punjabi reply.
    const languageId = prefs.languageId ?? siteDefaultLanguageId(lang);
    const script = languageId === 'punjabi' ? siteScript(lang) : undefined;
    const settings: ReplySettings = { lensId: prefs.lensId, modeId: prefs.modeId, languageId, ...(script ? { script } : {}) };

    const title = activeId ? list.all.find((c) => c.id === activeId)?.title || null : null;

    return (
        <div className="flex h-[calc(100dvh-4rem)] min-h-0">
            {sidebarOpen && (
                <nav
                    id="chat-sidebar"
                    aria-labelledby="chat-history-title"
                    className="hidden w-72 shrink-0 flex-col border-r border-edge bg-surface-raised lg:flex"
                >
                    <ChatHistoryPanel
                        variant="sidebar"
                        headingId="chat-history-title"
                        activeId={activeId}
                        onNavigate={(href) => (href === '/chat' ? startNewChat() : navigate(href))}
                        onHide={hideSidebar}
                    />
                </nav>
            )}
            <main className="flex min-w-0 flex-1 flex-col">
                <h1 className="sr-only">{t.chat.title}</h1>
                <ChatHeader
                    title={title}
                    sidebarOpen={sidebarOpen}
                    drawerOpen={drawerOpen}
                    onOpenDrawer={() => setDrawerOpen(true)}
                    onShowSidebar={showSidebar}
                    onNewChat={startNewChat}
                />
                <ChatConversation
                    key={viewKey}
                    routeId={routeId}
                    settings={settings}
                    prefs={prefs}
                    prefsHydrated={prefsHydrated}
                    onSelectLens={(lensId) => updatePrefs({ lensId })}
                    onSelectMode={(modeId) => updatePrefs({ modeId })}
                    onSelectLanguage={(languageId) => updatePrefs({ languageId })}
                    onCreated={onCreated}
                    onNewChat={startNewChat}
                />
            </main>
            <ChatHistoryDrawer
                open={drawerOpen}
                onClose={closeDrawer}
                activeId={activeId}
                onNavigate={(href) => (href === '/chat' ? startNewChat() : navigate(href))}
            />
        </div>
    );
}
