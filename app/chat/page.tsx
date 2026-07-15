'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowDownIcon, ChevronDownIcon, PencilSquareIcon, SparklesIcon } from '@heroicons/react/24/outline';
import ChatMessage from '../components/chat/ChatMessage';
import ChatInput from '../components/chat/ChatInput';
import StarterPrompts from '../components/chat/StarterPrompts';
import TopicPacks from '../components/chat/TopicPacks';
import ContextChip from '../components/chat/ContextChip';
import ChatSettingsDialog from '../components/chat/ChatSettingsDialog';
import { useChatStorage, type Message } from '../components/chat/useChatStorage';
import { useChatPrefs } from '../components/chat/useChatPrefs';
import { parseDeepLink, fetchChatContext } from '../components/chat/deepLink';
import { CONTEXT_STARTERS, LANGUAGES, LENSES, MODES, type LensId } from '@/lib/chat/config';

// Fixed id/timestamp: this message is rendered during SSR, so it must be
// identical between server and client renders. The text is swapped to the
// selected lens's greeting after hydration (greeting-only conversations only).
const INITIAL_MESSAGES: Message[] = [
  {
    id: 'greeting',
    role: 'ai',
    text: 'Waheguru Ji Ka Khalsa, Waheguru Ji Ki Fateh. How can I help you learn about Sikhi today?',
    createdAt: 0,
  },
];

const FRIENDLY_ERROR = 'Sorry, something went wrong. Please try again.';

