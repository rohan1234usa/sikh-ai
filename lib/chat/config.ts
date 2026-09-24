// Client-safe chat configuration: IDs, whitelist guards, size caps, and the
// shape of the per-language display copy. Display strings live in the i18n
// dictionaries (lib/i18n/dictionaries/*) keyed by these IDs; system-prompt
// text is server-only in lib/chat/prompts.ts. The shared Record types keep
// all of them in lockstep — a lens missing from a translation is a compile
// error.

import type { Lang } from '@/lib/i18n/config';

export const LENS_IDS = [
    'sikhai',
    'guru-nanak',
    'guru-angad',
    'guru-amar-das',
    'guru-ram-das',
    'guru-arjan',
    'guru-hargobind',
    'guru-har-rai',
    'guru-har-krishan',
    'guru-tegh-bahadur',
    'guru-gobind-singh',
] as const;
export type LensId = (typeof LENS_IDS)[number];

export const MODE_IDS = ['balanced', 'simple', 'gurbani-first', 'vichaar', 'sakhi'] as const;
export type ModeId = (typeof MODE_IDS)[number];

export const LANGUAGE_IDS = ['english', 'bilingual', 'punjabi'] as const;
export type LanguageId = (typeof LANGUAGE_IDS)[number];

export const TOPIC_PACK_IDS = ['life', 'hardship', 'concepts', 'history', 'practice'] as const;
export type TopicPackId = (typeof TOPIC_PACK_IDS)[number];

// Preferred Punjabi script, sent alongside languageId when the site UI is
// set to a Punjabi variant so 'punjabi' replies default to the right script.
export const SCRIPTS = ['gurmukhi', 'latin'] as const;
export type Script = (typeof SCRIPTS)[number];

export type ChatContext = {
    type: 'hukamnama' | 'shabad';
    title: string;
    text: string;
    capturedAt: number;
};

// Per-language chat display copy. Each i18n dictionary provides one of these
// under chat.config; the Record types force every lens/mode/pack to exist in
// every translation.
export type LensCopy = {
    name: string;
    ordinal?: string;
    tagline: string;
    greeting: string;
    starterPrompts: string[];
};

export type ChatCopy = {
    lenses: Record<LensId, LensCopy>;
    modes: Record<ModeId, { name: string; description: string }>;
    replyLanguages: Record<LanguageId, { name: string; description: string }>;
    topicPacks: Record<TopicPackId, { label: string; prompts: string[] }>;
    contextStarters: Record<ChatContext['type'], string[]>;
};

export const DEFAULT_PREFS = {
    lensId: 'sikhai',
    modeId: 'balanced',
    languageId: 'english',
} as const satisfies { lensId: LensId; modeId: ModeId; languageId: LanguageId };

// Size caps shared by the API route (authoritative) and the client (courtesy
// pre-truncation before a context is stored/sent).
export const MAX_MESSAGE_CHARS = 4000;
export const MAX_CONTEXT_TITLE_CHARS = 200;
export const MAX_CONTEXT_TEXT_CHARS = 8000;

// Saved chats. A reply is capped at 4,096 output tokens (~14,000 characters of
// English); 40,000 leaves room for Punjabi, which spends more per word, and
// still bounds what storage will accept. The per-chat and pinned caps keep a
// browser's ~5 MB of localStorage able to hold a useful number of chats, and
// guarantee there is always an unpinned chat to make room.
export const MAX_REPLY_CHARS = 40_000;
export const MAX_EXCHANGES_PER_CHAT = 100;
export const MAX_LOCAL_CHATS = 50;
export const MAX_PINNED_CHATS = 10;

// A passage read back from storage or the network: untrusted, rebuilt.
export function sanitizeChatContext(raw: unknown): ChatContext | null {
    if (!raw || typeof raw !== 'object') return null;
    const c = raw as Record<string, unknown>;
    if (c.type !== 'hukamnama' && c.type !== 'shabad') return null;
    if (typeof c.text !== 'string' || c.text.trim() === '') return null;
    return {
        type: c.type,
        title: typeof c.title === 'string' ? c.title.slice(0, MAX_CONTEXT_TITLE_CHARS) : '',
        text: c.text.slice(0, MAX_CONTEXT_TEXT_CHARS),
        capturedAt: typeof c.capturedAt === 'number' && Number.isFinite(c.capturedAt) ? c.capturedAt : 0,
    };
}

export const isLensId = (v: unknown): v is LensId => LENS_IDS.includes(v as LensId);
export const isModeId = (v: unknown): v is ModeId => MODE_IDS.includes(v as ModeId);
export const isLanguageId = (v: unknown): v is LanguageId => LANGUAGE_IDS.includes(v as LanguageId);
export const isScript = (v: unknown): v is Script => SCRIPTS.includes(v as Script);

// The site-wide UI language drives the chat's *default* reply language (a
// stored null pref means "follow the site") and the preferred Punjabi script.
export const siteDefaultLanguageId = (lang: Lang): LanguageId =>
    lang === 'en' ? 'english' : 'punjabi';

export const siteScript = (lang: Lang): Script | undefined =>
    lang === 'pa' ? 'gurmukhi' : lang === 'pa-latn' ? 'latin' : undefined;
