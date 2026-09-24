'use client';

import { useAuth } from '../../context/AuthContext';
import { useT } from '../../context/LanguageContext';
import { useChatHomes } from './useChatHomes';

// /chat/{id} for a chat that isn't here: deleted, saved in another browser
// or account, or a link that was never a chat.
export default function ChatUnavailable({ onNewChat }: { onNewChat: () => void }) {
    const t = useT();
    const { signIn } = useAuth();
    const { cloud, uid } = useChatHomes();
    return (
        <div className="py-16 text-center space-y-3">
            <h2 className="text-lg font-bold text-ink">{t.chat.notFoundHeading}</h2>
            <p className="text-sm text-ink-muted">{t.chat.notFoundBody}</p>
            {cloud && !uid && <p className="text-sm text-ink-muted">{t.chat.notFoundSignIn}</p>}
            <div className="flex flex-wrap justify-center gap-2">
                <button
                    type="button"
                    onClick={onNewChat}
                    className="inline-flex items-center rounded-lg bg-kesri px-4 py-2 text-sm font-bold text-navy transition-colors hover:bg-kesri-hover"
                >
                    {t.chat.newChat}
                </button>
                {cloud && !uid && (
                    <button
                        type="button"
                        onClick={() => void signIn()}
                        className="inline-flex items-center rounded-lg border border-edge px-4 py-2 text-sm font-semibold text-ink transition-colors hover:bg-edge/60"
                    >
                        {t.nav.signIn}
                    </button>
                )}
            </div>
        </div>
    );
}
