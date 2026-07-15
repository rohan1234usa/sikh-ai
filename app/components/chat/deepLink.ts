// Deep-link capture for /chat?context=hukamnama and /chat?context=shabad&ang=N.
// The URL carries only a small token; the actual passage text is fetched from
// our own API proxies and stored as ChatContext.

import {
    MAX_CONTEXT_TEXT_CHARS,
    MAX_CONTEXT_TITLE_CHARS,
    type ChatContext,
} from '@/lib/chat/config';
import { normalizeVerse, type AngItem } from '@/lib/gurbani/verse';
import type { Dictionary } from '@/lib/i18n';
import { fmt } from '@/lib/i18n/fmt';

export type DeepLink = { type: 'hukamnama' } | { type: 'shabad'; ang: number };

export function parseDeepLink(search: string): DeepLink | null {
    const params = new URLSearchParams(search);
    const context = params.get('context');
    if (context === 'hukamnama') return { type: 'hukamnama' };
    if (context === 'shabad') {
        const raw = params.get('ang') ?? '';
        if (!/^\d+$/.test(raw)) return null;
        const ang = parseInt(raw, 10);
        if (ang < 1 || ang > 1430) return null;
        return { type: 'shabad', ang };
    }
    return null;
}

function normalizeLine(item: AngItem): string {
    const { gurmukhi, translation } = normalizeVerse(item);
    return [gurmukhi, translation].filter(Boolean).join('\n');
}

function buildContext(type: ChatContext['type'], title: string, text: string): ChatContext {
    return {
        type,
        title: title.slice(0, MAX_CONTEXT_TITLE_CHARS),
        text: text.slice(0, MAX_CONTEXT_TEXT_CHARS),
        capturedAt: Date.now(),
    };
}

// The dictionary composes the context title in the current site language —
// the chip renders it verbatim, so a hardcoded English title would produce a
// mixed-language chip in the Punjabi UIs.
export async function fetchChatContext(link: DeepLink, t: Dictionary): Promise<ChatContext> {
    if (link.type === 'hukamnama') {
        const res = await fetch('/api/hukamnama');
        if (!res.ok) throw new Error('Failed to load the Hukamnama');
        const data = (await res.json()) as { title?: string; text?: string; ang?: number | null };
        if (!data.text) throw new Error('Hukamnama unavailable');
        const title = typeof data.ang === 'number'
            ? `${t.hukamnama.title} — ${fmt(t.hukamnama.ang, { n: data.ang })}`
            : t.hukamnama.title;
        return buildContext('hukamnama', title, data.text);
    }

    const res = await fetch(`/api/shabad?query=${link.ang}`);
    if (!res.ok) throw new Error('Failed to load that Ang');
    const data = await res.json();
    const page: AngItem[] = Array.isArray(data?.page) ? data.page : [];
    const lines = page.map(normalizeLine).filter(Boolean);
    if (lines.length === 0) throw new Error('Ang unavailable');
    return buildContext('shabad', `${fmt(t.shabad.angLabel, { n: link.ang })} — ${t.shabad.granth}`, lines.join('\n\n'));
}
