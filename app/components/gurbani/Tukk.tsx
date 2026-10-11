import type { ReactNode } from 'react';
import type { LineKind } from '@/lib/gurbani/shabad';

// One line the way every page sets it (docs/design/pothi.md, "the tukk"): the
// Gurmukhi, then its romanization and its meaning, each tagged with its own
// language. Hook-free and server-safe; it imports only a type, never the
// GurbaniNow client, so the chat's citations can use it in the browser.
//
//   voice  'source' for GurbaniNow's text: Gurbani in Tiro (never bold), the
//          romanization faint, the meaning in italics. 'learn' for everyday
//          Punjabi: the romanization leads, and the meaning isn't italic.
//   size   'display' for the Hukamnama, 'page' for a shabad or an Ang (and a
//          lesson's examples), 'list' for search results, 'compact' inside
//          something else (a citation).
//   kind   a verse, or the mangal and headings above it, set smaller.
//
// The Latin lines carry font-sans: on a Punjabi page the body's face leads
// with Gurmukhi, and a transliteration or translation should still read in
// Newsreader. TukkLines is the lines alone, with no element of its own, for a
// caller that owns the one around them (ShabadVerse's anchored line, whose
// markup tests/gurbani/shabad-page.test.ts pins: lang comes first on each
// line, and a heading's classes never contain "text-2xl").

export type TukkSize = 'display' | 'page' | 'list' | 'compact';
export type TukkVoice = 'source' | 'learn';

export type TukkLinesProps = {
    gurmukhi: ReactNode;
    transliteration?: ReactNode;
    translation?: ReactNode;
    kind?: LineKind;
    size?: TukkSize;
    voice?: TukkVoice;
};

const GURMUKHI_SIZE: Record<TukkSize, { verse: string; heading: string }> = {
    display: { verse: 'text-2xl md:text-4xl', heading: 'text-lg md:text-xl' },
    page: { verse: 'text-2xl md:text-3xl', heading: 'text-lg md:text-xl' },
    list: { verse: 'text-xl sm:text-2xl', heading: 'text-lg' },
    compact: { verse: 'text-lg', heading: 'text-base' },
};

const LATIN_SIZE: Record<TukkSize, { transliteration: string; translation: string }> = {
    display: { transliteration: 'text-sm md:text-base', translation: 'text-base md:text-lg' },
    page: { transliteration: 'text-sm md:text-base', translation: 'text-base md:text-lg' },
    list: { transliteration: 'text-sm', translation: 'text-base' },
    compact: { transliteration: 'text-xs', translation: 'text-sm' },
};

// The classes, for a caller that lays the three out its own way (the
// translator's labelled rows).
export function tukkClasses(size: TukkSize = 'page', voice: TukkVoice = 'source', kind: LineKind = 'verse') {
    const heading = kind !== 'verse';
    const g = GURMUKHI_SIZE[size];
    const l = LATIN_SIZE[size];
    return {
        gurmukhi: `font-gurmukhi leading-relaxed ${heading ? `${g.heading} text-ink-muted` : `${g.verse} text-ink`}`,
        transliteration: voice === 'learn'
            ? 'font-sans font-medium text-ink'
            : `font-sans ${l.transliteration} text-ink-faint`,
        translation: voice === 'learn'
            ? 'font-sans text-sm text-ink-muted'
            : `font-sans ${l.translation} italic text-ink-muted`,
    };
}

export function TukkLines({ gurmukhi, transliteration, translation, kind = 'verse', size = 'page', voice = 'source' }: TukkLinesProps) {
    const c = tukkClasses(size, voice, kind);
    const gap = voice === 'learn' ? 'mt-0.5' : size === 'compact' ? 'mt-1' : 'mt-2';
    return (
        <>
            <p lang="pa" className={c.gurmukhi}>{gurmukhi}</p>
            {transliteration ? <p lang="pa-Latn" className={`${gap} ${c.transliteration}`}>{transliteration}</p> : null}
            {translation ? <p lang="en" className={`${gap} ${c.translation}`}>{translation}</p> : null}
        </>
    );
}

// The lines in a block of their own, centred or not, with room after them for
// what belongs to the line: a meta line, a link, a copy button.
export default function Tukk({ align = 'center', className = '', children, ...lines }: TukkLinesProps & {
    align?: 'center' | 'start';
    className?: string;
    children?: ReactNode;
}) {
    return (
        <div className={`${align === 'center' ? 'text-center' : 'text-start'} ${className}`}>
            <TukkLines {...lines} />
            {children}
        </div>
    );
}
