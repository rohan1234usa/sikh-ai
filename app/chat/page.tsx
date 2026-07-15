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
import { DEFAULT_PREFS, siteDefaultLanguageId, siteScript, type LensId } from '@/lib/chat/config';
import { useLanguage } from '../context/LanguageContext';
import type { Dictionary } from '@/lib/i18n';
import { fmt } from '@/lib/i18n/fmt';

// Translate a known API error `code` to the current dictionary; unknown or
// missing codes fall back to the server's English `error` string, then to
// the generic message.
function apiErrorText(t: Dictionary, data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const { code, error } = data as { code?: unknown; error?: unknown };
  if (typeof code === 'string' && code in t.errors) {
    return t.errors[code as keyof Dictionary['errors']];
  }
  return typeof error === 'string' && error ? error : null;
}

export default function ChatPage() {
  const { lang, t } = useLanguage();
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [contextError, setContextError] = useState(false);

  // Seed the greeting in the site language (default lens) so a fresh chat's
  // first painted frame is already localized — no flash of English for pa /
  // pa-latn. The greeting is client-only (gated behind `hydrated`), so this
  // never reaches SSR HTML. useRef captures it once from the first-render
  // dictionary (stable identity); later lens/language changes are handled by
  // the greeting-sync effect below.
  const initialMessages = useRef<Message[]>([
    { id: 'greeting', role: 'ai', text: t.chat.config.lenses[DEFAULT_PREFS.lensId].greeting, createdAt: 0 },
  ]).current;

  const { messages, setMessages, context, updateContext, hydrated, save, clear } = useChatStorage(initialMessages);
  const { prefs, update: updatePrefs, hydrated: prefsHydrated } = useChatPrefs();

  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);
  const [showJump, setShowJump] = useState(false);

  // Mirrors the latest dictionary so async work (in-flight sends, the
  // deep-link effect) reads the current language instead of a stale closure.
  const tRef = useRef(t);
  useEffect(() => { tRef.current = t; }, [t]);

  const lens = t.chat.config.lenses[prefs.lensId];
  // null pref = follow the site language; an explicit pick always wins
  const effectiveLanguageId = prefs.languageId ?? siteDefaultLanguageId(lang);

  // Persist once a stream finalizes (not per-token); skip greeting-only state
  useEffect(() => {
    if (hydrated && !isStreaming && messages.length > 1) save(messages);
  }, [messages, isStreaming, hydrated, save]);

  // Keep the greeting in step with the selected lens and site language while
  // the conversation is still untouched (covers first hydration, lens changes,
  // and language switches alike).
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
    fetchChatContext(link, tRef.current)
      .then(ctx => {
        if (cancelled) return;
        updateContext(ctx);
        setContextError(false);
      })
      .catch(() => {
        if (!cancelled) setContextError(true);
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
          languageId: effectiveLanguageId,
          // Preferred Punjabi script from the site language; only meaningful
          // (and only sent) for 'punjabi' replies.
          script: effectiveLanguageId === 'punjabi' ? siteScript(lang) : undefined,
          context: context ? { type: context.type, title: context.title, text: context.text } : undefined,
        }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        let friendly: string | null = null;
        if (res.headers.get('content-type')?.includes('json')) {
          friendly = apiErrorText(tRef.current, await res.json());
        }
        throw new Error(friendly ?? tRef.current.errors.generic);
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
          m.id === aiMsg.id ? { ...m, text: tRef.current.errors.generic, isError: true } : m
        ));
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        // User pressed Stop: keep partial text; drop the bubble if nothing arrived
        setMessages(prev => prev.flatMap(m =>
          m.id !== aiMsg.id ? [m] : m.text ? [{ ...m, interrupted: true }] : []
        ));
      } else {
        const friendly = err instanceof Error && err.message ? err.message : tRef.current.errors.generic;
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
    clear([{ ...initialMessages[0], text: lens.greeting }]);
    setContextError(false);
    setConfirmingClear(false);
  };

  // Lens changes apply from the next message. Mid-conversation we drop a
  // divider notice; on an untouched chat the greeting-sync effect handles it.
  const selectLens = (lensId: LensId) => {
    if (lensId === prefs.lensId) return;
    updatePrefs({ lensId });
    setMessages(prev => {
      if (prev.length === 1 && prev[0].id === 'greeting') return prev;
      return [...prev, {
        id: crypto.randomUUID(),
        role: 'notice' as const,
        text: lensId === 'sikhai'
          ? t.chat.lensSwitchNoticeDefault
          : fmt(t.chat.lensSwitchNotice, { name: t.chat.config.lenses[lensId].name }),
        createdAt: Date.now(),
      }];
    });
  };

  const lastMessage = messages[messages.length - 1];
  const starterPrompts = context ? t.chat.config.contextStarters[context.type] : lens.starterPrompts;
  // Word order around the lens name differs per language, so split the
  // template on {name} and render the styled span between the halves.
  const [guidedBefore, guidedAfter] = t.chat.guidedBy.split('{name}');

  return (
    <main className="flex flex-col h-[calc(100dvh-4rem)]">
      <h1 className="sr-only">{t.chat.title}</h1>

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
          <div className="flex items-center gap-2 text-sm" role="group" aria-label={t.chat.confirmClearAria}>
            <span className="text-ink-muted">{t.chat.clearPrompt}</span>
            <button
              type="button"
              onClick={confirmClear}
              className="font-semibold text-red-600 dark:text-red-400 hover:underline px-1.5 py-1 rounded-lg"
            >
              {t.chat.clearConfirm}
            </button>
            <button
              type="button"
              onClick={() => setConfirmingClear(false)}
              className="text-ink-muted hover:text-ink px-1.5 py-1 rounded-lg hover:bg-edge/60 transition-colors"
            >
              {t.chat.cancel}
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
            {t.chat.newChat}
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
                      {guidedBefore}<span className="font-semibold text-ink">{lens.name}</span>{guidedAfter}
                      {' · '}{t.chat.config.modes[prefs.modeId].name}{' · '}{t.chat.config.replyLanguages[effectiveLanguageId].name}
                    </span>
                    <button
                      type="button"
                      onClick={() => setSettingsOpen(true)}
                      className="font-semibold text-accent-text hover:underline"
                    >
                      {t.chat.change}
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
            {t.chat.latest}
          </button>
        )}
      </div>

      {(context || contextError) && (
        <div className="flex justify-center px-4 pb-2 bg-surface shrink-0">
          {context ? (
            <ContextChip context={context} onDismiss={() => updateContext(null)} />
          ) : (
            <p role="alert" className="flex items-center gap-2 text-xs text-red-600 dark:text-red-400">
              {t.errors.contextLoad}
              <button type="button" onClick={() => setContextError(false)} className="underline font-semibold">
                {t.chat.dismiss}
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
        effectiveLanguageId={effectiveLanguageId}
        onSelectLens={selectLens}
        onSelectMode={(modeId) => updatePrefs({ modeId })}
        onSelectLanguage={(languageId) => updatePrefs({ languageId })}
        onClose={() => setSettingsOpen(false)}
      />
    </main>
  );
}
