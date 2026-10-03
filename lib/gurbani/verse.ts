// Normalization for the loosely-shaped verse objects the GurbaniNow API
// returns, as the chat's deep link to an Ang reads them from /api/shabad.
// The Ang and shabad pages read the source through ./gurbaninow's parsers.

export type VerseContent = {
    gurmukhi?: string | { unicode?: string };
    gurbani?: { gurmukhi?: string };
    translation?: { english?: string | { default?: string } };
};

export type AngItem = VerseContent & { line?: VerseContent; verse?: VerseContent };

export function normalizeVerse(item: AngItem): { gurmukhi: string; translation: string } {
    const content = item.line || item.verse || item;
    const g = content.gurmukhi;
    const gurmukhi = (typeof g === 'string' ? g : g?.unicode) || content.gurbani?.gurmukhi || '';
    const eng = content.translation?.english;
    const translation = (typeof eng === 'string' ? eng : eng?.default) || '';
    return { gurmukhi, translation };
}
