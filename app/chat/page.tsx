'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowDownIcon, PencilSquareIcon } from '@heroicons/react/24/outline';
import ChatMessage from '../components/chat/ChatMessage';
import ChatInput from '../components/chat/ChatInput';
import StarterPrompts from '../components/chat/StarterPrompts';
import { useChatStorage, type Message } from '../components/chat/useChatStorage';

// Fixed id/timestamp: this message is rendered during SSR, so it must be
// identical between server and client renders.
const INITIAL_MESSAGES: Message[] = [
  {
    id: 'greeting',
    role: 'ai',
    text: 'Waheguru Ji Ka Khalsa, Waheguru Ji Ki Fateh. How can I help you learn about Sikhism today?',
    createdAt: 0,
  },
];

const FRIENDLY_ERROR = 'Sorry, something went wrong. Please try again.';

export default function ChatPage() {
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [confirmingClear, setConfirmingClear] = useState(false);
  const { messages, setMessages, hydrated, save, clear } = useChatStorage(INITIAL_MESSAGES);

  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);
  const [showJump, setShowJump] = useState(false);

  // Persist once a stream finalizes (not per-token); skip greeting-only state
  useEffect(() => {
    if (hydrated && !isStreaming && messages.length > 1) save(messages);
  }, [messages, isStreaming, hydrated, save]);

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
      // turns (which it rejects with a 400). Unanswered user turns and error
      // bubbles left behind by a stop/failure are dropped rather than orphaned.
      const convo = baseMessages.filter(m => m.id !== 'greeting');
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
        body: JSON.stringify({ message: trimmed, history }),
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
    clear();
    setConfirmingClear(false);
  };

  const lastMessage = messages[messages.length - 1];

  return (
    <main className="flex flex-col h-[calc(100dvh-4rem)]">
      <h1 className="sr-only">Ask SikhAI</h1>

      {/* Slim chat header */}
      <div className="flex items-center justify-between px-4 py-2 bg-surface-raised border-b border-edge shrink-0">
        <p className="text-xs text-ink-faint">Powered by Gemini</p>
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
            className="flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-ink disabled:opacity-50 transition-colors p-1.5 rounded-lg hover:bg-edge/60"
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
              ))}
              {messages.length <= 1 && !isStreaming && (
                <StarterPrompts onSelect={(prompt) => send(prompt, messages)} />
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

      <ChatInput
        value={input}
        onChange={setInput}
        onSend={() => send(input, messages)}
        onStop={() => abortRef.current?.abort()}
        isStreaming={isStreaming}
      />
    </main>
  );
}