export default function ChatPage() {
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [contextError, setContextError] = useState<string | null>(null);
  const { messages, setMessages, context, updateContext, hydrated, save, clear } = useChatStorage(INITIAL_MESSAGES);
  const { prefs, update: updatePrefs, hydrated: prefsHydrated } = useChatPrefs();

  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);
  const [showJump, setShowJump] = useState(false);

  const lens = LENSES[prefs.lensId];

  // Persist once a stream finalizes (not per-token); skip greeting-only state
  useEffect(() => {
    if (hydrated && !isStreaming && messages.length > 1) save(messages);
  }, [messages, isStreaming, hydrated, save]);

  // Keep the greeting in step with the selected lens while the conversation
  // is still untouched (covers first hydration and lens changes alike).
  useEffect(() => {
    if (!hydrated || !prefsHydrated) return;
    setMessages(prev =>
      prev.length === 1 && prev[0].id === 'greeting' && prev[0].text !== lens.greeting
        ? [{ ...prev[0], text: lens.greeting }]
        : prev
    );
  }, [hydrated, prefsHydrated, lens.greeting, setMessages]);

  // Capture a deep-linked passage (?context=hukamnama | ?context=shabad&ang=N),
  // then strip the params so a refresh doesn't re-attach it.
  useEffect(() => {
    if (!hydrated) return;
    const link = parseDeepLink(window.location.search);
    if (!link) return;
    window.history.replaceState(null, '', '/chat');
    let cancelled = false;
    fetchChatContext(link)
      .then(ctx => {
        if (cancelled) return;
        updateContext(ctx);
        setContextError(null);
      })
      .catch(() => {
        if (!cancelled) setContextError('Could not load that passage. You can still chat normally.');
      });
    return () => { cancelled = true; };
  }, [hydrated, updateContext]);

  // Stick to bottom while new content arrives, unless the user scrolled up
  useEffect(() => {
    const el = scrollRef.current;
    if (el && atBottomRef.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  // Abort any in-flight stream on unmount
  useEffect(() => () => abortRef.current?.abort(), []);

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

  async function send(text: string, baseMessages: Message[]) {
    const trimmed = text.trim();
    if (!trimmed || isStreaming) return;

    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', text: trimmed, createdAt: Date.now() };
    const aiMsg: Message = { id: crypto.randomUUID(), role: 'ai', text: '', createdAt: Date.now() };
    setMessages([...baseMessages, userMsg, aiMsg]);
    setInput('');
    setConfirmingClear(false);
    setIsStreaming(true);
    atBottomRef.current = true;

    // Persist the question immediately so a refresh mid-stream keeps it
    save([...baseMessages, userMsg]);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      // History: only completed (user -> non-error AI) exchanges, kept in
      // strict alternation so Gemini never receives two consecutive same-role
      // turns (which it rejects with a 400). The greeting, lens-switch notices,
      // unanswered user turns, and error bubbles are dropped rather than orphaned.
      const convo = baseMessages.filter(m => m.id !== 'greeting' && m.role !== 'notice');
      const history: { role: string; text: string }[] = [];
      for (let i = 0; i < convo.length; i++) {
        const m = convo[i];
        const next = convo[i + 1];
        if (m.role === 'user' && next && next.role === 'ai' && !next.isError && next.text.trim()) {
          history.push({ role: 'user', text: m.text }, { role: 'ai', text: next.text });
          i++; // consume the paired AI turn
        }
      }

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          history,
          lensId: prefs.lensId,
          modeId: prefs.modeId,
          languageId: prefs.languageId,
          context: context ? { type: context.type, title: context.title, text: context.text } : undefined,
        }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        let friendly: string | null = null;
        if (res.headers.get('content-type')?.includes('json')) {
          friendly = (await res.json()).error;
        }
        throw new Error(friendly ?? FRIENDLY_ERROR);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let received = false;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        if (chunk) received = true;
        setMessages(prev => prev.map(m => (m.id === aiMsg.id ? { ...m, text: m.text + chunk } : m)));
      }
      if (!received) {
        // Never leave a permanently empty bubble
        setMessages(prev => prev.map(m =>
          m.id === aiMsg.id ? { ...m, text: FRIENDLY_ERROR, isError: true } : m
        ));
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        // User pressed Stop: keep partial text; drop the bubble if nothing arrived
        setMessages(prev => prev.flatMap(m =>
          m.id !== aiMsg.id ? [m] : m.text ? [{ ...m, interrupted: true }] : []
        ));
      } else {
        const friendly = err instanceof Error && err.message ? err.message : FRIENDLY_ERROR;
        setMessages(prev => prev.map(m =>
          m.id === aiMsg.id
            ? (m.text ? { ...m, interrupted: true } : { ...m, text: friendly, isError: true })
            : m
        ));
      }
    } finally {
      abortRef.current = null;
      setIsStreaming(false);
    }
  }

  const regenerate = () => {
    if (isStreaming) return;
    const lastUserIdx = messages.findLastIndex(m => m.role === 'user');
    if (lastUserIdx === -1) return;
    // send() re-appends the user message, so slice it off the base
    send(messages[lastUserIdx].text, messages.slice(0, lastUserIdx));
  };

  const confirmClear = () => {
    abortRef.current?.abort();
    clear([{ ...INITIAL_MESSAGES[0], text: lens.greeting }]);
    setContextError(null);
    setConfirmingClear(false);
  };

  // Lens changes apply from the next message. Mid-conversation we drop a
  // divider notice; on an untouched chat the greeting-sync effect handles it.
  const selectLens = (lensId: LensId) => {
    if (lensId === prefs.lensId) return;
    updatePrefs({ lensId });
    setMessages(prev => {
      if (prev.length === 1 && prev[0].id === 'greeting') return prev;
      const next = LENSES[lensId];
      return [...prev, {
        id: crypto.randomUUID(),
        role: 'notice' as const,
        text: next.id === 'sikhai'
          ? 'Now answering as SikhAI, drawing on all ten Gurus'
          : `Now answering through the lens of ${next.name}`,
        createdAt: Date.now(),
      }];
    });
  };

  const lastMessage = messages[messages.length - 1];
  const starterPrompts = context ? CONTEXT_STARTERS[context.type] : lens.starterPrompts;

  return (
    <main className="flex flex-col h-[calc(100dvh-4rem)]">
      <h1 className="sr-only">Ask SikhAI</h1>

      {/* Slim chat header */}
      <div className="flex items-center justify-between px-4 py-2 bg-surface-raised border-b border-edge shrink-0">
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          aria-haspopup="dialog"
          className="flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-ink transition-colors p-1.5 rounded-lg hover:bg-edge/60 min-w-0"
        >
          <SparklesIcon className="w-4 h-4 text-accent-text shrink-0" aria-hidden="true" />
          <span className="truncate">{lens.name}</span>
          <ChevronDownIcon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        </button>
        {confirmingClear ? (
          <div className="flex items-center gap-2 text-sm" role="group" aria-label="Confirm clearing the conversation">
            <span className="text-ink-muted">Clear this chat?</span>
            <button
              type="button"
              onClick={confirmClear}
              className="font-semibold text-red-600 dark:text-red-400 hover:underline px-1.5 py-1 rounded-lg"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => setConfirmingClear(false)}
              className="text-ink-muted hover:text-ink px-1.5 py-1 rounded-lg hover:bg-edge/60 transition-colors"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmingClear(true)}
            disabled={messages.length <= 1}
            className="flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-ink disabled:opacity-50 transition-colors p-1.5 rounded-lg hover:bg-edge/60 shrink-0"
          >
            <PencilSquareIcon className="w-4 h-4" aria-hidden="true" />
            New chat
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="relative flex-1 min-h-0">
        <div ref={scrollRef} onScroll={onScroll} aria-live="polite" aria-atomic="false" className="h-full overflow-y-auto p-4 md:p-8 space-y-6">
          {hydrated && (
            <>
              {messages.map((msg) => (
                msg.role === 'notice' ? (
                  <div key={msg.id} role="status" className="flex items-center gap-3 text-ink-faint">
                    <span className="h-px flex-1 bg-edge" aria-hidden="true" />
                    <span className="text-[11px] uppercase tracking-widest font-bold text-center">{msg.text}</span>
                    <span className="h-px flex-1 bg-edge" aria-hidden="true" />
                  </div>
                ) : (
                  <ChatMessage
                    key={msg.id}
                    message={msg}
                    isTyping={isStreaming && msg.id === lastMessage?.id && msg.role === 'ai' && msg.text === ''}
                    showActions={msg.role === 'ai' && !msg.isError && msg.id !== 'greeting' && msg.text !== ''}
                    onRegenerate={
                      msg.id === lastMessage?.id && msg.role === 'ai' && !msg.isError && !isStreaming && msg.id !== 'greeting'
                        ? regenerate
                        : undefined
                    }
                  />
                )
              ))}
              {messages.length <= 1 && !isStreaming && (
                <div className="space-y-1">
                  <div className="flex items-center justify-center gap-2 text-xs text-ink-muted flex-wrap px-2">
                    <span>
                      Guided by <span className="font-semibold text-ink">{lens.name}</span>
                      {' · '}{MODES[prefs.modeId].name}{' · '}{LANGUAGES[prefs.languageId].name}
                    </span>
                    <button
                      type="button"
                      onClick={() => setSettingsOpen(true)}
                      className="font-semibold text-accent-text hover:underline"
                    >
                      Change
                    </button>
                  </div>
                  <StarterPrompts prompts={starterPrompts} onSelect={(prompt) => send(prompt, messages)} />
                  {!context && <TopicPacks onSelect={(prompt) => send(prompt, messages)} />}
                </div>
              )}
            </>
          )}
        </div>

        {showJump && (
          <button
            type="button"
            onClick={jumpToBottom}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-navy text-white dark:bg-kesri dark:text-navy text-xs font-semibold px-3 py-2 rounded-full shadow-lg hover:opacity-90 transition-opacity"
          >
            <ArrowDownIcon className="w-3.5 h-3.5" aria-hidden="true" />
            Latest
          </button>
        )}
      </div>

      {(context || contextError) && (
        <div className="flex justify-center px-4 pb-2 bg-surface shrink-0">
          {context ? (
            <ContextChip context={context} onDismiss={() => updateContext(null)} />
          ) : (
            <p role="alert" className="flex items-center gap-2 text-xs text-red-600 dark:text-red-400">
              {contextError}
              <button type="button" onClick={() => setContextError(null)} className="underline font-semibold">
                Dismiss
              </button>
            </p>
          )}
        </div>
      )}

      <ChatInput
        value={input}
        onChange={setInput}
        onSend={() => send(input, messages)}
        onStop={() => abortRef.current?.abort()}
        isStreaming={isStreaming}
      />

      <ChatSettingsDialog
        open={settingsOpen}
        prefs={prefs}
        onSelectLens={selectLens}
        onSelectMode={(modeId) => updatePrefs({ modeId })}
        onSelectLanguage={(languageId) => updatePrefs({ languageId })}
        onClose={() => setSettingsOpen(false)}
      />
    </main>
  );
}
