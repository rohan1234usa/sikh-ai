// Client-safe, pure: the chat list's sections.

export const CHAT_SECTION_IDS = ['pinned', 'today', 'yesterday', 'week', 'month', 'older'] as const;
export type ChatSectionId = (typeof CHAT_SECTION_IDS)[number];

export type ChatSection<T> = { id: ChatSectionId; chats: T[] };

const DAY_MS = 24 * 60 * 60 * 1000;

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

// Calendar days between two moments in local time. Rounded, because a day
// with a daylight-saving change is 23 or 25 hours long.
function daysAgo(ts: number, now: Date): number {
    return Math.round((startOfDay(now) - startOfDay(new Date(ts))) / DAY_MS);
}

function sectionOf(updatedAt: number, now: Date): Exclude<ChatSectionId, 'pinned'> {
    const days = daysAgo(updatedAt, now);
    if (days <= 0) return 'today'; // including a clock that's ahead
    if (days === 1) return 'yesterday';
    if (days <= 7) return 'week';
    if (days <= 30) return 'month';
    return 'older';
}

// Pinned chats in their own section; the rest by how recently they were used.
// Order within a section is the order given (see sortChats). Empty sections
// are left out.
export function groupChats<T extends { updatedAt: number; pinned: boolean }>(chats: readonly T[], now: Date): ChatSection<T>[] {
    const by = new Map<ChatSectionId, T[]>(CHAT_SECTION_IDS.map((id) => [id, []]));
    for (const chat of chats) by.get(chat.pinned ? 'pinned' : sectionOf(chat.updatedAt, now))!.push(chat);
    return CHAT_SECTION_IDS.filter((id) => by.get(id)!.length > 0).map((id) => ({ id, chats: by.get(id)! }));
}
