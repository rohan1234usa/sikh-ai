'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { PaperAirplaneIcon } from '@heroicons/react/24/solid';
import ReactMarkdown from 'react-markdown';

type Message = {
  role: 'user' | 'ai';
  text: string;
  isError?: boolean;
};

export default function ChatPage() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    { role: 'ai', text: 'Waheguru Ji Ka Khalsa, Waheguru Ji Ki Fateh. How can I help you learn about Sikhism today?' }
  ]);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  useEffect(() => { scrollToBottom() }, [messages]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMsg: Message = { role: 'user', text: input };

    // Optimistic UI update
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      // Send the NEW message + the HISTORY (excluding the hardcoded initial greeting at index 0)
      // This prevents "Double Greetings" in the LLM context.
      const historyPayload = messages.slice(1);

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMsg.text,
          history: historyPayload
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Something went wrong");
      }

      setMessages((prev) => [...prev, { role: 'ai', text: data.text }]);
    } catch (error: any) {
      setMessages((prev) => [
        ...prev,
        { role: 'ai', text: `Error: ${error.message}`, isError: true }
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex flex-col h-screen bg-offwhite font-sans">
      <nav className="bg-navy text-white p-4 shadow-md flex justify-between items-center shrink-0">
        <Link href="/" className="flex items-center gap-2 hover:text-kesri transition font-bold">
          <span className="text-kesri">←</span> Home
        </Link>
        <div className="text-center">
          <h1 className="font-bold">Sikh AI Chat</h1>
          <p className="text-xs text-slate-400">Powered by Gemini</p>
        </div>
        <div className="w-16"></div>
      </nav>

      <div className="flex-grow overflow-y-auto p-4 md:p-8 space-y-6">
        {messages.map((msg, index) => (
          <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] md:max-w-[75%] p-4 rounded-2xl shadow-sm text-sm md:text-base leading-relaxed ${msg.role === 'user'
                  ? 'bg-navy text-white rounded-br-none'
                  : msg.isError
                    ? 'bg-red-50 border border-red-200 text-red-600 rounded-bl-none'
                    : 'bg-white border border-slate-200 text-slate-800 rounded-bl-none'
                }`}
            >
              {/* MARKDOWN RENDERER */}
              <ReactMarkdown
                components={{
                  strong: ({ node, ...props }) => <span className="font-bold" {...props} />,
                  ul: ({ node, ...props }) => <ul className="list-disc pl-4 space-y-2 my-2" {...props} />,
                  ol: ({ node, ...props }) => <ol className="list-decimal pl-4 space-y-2 my-2" {...props} />,
                  p: ({ node, ...props }) => <p className="mb-2 last:mb-0" {...props} />,
                  blockquote: ({ node, ...props }) => (
                    <blockquote className="border-l-4 border-kesri/40 pl-3 py-1 my-2 text-slate-500 italic bg-slate-50 rounded-r" {...props} />
                  ),
                }}
              >
                {msg.text}
              </ReactMarkdown>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start animate-pulse">
            <div className="bg-slate-200 h-10 w-24 rounded-full flex items-center justify-center text-xs text-slate-500">
              Thinking...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 bg-white border-t border-slate-200 shrink-0">
        <form onSubmit={sendMessage} className="max-w-4xl mx-auto relative flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question..."
            className="w-full p-4 pr-14 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-kesri text-slate-800"
          />
          <button
            type="submit"
            disabled={loading}
            className="absolute right-2 top-2 bottom-2 bg-kesri text-navy hover:bg-navy hover:text-white p-3 rounded-lg transition-all disabled:opacity-50"
          >
            <PaperAirplaneIcon className="w-5 h-5" />
          </button>
        </form>
      </div>
    </main>
  );
}