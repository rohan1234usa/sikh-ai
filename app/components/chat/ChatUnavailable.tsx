'use client';

import { useT } from '../../context/LanguageContext';

// /chat/{id} for a chat that isn't here: deleted, saved in another browser,
// or a link that was never a chat.
export default function ChatUnavailable({ onNewChat }: { onNewChat: () => void }) {
    const t = useT();
    return (
        <div className="py-16 text-center space-y-3">
            <h2 className="text-lg font-bold text-ink">{t.chat.notFoundHeading}</h2>
            <p className="text-sm text-ink-muted">{t.chat.notFoundBody}</p>
            <button
                type="button"
                onClick={onNewChat}
                className="inline-flex items-center rounded-lg bg-kesri px-4 py-2 text-sm font-bold text-navy transition-colors hover:bg-kesri-hover"
            >
                {t.chat.newChat}
            </button>
        </div>
    );
}
