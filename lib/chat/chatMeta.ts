// Client-safe, pure: what the chat list knows about each chat, and the rules
// for its ids, titles and order.

export type ChatHome = 'local' | 'account';

// A chat's public snapshot link, if it has one (lib/chat/share.ts).
// lastOrder: the newest entry the snapshot includes, to tell whether the
// chat has moved on since.
export type ShareRef = { id: string; createdAt: number; updatedAt: number; lastOrder: number };

export type ChatMeta = {
    id: string;
    title: string;
    // 'auto' titles come from the first question; a rename makes it 'user'.
    titleSource: 'auto' | 'user';
    createdAt: number;
    // Last activity (a question asked or retried). Renaming, pinning and
    // sharing leave it alone, so they don't reshuffle the list.
    updatedAt: number;
    pinned: boolean;
    share: ShareRef | null;
};

// Ids are UUIDs, or `legacy-…` for the chat carried over from the old
// single-chat storage. Checked before an id from a URL reaches any store.
export const CHAT_ID_RE = /^[A-Za-z0-9_-]{8,64}$/;
export const isChatId = (v: unknown): v is string => typeof v === 'string' && CHAT_ID_RE.test(v);

export const AUTO_TITLE_CHARS = 60;
export const MAX_CHAT_TITLE_CHARS = 120;

// /chat is a new, blank chat; /chat/{id} a saved one. Anything else under
// /chat is a link that can't be a chat.
export function chatIdFromPath(pathname: string): string | null | 'invalid' {
    const path = pathname.replace(/\/+$/, '');
    if (path === '/chat') return null;
    const m = /^\/chat\/([^/]+)$/.exec(path);
    if (!m) return 'invalid';
    let id: string;
    try {
        id = decodeURIComponent(m[1]);
    } catch {
        return 'invalid';
    }
    return isChatId(id) ? id : 'invalid';
}

// Grapheme clusters, so a cut never splits a Gurmukhi letter from its vowel
// sign, or an emoji in half.
function graphemes(s: string): string[] {
    if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
        return Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(s), (x) => x.segment);
    }
    return Array.from(s);
}

function clip(s: string, max: number): string {
    const g = graphemes(s);
    if (g.length <= max) return s;
    const cut = g.slice(0, max).join('');
    // Prefer ending on a whole word, unless that throws most of it away.
    const space = cut.lastIndexOf(' ');
    return `${(space >= cut.length * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

const collapse = (s: string) => s.replace(/\s+/g, ' ').trim();

// The first line of the first question, shortened.
export function deriveTitle(question: string): string {
    const line = question.split('\n').map(collapse).find(Boolean) ?? '';
    return clip(line, AUTO_TITLE_CHARS);
}

// A title the user typed; '' means "go back to the automatic one".
export function sanitizeTitle(s: string): string {
    return clip(collapse(s), MAX_CHAT_TITLE_CHARS);
}

// Pinned first, then most recent. The id settles ties, so every tab and device
// lists the same chats in the same order.
export function sortChats<T extends Pick<ChatMeta, 'id' | 'pinned' | 'updatedAt'>>(chats: readonly T[]): T[] {
    return [...chats].sort((a, b) =>
        Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export function sanitizeShareRef(raw: unknown): ShareRef | null {
    if (!raw || typeof raw !== 'object') return null;
    const o = raw as Record<string, unknown>;
    if (!isChatId(o.id) || !isNum(o.createdAt) || !isNum(o.updatedAt) || !isNum(o.lastOrder)) return null;
    return { id: o.id, createdAt: o.createdAt, updatedAt: o.updatedAt, lastOrder: o.lastOrder };
}

// Meta read back from storage: untrusted, so rebuilt field by field.
export function sanitizeMeta(raw: unknown, idFallback?: string): ChatMeta | null {
    if (!raw || typeof raw !== 'object') return null;
    const o = raw as Record<string, unknown>;
    const id = isChatId(o.id) ? o.id : idFallback && isChatId(idFallback) ? idFallback : null;
    if (!id) return null;
    const createdAt = isNum(o.createdAt) ? o.createdAt : 0;
    const title = typeof o.title === 'string' ? sanitizeTitle(o.title) : '';
    return {
        id,
        title,
        titleSource: o.titleSource === 'user' && title ? 'user' : 'auto',
        createdAt,
        updatedAt: isNum(o.updatedAt) ? o.updatedAt : createdAt,
        pinned: o.pinned === true,
        share: sanitizeShareRef(o.share),
    };
}
